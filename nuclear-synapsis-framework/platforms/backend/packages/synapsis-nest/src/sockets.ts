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
import { AppConfig, Connection } from './config.js';
import { sinks } from './events.js';
import { Headers, refusal } from './guards.js';

// the headers of the upgrade that are the socket's, not a request's
const hop = new Set(['host', 'connection', 'upgrade', 'content-length', 'content-type']);
const clients = new Map<Client, Set<string>>();

sinks.push(async (topic, data) => {
  const frame = JSON.stringify({ event: topic, data });
  for (const [c, topics] of clients) if (topics.has(topic) && c.readyState === 1) c.send(frame);
});

type Frame = { id?: unknown; method?: string; path?: string; headers?: Record<string, string>; body?: unknown; subscribe?: string; unsubscribe?: string };

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
      if ((req.url ?? '').split('?')[0] !== this.path) return;
      const e = refusal(guards, req.headers as Headers);
      if (e) {
        socket.end(`HTTP/1.1 ${e.status === 401 ? '401 Unauthorized' : '403 Forbidden'}\r\nConnection: close\r\n\r\n`);
        return;
      }
      void this.accept(server, req, socket, head);
    });
  }

  private async accept(server: Server, req: IncomingMessage, socket: Socket, head: Buffer): Promise<void> {
    if (!this.wss) {
      const { WebSocketServer: Server } = await import('ws');
      this.wss = new Server({ noServer: true });
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
    ws.on('message', (raw) => {
      let frame: Frame;
      try {
        frame = JSON.parse(String(raw)) as Frame;
      } catch {
        ws.close(1003); // a frame that is not JSON
        return;
      }
      if (frame.subscribe !== undefined) topics.add(String(frame.subscribe));
      else if (frame.unsubscribe !== undefined) topics.delete(String(frame.unsubscribe));
      else if (frame.id !== undefined) void this.answer(server, base, frame, ws);
    });
  }

  /** One request through the app itself, over the loopback: the same pipeline as an HTTP request. */
  private async answer(server: Server, base: Record<string, string>, frame: Frame, ws: Client): Promise<void> {
    let reply: { id: unknown; status: number; body: unknown };
    try {
      const { port } = server.address() as AddressInfo;
      const r = await fetch(`http://127.0.0.1:${port}${frame.path ?? '/'}`, {
        method: frame.method ?? 'GET',
        headers: { ...base, ...(frame.headers ?? {}), ...(frame.body !== undefined ? { 'content-type': 'application/json' } : {}) },
        body: frame.body !== undefined ? JSON.stringify(frame.body) : undefined,
      });
      const text = await r.text();
      reply = { id: frame.id, status: r.status, body: parse(text) };
    } catch (e) {
      reply = { id: frame.id, status: 500, body: { message: (e as Error).message } };
    }
    if (ws.readyState === 1) ws.send(JSON.stringify(reply));
  }

  override async close(): Promise<void> {
    for (const c of clients.keys()) c.terminate();
    this.wss?.close();
  }
}
