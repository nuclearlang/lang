// Nuclear Monitor for the editors (spec 015): `nuclear monitor --json` read and drawn as an accordion of bars.
// No `vscode` import: the page's HTML is built here, the panel only shows it.

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { toolEnv } from '../../nuclear-builder/src/support';

export interface MonitorNode {
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
  children: MonitorNode[];
}

export interface HotSpot {
  label: string;
  path: string;
  line: number;
  flags: string[];
  self_ms: number;
  calls_per_parent_call: number;
  via: string;
}

/** One line of the console: a request, an error (with its stack), a step of the run, a reload, the end, the app's
 * own output (`nuclear monitor --json`'s `console.lines`). */
export interface ConsoleLine {
  kind: 'request' | 'error' | 'step' | 'reload' | 'end' | 'failed' | 'output';
  at: string;
  text?: string;
  method?: string;
  path?: string;
  status?: number;
  ms?: number;
  stack?: string[];
}

/** The last run of the project, read from its run log by the CLI. */
export interface Console {
  state: 'none' | 'starting' | 'running' | 'stopped' | 'failed';
  step: string;
  url: string | null;
  started: string;
  updated: string;
  why: string | null;
  requests: number;
  errors: number;
  lines: ConsoleLine[];
}

export interface MonitorView {
  report: string;
  app: string;
  runtime: string;
  updated: string;
  notes: string[];
  hot_spots: HotSpot[];
  roots: MonitorNode[];
  /** Since 0.97: the project, whether it is measured (`.nuclear/monitor/on`), its console. */
  project?: string;
  measuring?: boolean;
  console?: Console;
}

/** The project of a report: `<root>/.nuclear/monitor/report.json`. */
export function projectOf(report: string): string {
  return path.dirname(path.dirname(path.dirname(report)));
}

/** The Nuclear project of a file or folder: the closest folder at or above it with `main.nuc`, `config.nuc` or
 * `nuclear.toml` (a workspace's own folder is none). */
export function projectAt(file: string): string | undefined {
  for (let dir = file; ; dir = path.dirname(dir)) {
    if (['main.nuc', 'config.nuc', 'nuclear.toml'].some((f) => fs.existsSync(path.join(dir, f)))) return dir;
    if (path.dirname(dir) === dir) return undefined;
  }
}

/** The name and platform of a project, from `.nuclear/project.json` (the folder's name without one). */
export function projectInfo(root: string): { root: string; name: string; platform: string | null } {
  try {
    const card = JSON.parse(fs.readFileSync(path.join(root, '.nuclear', 'project.json'), 'utf8')) as { name?: string; platform?: string | null };
    return { root, name: card.name || path.basename(root), platform: card.platform ?? null };
  } catch {
    return { root, name: path.basename(root), platform: null };
  }
}

/** `nuclear <args>` in `folder`: its output, or its message as an error. */
export function nuclear(folder: string, args: string[], input?: string, command = 'nuclear'): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    const p = spawn(command, args, { cwd: folder, env: toolEnv() });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => resolve({ ok: false, out: String(e) }));
    p.on('close', (code) => resolve(code === 0 ? { ok: true, out } : { ok: false, out: err.trim() || `nuclear ${args[0]}: exit ${code}` }));
    if (input !== undefined) p.stdin.end(input);
  });
}

/** `nuclear monitor --json` of the project at `folder`: the view, or the command's message when it failed. */
export async function readMonitor(folder: string, command = 'nuclear'): Promise<MonitorView | string> {
  const r = await nuclear(folder, ['monitor', '--json', '--project', folder], undefined, command);
  if (!r.ok) return r.out;
  try {
    return JSON.parse(r.out.slice(r.out.indexOf('{'))) as MonitorView;
  } catch (e) {
    return `nuclear monitor: ${e}`;
  }
}

/** The `.nuc` place a build error names itself (`--> components/a.nuc:11:9`). */
export function nucPlace(root: string, line: ConsoleLine): { file: string; line: number } | undefined {
  for (const s of [line.text ?? '', ...(line.stack ?? [])]) {
    const m = /-->\s*(\S+\.nuc):(\d+)/.exec(s);
    if (m) return { file: path.resolve(root, m[1]), line: Number(m[2]) };
  }
  return undefined;
}

/** The `.nuc` place of an error: the one it names, else the innermost frame of `nuclear explain --json` (the line map
 * of the build), else undefined. */
export async function explainPlace(root: string, line: ConsoleLine, command = 'nuclear'): Promise<{ file: string; line: number } | undefined> {
  const named = nucPlace(root, line);
  if (named) return named;
  const text = [`ERROR ${line.method ?? ''} ${line.path ?? ''} ${line.text ?? ''}`, ...(line.stack ?? [])].join('\n');
  const r = await nuclear(root, ['explain', '--json', '--project', root], text, command);
  try {
    const frames = (JSON.parse(r.out) as { frames?: { source: string; line: number }[] }).frames ?? [];
    const last = frames[frames.length - 1];
    return last && { file: last.source, line: last.line };
  } catch {
    return undefined;
  }
}

