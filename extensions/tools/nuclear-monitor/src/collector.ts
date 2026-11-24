// The monitor's collector of the editor (spec 015, phase 2): an app in a browser (the web device, the Synapsis device)
// or on a phone has no project files, so its runtime posts its report every two seconds to
// `http://127.0.0.1:<port>/<token>/<project key>`; this writes it to `<project>/.nuclear/monitor/report.json`, where
// `nuclear monitor --json` reads it (the only source of the hot spots). One per window: a random port of this
// machine, a token of this session, CORS only for the app's own origin. The address reaches every build through
// `NUCLEAR_MONITOR_URL` (the CLI adds the project's key: `collector_url` of `tools/cli/src/main.rs`). No `vscode`
// import.

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

/** A report larger than this is refused (a real one is a few hundred kilobytes). */
const MAX_BODY = 8 << 20;

/** The key of a project: FNV-1a (64 bits) of its real folder, in hex; the CLI computes the same (`project_key`). */
export function projectKey(root: string): string {
  let real = root;
  try {
    real = fs.realpathSync(root);
  } catch {
    // a folder that does not exist keeps its name
  }
  let h = 0xcbf29ce484222325n;
  for (const b of Buffer.from(real, 'utf8')) h = ((h ^ BigInt(b)) * 0x100000001b3n) & 0xffffffffffffffffn;
  return h.toString(16).padStart(16, '0');
}

/** A project the collector writes for, and the origins its app is served from. */
interface Known {
  root: string;
  origins: Set<string>;
}

/** Finds a project the collector was not told of (the registry of projects: its folder and its port). */
export type Lookup = (key: string) => Promise<{ root: string; port?: number } | undefined>;

/** The origins of this machine at `port`, as a browser writes them. */
export const localOrigins = (port: number): string[] => [`http://127.0.0.1:${port}`, `http://localhost:${port}`, `http://[::1]:${port}`];

export class Collector {
  readonly token = crypto.randomBytes(16).toString('hex');
  url = '';
  private server?: http.Server;
  private known = new Map<string, Known>();

  constructor(private readonly lookup: Lookup = async () => undefined) {}

  /** Listens on a free port of 127.0.0.1; the address with the token, for `NUCLEAR_MONITOR_URL`. */
  async start(): Promise<string> {
    const server = (this.server = http.createServer((req, res) => void this.answer(req, res)));
    await new Promise<void>((done, fail) => server.once('error', fail).listen(0, '127.0.0.1', done));
    server.unref();
    this.url = `http://127.0.0.1:${(server.address() as { port: number }).port}/${this.token}`;
    return this.url;
  }

  stop(): void {
    this.server?.close();
  }

  /** The app of `root` is served at `origin` (a device's page): its posts are taken. */
  allow(root: string, origin?: string): void {
    const key = projectKey(root);
    const k = this.known.get(key) ?? { root, origins: new Set<string>() };
    if (origin) k.origins.add(new URL(origin).origin);
    this.known.set(key, k);
  }

  private async project(key: string): Promise<Known | undefined> {
    const known = this.known.get(key);
    if (known) return known;
    const found = await this.lookup(key).catch(() => undefined);
    if (!found || projectKey(found.root) !== key) return undefined;
    const k: Known = { root: found.root, origins: new Set(found.port ? localOrigins(found.port) : []) };
    this.known.set(key, k);
    return k;
  }

  private async answer(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const end = (status: number, origin?: string) => {
      res.writeHead(status, origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type', Vary: 'Origin' } : {});
      res.end();
    };
    const [, token, key, extra] = (req.url ?? '').split('?')[0].split('/');
    const k = token === this.token && key && extra === undefined ? await this.project(key) : undefined;
    // a browser always names its page's origin; a phone's app names none (the token is the key)
    const origin = req.headers.origin;
    if (!k || (origin !== undefined && !k.origins.has(origin))) {
      req.resume();
      return end(403);
    }
    if (req.method === 'OPTIONS') return end(204, origin);
    if (req.method !== 'POST') return end(405, origin);
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size <= MAX_BODY) chunks.push(c);
    });
    req.on('end', () => {
      if (size > MAX_BODY) return end(413, origin);
      const body = Buffer.concat(chunks);
      try {
        const r = JSON.parse(body.toString('utf8')) as { format?: unknown; roots?: unknown };
        if (typeof r.format !== 'number' || !Array.isArray(r.roots)) return end(400, origin);
      } catch {
        return end(400, origin);
      }
      try {
        const file = path.join(k.root, '.nuclear', 'monitor', 'report.json');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(`${file}.tmp`, body);
        fs.renameSync(`${file}.tmp`, file);
        end(204, origin);
      } catch {
        end(500, origin);
      }
    });
  }
}

/** The window's collector, once started (`activateMonitor`). */
let current: Collector | undefined;
export const setCollector = (c: Collector | undefined): void => void (current = c);

/** A device serves the app of `root` at `origin`: its reports are taken. Nothing without a collector. */
export function allowOrigin(root: string | undefined, origin: string): void {
  if (root) current?.allow(root, origin);
}

/** Whether a request of the page is the monitor's own post (left out of the console). */
export const isCollector = (url: string): boolean => !!current?.url && url.startsWith(current.url);
