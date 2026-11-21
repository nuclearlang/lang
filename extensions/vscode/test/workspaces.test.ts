// The Nuclear workspaces of the editor (spec 022, src/workspaces.ts): the CLI's JSON, the recent list, the projects
// opened by hand of 0.63 to 0.83 (kept per VS Code folder) joining the editor's global list, the empty panel's reason,
// the dialects offered for a platform.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';
import { afterReload, alive, appFolder, dialectsOf, emptyState, markerOf, migrateSaved, parseCli, parseDialects, remember, shownProjects } from '../src/workspaces';

const FIXTURES = path.resolve(__dirname, '..', '..', 'test', 'fixtures', 'compat');
const fixture = (f: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES, f), 'utf8')) as Record<string, string[]>;
const SHOW = '{"apps":[{"dialect":"fastapi","exists":true,"folder":"demo_api","name":"demo_api","platform":"backend"},{"dialect":null,"exists":false,"folder":"web","name":"web","platform":"web"}],"description":"","name":"demo","root":"/w/demo"}';

test("the CLI's answer: the workspace, null outside one, a refusal thrown with its message", () => {
  const w = parseCli(SHOW, 0)!;
  assert.equal(w.name, 'demo');
  assert.deepEqual(w.apps.map((a) => [a.folder, a.platform, a.dialect, a.exists]), [['demo_api', 'backend', 'fastapi', true], ['web', 'web', null, false]]);
  // `add` prints `nuclear new`'s lines first: the last JSON line is the answer
  assert.equal(parseCli(`✓ backend project demo_api created. Next:\n  cd demo_api && nuclear build\n${SHOW}\n`, 0)!.apps.length, 2);
  assert.equal(parseCli('null\n', 0), null);
  assert.throws(() => parseCli('{"error":"\'flutter\' is a dialect of the mobile platform, not of \'web\'"}', 1), /dialect of the mobile platform/);
  // an older nuclear without `workspace` prints its usage: an error, never a workspace
  assert.throws(() => parseCli('usage:\n  nuclear help [<topic>]', 2));
});

test('the recent workspaces: the last opened first, each once, at most ten, only those still there', () => {
  let list = remember(undefined, { root: '/a', name: 'a' }, 1);
  list = remember(list, { root: '/b', name: 'b' }, 2);
  list = remember(list, { root: '/a', name: 'a2' }, 3);
  assert.deepEqual(list, [{ root: '/a', name: 'a2', openedAt: 3 }, { root: '/b', name: 'b', openedAt: 2 }]);
  for (let i = 0; i < 20; i++) list = remember(list, { root: `/x${i}`, name: `x${i}` }, 10 + i);
  assert.equal(list.length, 10);
  assert.equal(list[0].root, '/x19');
  assert.deepEqual(alive([{ root: '/a', name: 'a', openedAt: 1 }, { root: '/gone', name: 'g', openedAt: 1 }], (f) => f === markerOf('/a')).map((r) => r.root), ['/a']);
});

test('the projects opened by hand of 0.63 to 0.83 (one list per folder) join the global list, never lost', () => {
  const global = fixture('global-state-0.62.json')['nuclear.workspace.projects'];
  const here = fixture('workspace-state-0.83.json')['nuclear.workspace.projects'];
  const { saved, changed } = migrateSaved(global, here);
  assert.ok(changed, "the folder's old entry is cleared once read");
  assert.deepEqual(saved, [...global, '/home/someone/work/shop-workspace/admin']);
  // read again: nothing left in the folder, the same list
  assert.deepEqual(migrateSaved(saved, undefined), { saved, changed: false });
  assert.deepEqual(migrateSaved(undefined, undefined), { saved: [], changed: false });
});

test('the empty panel: no folder open, or a folder that is not a workspace; nothing when there is something', () => {
  const recent = [{ root: '/a', name: 'a', openedAt: 1 }];
  assert.deepEqual(emptyState(undefined, 0, [], recent), { reason: 'noFolder', recent });
  assert.deepEqual(emptyState(undefined, 0, ['/home/me/other'], []), { reason: 'notWorkspace', recent: [] });
  assert.equal(emptyState(parseCli(SHOW, 0)!, 0, [], recent), null);
  assert.equal(emptyState(undefined, 2, ['/f'], recent), null);
});

test("the dialects offered for a platform: the installed ones, the platform's default first", () => {
  const installed = parseDialects('dart         dart                         Dart 3\nfastapi      fastapi → python             Synapsis for Python\nnestjs       nestjs → nodejs → typescript Synapsis for NestJS\nreact        react → typescript           Synapsis for React\nflutter      flutter → dart               Flutter');
  assert.deepEqual(dialectsOf('backend', installed), ['fastapi', 'nestjs']);
  assert.deepEqual(dialectsOf('web', installed), ['react']);
  assert.deepEqual(dialectsOf('mobile', undefined), ['flutter']);
  assert.equal(appFolder(' citofony-api '), 'citofony_api');
});

test('an open workspace shows its apps only: never VS Code folders scanned nor projects opened by hand elsewhere', () => {
  const w = parseCli(SHOW, 0)!;
  const app = [{ root: '/ws/api' }], scan = [{ root: '/other/langgraph' }], byHand = [{ root: '/nuc/rick_and_morty' }, { root: '/other/langgraph' }];
  assert.deepEqual(shownProjects(true, w, () => app, () => scan, () => byHand), app);
  // not known yet (the CLI still answering): nothing, not the scan of a parent folder
  assert.deepEqual(shownProjects(false, undefined, () => app, () => scan, () => byHand), []);
  // no workspace: the folders' projects, then the ones opened by hand, each once
  assert.deepEqual(shownProjects(true, undefined, () => app, () => scan, () => byHand), [{ root: '/other/langgraph' }, { root: '/nuc/rick_and_morty' }]);
});

test('a failed reading after the marker changed keeps the workspace while its marker is there', () => {
  const w = parseCli(SHOW, 0)!;
  assert.equal(afterReload(w, null, true), w);
  assert.equal(afterReload(w, null, false), undefined);
  const fresh = { ...w, name: 'renamed' };
  assert.equal(afterReload(w, fresh, true), fresh);
});
