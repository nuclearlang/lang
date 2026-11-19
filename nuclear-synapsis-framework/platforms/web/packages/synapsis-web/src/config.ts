// Configuration: the project config (`appConfig`) and a component's (`config`): connections and global services.
import { AppError, HttpError } from './errors.js';
import { register } from './inject.js';

/** Something the app opens at start; `connectionName` tells two of a kind apart (`''` is the default one). */
export abstract class Connection {
  readonly name: string;

  constructor(options: { connectionName?: string } = {}) {
    this.name = options.connectionName ?? '';
  }

  async open(): Promise<void> {}

  async close(): Promise<void> {}
}

export interface HttpOptions {
  connectionName?: string;
  /** Every path of a repository is appended to it (`https://api.example.com/`). */
  baseUrl: string;
  headers?: Record<string, string>;
  /** Milliseconds a request may take (default 10 000). */
  timeout?: number;
  interceptors?: HttpInterceptor[];
}

export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpResponse {
  status: number;
  headers: Headers;
  body: unknown;
}

/** Reads or changes every request and response of a connection (the session token, logs, events). */
export abstract class HttpInterceptor {
  async onRequest(request: HttpRequest): Promise<HttpRequest> {
    return request;
  }

  async onResponse(response: HttpResponse): Promise<HttpResponse> {
    return response;
  }
}

/** A connection a repository's calls travel over (ADR-synapsis-0008): `Http` or `WebSocket`, the same options. */
export abstract class Transport extends Connection {
  /** What a request's path is appended to: the API's url (`Http`), `/` for a socket's frames. */
  abstract readonly base: string;
  readonly headers: Record<string, string>;
  readonly timeout: number;
  readonly interceptors: HttpInterceptor[];

  constructor(options: { connectionName?: string; headers?: Record<string, string>; timeout?: number; interceptors?: HttpInterceptor[] }) {
    super(options);
    this.headers = options.headers ?? {};
    this.timeout = options.timeout ?? 10_000;
    this.interceptors = options.interceptors ?? [];
  }

  /** One request and its answer (the body parsed as JSON when it is JSON); a network failure throws HttpError(0). */
  abstract exchange(request: HttpRequest): Promise<HttpResponse>;

  /** Calls `on` with the data of every event `topic` the server pushes; gives back the function that stops. */
  listen(_topic: string, _on: (data: unknown) => void): () => void {
    throw new AppError(`the connection "${this.name || 'default'}" cannot receive what a server pushes: use a WebSocket connection`);
  }
}

/** An http API (fetch): `Http(baseUrl = "https://api.example.com/")`. */
export class Http extends Transport {
  readonly baseUrl: string;

  constructor(options: HttpOptions) {
    super(options);
    this.baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
  }

  get base(): string {
    return this.baseUrl;
  }

  async exchange(request: HttpRequest): Promise<HttpResponse> {
    let fetched: globalThis.Response;
    try {
      fetched = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: AbortSignal.timeout(this.timeout),
      });
    } catch (e) {
      throw new HttpError(`${request.method} ${request.url}: ${(e as Error).message}`, 0);
    }
    return { status: fetched.status, headers: fetched.headers, body: parse(await fetched.text()) };
  }
}

/** A body as JSON when it is JSON, else the text; `null` when empty. */
export function parse(text: string): unknown {
  if (text === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** A service that lives for the whole app (SessionManager, Events...): listed in `globals`, started by Synapsis. */
export abstract class Global {
  /** Registers this object in the injector under its own class (`register(Self, () => this)`). */
  register(): void {
    register(this.constructor as new () => this, () => this);
  }

  async init(): Promise<void> {}

  async dispose(): Promise<void> {}
}

/** The project configuration (`appConfig` kind): connections and global services. */
export abstract class AppConfig {
  readonly connections: Connection[] = [];
  readonly globals: Global[] = [];
}

/** The configuration of one component (`config` kind): its own connections and services. */
export abstract class ComponentConfig extends AppConfig {}
