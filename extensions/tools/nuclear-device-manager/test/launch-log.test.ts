import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { appendLog, Launch, logFile, reason, RUN_STALL_MS, RunFollower, STALL_MS, WEB_STALL_MS } from '../src/launch-log';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'launch-'));

test('the project log keeps each line with its time, and a missing root writes nothing', () => {
  const root = tmp();
  appendLog(root, 'nuclear build\n✓ 14 files\n\n');
  const text = fs.readFileSync(logFile(root)!, 'utf8');
  assert.match(text, /^\d{4}-\d\d-\d\dT.* nuclear build\n.* ✓ 14 files\n$/);
  appendLog(undefined, 'nothing');
});

test('a failure is explained by its error lines, else by the last lines', () => {
  assert.deepEqual(reason(['Compiling', 'lib/main.dart:3: Error: x is not defined', 'done']), ['lib/main.dart:3: Error: x is not defined']);
  assert.deepEqual(reason(['a', 'b', 'c'], 2), ['b', 'c']);
});

test('a step silent for too long is stuck; output keeps it alive; live ends the watch', () => {
  const root = tmp();
  const stuck: string[] = [];
  const stall = { ...STALL_MS, compile: 1000 };
  const l = new Launch(root, () => undefined, (x) => stuck.push(x.step), stall, 1e9);
  l.to('flutter');
  l.to('compile');
  l.out('Compiling lib/main.dart for the Web...');
  l.check(Date.now() + 500);
  assert.deepEqual(stuck, []);
  l.check(Date.now() + 5000);
  assert.deepEqual(stuck, ['compile']);
  assert.ok(l.done);
  assert.match(fs.readFileSync(logFile(root)!, 'utf8'), /failed at compile: no progress/);

  const ok = new Launch(root, () => undefined, () => assert.fail('not stuck'), stall, 1e9);
  ok.to('browser');
  ok.to('flutter'); // a step never goes back
  assert.equal(ok.step, 'browser');
  ok.to('live');
  ok.check(Date.now() + 1e7);
  assert.ok(ok.done);
});

test('a terminal run is followed through the lines nuclear run appends to the log', () => {
  const root = tmp();
  appendLog(root, 'old run\nfailed: an old failure');
  const steps: string[] = [];
  const failed: string[] = [];
  const launch = new Launch(undefined, (l) => steps.push(l.step), () => undefined, RUN_STALL_MS, 1e9);
  const f = new RunFollower(root, launch, (why) => failed.push(why));
  appendLog(root, '--- nuclear run\nstep: build\n✓ 12 files\nstep: serve http://localhost:8000');
  f.poll();
  assert.deepEqual(steps, ['build', 'serve']);
  assert.equal(f.url, 'http://localhost:8000');
  assert.deepEqual(launch.output, ['✓ 12 files']);
  appendLog(root, 'ModuleNotFoundError: No module named x\nexited: 1');
  f.poll();
  assert.deepEqual(failed, ['the command ended (exit code 1)']);
  assert.deepEqual(reason(launch.output), ['ModuleNotFoundError: No module named x']);
  assert.ok(launch.done);
});

test('the web device has its own steps and limits', () => {
  const stuck: string[] = [];
  const l = new Launch(tmp(), () => undefined, (x) => stuck.push(x.step), { ...WEB_STALL_MS, server: 1000 }, 1e9, 'the web device');
  assert.equal(l.step, 'build');
  l.to('server'); // install skipped: the app had its packages
  l.check(Date.now() + 5000);
  assert.deepEqual(stuck, ['server']);
});
