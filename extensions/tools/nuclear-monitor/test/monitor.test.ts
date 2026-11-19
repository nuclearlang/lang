import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MonitorNode, MonitorView, page, projectOf, rows, TEXTS } from '../src/monitor';

const node = (label: string, total: number, own: number, children: MonitorNode[] = []): MonitorNode => ({
  label, path: 'a.nuc', line: label.length, async: true, calls: 1, total_ms: total, self_ms: own, max_ms: total,
  connections: 0, memory_bytes: 0, children,
});

test('a row draws its time against the root and the flags of its hot spot', () => {
  const tree = node('exec', 200, 20, [node('getUser', 100, 100), node('<b>', 80, 80)]);
  const html = rows(tree, 200, [{ label: 'getUser', path: 'a.nuc', line: 7, flags: ['slow'], self_ms: 100, calls_per_parent_call: 1, via: 'exec' }], TEXTS.en);
  assert.match(html, /width:50\.00%/);
  assert.match(html, /class="chip slow">slow</);
  assert.match(html, /&lt;b&gt;/);
  assert.doesNotMatch(html, /<b>/);
});

test('the page says how to get a report when there is none, in Spanish too', () => {
  assert.match(page('no report', TEXTS.es, 'n', 'csp'), /nuclear run --monitor/);
  const view: MonitorView = { report: '/p/.nuclear/monitor/report.json', app: 'a', runtime: 'node', updated: 'now', notes: [], hot_spots: [], roots: [node('main', 1, 1)] };
  assert.match(page(view, TEXTS.en, 'n', 'csp'), /No function stands out/);
  assert.equal(projectOf(view.report), '/p');
});
