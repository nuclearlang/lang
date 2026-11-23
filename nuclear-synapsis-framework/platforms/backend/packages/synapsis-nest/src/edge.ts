// What every request passes before its route, the same in every dialect (the platform's reference, §2.8):
// - one line in the log per request: `<time> <METHOD> <path> <status> <ms>ms`, the path without its query, never a
//   value the client sent; a 500 also logs its cause (`<time> ERROR <METHOD> <path> <type>: <message>` and the
//   stack), whose message never holds a value of the request (a database error says its code, never its SQL);
// - a body larger than `maxBodySize` answers 413; a body that is not JSON in UTF-8 answers 415;
// - an encoded `/` or `\` in the path matches no route (404); an encoded letter, digit, `-`, `.`, `_` or `~` is
//   the character itself;
// - CORS: a preflight from a listed origin answers 200 with what it may send, from any other origin 403; a listed
//   origin's request is answered with `Access-Control-Allow-Origin`.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { performance } from 'node:perf_hooks';
import { errorBody, reason, type Reason } from './errors.js';

// the platform's defaults (the reference, §2.8): 1 MB for a body or a frame, 100 rows for a page; an app's
// configuration changes them (`maxBodySize`, `maxPageSize`)
export const MAX_BODY_SIZE = 1024 * 1024;
export const MAX_PAGE_SIZE = 100;
export const MAX_DEPTH = 512;
export const INT_MIN = -(2 ** 63);
export const INT_MAX = 2 ** 63; // exclusive: the first double past a 64-bit whole number

/** The running app's limits (configureApp sets them). */
export const limits = { body: MAX_BODY_SIZE, page: MAX_PAGE_SIZE };

const METHODS = 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS';

function now(): string {
  return new Date().toISOString();
}

/** The line of one request (stdout). */
export function logRequest(method: string, path: string, status: number, started: number): void {
  process.stdout.write(`${now()} ${method} ${path} ${status} ${Math.round(performance.now() - started)}ms\n`);
}

/** `<type>: <message>` of an error, with no value a client sent. */
export function said(e: unknown): string {
  if (!(e instanceof Error)) return `${typeof e}: ${String(e)}`;
  const original = (e as { original?: { code?: unknown; sqlState?: unknown; errno?: unknown } }).original;
  if (original && typeof original === 'object') {
    // a database error: its SQL holds the request's values
    const code = original.sqlState ?? original.code ?? original.errno;
    return `${e.name}: ${original.constructor?.name ?? 'error'}${code !== undefined ? ` (code ${String(code)})` : ''}`;
  }
  return `${e.name}: ${e.message}`;
}

/** The cause of a 500 (stderr): the error and its stack, never the values of the request. */
export function logCause(method: string, path: string, e: unknown): void {
  const stack = e instanceof Error && e.stack ? e.stack.split('\n').filter((l) => l.startsWith('    at ')).join('\n') : '';
  process.stderr.write(`${now()} ERROR ${method} ${path} ${said(e)}\n${stack}\n`);
}

/** `application/json` or `application/<x>+json`, in any case, in UTF-8 (no charset, or `utf-8`). */
export function isJson(contentType: string): boolean {
  const [kind = '', ...params] = contentType.split(';');
  const k = kind.trim().toLowerCase();
  if (!(k === 'application/json' || (k.startsWith('application/') && k.endsWith('+json')))) return false;
  for (const p of params) {
    const [name = '', value = ''] = p.split('=');
    if (name.trim().toLowerCase() === 'charset' && !['utf-8', 'utf8'].includes(value.trim().replace(/^"|"$/g, '').toLowerCase())) return false;
  }
  return true;
}

/** A body as it came, read by the body's pipe only for a route that takes one. */
export class RawBody {
  constructor(readonly bytes: Buffer) {}
}

/** A body or a frame that cannot be read: `reasons` say why. */
export class Unreadable extends Error {
  constructor(readonly reasons: Reason[]) {
    super('the JSON cannot be read');
  }
}

const utf8 = new TextDecoder('utf-8', { fatal: true });

