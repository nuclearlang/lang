import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backendScripts } from '../src/backendScripts';

test('a backend project has the commands of every backend dialect, run serving until stopped', () => {
  const scripts = backendScripts('/p', () => false);
  assert.deepEqual(scripts.map((s) => s.name), ['run', 'test', 'build', 'check', 'install']);
  assert.deepEqual(scripts.find((s) => s.name === 'run')?.args, ['run']);
  assert.equal(scripts.filter((s) => s.background).length, 1);
});

test('migrate appears once the project has a migrations folder', () => {
  const scripts = backendScripts('/p', (p) => p === '/p/migrations');
  assert.deepEqual(scripts.at(-1)?.args, ['migrate']);
});

test('the actions of a project never sit above or inside the file tree: a collapsed accordion below it (ADR-extensions-0002 rule 6)', () => {
  // the bundle runs from out/test; the page's script is read from the source
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '..', 'src', 'workspace.ts'), 'utf8') as string;
  const files = src.slice(src.indexOf('function renderFiles(pane, p) {'), src.indexOf('// shortcut: the explorer'));
  assert.ok(files.length > 100);
  assert.equal(files.includes("el('div', 'actions')"), false, 'no button row in the files pane');
  assert.ok(files.indexOf("pane.appendChild(tree)") < files.indexOf("el('div', 'acc'"), 'the accordion comes after the tree');
  assert.match(src, /let actionsOpen = false;/, 'collapsed by default');
});