export interface Texts {
  title: string;
  refresh: string;
  hotSpots: string;
  none: string;
  calls: string;
  own: string;
  connections: string;
  memory: string;
  empty: string;
  flags: Record<string, string>;
  console: string;
  measurements: string;
  all: string;
  requests: string;
  errors: string;
  measure: string;
  measureTip: string;
  run: string;
  retry: string;
  showDetails: string;
  details: string;
  openCode: string;
  noPlace: string;
  project: string;
  state: Record<Console['state'], string>;
  noProject: [string, string];
  readError: string;
  readErrorHint: string;
  idle: [string, string];
  starting: string;
  quiet: [string, string];
  failed: Record<'build' | 'install' | 'serve' | 'device' | 'other', string>;
  failedHint: string;
  lastRun: string;
  steps: Record<string, string>;
  reloaded: string;
  ended: string;
  endedBad: string;
  measuring: string;
  measureOff: string;
  measureNotHere: string;
  nothing: string;
  detailRows: Record<'project' | 'log' | 'report' | 'address' | 'why' | 'message', string>;
}

export const TEXTS: Record<'en' | 'es', Texts> = {
  en: {
    title: 'Nuclear Monitor',
    refresh: 'Refresh',
    hotSpots: 'Hot spots',
    none: 'No function stands out.',
    calls: 'calls',
    own: 'own',
    connections: 'connections',
    memory: 'memory',
    empty: 'Open a project to see what it does while it runs.',
    flags: { slow: 'slow', loop: 'async calls in a loop', connections: 'many connections', memory: 'much memory' },
    console: 'Console',
    measurements: 'Measurements',
    all: 'All',
    requests: 'Requests',
    errors: 'Errors',
    measure: 'Measure the app',
    measureTip: "Each function's time, calls, connections and memory while the app runs",
    run: 'Run and watch',
    retry: 'Try again',
    showDetails: 'Show details',
    details: 'Details',
    openCode: 'Open in the code',
    noPlace: 'This error has no line of your code: open Details to read it whole.',
    project: 'Project',
    state: { none: 'Not running', starting: 'Starting', running: 'Running', stopped: 'Stopped', failed: 'Could not start' },
    noProject: ['Open a project', 'Choose an app in the Nuclear workspace: the Monitor shows what it does while it runs.'],
    readError: 'The Monitor could not read this project.',
    readErrorHint: 'Try again in a moment; if it keeps failing, the details say why.',
    idle: ['{0} is not running', 'Run it and watch it here: every request, error and message appears live.'],
    starting: 'Preparing {0}…',
    quiet: ['{0} is running', 'Use the app: each request and screen appears here.'],
    failed: { build: 'The app did not build', install: 'The packages could not be installed', serve: 'The app stopped', device: 'No device could open the app', other: '{0} could not start' },
    failedHint: 'The lines below say why. Fix it and try again.',
    lastRun: 'Last run',
    steps: { build: 'Building the app', install: 'Installing the packages', serve: 'Starting the server', live: 'Ready', flutter: 'Starting Flutter', compile: 'Compiling the app', browser: 'Opening the device' },
    reloaded: 'Reloaded',
    ended: 'Stopped',
    endedBad: 'Stopped with an error',
    measuring: 'Measuring: use the app, and each function it runs appears here with its time.',
    measureOff: 'Turn on “Measure the app” and use it: each function it runs appears here with its time, calls, connections and memory.',
    measureNotHere: 'An app on a phone or in a browser cannot be measured yet. Its console works.',
    nothing: 'Nothing here yet.',
    detailRows: { project: 'Project folder', log: 'Run log', report: 'Measurements file', address: 'Address', why: 'Reason', message: 'Message' },
  },
  es: {
    title: 'Nuclear Monitor',
    refresh: 'Actualizar',
    hotSpots: 'Puntos calientes',
    none: 'Ninguna función destaca.',
    calls: 'llamadas',
    own: 'propio',
    connections: 'conexiones',
    memory: 'memoria',
    empty: 'Abre un proyecto para ver lo que hace mientras se ejecuta.',
    flags: { slow: 'lento', loop: 'llamadas async en un bucle', connections: 'muchas conexiones', memory: 'mucha memoria' },
    console: 'Consola',
    measurements: 'Mediciones',
    all: 'Todo',
    requests: 'Peticiones',
    errors: 'Errores',
    measure: 'Medir la app',
    measureTip: 'El tiempo, las llamadas, las conexiones y la memoria de cada función mientras la app se ejecuta',
    run: 'Ejecutar y observar',
    retry: 'Reintentar',
    showDetails: 'Ver detalles',
    details: 'Detalles',
    openCode: 'Abrir en el código',
    noPlace: 'Este error no tiene una línea de tu código: abre Detalles para leerlo completo.',
    project: 'Proyecto',
    state: { none: 'Sin ejecutar', starting: 'Arrancando', running: 'En marcha', stopped: 'Detenida', failed: 'No pudo arrancar' },
    noProject: ['Abre un proyecto', 'Elige una app en el workspace de Nuclear: el Monitor muestra lo que hace mientras se ejecuta.'],
    readError: 'El Monitor no pudo leer este proyecto.',
    readErrorHint: 'Reintenta en un momento; si sigue fallando, los detalles dicen por qué.',
    idle: ['{0} no se está ejecutando', 'Ejecútala y obsérvala aquí: cada petición, error y mensaje aparece en vivo.'],
    starting: 'Preparando {0}…',
    quiet: ['{0} está en marcha', 'Usa la app: cada petición y pantalla aparece aquí.'],
    failed: { build: 'La app no compiló', install: 'No se pudieron instalar los paquetes', serve: 'La app se detuvo', device: 'Ningún dispositivo pudo abrir la app', other: '{0} no pudo arrancar' },
    failedHint: 'Las líneas de abajo dicen por qué. Corrígelo y reintenta.',
    lastRun: 'Última ejecución',
    steps: { build: 'Compilando la app', install: 'Instalando los paquetes', serve: 'Arrancando el servidor', live: 'Lista', flutter: 'Arrancando Flutter', compile: 'Compilando la app', browser: 'Abriendo el dispositivo' },
    reloaded: 'Recargada',
    ended: 'Detenida',
    endedBad: 'Detenida con un error',
    measuring: 'Midiendo: usa la app, y cada función que ejecuta aparece aquí con su tiempo.',
    measureOff: 'Activa «Medir la app» y úsala: cada función que ejecuta aparece aquí con su tiempo, llamadas, conexiones y memoria.',
    measureNotHere: 'Una app en un teléfono o en un navegador aún no se puede medir. Su consola funciona.',
    nothing: 'Aún no hay nada.',
    detailRows: { project: 'Carpeta del proyecto', log: 'Registro de ejecución', report: 'Archivo de mediciones', address: 'Dirección', why: 'Motivo', message: 'Mensaje' },
  },
};

