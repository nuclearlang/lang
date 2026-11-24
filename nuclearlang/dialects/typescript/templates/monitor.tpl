// Nuclear Monitor (spec 015): the time, calls, connections and memory of each Nuclear function and method of
// {{app}}. Written by `nuclear build --monitor`; the report goes to NUCLEAR_MONITOR_FILE, else
// .nuclear/monitor/report.json of the working folder. In a browser it is `globalThis.nuclearMonitor.report()`, posted
// every two seconds to the collector the build was given (the page's own fetch, not counted).

interface MonitorNode {
  label: string;
  path: string;
  line: number;
  async: boolean;
  calls: number;
  totalMs: number;
  maxMs: number;
  connections: number;
  memoryBytes: number;
  children: Map<string, MonitorNode>;
}

interface MonitorSpan {
  node: MonitorNode;
  parent: MonitorNode;
  start: number;
  memory: number;
  connections: number;
}

interface MonitorStore {
  getStore(): MonitorNode | undefined;
  enterWith(node: MonitorNode): void;
  run<T>(node: MonitorNode, f: () => T): T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builtin = any;
const host = globalThis as unknown as {
  process?: {
    env: Record<string, string | undefined>;
    cwd(): string;
    on(event: string, f: () => void): void;
    getBuiltinModule?(id: string): Builtin;
  };
  nuclearMonitor?: { report(): object };
};
const clock = (globalThis as unknown as { performance: { now(): number } }).performance;
const builtin = (id: string): Builtin => host.process?.getBuiltinModule?.(id);

function newNode(label: string, path: string, line: number, isAsync: boolean): MonitorNode {
  return { label, path, line, async: isAsync, calls: 0, totalMs: 0, maxMs: 0, connections: 0, memoryBytes: 0, children: new Map() };
}

const root = newNode('', '', 0, false);
const started = new Date();
const v8 = builtin('node:v8');
const fs = builtin('node:fs');
const AsyncStore = builtin('node:async_hooks')?.AsyncLocalStorage;
// Node.js: the node follows the async flow; a browser: a variable (concurrent async calls may land on another parent)
const store: MonitorStore | undefined = AsyncStore ? new AsyncStore() : undefined;
const collector = '{{url}}';
let current = root;
let connections = 0;
let dirty = false;

function memory(): number {
  if (v8) return v8.getHeapStatistics().used_heap_size;
  return (clock as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
}

// a connection is a new socket (Node.js) or a request the page opens (a browser)
const net = builtin('node:net');
let post: ((body: string) => Promise<unknown>) | undefined;
if (net) {
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (this: unknown, ...args: unknown[]) {
    connections++;
    return connect.apply(this, args);
  };
} else {
  const page = globalThis as unknown as Record<string, Builtin>;
  if (page.fetch) {
    const fetch = page.fetch;
    post = (body: string) => fetch.call(globalThis, collector, { method: 'POST', body }).catch(() => undefined);
    page.fetch = (...args: unknown[]) => {
      connections++;
      return fetch(...args);
    };
  }
  if (page.XMLHttpRequest) {
    const open = page.XMLHttpRequest.prototype.open;
    page.XMLHttpRequest.prototype.open = function (this: unknown, ...args: unknown[]) {
      connections++;
      return open.apply(this, args);
    };
  }
  if (page.WebSocket) {
    const Socket = page.WebSocket;
    page.WebSocket = class extends Socket {
      constructor(...args: unknown[]) {
        super(...args);
        connections++;
      }
    };
  }
}

function open(label: string, path: string, line: number, isAsync: boolean): MonitorSpan {
  const parent = (store ? store.getStore() : current) ?? root;
  const key = path + ':' + line;
  let node = parent.children.get(key);
  if (!node) {
    node = newNode(label, path, line, isAsync);
    parent.children.set(key, node);
  }
  return { node, parent, start: clock.now(), memory: memory(), connections };
}

function close(span: MonitorSpan): void {
  const ms = clock.now() - span.start;
  const node = span.node;
  node.calls++;
  node.totalMs += ms;
  if (ms > node.maxMs) node.maxMs = ms;
  node.connections += connections - span.connections;
  node.memoryBytes += Math.max(0, memory() - span.memory);
  dirty = true;
}

interface ReportNode {
  label: string;
  path: string;
  line: number;
  async: boolean;
  calls: number;
  total_ms: number;
  self_ms: number;
  max_ms: number;
  connections: number;
  memory_bytes: number;
  children: ReportNode[];
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

function toReport(node: MonitorNode): ReportNode {
  const children = [...node.children.values()].map(toReport).sort((a, b) => b.total_ms - a.total_ms);
  const inner = children.reduce((sum, c) => sum + c.total_ms, 0);
  return {
    label: node.label,
    path: node.path,
    line: node.line,
    async: node.async,
    calls: node.calls,
    total_ms: round(node.totalMs),
    self_ms: round(Math.max(0, node.totalMs - inner)),
    max_ms: round(node.maxMs),
    connections: node.connections,
    memory_bytes: node.memoryBytes,
    children,
  };
}

function report(): object {
  return {
    format: 1,
    app: '{{app}}',
    runtime: v8 ? 'node' : 'browser',
    started: started.toISOString(),
    updated: new Date().toISOString(),
    wall_ms: round(Date.now() - started.getTime()),
    notes: store ? [] : ['no AsyncLocalStorage: concurrent async calls may be shown under another parent'],
    roots: toReport(root).children,
  };
}

function write(): void {
  if (!fs || !dirty || !host.process) return;
  dirty = false;
  const env = host.process.env;
  const file = env.NUCLEAR_MONITOR_FILE || host.process.cwd() + '/.nuclear/monitor/report.json';
  try {
    fs.mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(report(), null, 1));
    fs.renameSync(file + '.tmp', file);
  } catch {
    // the report is best effort: the app never fails because of it
  }
}

if (fs && host.process) {
  (setInterval(write, 2000) as unknown as { unref?: () => void }).unref?.();
  host.process.on('exit', write);
} else if (post && collector) {
  setInterval(() => {
    if (!dirty) return;
    dirty = false;
    void post?.(JSON.stringify(report()));
  }, 2000);
}
host.nuclearMonitor = { report };

export class NuclearMonitor {
  /** A synchronous call begins. */
  static enter(label: string, path: string, line: number): MonitorSpan {
    const span = open(label, path, line, false);
    if (store) store.enterWith(span.node);
    else current = span.node;
    return span;
  }

  /** A synchronous call ends (in a `finally`). */
  static exit(span: MonitorSpan): void {
    close(span);
    if (store) store.enterWith(span.parent);
    else current = span.parent;
  }

  /** An async call: its body runs inside its node, so what it awaits is measured under it. */
  static async run<T>(label: string, path: string, line: number, body: () => Promise<T>): Promise<T> {
    const span = open(label, path, line, true);
    try {
      if (store) return await store.run(span.node, body);
      // without a store only the part before the first await is under it: the caller gets its node back
      current = span.node;
      let result: Promise<T>;
      try {
        result = body();
      } finally {
        current = span.parent;
      }
      return await result;
    } finally {
      close(span);
    }
  }
}
