// Real time (ADR-synapsis-0008) and the host's bridge (ADR-synapsis-0009): the frames of the platform, the
// `WebSocket` connection that carries a repository's calls and what the server pushes, and `Stream<T>`.
//   client → app   {"id": 1, "method": "GET", "path": "/tasks/1", "headers": {...}, "body": ...}
//                  {"subscribe": "tasks.created"}   {"unsubscribe": "tasks.created"}
//   app → client   {"id": 1, "status": 200, "body": ...}   {"event": "tasks.created", "data": ...}
import { HttpInterceptor, HttpRequest, HttpResponse, Transport, parse } from './config.js';
import { HttpError } from './errors.js';

export type Frame = Record<string, unknown>;

/** What a host page gives a mounted app to reach its service: the frames go out with `send` and come back to
 * `onMessage`'s callback (the host forwards them, with its token). */
export interface Bridge {
  send(frame: Frame): void;
  onMessage(on: (frame: Frame) => void): unknown;
}

/** Requests and subscriptions over something that carries frames (a socket, a bridge). */
export class Frames {
  private next = 1;
  private readonly waiting = new Map<number, { resolve: (r: HttpResponse) => void; reject: (e: unknown) => void }>();
  private readonly topics = new Map<string, Set<(data: unknown) => void>>();

  constructor(private readonly out: (frame: Frame) => void) {}

  /** A frame that arrived. */
  receive(frame: Frame): void {
    if (typeof frame.event === 'string') {
      for (const on of this.topics.get(frame.event) ?? []) on(frame.data);
      return;
    }
    const w = this.waiting.get(frame.id as number);
    if (!w) return;
    this.waiting.delete(frame.id as number);
    w.resolve({ status: Number(frame.status), headers: new Headers(), body: frame.body ?? null });
  }

  async request(request: HttpRequest, timeout: number): Promise<HttpResponse> {
    const id = this.next++;
    const body = request.body !== undefined ? parse(request.body) : undefined;
    return new Promise<HttpResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        reject(new HttpError(`${request.method} ${request.url}: no answer in ${timeout} ms`, 0));
      }, timeout);
      this.waiting.set(id, {
        resolve: (r) => (clearTimeout(timer), resolve(r)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
      try {
        this.out({ id, method: request.method, path: request.url, headers: request.headers, ...(body !== undefined ? { body } : {}) });
      } catch (e) {
        this.waiting.get(id)?.reject(new HttpError(`${request.method} ${request.url}: ${(e as Error).message}`, 0));
        this.waiting.delete(id);
      }
    });
  }

  listen(topic: string, on: (data: unknown) => void): () => void {
    let set = this.topics.get(topic);
    if (!set) {
      set = new Set();
      this.topics.set(topic, set);
      this.out({ subscribe: topic });
    }
    set.add(on);
    return () => {
      set.delete(on);
      if (set.size === 0 && this.topics.get(topic) === set) {
        this.topics.delete(topic);
        try {
          this.out({ unsubscribe: topic });
        } catch {
          // closed: nothing to unsubscribe from
        }
      }
    };
  }

  /** Every topic listened to, sent again (after a reconnection). */
  resubscribe(): void {
    for (const topic of this.topics.keys()) this.out({ subscribe: topic });
  }

  /** The requests in flight fail like a network failure (the repository's retries cover them). */
  fail(why: string): void {
    for (const w of this.waiting.values()) w.reject(new HttpError(why, 0));
    this.waiting.clear();
  }
}

export interface WebSocketOptions {
  connectionName?: string;
  /** The server's socket (`ws://localhost:8000/ws`). */
  url: string;
  /** Sent with every request (a browser's WebSocket cannot send headers on its upgrade). */
  headers?: Record<string, string>;
  /** Milliseconds a request may take (default 10 000). */
  timeout?: number;
  interceptors?: HttpInterceptor[];
}

/** A WebSocket to a Synapsis backend: `WebSocket(url = "ws://localhost:8000/ws")`. Opens on the first call,
 * reconnects by itself (with growing waits) and subscribes again to what it listens to. */
export class WebSocket extends Transport {
  readonly url: string;
  readonly base = '/';
  private socket: globalThis.WebSocket | null = null;
  private opening: Promise<globalThis.WebSocket> | null = null;
  private retries = 0;
  private closed = false;
  private readonly frames = new Frames((f) => {
    if (this.socket?.readyState !== 1) throw new Error('the socket is not open');
    this.socket.send(JSON.stringify(f));
  });

  constructor(options: WebSocketOptions) {
    super(options);
    this.url = options.url;
  }

  async exchange(request: HttpRequest): Promise<HttpResponse> {
    await this.connect();
    return this.frames.request(request, this.timeout);
  }

  listen(topic: string, on: (data: unknown) => void): () => void {
    void this.connect().catch(() => undefined); // the subscription is sent when it opens
    return this.frames.listen(topic, on);
  }

  override async close(): Promise<void> {
    this.closed = true;
    this.socket?.close();
    this.frames.fail('the connection was closed');
  }

  private connect(): Promise<globalThis.WebSocket> {
    if (this.socket?.readyState === 1) return Promise.resolve(this.socket);
    this.closed = false;
    this.opening ??= new Promise<globalThis.WebSocket>((resolve, reject) => {
      const s = new globalThis.WebSocket(this.url);
      s.onopen = () => {
        this.socket = s;
        this.opening = null;
        this.retries = 0;
        this.frames.resubscribe();
        resolve(s);
      };
      s.onmessage = (m) => this.frames.receive(JSON.parse(String(m.data)) as Frame);
      s.onclose = () => {
        const was = this.socket === s;
        if (was) this.socket = null;
        this.opening = null;
        this.frames.fail(`${this.url}: the connection closed`);
        if (!was) reject(new HttpError(`${this.url}: could not connect`, 0));
        if (!this.closed && was) setTimeout(() => void this.connect().catch(() => undefined), Math.min(30_000, 500 * 2 ** this.retries++));
      };
    });
    return this.opening;
  }
}

/** The host's bridge as the transport of every repository of a mounted app (ADR-synapsis-0009). */
export class BridgeTransport extends Transport {
  readonly base = '/';
  private readonly frames: Frames;

  constructor(bridge: Bridge, options: { timeout?: number } = {}) {
    super(options);
    this.frames = new Frames((f) => bridge.send(f));
    bridge.onMessage((f) => this.frames.receive(f));
  }

  async exchange(request: HttpRequest): Promise<HttpResponse> {
    return this.frames.request(request, this.timeout);
  }

  listen(topic: string, on: (data: unknown) => void): () => void {
    return this.frames.listen(topic, on);
  }
}

/** Values that arrive (what a server pushes): `listen((value) => ...)` gives back the function that stops. */
export class Stream<T> {
  constructor(private readonly start: (on: (value: T) => void) => () => void) {}

  listen(on: (value: T) => void): () => void {
    return this.start(on);
  }

  /** The same stream with each value changed by `f`. */
  map<R>(f: (value: T) => R): Stream<R> {
    return new Stream<R>((on) => this.start((v) => on(f(v))));
  }
}