const escape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fill = (s: string, ...v: string[]): string => s.replace(/\{(\d)\}/g, (_, i) => v[Number(i)] ?? '');

export const ms = (v: number): string => (v >= 100 ? `${v.toFixed(0)} ms` : `${v.toFixed(1)} ms`);

export const bytes = (v: number): string =>
  v >= 1024 * 1024 ? `${(v / 1024 / 1024).toFixed(1)} MB` : `${(v / 1024).toFixed(0)} KB`;

/** The flags of a node of the tree, from the hot spots (same place and same callers). */
function flagsOf(spots: HotSpot[], node: MonitorNode, via: string): string[] {
  return spots.find((s) => s.path === node.path && s.line === node.line && s.via === via)?.flags ?? [];
}

/** One row of the accordion and its children: a bar of its time against the root's, its own time darker. */
export function rows(node: MonitorNode, scale: number, spots: HotSpot[], t: Texts, via: string[] = [], depth = 0): string {
  const flags = flagsOf(spots, node, via.join(' › '));
  const width = scale > 0 ? Math.min(100, (node.total_ms / scale) * 100) : 0;
  const own = node.total_ms > 0 ? Math.min(100, (node.self_ms / node.total_ms) * 100) : 0;
  const facts = [`×${node.calls} ${t.calls}`, `${t.own} ${ms(node.self_ms)}`];
  if (node.connections > 0) facts.push(`${node.connections} ${t.connections}`);
  if (node.memory_bytes >= 1024) facts.push(`+${bytes(node.memory_bytes)}`);
  const chips = flags.map((f) => `<span class="chip ${f}">${escape(t.flags[f] ?? f)}</span>`).join('');
  const kids = node.children.map((c) => rows(c, scale, spots, t, [...via, node.label], depth + 1)).join('');
  const open = depth < 2 || flags.length > 0 ? ' open' : '';
  const head = `<summary style="--depth:${depth}">
      <span class="cell"><span class="name" data-path="${escape(node.path)}" data-line="${node.line}" title="${escape(node.path)}:${node.line}">${escape(node.label)}${node.async ? ' <i>async</i>' : ''}</span>${chips}</span>
      <span class="bar"><span class="total" style="width:${width.toFixed(2)}%"><span class="self" style="width:${own.toFixed(2)}%"></span></span></span>
      <span class="time">${ms(node.total_ms)}</span>
      <span class="facts">${escape(facts.join(' · '))}</span>
    </summary>`;
  return node.children.length > 0
    ? `<details${open}>${head}${kids}</details>`
    : `<details class="leaf">${head}</details>`;
}

// ---------------------------------------------------------------- the page

/** The project the page is on: its name, platform, folder, and the workspace's other apps to switch to. */
export interface PageContext {
  root: string;
  name: string;
  platform: string | null;
  projects: { root: string; name: string }[];
}

/** What the page shows: no project, the CLI failed, not running, starting, running without traffic yet, data, the
 * run could not start. */
export type PageState = 'none' | 'error' | 'idle' | 'starting' | 'quiet' | 'data' | 'failed';

export function stateOf(view: MonitorView | string | undefined, platform: string | null = null): PageState {
  if (view === undefined) return 'none';
  if (typeof view === 'string') return 'error';
  const c = view.console;
  if (!c || c.state === 'none' || c.state === 'stopped') return 'idle';
  if (c.state === 'starting' || c.state === 'failed') return c.state;
  return c.requests === 0 && c.errors === 0 && platform !== 'mobile' ? 'quiet' : 'data';
}

