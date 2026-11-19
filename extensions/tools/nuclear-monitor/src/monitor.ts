// Nuclear Monitor for the editors (spec 015): `nuclear monitor --json` read and drawn as an accordion of bars.
// No `vscode` import: the page's HTML is built here, the panel only shows it.

import { spawn } from 'child_process';
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

export interface MonitorView {
  report: string;
  app: string;
  runtime: string;
  updated: string;
  notes: string[];
  hot_spots: HotSpot[];
  roots: MonitorNode[];
}

/** The project of a report: `<root>/.nuclear/monitor/report.json`. */
export function projectOf(report: string): string {
  return path.dirname(path.dirname(path.dirname(report)));
}

/** `nuclear monitor --json` in `folder` (or above): the view, or the command's message when there is no report. */
export function readMonitor(folder: string, command = 'nuclear'): Promise<MonitorView | string> {
  return new Promise((resolve) => {
    const p = spawn(command, ['monitor', '--json', '--project', folder], { cwd: folder, env: toolEnv() });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => resolve(String(e)));
    p.on('close', (code) => {
      if (code !== 0) return resolve(err.trim() || `nuclear monitor: exit ${code}`);
      try {
        resolve(JSON.parse(out.slice(out.indexOf('{'))) as MonitorView);
      } catch (e) {
        resolve(`nuclear monitor: ${e}`);
      }
    });
  });
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
    empty: 'Run the app with `nuclear run --monitor` (or build it with `nuclear build --monitor`) and use it: the report appears here.',
    flags: { slow: 'slow', loop: 'async calls in a loop', connections: 'many connections', memory: 'much memory' },
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
    empty: 'Ejecuta la app con `nuclear run --monitor` (o constrúyela con `nuclear build --monitor`) y úsala: el reporte aparece aquí.',
    flags: { slow: 'lento', loop: 'llamadas async en un bucle', connections: 'muchas conexiones', memory: 'mucha memoria' },
  },
};

const escape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
      <span class="name" data-path="${escape(node.path)}" data-line="${node.line}" title="${escape(node.path)}:${node.line}">${escape(node.label)}${node.async ? ' <i>async</i>' : ''}</span>${chips}
      <span class="bar"><span class="total" style="width:${width.toFixed(2)}%"><span class="self" style="width:${own.toFixed(2)}%"></span></span></span>
      <span class="time">${ms(node.total_ms)}</span>
      <span class="facts">${escape(facts.join(' · '))}</span>
    </summary>`;
  return node.children.length > 0
    ? `<details${open}>${head}${kids}</details>`
    : `<details class="leaf">${head}</details>`;
}

/** The page: the hot spots, then the tree. `view` is the message of the command when there is no report. */
export function page(view: MonitorView | string, t: Texts, nonce: string, csp: string): string {
  let body: string;
  if (typeof view === 'string') {
    body = `<p class="empty">${escape(t.empty)}</p><pre>${escape(view)}</pre>`;
  } else {
    const scale = Math.max(0, ...view.roots.map((r) => r.total_ms));
    const spots = view.hot_spots.length
      ? view.hot_spots
          .map(
            (s) => `<li><span class="name" data-path="${escape(s.path)}" data-line="${s.line}">${escape(s.label)}</span>
              ${s.flags.map((f) => `<span class="chip ${f}">${escape(t.flags[f] ?? f)}</span>`).join('')}
              <span class="facts">${t.own} ${ms(s.self_ms)}${s.flags.includes('loop') ? ` · ×${s.calls_per_parent_call}` : ''} · ${escape(s.path)}:${s.line}${s.via ? ` · ${escape(s.via)}` : ''}</span></li>`,
          )
          .join('')
      : `<li class="facts">${escape(t.none)}</li>`;
    body = `<p class="meta">${escape(view.app)} · ${escape(view.runtime)} · ${escape(view.updated)}</p>
      ${view.notes.map((n) => `<p class="note">${escape(n)}</p>`).join('')}
      <h2>${escape(t.hotSpots)}</h2><ul class="spots">${spots}</ul>
      <div class="tree">${view.roots.map((r) => rows(r, scale, view.hot_spots, t)).join('')}</div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  body { font: 13px var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 8px 16px; }
  header { display: flex; align-items: center; gap: 12px; }
  h1 { font-size: 15px; margin: 0; } h2 { font-size: 13px; margin: 16px 0 6px; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 0; padding: 4px 10px; cursor: pointer; }
  .meta, .note, .facts, .empty { color: var(--vscode-descriptionForeground); }
  .note { font-style: italic; margin: 2px 0; }
  .spots { list-style: none; padding: 0; margin: 0; } .spots li { padding: 3px 0; }
  .name { cursor: pointer; font-family: var(--vscode-editor-font-family); }
  .name:hover { text-decoration: underline; color: var(--vscode-textLink-foreground); }
  .name i { color: var(--vscode-descriptionForeground); font-size: 11px; }
  summary { display: grid; grid-template-columns: minmax(200px, 30%) minmax(120px, 1fr) 70px minmax(160px, 30%);
    align-items: center; gap: 8px; padding: 2px 0 2px calc(var(--depth) * 16px); cursor: pointer; list-style-position: inside; }
  .leaf > summary { list-style: none; padding-left: calc(var(--depth) * 16px + 14px); }
  summary:hover { background: var(--vscode-list-hoverBackground); }
  summary .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { height: 10px; background: var(--vscode-editorWidget-background); border-radius: 2px; overflow: hidden; }
  .total { display: block; height: 100%; background: var(--vscode-charts-blue, #3794ff); opacity: .55; }
  .self { display: block; height: 100%; background: var(--vscode-charts-orange, #d18616); }
  .time { text-align: right; font-variant-numeric: tabular-nums; }
  .chip { font-size: 11px; padding: 0 6px; margin-left: 6px; border-radius: 8px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .chip.slow, .chip.loop { background: var(--vscode-charts-red, #f14c4c); color: #fff; }
  pre { white-space: pre-wrap; }
</style></head><body>
<header><h1>${escape(t.title)}</h1><button id="refresh">${escape(t.refresh)}</button></header>
${body}
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
  document.addEventListener('click', (e) => {
    const name = e.target.closest && e.target.closest('.name');
    if (!name) return;
    e.preventDefault();
    vscode.postMessage({ type: 'open', path: name.dataset.path, line: Number(name.dataset.line) });
  });
</script></body></html>`;
}
