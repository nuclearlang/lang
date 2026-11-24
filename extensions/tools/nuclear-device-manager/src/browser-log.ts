// The console of an app in a browser (the web device, the Synapsis device) written into the project's run log
// (`.nuclear/logs/run.log`), the lines `nuclear monitor --json` reads (spec 015, phase 2): each request the page makes
// to a server (`GET http://127.0.0.1:8000/films 200 12ms`), each request with no answer (`ERROR GET <url>
// net::ERR_CONNECTION_REFUSED`), each error of the page with its stack (`ERROR Uncaught TypeError: ...` and the
// frames indented, the app's files relative to the app so `nuclear explain` finds their `.nuc` lines), and its
// console. No `vscode` import: the tests drive it.

/** What a page of CDP sends: an event and its parameters. */
export interface Events {
  on(method: string, f: (params: Record<string, unknown>) => void): void;
}

interface Frame {
  functionName?: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
}

/** `http://127.0.0.1:5173/src/x.ts?t=1` of the app's own origin → `src/x.ts` (the app's file); any other url as it is. */
export function appFile(url: string, origin: string): string {
  if (!origin || !url.startsWith(origin + '/')) return url;
  return url.slice(origin.length + 1).split(/[?#]/)[0];
}

/** A stack's frames as a run log writes them: `    at name (file:line:column)`. */
export function stackLines(frames: Frame[] | undefined, origin: string): string[] {
  return (frames ?? []).slice(0, 20).map((f) => `    at ${f.functionName || '<anonymous>'} (${appFile(f.url, origin)}:${f.lineNumber + 1}:${f.columnNumber + 1})`);
}

interface Remote {
  type: string;
  value?: unknown;
  description?: string;
  preview?: { properties?: { name: string; value?: string }[] };
}

/** A value as the browser's console shows it; an error-like object with its message (`AppError: no films`). */
function shown(a: Remote): string {
  if (a.value !== undefined) return typeof a.value === 'string' ? a.value : JSON.stringify(a.value);
  const message = a.preview?.properties?.find((p) => p.name === 'message')?.value;
  const d = a.description ?? a.type;
  return message && !d.includes(message) ? `${d}: ${message}` : d;
}

/** The text of a `console.*` call: its arguments as the browser's console shows them, a format string's `%s`,
 * `%d`, `%o` filled and its `%c` styles dropped. */
export function consoleText(args: Remote[] | undefined): string {
  const rest = [...(args ?? [])];
  const first = rest[0];
  if (first && typeof first.value === 'string' && /%[sdifoOc]/.test(first.value)) {
    rest.shift();
    const text = first.value.replace(/%([sdifoOc])/g, (_, f: string) => {
      const a = rest.shift();
      return f === 'c' || !a ? '' : shown(a);
    });
    return [text, ...rest.map(shown)].join(' ');
  }
  return rest.map(shown).join(' ');
}

/** The lines of a `Runtime.consoleAPICalled`: an error with its stack, anything else as output. */
export function consoleLines(p: Record<string, unknown>, origin: string): string[] {
  const text = consoleText(p.args as Remote[]);
  if (!text.trim()) return [];
  if (p.type !== 'error' && p.type !== 'assert') return [p.type === 'warning' ? `warning: ${text}` : text];
  const [first, ...rest] = text.split('\n');
  // an Error's description already carries its stack; else the call's own
  const stack = rest.length ? rest.map((l) => `    ${l.trim()}`) : stackLines((p.stackTrace as { callFrames?: Frame[] })?.callFrames, origin);
  return [`ERROR ${first}`, ...stack];
}

/** The lines of a `Runtime.exceptionThrown`: `ERROR Uncaught TypeError: ...` and its frames. */
export function exceptionLines(p: Record<string, unknown>, origin: string): string[] {
  const d = p.exceptionDetails as { text: string; exception?: Remote; stackTrace?: { callFrames?: Frame[] } };
  const [message] = (d.exception ? shown(d.exception) : '').split('\n');
  // `Uncaught`, `Uncaught (in promise)`: how it got away
  const text = message ? `${d.text.startsWith('Uncaught') ? `${d.text} ` : ''}${message}` : d.text;
  return [`ERROR ${text}`, ...stackLines(d.stackTrace?.callFrames, origin)];
}

/** A file of the page rather than a call to a server: a font, an image, a stylesheet, a script, a wasm module, or
 * what a framework fetches of its own (Flutter's fonts, CanvasKit, its asset manifests). */
export function isAsset(url: string, mime = ''): boolean {
  if (/^(font|image|audio|video)\/|^text\/css|javascript|wasm|octet-stream/.test(mime)) return true;
  const p = url.split(/[?#]/)[0];
  return /\.(woff2?|ttf|otf|png|jpe?g|gif|webp|svg|ico|css|m?js|wasm|map)$/.test(p) || /\/(assets|canvaskit)\//.test(p);
}

/** The requests a page makes to servers (fetch and XMLHttpRequest, not its own files), one line when each ends. */
export class Requests {
  private open = new Map<string, { method: string; url: string; status?: number; mime?: string; at: number }>();

  constructor(private readonly skip: (url: string) => boolean = () => false) {}

  sent(p: Record<string, unknown>, now = Date.now()): void {
    const r = p.request as { method: string; url: string };
    if ((p.type !== 'Fetch' && p.type !== 'XHR') || r.method === 'OPTIONS' || this.skip(r.url) || isAsset(r.url)) return;
    this.open.set(String(p.requestId), { method: r.method, url: r.url, at: now });
  }

  response(p: Record<string, unknown>): void {
    const r = this.open.get(String(p.requestId));
    if (!r) return;
    r.status = (p.response as { status: number }).status;
    r.mime = (p.response as { mimeType?: string }).mimeType;
  }

  /** The line of a request that ended: `GET <url> 200 12ms`. */
  finished(p: Record<string, unknown>, now = Date.now()): string | undefined {
    const r = this.take(p);
    return r && !isAsset(r.url, r.mime) ? `${r.method} ${r.url} ${r.status ?? 0} ${now - r.at}ms` : undefined;
  }

  /** The line of a request with no answer: `ERROR GET <url> net::ERR_CONNECTION_REFUSED` (a cancelled one: none). */
  failed(p: Record<string, unknown>, now = Date.now()): string | undefined {
    const r = this.take(p);
    if (!r || p.canceled) return undefined;
    // a CORS refusal has an answer the page may not read: the browser says why
    const why = p.corsErrorStatus ? `blocked by CORS (${(p.corsErrorStatus as { corsError?: string }).corsError ?? ''})` : String(p.errorText ?? 'failed');
    return r.status ? `${r.method} ${r.url} ${r.status} ${now - r.at}ms` : `ERROR ${r.method} ${r.url} ${why}`;
  }

  private take(p: Record<string, unknown>) {
    const id = String(p.requestId);
    const r = this.open.get(id);
    this.open.delete(id);
    return r;
  }
}

/** Follows a page: its requests (and, with `console`, its console and its errors) written by `write` as lines of the
 * run log. `origin`: the app's own (its files are written relative to the app). The Synapsis device leaves the
 * console to Flutter, whose output is already in the log. */
export function follow(cdp: Events, origin: () => string, write: (lines: string[]) => void, opts: { console: boolean; skip?: (url: string) => boolean }): void {
  const requests = new Requests(opts.skip);
  cdp.on('Network.requestWillBeSent', (p) => requests.sent(p));
  cdp.on('Network.responseReceived', (p) => requests.response(p));
  cdp.on('Network.loadingFinished', (p) => {
    const l = requests.finished(p);
    if (l) write([l]);
  });
  cdp.on('Network.loadingFailed', (p) => {
    const l = requests.failed(p);
    if (l) write([l]);
  });
  if (!opts.console) return;
  cdp.on('Runtime.consoleAPICalled', (p) => write(consoleLines(p, origin())));
  cdp.on('Runtime.exceptionThrown', (p) => write(exceptionLines(p, origin())));
}
