// Tests: the app with the databases in SQLite in memory (SYNAPSIS_DATABASE=memory) and `inject` working.
import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { currentApp, register, useApp } from './app.js';
import { AppError } from './errors.js';
import { Err, Ok, Result } from './result.js';
import { Connection } from './config.js';
import { configureApp } from './web.js';

export async function startTestApp(module: Type<unknown>): Promise<INestApplication> {
  // read by Database.sequelize() when the app module asks for its options (forRootAsync)
  process.env.SYNAPSIS_DATABASE = 'memory';
  const ref = await Test.createTestingModule({ imports: [module] }).compile();
  const app = configureApp(ref.createNestApplication({ logger: false, bodyParser: false }));
  await app.init();
  useApp(app);
  return app;
}

export async function stopTestApp(app: INestApplication | undefined): Promise<void> {
  await app?.close();
  useApp(undefined);
}

/** Puts `connection` in the app's connections (a FakeModel instead of the configured model). */
export function useConnection(c: Connection): void {
  register(c);
}

// ---------- the app over HTTP and its WebSocket, from a test (ADR-synapsis-0010) ----------

/** What the app answered: its `status` and its `body` (JSON, or the text). */
export class HttpAnswer {
  constructor(
    readonly status: number,
    readonly body: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {}
}

/** An event the app pushed: its `topic` and its `data`. */
export class SocketEvent {
  constructor(
    readonly topic: string,
    readonly data: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {}
}

function parse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** What a request sends: Nuclear's named arguments `body = ...`, `headers = {...}`. */
export interface Sent {
  body?: unknown;
  headers?: Record<string, string>;
}

type Raw = { on(e: string, f: (...a: any[]) => void): void; send(d: string): void; close(): void }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** A client of the app's WebSocket: requests answered as over HTTP, subscriptions, and the events pushed to it. */
export class AppSocket {
  private next_ = 0;
  private readonly answers = new Map<number, HttpAnswer>();
  private readonly events: SocketEvent[] = [];
  private wake: (() => void) | null = null;

  constructor(private readonly raw: Raw) {
    raw.on('message', (data: unknown) => {
      const frame = JSON.parse(String(data)) as { id?: number; status?: number; body?: unknown; event?: string; data?: unknown };
      if (frame.event !== undefined) this.events.push(new SocketEvent(frame.event, frame.data));
      else this.answers.set(Number(frame.id), new HttpAnswer(Number(frame.status), frame.body ?? null));
      this.wake?.();
    });
  }

  private async until(ready: () => boolean, seconds: number): Promise<boolean> {
    const end = Date.now() + seconds * 1000;
    while (!ready()) {
      const left = end - Date.now();
      if (left <= 0) return false;
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, left);
        this.wake = () => (clearTimeout(t), resolve());
      });
      this.wake = null;
    }
    return true;
  }

  /** A request frame and its answer (the events that arrive meanwhile are kept for `next`). */
  async request(method: string, path: string, options: Sent = {}): Promise<HttpAnswer> {
    const { body, headers = {} } = options;
    const id = ++this.next_;
    this.raw.send(JSON.stringify({ id, method: method.toUpperCase(), path, headers, ...(body !== undefined && body !== null ? { body } : {}) }));
    if (!(await this.until(() => this.answers.has(id), 5))) throw new AppError(`${method} ${path}: no answer over the socket`, 504);
    const answer = this.answers.get(id)!;
    this.answers.delete(id);
    return answer;
  }

  async subscribe(topic: string): Promise<void> {
    this.raw.send(JSON.stringify({ subscribe: topic }));
  }

  async unsubscribe(topic: string): Promise<void> {
    this.raw.send(JSON.stringify({ unsubscribe: topic }));
  }

  /** The next event pushed to this socket, or null when none comes in `seconds`. */
  async next(options: { seconds?: number } = {}): Promise<SocketEvent | null> {
    const seconds = options.seconds ?? 2;
    return (await this.until(() => this.events.length > 0, seconds)) ? this.events.shift()! : null;
  }

  async close(): Promise<void> {
    this.raw.close();
  }
}

/** The app of the test over HTTP and over its WebSocket (`appClient()`): it listens on a free port of 127.0.0.1. */
export class AppClient {
  private base = '';

  private async url(): Promise<string> {
    if (this.base) return this.base;
    const app = currentApp();
    if (!app) throw new AppError('appClient(): the app is not running', 500);
    const server = app.getHttpServer() as { listening?: boolean; address(): AddressInfo | string | null };
    if (!server.listening) await app.listen(0, '127.0.0.1');
    this.base = `127.0.0.1:${(server.address() as AddressInfo).port}`;
    return this.base;
  }

  async request(method: string, path: string, options: Sent = {}): Promise<HttpAnswer> {
    const { body, headers = {} } = options;
    const json = body !== undefined && body !== null;
    const r = await fetch(`http://${await this.url()}${path}`, {
      method: method.toUpperCase(),
      headers: { ...headers, ...(json ? { 'content-type': 'application/json' } : {}) },
      body: json ? JSON.stringify(body) : undefined,
    });
    return new HttpAnswer(r.status, parse(await r.text()));
  }

  get(path: string, options: { headers?: Record<string, string> } = {}): Promise<HttpAnswer> {
    return this.request('GET', path, options);
  }

  post(path: string, options: Sent = {}): Promise<HttpAnswer> {
    return this.request('POST', path, options);
  }

  put(path: string, options: Sent = {}): Promise<HttpAnswer> {
    return this.request('PUT', path, options);
  }

  patch(path: string, options: Sent = {}): Promise<HttpAnswer> {
    return this.request('PATCH', path, options);
  }

  delete(path: string, options: { headers?: Record<string, string> } = {}): Promise<HttpAnswer> {
    return this.request('DELETE', path, options);
  }

  /** The app's WebSocket opened with `headers`; `Err` with the status (401, 403) when its guards refuse it. */
  async socket(path = '/ws', options: { headers?: Record<string, string> } = {}): Promise<Result<AppError, AppSocket>> {
    const { headers = {} } = options;
    const { WebSocket } = await import('ws');
    const raw = new WebSocket(`ws://${await this.url()}${path}`, { headers });
    return new Promise((resolve) => {
      raw.on('open', () => resolve(Ok(new AppSocket(raw as unknown as Raw))));
      raw.on('unexpected-response', (_req, res) => {
        resolve(Err(new AppError(res.statusMessage || 'the socket was refused', res.statusCode ?? 403)));
        raw.terminate();
      });
      raw.on('error', (e) => resolve(Err(new AppError(e.message, 500))));
    });
  }
}

/** The test's app over HTTP and its WebSocket. */
export function appClient(): AppClient {
  return new AppClient();
}
