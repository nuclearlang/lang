// The WebSocket side of HTTP Connections without `vscode`, so the tests drive it: what the contract says is served
// over WebSockets (ADR-synapsis-0008; absent = HTTP only), the frames, the urls, the message log and the history of
// sent messages, and the connection itself (the extension host's, never the webview's). The functions marked "page"
// are also inlined into the WebSocket page (socketPanel.ts) by their source, so they must not use anything outside
// their own body.

import type { Api, Contract } from './httpConnections';

export type Protocol = 'http' | 'websocket';

/** A message of the log: received (`in`), sent (`out`), or a line of the connection (`info`, `error`). */
export interface LogEntry {
  at: number;
  dir: 'in' | 'out' | 'info' | 'error';
  text: string;
}

/** A topic the app publishes, as the contract's `events` lists it. */
export interface SocketEvent {
  topic: string;
  component: string;
  payload: string;
  fields?: string[];
}

// ---------- the contract (nuclearlang/docs/07-reference/projects.md §1.2) ----------

/** A controller's `transports` (`["http"]` or `["http", "websocket"]`); absent: HTTP only. */
export function transportsOf(api: Api): Set<Protocol> {
  const t = (api as { transports?: unknown }).transports;
  const out = Array.isArray(t) ? t.filter((x): x is Protocol => x === 'http' || x === 'websocket') : [];
  return new Set(out.length ? out : ['http']);
}

/** The contract's `events`: each topic with the component that publishes it and its payload. */
export function eventsOf(contract?: Contract): SocketEvent[] {
  const raw = (contract as { events?: unknown } | undefined)?.events;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, { component?: unknown; payload?: unknown; fields?: unknown }>).map(([topic, e]) => ({
    topic,
    component: typeof e?.component === 'string' && e.component ? e.component : 'shared',
    payload: typeof e?.payload === 'string' ? e.payload : 'any',
    fields: Array.isArray(e?.fields) ? e.fields.map(String) : undefined,
  }));
}

/** The path of the app's WebSocket (`webSocket`), or undefined when it has none. */
export function socketPathOf(contract?: Contract): string | undefined {
  const p = (contract as { webSocket?: unknown } | undefined)?.webSocket;
  return typeof p === 'string' && p ? (p.startsWith('/') ? p : '/' + p) : undefined;
}

/** The headers the token guards read, the app's then the controller's (ADR-synapsis-0007), each with the value to
 * fill: `Authorization` carries `Bearer <token>`. */
export function guardHeadersOf(contract: Contract | undefined, api?: Api): [string, string][] {
  const out: [string, string][] = [];
  for (const owner of [contract, api]) {
    const guards = (owner as { guards?: unknown } | undefined)?.guards;
    if (!Array.isArray(guards)) continue;
    for (const g of guards as { guard?: unknown; header?: unknown }[]) {
      if (g?.guard !== 'token') continue;
      const header = typeof g.header === 'string' && g.header ? g.header : 'Authorization';
      if (out.some(([h]) => h.toLowerCase() === header.toLowerCase())) continue;
      out.push([header, header.toLowerCase() === 'authorization' ? 'Bearer {{token}}' : '{{token}}']);
    }
  }
  return out;
}

/** The frame that calls a route over the socket: a full HTTP request through the app (its guards apply). */
export function routeMessage(method: string, path: string, body?: unknown): string {
  const m: Record<string, unknown> = { id: 1, method: method.toUpperCase(), path, headers: {} };
  if (body !== undefined) m.body = body;
  return JSON.stringify(m, null, 2);
}

/** The frame that subscribes to a topic the app publishes. */
export function subscribeMessage(topic: string): string {
  return JSON.stringify({ subscribe: topic }, null, 2);
}

/** The frame that stops a subscription. */
export function unsubscribeMessage(topic: string): string {
  return JSON.stringify({ unsubscribe: topic }, null, 2);
}

// ---------- urls ----------

/** `{{name}}` replaced by the environment's variable; an unknown one stays as written. */
export function resolveVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g, (all, name: string) => vars[name] ?? all);
}

/** A socket url from a base and a path: the base's http(s) becomes ws(s). */
export function socketUrl(base: string, path: string): string {
  return toSocketScheme(base.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path));
}