/** A phone's or a browser's app writes no measurements yet (spec 015 phase 2). */
export const measurable = (platform: string | null): boolean => platform !== 'mobile' && platform !== 'web';

/** The key of each line, stable while the log grows: its time and its place among the lines of that time. */
export function lineKeys(lines: ConsoleLine[]): string[] {
  const seen = new Map<string, number>();
  return lines.map((l) => {
    const n = seen.get(l.at) ?? 0;
    seen.set(l.at, n + 1);
    return `${l.at}#${n}`;
  });
}

const clock = (at: string): string => {
  const d = new Date(at);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-GB');
};

function failedTitle(c: Console, t: Texts, name: string): string {
  const s = c.step;
  const key = s === 'build' || s === 'install' || s === 'serve' ? s : ['flutter', 'compile', 'browser', 'live'].includes(s) ? 'device' : 'other';
  return fill(t.failed[key], name);
}

const LIBRARY = /site-packages|dist-packages|node_modules|[\\/]lib[\\/]python\d|\(node:|internal\/|dart:|package:flutter\//;

/** A stack with the frames of libraries dimmed: the app's own frames stand out (a Python frame is two lines). */
export function stackHtml(stack: string[]): string {
  let lib = false;
  return stack
    .map((s) => {
      const frame = /^\s*(File |at |#\d)/.test(s);
      if (frame) lib = LIBRARY.test(s);
      return `<span class="${lib ? 'lib' : 'own'}">${escape(s)}</span>`;
    })
    .join('\n');
}

/** One line of the console. */
export function consoleLine(l: ConsoleLine, key: string, t: Texts): string {
  const time = `<time>${escape(clock(l.at))}</time>`;
  const k = `data-k="${escape(key)}"`;
  switch (l.kind) {
    case 'request': {
      const band = `s${String(l.status ?? 0)[0]}xx`;
      return `<div class="ln req ${band}" ${k}>${time}<b class="verb">${escape(l.method ?? '')}</b><span class="route">${escape(l.path ?? '')}</span><span class="status">${l.status}</span><span class="took">${ms(l.ms ?? 0)}</span></div>`;
    }
    case 'error': {
      const where = l.method ? `<b class="verb">${escape(l.method)}</b><span class="route">${escape(l.path ?? '')}</span>` : '';
      const head = `${time}<span class="mark">✗</span>${where}<span class="cause">${escape(l.text ?? '')}</span>`;
      const open = `<button class="open" data-k="${escape(key)}">${escape(t.openCode)}</button>`;
      return l.stack?.length
        ? `<details class="ln err" ${k}><summary>${head}${open}</summary><pre>${stackHtml(l.stack)}</pre></details>`
        : `<div class="ln err" ${k}>${head}</div>`;
    }
    case 'step':
      return t.steps[l.text ?? ''] ? `<div class="ln step" ${k}>${time}<span class="mark">▸</span>${escape(t.steps[l.text ?? ''])}</div>` : '';
    case 'reload':
      return `<div class="ln reload" ${k}>${time}<span class="mark">↻</span>${escape(t.reloaded)}<span class="dim">${escape(l.text ?? '')}</span></div>`;
    case 'end':
      return `<div class="ln end" ${k}>${time}<span class="mark">■</span>${escape(['0', 'signal', '130'].includes(l.text ?? '') ? t.ended : t.endedBad)}</div>`;
    case 'failed':
      return `<div class="ln end bad" ${k}>${time}<span class="mark">✗</span>${escape(t.endedBad)}</div>`;
    default:
      return `<div class="ln out" ${k}>${time}<span class="text">${escape(l.text ?? '')}</span></div>`;
  }
}

/** The steps of a run that is starting: the ones done, the current one. */
function progress(c: Console, t: Texts): string {
  const steps = c.lines.filter((l) => l.kind === 'step' && t.steps[l.text ?? '']).map((l) => l.text!);
  return `<ol class="progress">${steps.map((s, i) => `<li class="${i === steps.length - 1 ? 'now' : 'done'}">${escape(t.steps[s])}</li>`).join('')}</ol>`;
}

/** The card above the console: what the project is doing, in plain words, and what to do. */
export function notice(state: PageState, view: MonitorView | string | undefined, ctx: PageContext | undefined, t: Texts): string {
  const name = escape(ctx?.name ?? '');
  const c = typeof view === 'object' ? view.console : undefined;
  const card = (cls: string, title: string, text: string, actions = '') =>
    `<section class="card ${cls}"><div class="card-text"><h2>${title}</h2><div class="sub">${text}</div></div>${actions ? `<div class="actions">${actions}</div>` : ''}</section>`;
  const run = `<button class="primary" data-do="run">▷ ${escape(t.run)}</button>`;
  switch (state) {
    case 'none':
      return card('idle', escape(t.noProject[0]), escape(t.noProject[1]));
    case 'error':
      return card('bad', escape(t.readError), escape(t.readErrorHint), `<button class="primary" data-do="refresh">${escape(t.retry)}</button><button data-do="details">${escape(t.showDetails)}</button>`);
    case 'idle':
      return card('idle', fill(t.idle[0], name), escape(t.idle[1]), run);
    case 'starting':
      return card('busy', fill(t.starting, name), progress(c!, t));
    case 'quiet':
      return card('live', fill(t.quiet[0], name), `<span class="pulse"></span>${escape(t.quiet[1])}`);
    case 'failed':
      return card('bad', escape(failedTitle(c!, t, ctx?.name ?? '')), escape(t.failedHint), `<button class="primary" data-do="run">${escape(t.retry)}</button><button data-do="details">${escape(t.showDetails)}</button>`);
    default:
      return '';
  }
}

/** The console: the filters with their counts, then every line of the run in order. */
export function consolePart(view: MonitorView | string | undefined, t: Texts): string {
  const c = typeof view === 'object' ? view.console : undefined;
  if (!c || !c.lines.length) return '';
  const keys = lineKeys(c.lines);
  const body = c.lines.map((l, i) => consoleLine(l, keys[i], t)).join('');
  const old = c.state === 'stopped' || c.state === 'none' ? `<h3 class="last">${escape(t.lastRun)}</h3>` : '';
  return `${old}<div class="filters" role="tablist">
      <button class="filter" data-filter="all">${escape(t.all)} <b>${c.lines.length}</b></button>
      <button class="filter" data-filter="requests">${escape(t.requests)} <b>${c.requests}</b></button>
      <button class="filter${c.errors ? ' has-errors' : ''}" data-filter="errors">${escape(t.errors)} <b>${c.errors}</b></button>
    </div><div class="lines" id="lines">${body}</div>`;
}

/** The measurements: the hot spots and the accordion of each function's time; else what to do to get them. */
export function measurePart(view: MonitorView | string | undefined, platform: string | null, t: Texts): string {
  if (typeof view !== 'object') return `<p class="hint">${escape(t.nothing)}</p>`;
  if (!view.roots.length) {
    const text = !measurable(platform) ? t.measureNotHere : view.measuring ? t.measuring : t.measureOff;
    return `<p class="hint">${view.measuring && measurable(platform) ? '<span class="pulse"></span>' : ''}${escape(text)}</p>`;
  }
  const scale = Math.max(0, ...view.roots.map((r) => r.total_ms));
  const spots = view.hot_spots.length
    ? view.hot_spots
        .map(
          (s) => `<li><span class="name" data-path="${escape(s.path)}" data-line="${s.line}">${escape(s.label)}</span>
            ${s.flags.map((f) => `<span class="chip ${f}">${escape(t.flags[f] ?? f)}</span>`).join('')}
            <span class="facts">${t.own} ${ms(s.self_ms)}${s.flags.includes('loop') ? ` · ×${s.calls_per_parent_call}` : ''}${s.via ? ` · ${escape(s.via)}` : ''}</span></li>`,
        )
        .join('')
    : `<li class="facts">${escape(t.none)}</li>`;
  return `${view.notes.map((n) => `<p class="note">${escape(n)}</p>`).join('')}
    <h3>${escape(t.hotSpots)}</h3><ul class="spots">${spots}</ul>
    <div class="tree">${view.roots.map((r) => rows(r, scale, view.hot_spots, t)).join('')}</div>`;
}

/** The only place of the page with folders, files, addresses and the raw messages. */
export function detailsPart(view: MonitorView | string | undefined, ctx: PageContext | undefined, t: Texts): string {
  const rows: [string, string][] = [];
  if (ctx) rows.push([t.detailRows.project, ctx.root], [t.detailRows.log, path.join(ctx.root, '.nuclear', 'logs', 'run.log')]);
  if (typeof view === 'string') rows.push([t.detailRows.message, view]);
  else if (view) {
    if (view.report) rows.push([t.detailRows.report, view.report]);
    if (view.console?.url) rows.push([t.detailRows.address, view.console.url]);
    if (view.console?.why) rows.push([t.detailRows.why, view.console.why]);
  }
  return `<details id="details"><summary>${escape(t.details)}</summary><dl>${rows.map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')}</dl></details>`;
}

/** The header: the project (a pick among the workspace's apps), its state and the toggle of the measuring. */
export function barPart(view: MonitorView | string | undefined, ctx: PageContext | undefined, t: Texts): string {
  const c = typeof view === 'object' ? view.console : undefined;
  const pill = ctx && typeof view === 'object' ? `<span class="pill ${c?.state ?? 'none'}"><i></i>${escape(t.state[c?.state ?? 'none'])}</span>` : '';
  const pick = ctx
    ? ctx.projects.length > 1
      ? `<label class="pick"><span>${escape(t.project)}</span><select id="project">${ctx.projects.map((p) => `<option value="${escape(p.root)}"${p.root === ctx.root ? ' selected' : ''}>${escape(p.name)}</option>`).join('')}</select></label>`
      : `<span class="proj">${escape(ctx.name)}</span>`
    : '';
  const can = measurable(ctx?.platform ?? null);
  const measuring = typeof view === 'object' && !!view.measuring;
  const toggle = ctx
    ? `<label class="toggle${can ? '' : ' off'}" title="${escape(can ? t.measureTip : t.measureNotHere)}"><input type="checkbox" id="measuring"${measuring && can ? ' checked' : ''}${can ? '' : ' disabled'}><span class="track"></span>${escape(t.measure)}</label>`
    : '';
  return `${pick}${pill}<span class="spacer"></span>${toggle}`;
}

/** Every part the page redraws as the run goes on. */
export function parts(view: MonitorView | string | undefined, ctx: PageContext | undefined, t: Texts) {
  const state = stateOf(view, ctx?.platform ?? null);
  const c = typeof view === 'object' ? view.console : undefined;
  return {
    state,
    bar: barPart(view, ctx, t),
    notice: notice(state, view, ctx, t),
    console: consolePart(view, t),
    measure: measurePart(view, ctx?.platform ?? null, t),
    details: detailsPart(view, ctx, t),
    counts: { lines: c?.lines.length ?? 0, errors: c?.errors ?? 0 },
  };
}

const CSS = /* css */ `
  :root { --tc: var(--vscode-nuclearHttpConnections-delete, var(--vscode-charts-red, #f14c4c));
    --ok: var(--vscode-charts-green, #89d185); --warn: var(--vscode-charts-yellow, #cca700); --bad: var(--vscode-errorForeground, #f14c4c);
    --line: var(--vscode-widget-border, color-mix(in srgb, var(--vscode-foreground) 14%, transparent));
    --soft: color-mix(in srgb, var(--vscode-foreground) 5%, transparent); --mono: var(--vscode-editor-font-family, monospace); }
  * { box-sizing: border-box; }
  body { margin: 0; font: 13px var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  button { font: inherit; font-size: 12px; color: inherit; background: none; border: 1px solid var(--line); border-radius: 4px; padding: 4px 10px; cursor: pointer; white-space: nowrap; }
  button:hover { background: var(--vscode-toolbar-hoverBackground, var(--soft)); }
  button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: transparent; font-weight: 600; }
  button.primary:hover { background: var(--vscode-button-hoverBackground); }
  :focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px; }
  .top { position: sticky; top: 0; z-index: 2; background: var(--vscode-editor-background); }
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 8px 16px; background: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-editor-background)); border-bottom: 1px solid var(--line); }
  h1 { margin: 0 4px 0 0; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--tc); text-shadow: 0 0 6px color-mix(in srgb, var(--tc) 45%, transparent); }
  .proj { font-weight: 600; } .pick { display: inline-flex; gap: 6px; align-items: center; } .pick > span { opacity: .7; font-size: 12px; }
  select { font: inherit; font-size: 12px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--line)); border-radius: 4px; padding: 3px 6px; }
  .spacer { flex: 1; }
  .pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; padding: 1px 9px 1px 7px; border-radius: 10px; border: 1px solid color-mix(in srgb, currentColor 40%, transparent); background: color-mix(in srgb, currentColor 10%, transparent); color: var(--vscode-descriptionForeground); }
  .pill i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .pill.running { color: var(--ok); } .pill.running i { animation: beat 1.6s ease-in-out infinite; }
  .pill.starting { color: var(--warn); } .pill.starting i { animation: beat .8s ease-in-out infinite; } .pill.failed { color: var(--bad); }
  @keyframes beat { 50% { opacity: .25; } }
  .toggle { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; cursor: pointer; user-select: none; }
  .toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
  .toggle .track { position: relative; width: 26px; height: 14px; border-radius: 7px; background: var(--line); transition: background .15s; }
  .toggle .track::after { content: ''; position: absolute; left: 2px; top: 2px; width: 10px; height: 10px; border-radius: 50%; background: var(--vscode-foreground); transition: left .15s; }
  .toggle input:checked + .track { background: var(--tc); } .toggle input:checked + .track::after { left: 14px; background: #fff; }
  .toggle input:focus-visible + .track { outline: 1px solid var(--vscode-focusBorder); }
  .toggle.off { opacity: .5; cursor: default; }
  nav { display: flex; gap: 2px; padding: 0 16px; border-bottom: 1px solid var(--line); }
  nav button { border: 0; border-bottom: 2px solid transparent; border-radius: 0; padding: 7px 12px 6px; opacity: .7; }
  nav .count { color: var(--bad); }
  nav button.on { opacity: 1; border-bottom-color: var(--tc); color: var(--tc); }
  main { padding: 12px 16px 40px; }
  .card { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; margin: 0 0 14px; padding: 14px 18px; border: 1px solid color-mix(in srgb, var(--cc, var(--tc)) 35%, transparent); background: color-mix(in srgb, var(--cc, var(--tc)) 6%, transparent); border-radius: 3px; }
  .card::before, .card::after { content: ''; position: absolute; width: 9px; height: 9px; border: 2px solid var(--cc, var(--tc)); pointer-events: none; }
  .card::before { left: -1px; top: -1px; border-right: 0; border-bottom: 0; } .card::after { right: -1px; bottom: -1px; border-left: 0; border-top: 0; }
  .card.live { --cc: var(--ok); } .card.busy { --cc: var(--warn); } .card.bad { --cc: var(--bad); } .card.idle { --cc: var(--vscode-focusBorder, var(--tc)); }
  .card-text { flex: 1; min-width: 220px; } .card h2 { margin: 0 0 4px; font-size: 14px; } .card .sub { margin: 0; color: var(--vscode-descriptionForeground); line-height: 1.5; }
  .actions { display: flex; gap: 8px; }
  .pulse { display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 0 var(--ok); animation: ring 1.8s ease-out infinite; vertical-align: middle; }
  @keyframes ring { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ok) 70%, transparent); } 100% { box-shadow: 0 0 0 9px transparent; } }
  .progress { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 16px; }
  .progress li.done::before { content: '✓ '; color: var(--ok); } .progress li.now { color: var(--vscode-foreground); font-weight: 600; } .progress li.now::before { content: '● '; color: var(--warn); animation: beat .8s infinite; }
  h3 { font-size: 12px; margin: 14px 0 6px; } h3.last { opacity: .7; text-transform: uppercase; letter-spacing: .08em; font-size: 11px; }
  .filters { display: flex; gap: 6px; margin: 0 0 8px; }
  .filter { border-radius: 12px; padding: 2px 10px; } .filter b { font-variant-numeric: tabular-nums; opacity: .8; margin-left: 2px; }
  .filter.on { border-color: var(--tc); background: color-mix(in srgb, var(--tc) 14%, transparent); }
  .filter.has-errors b { color: var(--bad); opacity: 1; }
  .lines { font: 12px/1.55 var(--mono); border: 1px solid var(--line); border-radius: 3px; padding: 6px 0; background: color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-foreground)); }
  .ln { display: flex; gap: 10px; align-items: baseline; padding: 0 12px; } .ln:hover, .ln > summary:hover { background: var(--vscode-list-hoverBackground, var(--soft)); }
  .ln time { flex: none; opacity: .5; font-variant-numeric: tabular-nums; }
  .ln .text { white-space: pre-wrap; word-break: break-word; opacity: .85; }
  .ln .mark { flex: none; width: 1em; text-align: center; }
  .verb { flex: none; min-width: 4.2em; font-weight: 700; color: var(--vscode-nuclearHttpConnections-get, var(--vscode-charts-blue, #3794ff)); }
  .route { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .status { flex: none; font-weight: 700; min-width: 2.4em; } .took { flex: none; min-width: 5em; text-align: right; opacity: .65; font-variant-numeric: tabular-nums; }
  .s2xx .status { color: var(--ok); } .s3xx .status { color: var(--vscode-descriptionForeground); } .s4xx .status { color: var(--warn); }
  .s5xx { background: color-mix(in srgb, var(--bad) 9%, transparent); } .s5xx .status { color: var(--bad); }
  .ln.err { color: var(--bad); background: color-mix(in srgb, var(--bad) 11%, transparent); border-left: 2px solid var(--bad); }
  details.ln.err { display: block; padding: 0; } details.ln.err > summary { display: flex; gap: 10px; align-items: baseline; padding: 0 12px; cursor: pointer; list-style: none; }
  details.ln.err > summary::-webkit-details-marker { display: none; }
  details.ln.err > summary::after { content: '▸'; margin-left: 4px; opacity: .7; } details.ln.err[open] > summary::after { content: '▾'; }
  .ln.err .cause { flex: 1; min-width: 0; font-weight: 600; word-break: break-word; } .ln.err .verb { color: inherit; }
  .ln.err .route { flex: none; } .ln.err pre .lib { opacity: .45; } .ln.err pre .own { font-weight: 600; }
  .ln.err pre { margin: 2px 0 6px; padding: 6px 12px 6px 40px; white-space: pre-wrap; word-break: break-word; color: var(--vscode-foreground); opacity: .85; font: inherit; font-size: 11.5px; }
  .ln.err .open { flex: none; padding: 0 8px; font-size: 11px; border-color: color-mix(in srgb, var(--bad) 50%, transparent); color: var(--vscode-foreground); }
  .ln.step { color: var(--vscode-descriptionForeground); font-style: italic; }
  .ln.reload { color: var(--vscode-charts-purple, #b180d7); } .ln .dim { opacity: .55; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ln.end { color: var(--vscode-descriptionForeground); font-weight: 600; } .ln.end.bad { color: var(--bad); }
  body.f-requests .ln:not(.req) { display: none; }
  body.f-errors .ln:not(.err):not(.s5xx) { display: none; }
  .hint { color: var(--vscode-descriptionForeground); line-height: 1.6; max-width: 640px; }
  #details { margin-top: 22px; color: var(--vscode-descriptionForeground); font-size: 12px; } #details summary { cursor: pointer; }
  #details dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; margin: 8px 0 0; } #details dt { opacity: .8; } #details dd { margin: 0; font-family: var(--mono); word-break: break-all; }
  .note, .facts { color: var(--vscode-descriptionForeground); } .note { font-style: italic; margin: 2px 0; }
  .spots { list-style: none; padding: 0; margin: 0; } .spots li { padding: 3px 0; }
  .name { cursor: pointer; font-family: var(--mono); }
  .name:hover { text-decoration: underline; color: var(--vscode-textLink-foreground); }
  .name i { color: var(--vscode-descriptionForeground); font-size: 11px; }
  summary[style] { display: grid; grid-template-columns: minmax(200px, 30%) minmax(120px, 1fr) 70px minmax(160px, 30%);
    align-items: center; gap: 8px; padding: 2px 0 2px calc(var(--depth) * 16px); cursor: pointer; list-style-position: inside; }
  .leaf > summary { list-style: none; padding-left: calc(var(--depth) * 16px + 14px); }
  .tree summary:hover { background: var(--vscode-list-hoverBackground); }
  summary .cell { display: flex; align-items: center; min-width: 0; } summary .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { height: 10px; background: var(--vscode-editorWidget-background, var(--soft)); border-radius: 2px; overflow: hidden; }
  .total { display: block; height: 100%; background: var(--vscode-charts-blue, #3794ff); opacity: .55; }
  .self { display: block; height: 100%; background: var(--vscode-charts-orange, #d18616); }
  .time { text-align: right; font-variant-numeric: tabular-nums; }
  .chip { font-size: 11px; padding: 0 6px; margin-left: 6px; border-radius: 8px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .chip.slow, .chip.loop { background: var(--vscode-charts-red, #f14c4c); color: #fff; }
  [hidden] { display: none !important; }
`;

/** The script of the page: the tabs, the filters, the clicks; `draw` messages replace the parts and keep the open
 * errors, the filter and the scroll at the bottom while it follows the run. */
const SCRIPT = `
  const vscode = acquireVsCodeApi();
  const kept = Object.assign({ tab: 'console', filter: 'all' }, vscode.getState() || {});
  const $ = (id) => document.getElementById(id);
  function apply() {
    document.body.className = 'f-' + kept.filter;
    for (const b of document.querySelectorAll('nav button')) b.classList.toggle('on', b.dataset.tab === kept.tab);
    for (const b of document.querySelectorAll('.filter')) b.classList.toggle('on', b.dataset.filter === kept.filter);
    $('console').hidden = kept.tab !== 'console';
    $('measure').hidden = kept.tab !== 'measure';
    vscode.setState(kept);
  }
  function draw(p) {
    const bottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 30;
    const open = new Set([...document.querySelectorAll('details[data-k][open]')].map((d) => d.dataset.k));
    const details = $('details') && $('details').open;
    $('bar').innerHTML = p.bar; $('notice').innerHTML = p.notice; $('lines-part').innerHTML = p.console;
    $('measure').innerHTML = p.measure; $('details-part').innerHTML = p.details;
    $('count').textContent = p.counts.errors ? String(p.counts.errors) : '';
    for (const d of document.querySelectorAll('details[data-k]')) if (open.has(d.dataset.k)) d.open = true;
    if (details) $('details').open = true;
    apply();
    if (bottom) window.scrollTo(0, document.body.scrollHeight);
  }
  window.addEventListener('message', (e) => e.data && e.data.type === 'draw' && draw(e.data.parts));
  document.addEventListener('change', (e) => {
    if (e.target.id === 'measuring') vscode.postMessage({ type: 'measure', on: e.target.checked });
    if (e.target.id === 'project') vscode.postMessage({ type: 'project', root: e.target.value });
  });
  document.addEventListener('click', (e) => {
    const el = e.target.closest ? e.target : e.target.parentElement;
    const tab = el.closest('nav button'); if (tab) { kept.tab = tab.dataset.tab; return apply(); }
    const f = el.closest('.filter'); if (f) { kept.filter = f.dataset.filter; return apply(); }
    const open = el.closest('button.open'); if (open) { e.preventDefault(); return vscode.postMessage({ type: 'explain', k: open.dataset.k }); }
    const act = el.closest('[data-do]');
    if (act && act.dataset.do === 'details') { $('details').open = true; return $('details').scrollIntoView({ behavior: 'smooth' }); }
    if (act) return vscode.postMessage({ type: act.dataset.do });
    const name = el.closest('.name');
    if (name) { e.preventDefault(); vscode.postMessage({ type: 'open', path: name.dataset.path, line: Number(name.dataset.line) }); }
  });
  apply();
  window.scrollTo(0, document.body.scrollHeight);
`;

/** The whole page, drawn with `view` (later draws come as messages with `parts`). */
export function page(view: MonitorView | string | undefined, ctx: PageContext | undefined, t: Texts, nonce: string, csp: string): string {
  const p = parts(view, ctx, t);
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>${CSS}</style></head><body>
<div class="top"><header><h1>${escape(t.title)}</h1><span id="bar" style="display:contents">${p.bar}</span></header>
<nav><button data-tab="console">${escape(t.console)} <b id="count" class="count">${p.counts.errors || ''}</b></button><button data-tab="measure">${escape(t.measurements)}</button></nav></div>
<main><div id="console"><div id="notice">${p.notice}</div><div id="lines-part">${p.console}</div></div>
<div id="measure" hidden>${p.measure}</div><div id="details-part">${p.details}</div></main>
<script nonce="${nonce}">${SCRIPT}</script></body></html>`;
}
