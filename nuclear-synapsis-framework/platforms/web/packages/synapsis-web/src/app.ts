// Entry point of the runtime: the connections, the global services and the injector.
import { AppConfig, ComponentConfig, Connection, Global, Transport } from './config.js';
import { Events } from './events.js';
import { MemoryCache } from './http.js';
import { resetInjector, register } from './inject.js';
import { Bridge, BridgeTransport } from './sockets.js';

const connections = new Map<string, Connection>();
const globals: Global[] = [];
let bridged: BridgeTransport | null = null;

export const Synapsis = {
  /** [start] ran. */
  started: false,

  /** The response cache of every repository. */
  cache: new MemoryCache(),

  /** Registers the project config, its connections and its global services, and starts them. */
  async start(config: AppConfig): Promise<void> {
    this.started = true;
    register(AppConfig, () => config);
    await add(config);
  },

  /** Adds the connections and services of a component's config. */
  async addConfig(config: ComponentConfig, _component?: string): Promise<void> {
    await add(config);
  },

  /** The connection named `name` of that class (`''` = the connection without `connectionName`). */
  connection<C extends Connection>(kind: abstract new (...args: never[]) => C, name = ''): C {
    const c = connections.get(name);
    if (c instanceof kind) return c;
    const known = [...connections.keys()].map((k) => k || '(default)').join(', ');
    throw new Error(`no ${kind.name} connection named "${name}" in the project config (known: ${known})`);
  },

  /** What a repository's calls travel over: the host's bridge when the app is mounted with one, else its connection. */
  transport(name = ''): Transport {
    return bridged ?? this.connection(Transport, name);
  },

  /** Mounted in a host's page (ADR-synapsis-0009): an in-memory router and, given a bridge, every call through it. */
  embedded: false,

  /** The first path of a mounted app's router. */
  path: '/',

  embed(host: { bridge?: Bridge; path?: string } = {}): void {
    this.embedded = true;
    this.path = host.path ?? '/';
    bridged = host.bridge ? new BridgeTransport(host.bridge) : null;
  },

  get connections(): Connection[] {
    return [...connections.values()];
  },

  /** Stops the global services and empties the injector, the connections and the cache (tests). */
  async reset(): Promise<void> {
    for (const g of [...globals].reverse()) await g.dispose();
    globals.length = 0;
    for (const c of connections.values()) await c.close();
    connections.clear();
    Events.reset();
    this.cache.clear();
    this.started = false;
    this.embedded = false;
    this.path = '/';
    bridged = null;
    resetInjector();
  },
};

async function add(config: AppConfig): Promise<void> {
  for (const c of config.connections) {
    if (connections.has(c.name)) {
      throw new Error(`two connections are named "${c.name}"; each connectionName is used once`);
    }
    await c.open();
    connections.set(c.name, c);
  }
  for (const g of config.globals) {
    g.register();
    globals.push(g);
    await g.init();
  }
}
