import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Console, MonitorNode, MonitorView, page, PageContext, parts, projectAt, projectOf, rows, stateOf, TEXTS } from '../src/monitor';
import running from './fixtures/running-backend.json';
import old from './fixtures/report-0.96.json';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const node = (label: string, total: number, own: number, children: MonitorNode[] = []): MonitorNode => ({
  label, path: 'a.nuc', line: label.length, async: true, calls: 1, total_ms: total, self_ms: own, max_ms: total,
  connections: 0, memory_bytes: 0, children,
});

const ctx: PageContext = { root: '/home/user/ghibli/api', name: 'api', platform: 'backend', projects: [{ root: '/home/user/ghibli/api', name: 'api' }, { root: '/home/user/ghibli/app', name: 'app' }] };
const live = running as unknown as MonitorView;
const withConsole = (c: Partial<Console>, measuring = false): MonitorView => ({
  ...(old as unknown as MonitorView), roots: [], hot_spots: [], measuring,
  console: { state: 'running', step: 'serve', url: 'http://localhost:8000', started: '', updated: '', why: null, requests: 0, errors: 0, lines: [], ...c },
});

/** The page's own words (the card and the header): never a path, a command, a backtick or the report's name. */
function noLeak(html: string): void {
  const shown = html.replace(/(value|data-path|title)="[^"]*"/g, '');
  assert.doesNotMatch(shown, /\/home\/|`|report\.json|nuclear (run|monitor|build)|\.nuclear\//, shown);
}

test('a row draws its time against the root and the flags of its hot spot', () => {
  const tree = node('exec', 200, 20, [node('getUser', 100, 100), node('<b>', 80, 80)]);
  const html = rows(tree, 200, [{ label: 'getUser', path: 'a.nuc', line: 7, flags: ['slow'], self_ms: 100, calls_per_parent_call: 1, via: 'exec' }], TEXTS.en);
  assert.match(html, /width:50\.00%/);
  assert.match(html, /class="chip slow">slow</);
  assert.match(html, /&lt;b&gt;/);
  assert.doesNotMatch(html, /<b>/);
});

test('the console of a real run holds its requests, the 404s and the error with its stack, in order', () => {
  const p = parts(live, ctx, TEXTS.en);
  assert.equal(p.state, 'data');
  const order = [...p.console.matchAll(/class="ln (\w+)/g)].map((m) => m[1]);
  assert.ok(order.indexOf('err') > order.indexOf('req'));
  assert.match(p.console, /<b class="verb">GET<\/b><span class="route">\/films<\/span><span class="status">200<\/span>/);
  assert.match(p.console, /class="ln req s4xx"[^>]*>.*\/nothing<\/span><span class="status">404/);
  assert.match(p.console, /class="ln req s5xx"/);
  assert.match(p.console, /<details class="ln err"[^>]*><summary>.*IndexError: list index out of range.*Open in the code/);
  // the app's own frames stand out, the libraries' are dimmed
  assert.match(p.console, /<span class="own">[^<]*search_films\.py/);
  assert.match(p.console, /<span class="lib">[^<]*site-packages/);
  assert.match(p.console, /Requests <b>12<\/b>/);
  assert.match(p.console, /Errors <b>2<\/b>/);
  assert.match(p.console, /↻<\/span>Reloaded/);
  // the run's own commands are not lines of the console
  assert.doesNotMatch(p.console, /\$ nuclear build/);
  assert.match(p.bar, /class="pill running"/);
  assert.match(p.bar, /id="measuring" checked/);
  noLeak(p.bar + p.notice);
  // measured: the accordion of the report of the same run
  assert.match(p.measure, /SearchFilms\.exec/);
  assert.match(p.measure, /class="chip slow"/);
  noLeak(p.measure);
  assert.match(p.details, /\/home\/user\/ghibli\/api\/\.nuclear\/logs\/run\.log/);
});

test('each state has its card, in English and Spanish, with no path or command in it', () => {
  const cases: [MonitorView | string | undefined, string, RegExp, RegExp][] = [
    [undefined, 'none', /Open a project/, /Abre un proyecto/],
    ['✗ no .nuclear/monitor/report.json in /x or above: run `nuclear run --monitor`', 'error', /could not read this project.*Try again/, /no pudo leer este proyecto/],
    [withConsole({ state: 'none', lines: [] }), 'idle', /api is not running.*Run and watch/, /api no se está ejecutando.*Ejecutar y observar/],
    [withConsole({ state: 'stopped', lines: [{ kind: 'end', at: '2026-11-23T20:00:00.000Z', text: 'signal' }] }), 'idle', /api is not running/, /no se está ejecutando/],
    [withConsole({ state: 'starting', step: 'install', lines: [{ kind: 'step', at: 'a', text: 'build' }, { kind: 'step', at: 'b', text: 'install' }] }), 'starting', /Preparing api….*class="done">Building the app.*class="now">Installing the packages/, /Preparando api/],
    [withConsole({ state: 'running', lines: [{ kind: 'output', at: 'a', text: 'INFO: Application startup complete.' }] }), 'quiet', /api is running.*class="pulse".*Use the app: each request and screen appears here/, /Usa la app/],
    [withConsole({ state: 'failed', step: 'build', why: 'nuclear build . failed (exit code 2)', errors: 1, lines: [{ kind: 'error', at: 'a', text: 'error[E0101]: unknown name', stack: [] }] }), 'failed', /The app did not build.*Try again.*Show details/, /La app no compiló.*Reintentar.*Ver detalles/],
    [withConsole({ state: 'failed', step: 'flutter', why: 'the app could not be launched.' }), 'failed', /No device could open the app/, /Ningún dispositivo/],
  ];
  for (const [view, state, en, es] of cases) {
    const c = view === undefined ? undefined : ctx;
    const p = parts(view, c, TEXTS.en);
    assert.equal(p.state, state);
    assert.match(p.notice.replace(/\n/g, ' '), en);
    assert.match(parts(view, c, TEXTS.es).notice.replace(/\n/g, ' '), es);
    noLeak(p.notice + p.bar);
  }
  // the raw message and the reason only in the Details
  const failed = parts(cases[6][0], ctx, TEXTS.en);
  assert.match(failed.details, /nuclear build \. failed/);
  assert.match(parts(cases[1][0], ctx, TEXTS.en).details, /nuclear run --monitor/);
});

test('the header picks among the workspace apps; a phone app cannot be measured yet', () => {
  const p = parts(live, ctx, TEXTS.en);
  assert.match(p.bar, /<select id="project"><option value="\/home\/user\/ghibli\/api" selected>api<\/option><option value="\/home\/user\/ghibli\/app">app/);
  const mobile = parts(withConsole({ state: 'running', lines: [{ kind: 'output', at: 'a', text: 'Flutter run key commands.' }] }), { ...ctx, platform: 'mobile', name: 'app' }, TEXTS.en);
  assert.equal(mobile.state, 'data');
  assert.match(mobile.bar, /id="measuring" disabled/);
  assert.match(mobile.measure, /cannot be measured yet/);
  assert.match(mobile.console, /Flutter run key commands/);
});

test('an old report (0.96, without a console) still draws its measurements', () => {
  const view = old as unknown as MonitorView;
  assert.equal(stateOf(view), 'idle');
  const html = page(view, ctx, TEXTS.en, 'n', 'csp');
  assert.match(html, /SearchFilms\.exec/);
  assert.match(html, /Run and watch/);
  assert.equal(projectOf(view.report), '/home/user/ghibli/api');
  assert.match(page(withConsole({}), ctx, TEXTS.es, 'n', 'csp'), /Puntos calientes|Activa «Medir la app»/);
});

test('the project of a file is the folder of its config.nuc, never the workspace above it', () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'monitor-ws-'));
  try {
    fs.mkdirSync(path.join(ws, 'api', 'components'), { recursive: true });
    fs.mkdirSync(path.join(ws, '.workspace'));
    fs.writeFileSync(path.join(ws, '.workspace', 'workspace.nuc'), '');
    fs.writeFileSync(path.join(ws, 'api', 'config.nuc'), '');
    assert.equal(projectAt(path.join(ws, 'api', 'components')), path.join(ws, 'api'));
    assert.equal(projectAt(ws), undefined);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});