export function toSocketScheme(url: string): string {
  return url.replace(/^http(s?):\/\//i, 'ws$1://');
}

/** Why a resolved url cannot be opened (a `{{var}}` the environment lacks, another scheme, not a url), or undefined. */
export function badSocketUrl(url: string): 'variable' | 'scheme' | 'url' | undefined {
  if (/\{\{[^}]*\}\}/.test(url)) return 'variable';
  try {
    const u = new URL(url);
    return u.protocol === 'ws:' || u.protocol === 'wss:' ? undefined : 'scheme';
  } catch {
    return 'url';
  }
}

// ---------- the log and the history (page) ----------

/** The log with `entry` at the end, keeping the last `max`. */
export function appendLog(log: LogEntry[], entry: LogEntry, max: number): LogEntry[] {
  const out = log.concat([entry]);
  return out.length > max ? out.slice(out.length - max) : out;
}

/** The entries of `dir` (`all`, `in`, `out`) whose text holds `query` (any case). */
export function filterLog(log: LogEntry[], query: string, dir: string): LogEntry[] {
  const q = query.trim().toLowerCase();
  return log.filter((e) => (dir === 'all' || e.dir === dir) && (!q || e.text.toLowerCase().includes(q)));
}

/** A message for reading: JSON objects and lists pretty-printed, anything else as it came. */
export function prettyMessage(text: string): { json: boolean; text: string } {
  try {
    const v = JSON.parse(text);
    if (v !== null && typeof v === 'object') return { json: true, text: JSON.stringify(v, null, 2) };
  } catch {
    // not JSON: shown as text
  }
  return { json: false, text };
}

/** The sent messages, newest first, without repeats, at most `max`. */
export function pushHistory(history: string[], text: string, max: number): string[] {
  return [text].concat(history.filter((h) => h !== text)).slice(0, max);
}

/** Why `text` cannot be sent as `format` (`json` or `text`), or an empty string. */
export function messageProblem(text: string, format: string): string {
  if (!text.trim()) return 'empty';
  if (format !== 'json') return '';
  try {
    JSON.parse(text);
    return '';
  } catch (e) {
    return String((e as Error).message);
  }
}

// ---------- the connection ----------

export interface SocketEvents {
  open(): void;
  message(text: string): void;
  close(code: number, reason: string): void;
  error(message: string): void;
}

type NodeWebSocket = {
  readyState: number;
  binaryType: string;
  send(data: string): void;
  close(code?: number): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: ((e: { code: number; reason: string }) => void) | null;
  onerror: ((e: { message?: string; error?: unknown }) => void) | null;
};

/**
 * One socket, opened by the extension host with Node's `WebSocket` (which sends the headers and no `Origin`, so a
 * guard that refuses an `Origin` lets the tool in).
 * shortcut: needs Node 22's global WebSocket (VS Code 1.101+); on an older editor `open` reports it as an error.
 */
export class SocketConnection {
  private ws?: NodeWebSocket;

  constructor(private readonly on: SocketEvents) {}

  /** Whether this Node has a WebSocket client (Node 22: VS Code 1.101 or newer). */
  static get available(): boolean {
    return typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'function';
  }

  get open(): boolean {
    return this.ws?.readyState === 1;
  }

  connect(url: string, headers: Record<string, string>): void {
    this.close();
    const Ctor = (globalThis as { WebSocket?: new (url: string, init: unknown) => NodeWebSocket }).WebSocket;
    if (!Ctor) return this.on.error('no WebSocket client in this Node');
    let ws: NodeWebSocket;
    try {
      ws = new Ctor(url, { headers });
    } catch (e) {
      return this.on.error(String((e as Error).message ?? e));
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onopen = () => this.on.open();
    ws.onmessage = (e) => this.on.message(typeof e.data === 'string' ? e.data : `[binary, ${(e.data as ArrayBuffer).byteLength} bytes]`);
    // undici gives no reason (a refused handshake is a bare TypeError): an empty message, which the panel words
    ws.onerror = (e) => this.on.error(e.message || (e.error as Error | undefined)?.message || '');
    ws.onclose = (e) => {
      if (this.ws === ws) this.ws = undefined;
      this.on.close(e.code, e.reason);
    };
  }

  send(text: string): boolean {
    if (!this.open) return false;
    this.ws!.send(text);
    return true;
  }

  close(): void {
    const ws = this.ws;
    this.ws = undefined;
    if (ws && ws.readyState < 2) ws.close(1000);
  }
}
