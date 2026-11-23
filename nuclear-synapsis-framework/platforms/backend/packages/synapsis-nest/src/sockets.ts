// The app's WebSocket (ADR-synapsis-0008): `WebSocketServer(path = "ws")` in the configuration serves the same
// controllers over one socket, and sends the events the app publishes to the clients subscribed to them.
//
// The frames are JSON text, the same in every dialect:
//   client → app   {"id": 1, "method": "GET", "path": "/tasks/1", "headers": {...}, "body": ...}
//                  {"subscribe": "tasks.created"}   {"unsubscribe": "tasks.created"}
//   app → client   {"id": 1, "status": 200, "body": ...}
//                  {"event": "tasks.created", "data": ...}
// The upgrade passes the app's guards; each request then goes through the app as an HTTP request with the upgrade's
// headers and its own, so a controller's guards, validation and answers are the HTTP ones.
import type { INestApplication } from '@nestjs/common';
import type { IncomingMessage, Server } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
// ws is loaded when the app starts: a project without the websocket plugin does not need it
import type { WebSocket as Client, WebSocketServer as Wss } from 'ws';
import { performance } from 'node:perf_hooks';
import { AppConfig, Connection } from './config.js';
import { Unreadable, limits, logRequest, readJson } from './edge.js';
import { errorBody } from './errors.js';
import { sinks } from './events.js';
import { headersOf, refusal } from './guards.js';

// the headers that are the socket's, not a request's: never sent from the upgrade nor from a frame
const hop = new Set(['host', 'connection', 'upgrade', 'content-length', 'content-type', 'transfer-encoding', 'keep-alive', 'te', 'trailer']);
// the methods a request frame may have; another is answered 405 without reaching the app
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
const STATUS: Record<number, string> = { 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found' };
const clients = new Map<Client, Set<string>>();

sinks.push(async (topic, data) => {
  const frame = JSON.stringify({ event: topic, data });
  for (const [c, topics] of clients) if (topics.has(topic) && c.readyState === 1) c.send(frame);
});

type Frame = { id?: unknown; method?: string; path?: string; headers?: Record<string, string> | null; body?: unknown; subscribe?: string; unsubscribe?: string };

/** A frame is a JSON object whose `method` and `path` are texts and whose `headers` is an object of texts. */
function isRequest(v: unknown): v is Frame {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const f = v as Record<string, unknown>;
  const h = f.headers;
  return (
    (f.method === undefined || typeof f.method === 'string') &&
    (f.path === undefined || typeof f.path === 'string') &&
    (h === undefined || h === null || (typeof h === 'object' && !Array.isArray(h) && Object.values(h).every((x) => typeof x === 'string')))
  );
}

/** Refuses an upgrade with `status` and the error's body, as an HTTP answer. */
function deny(socket: Socket, status: number, message: string): void {
  const body = JSON.stringify(errorBody(status, message));
  socket.end(`HTTP/1.1 ${status} ${STATUS[status] ?? 'Error'}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
}

function parse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** The app also answers over a WebSocket at `path` (`'ws'` → `/ws`). */
export class WebSocketServer extends Connection {
  readonly path: string;
  private wss?: Wss;

  constructor(options: { path?: string; name?: string } = {}) {
    super();
    this.path = '/' + (options.path ?? 'ws').replace(/^\/+|\/+$/g, '');
    this.name = options.name ?? 'default';
  }

  override instrument(app: unknown): void {
    const nest = app as INestApplication;
    const server = nest.getHttpServer() as Server;
    const guards = nest.get(AppConfig, { strict: false }).guards ?? [];
    server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
      const started = performance.now();
      const path = (req.url ?? '/').split('?')[0]!;
      // an upgrade on a path that is not the socket's: 404, as a request for a route that does not exist
      if (path !== this.path) {
        deny(socket, 404, 'not found');
        return logRequest(req.method ?? 'GET', path, 404, started);
      }
      const e = refusal(guards, headersOf(req));
      if (e) {
        deny(socket, e.status, e.message);
        return logRequest(req.method ?? 'GET', path, e.status, started);
      }
      void this.accept(server, req, socket, head).then(() => logRequest(req.method ?? 'GET', path, 101, started));
    });
  }

  private async accept(server: Server, req: IncomingMessage, socket: Socket, head: Buffer): Promise<void> {
    if (!this.wss) {
      const { WebSocketServer: Server } = await import('ws');
      // a frame larger than the app reads (maxBodySize) closes the socket 1009
      this.wss = new Server({ noServer: true, maxPayload: limits.body });
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.serve(server, req, ws));
  }

  private serve(server: Server, req: IncomingMessage, ws: Client): void {
    const base: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!hop.has(k) && !k.startsWith('sec-websocket') && typeof v === 'string') base[k] = v;
    }
    const topics = new Set<string>();
    clients.set(ws, topics);
    ws.on('close', () => clients.delete(ws));
    // a frame the socket refuses (too large: 1009; not valid UTF-8: 1007) closes it; it never reaches the process
    ws.on('error', () => undefined);
    ws.on('message', (raw, binary) => {
      // a binary frame: the frames are JSON text
      if (binary) return ws.close(1003);
      let frame: unknown;
      try {
        frame = readJson(raw as Buffer);
      } catch (e) {
        if (!(e instanceof Unreadable)) throw e;
        frame = undefined;
      }
      // not JSON, or not an object the protocol knows
      if (!isRequest(frame)) return ws.close(1003);
      if (frame.subscribe !== undefined) topics.add(String(frame.subscribe));
      else if (frame.unsubscribe !== undefined) topics.delete(String(frame.unsubscribe));
      else if (frame.id !== undefined) void this.answer(server, base, frame, ws);
    });
  }

  /** One request through the app itself, over the loopback: the same pipeline as an HTTP request. */
  private async answer(server: Server, base: Record<string, string>, frame: Frame, ws: Client): Promise<void> {
    let reply: { id: unknown; status: number; body: unknown };
    const method = (frame.method ?? 'GET').toUpperCase();
    const path = frame.path ?? '/';
    try {
      const { port } = server.address() as AddressInfo;
      const origin = `http://127.0.0.1:${port}`;
      // only a path of the app itself: never another host, port or scheme
      const url = path.startsWith('/') && !path.startsWith('//') ? new URL(path, origin) : undefined;
      if (!METHODS.has(method)) reply = { id: frame.id, status: 405, body: errorBody(405, 'method not allowed') };
      else if (!url || url.origin !== origin) reply = { id: frame.id, status: 404, body: errorBody(404, 'not found') };
      else {
        // a frame's own headers replace the upgrade's of the same name (the socket's own are never sent)
        const own: Record<string, string> = {};
        for (const [k, v] of Object.entries(frame.headers ?? {})) if (!hop.has(k.toLowerCase())) own[k.toLowerCase()] = v;
        const r = await fetch(url, {
          method,
          headers: { ...base, ...own, ...(frame.body !== undefined ? { 'content-type': 'application/json' } : {}) },
          body: frame.body !== undefined ? JSON.stringify(frame.body) : undefined,
        });
        const text = await r.text();
        reply = { id: frame.id, status: r.status, body: parse(text) };
      }
    } catch {
      reply = { id: frame.id, status: 500, body: errorBody(500, 'error') };
    }
    if (ws.readyState === 1) ws.send(JSON.stringify(reply));
  }

  override async close(): Promise<void> {
    for (const c of clients.keys()) c.terminate();
    this.wss?.close();
  }
}