/** The JSON value of `raw`: UTF-8; no value deeper than MAX_DEPTH; no text with U+0000 (named by its place). */
export function readJson(raw: Buffer | string): unknown {
  let value: unknown;
  try {
    value = JSON.parse(typeof raw === 'string' ? raw : utf8.decode(raw));
  } catch {
    throw new Unreadable([reason('', 'json')]);
  }
  const stack: [unknown, number, string][] = [[value, 1, '']];
  while (stack.length) {
    const [v, depth, at] = stack.pop()!;
    if (v !== null && typeof v === 'object') {
      if (depth > MAX_DEPTH) throw new Unreadable([reason('', 'json')]);
      for (const [k, item] of Object.entries(v)) {
        if (k.includes('\0')) throw new Unreadable([reason(at, 'invalid')]);
        stack.push([item, depth + 1, at ? `${at}.${k}` : k]);
      }
    } else if (typeof v === 'string' && v.includes('\0')) {
      throw new Unreadable([reason(at, 'invalid')]);
    }
  }
  return value;
}

type Request = IncomingMessage & { body?: unknown; originalUrl?: string };

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { ...headers, 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(data)) });
  res.end(data);
}

// %41 → A: an encoded unreserved character is that character (RFC 3986 §6.2.2.2)
const UNRESERVED = /%(4[1-9A-F]|5[0-9A]|6[1-9A-F]|7[0-9A]|3[0-9]|2D|2E|5F|7E)/gi;

/** The middleware of every Synapsis app (configureApp adds it before the routes). */
export function edge(origins: readonly string[]) {
  const listed = new Set(origins);
  return (req: Request, res: ServerResponse, next: (e?: unknown) => void): void => {
    const started = performance.now();
    const url = req.url ?? '/';
    const q = url.indexOf('?');
    const path = q < 0 ? url : url.slice(0, q);
    let logged = false;
    const log = () => {
      if (logged) return;
      logged = true;
      logRequest(req.method ?? 'GET', path, res.headersSent ? res.statusCode : 500, started);
    };
    res.on('finish', log);
    res.on('close', log);
    if (/%2f|%5c/i.test(path)) return send(res, 404, errorBody(404, 'not found'));
    req.url = path.replace(UNRESERVED, (s) => String.fromCharCode(parseInt(s.slice(1), 16))) + (q < 0 ? '' : url.slice(q));
    const origin = req.headers.origin;
    if (req.method === 'OPTIONS' && origin !== undefined && req.headers['access-control-request-method'] !== undefined) {
      if (!listed.has(origin)) return send(res, 403, errorBody(403, 'origin not allowed'));
      const asked = req.headers['access-control-request-headers'];
      res.writeHead(200, {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': METHODS,
        'access-control-max-age': '1800',
        vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
        'content-length': '0',
        ...(asked ? { 'access-control-allow-headers': asked } : {}),
      });
      res.end();
      return;
    }
    if (origin !== undefined && listed.has(origin)) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
    }
    const length = req.headers['content-length'];
    const chunked = req.headers['transfer-encoding'] !== undefined;
    if (!chunked && (length === undefined || length.trim() === '' || length.trim() === '0')) return next();
    if (!isJson(req.headers['content-type'] ?? '')) return send(res, 415, errorBody(415, 'unsupported media type'));
    if (length !== undefined && /^\d+$/.test(length.trim()) && Number(length) > limits.body) return send(res, 413, errorBody(413, 'content too large'));
    const parts: Buffer[] = [];
    let size = 0;
    let over = false;
    req.on('data', (chunk: Buffer) => {
      if (over) return;
      size += chunk.length;
      if (size > limits.body) {
        over = true;
        send(res, 413, errorBody(413, 'content too large'));
        return;
      }
      parts.push(chunk);
    });
    req.on('end', () => {
      if (over) return;
      req.body = new RawBody(Buffer.concat(parts));
      // read: a parser of the framework left on (an app made without `bodyParser: false`) leaves it as it is
      (req as { _body?: boolean })._body = true;
      next();
    });
    req.on('error', (e) => next(e));
  };
}
