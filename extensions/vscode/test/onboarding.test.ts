// The onboarding's progress (src/onboarding.ts): the next step, never back, what activation resumes (a reload after
// *This window*, a closed editor, a new window), 0.84.0's flag migrated; and where Nuclear Atlas's chat opens without
// a project (../tools/nuclear-atlas/src/chat.ts).
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';
import { advance, markerHasApps, next, resume } from '../src/onboarding';
import { chatRoots } from '../../tools/nuclear-atlas/src/chat';

const FIXTURES = path.resolve(__dirname, '..', '..', 'test', 'fixtures', 'compat');
const NOW = 1_800_000_000_000;

test('the steps go forward only', () => {
  assert.equal(next('workspace'), 'apps');
  assert.equal(next('tour'), 'services');
  assert.equal(next('done'), 'done');
  const o = advance(undefined, 'apps', 1, { root: '/w', chosenWindow: 'this' });
  assert.deepEqual(o, { step: 'apps', root: '/w', chosenWindow: 'this', at: 1 });
  // opening a workspace again during the tour does not bring it back to the apps
  assert.equal(advance({ step: 'tour', at: 1 }, 'apps', 2).step, 'tour');
  assert.equal(advance({ step: 'tour', at: 1 }, 'done', 2).step, 'done');
});

test('activation resumes the saved step: after a reload, a closed editor or a new window', () => {
  const base = { welcomed: true, servicesDone: false, recent: [], now: NOW };
  // *Create a workspace* → *This window*: saved before the reload, resumed at the apps with its workspace
  const saved = { step: 'apps' as const, root: '/w/shop', chosenWindow: 'this' as const, at: 1 };
  assert.deepEqual(resume({ ...base, saved }), saved);
  assert.equal(resume({ ...base, saved: { step: 'tour', at: 1 } }).step, 'tour');
  // the AI services' step lasts until their set-up is finished or declined
  assert.equal(resume({ ...base, saved: { step: 'services', at: 1 } }).step, 'services');
  assert.equal(resume({ ...base, servicesDone: true, saved: { step: 'services', at: 1 } }).step, 'done');
  assert.equal(resume({ ...base, saved: { step: 'done', at: 1 } }).step, 'done');
});

test('a first run starts from the workspace; an editor with workspaces of before is done', () => {
  assert.deepEqual(resume({ saved: undefined, welcomed: false, servicesDone: false, recent: [], now: NOW }), { step: 'workspace', at: NOW });
  assert.equal(resume({ saved: undefined, welcomed: false, servicesDone: false, recent: [{ root: '/a', apps: true }], now: NOW }).step, 'done');
});

test("0.84.0's flag (set the moment the welcome opened) resumes an onboarding never finished, once", () => {
  const state = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'global-state-0.84.0-onboarding.json'), 'utf8')) as { 'nuclear.workspace.welcomed': boolean; 'nuclear.workspaces.recent': { root: string }[] };
  const recent = state['nuclear.workspaces.recent'].map((r) => ({ root: r.root, apps: false }));
  const facts = { saved: undefined, welcomed: state['nuclear.workspace.welcomed'], servicesDone: false, recent, now: NOW };
  // a workspace with no app and no AI services: back at its apps
  assert.deepEqual(resume(facts), { step: 'apps', root: '/home/someone/projects/citofony', at: NOW });
  // no workspace at all: from the start
  assert.equal(resume({ ...facts, recent: [] }).step, 'workspace');
  // something says it was finished: an app, or the AI services set up
  assert.equal(resume({ ...facts, recent: [{ root: recent[0].root, apps: true }] }).step, 'done');
  assert.equal(resume({ ...facts, servicesDone: true }).step, 'done');
  // once written, the saved progress decides from then on
  assert.equal(resume({ ...facts, saved: { step: 'done', at: 1 } }).step, 'done');
});

test("a marker's apps", () => {
  assert.ok(markerHasApps('/w', () => 'workspace(name = "w")\napp(folder = "w_api", platform = "backend")\n'));
  assert.ok(!markerHasApps('/w', () => '// app(folder = "x")\nworkspace(name = "w")\n'));
  assert.ok(!markerHasApps('/nowhere'));
});

test("Atlas's chat opens without a project: the workspace's (or the welcome's) folder", () => {
  const ws = { root: '/w/shop', name: 'shop' };
  assert.deepEqual(chatRoots([], undefined, ws, ''), { roots: [ws], root: '/w/shop' });
  const api = { root: '/w/shop/shop_api', name: 'shop_api' };
  // a project: its chat, the fallback not offered
  assert.deepEqual(chatRoots([api], undefined, ws, ''), { roots: [api], root: '/w/shop/shop_api' });
  // the folder it was opened on (the welcome's *Do it with me by chat*) stays beside the projects
  assert.deepEqual(chatRoots([api], ws, ws, '/w/shop'), { roots: [api, ws], root: '/w/shop' });
  assert.deepEqual(chatRoots([], undefined, undefined, ''), { roots: [], root: '' });
  // a workspace deleted from the disk: never opened, the chat goes to the fallback (the welcome's folder)
  const welcome = { root: '/g/welcome', name: 'Welcome' };
  assert.deepEqual(chatRoots([], undefined, welcome, '/w/shop', ws, (d) => d !== '/w/shop'), { roots: [welcome], root: '/g/welcome' });
});

test("an open workspace is Atlas's first folder and the one it opens; a project asked for stays", () => {
  const ws = { root: '/w/shop', name: 'shop' }, api = { root: '/w/shop/shop_api', name: 'shop_api' };
  assert.deepEqual(chatRoots([api], undefined, ws, '', ws), { roots: [ws, api], root: '/w/shop' });
  assert.deepEqual(chatRoots([api], undefined, ws, '/w/shop/shop_api', ws), { roots: [ws, api], root: '/w/shop/shop_api' });
  // the workspace once, even when it is also the folder Atlas was opened on
  assert.deepEqual(chatRoots([api], ws, ws, '', ws).roots, [ws, api]);
});
