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
