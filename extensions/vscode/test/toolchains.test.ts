// The platforms' toolchains (src/toolchains.ts): the variables the settings give `nuclear`, where each toolchain is
// found (setting → variable → NuclearLang's own → PATH), and what `nuclear doctor --json` says. node:test, no editor.
import assert from 'node:assert/strict';
import * as path from 'node:path';
import test from 'node:test';
import { dartFlutterRoot, onPath, ownPaths, parseDoctor, probe, serverCandidates, toolchainEnv } from '../src/toolchains';

const ROOT = '/opt/nuc';
const base = { NUCLEAR_INSTALL: ROOT, PATH: '/usr/bin:/bin' };
const has = (...files: string[]) => (f: string) => files.includes(f);
const included = path.join(ROOT, 'ai', 'python', 'bin', 'python3');

test('the settings become the variables nuclear reads', () => {
  const env = toolchainEnv({ python: '/py/bin/python3', node: ' /n/bin/node ', flutter: '/sdk/flutter' }, base, has(), 'linux');
  assert.equal(env.NUCLEAR_PYTHON, '/py/bin/python3');
  assert.equal(env.NUCLEAR_NODE, '/n/bin/node');
  assert.equal(env.FLUTTER_ROOT, '/sdk/flutter');
  assert.equal(env.FLUTTER, undefined);
  assert.equal(env.PATH, base.PATH);
});

test('a Flutter executable gives FLUTTER and its SDK root', () => {
  const env = toolchainEnv({ flutter: '/sdk/flutter/bin/flutter' }, base, has(), 'linux');
  assert.equal(env.FLUTTER, '/sdk/flutter/bin/flutter');
  assert.equal(env.FLUTTER_ROOT, '/sdk/flutter');
});

test('with no Python setting, the included Python; the user\'s own variables stay', () => {
  assert.equal(toolchainEnv({}, base, has(included), 'linux').NUCLEAR_PYTHON, included);
  assert.equal(toolchainEnv({}, base, has(), 'linux').NUCLEAR_PYTHON, undefined);
  const mine = toolchainEnv({ python: '' }, { ...base, NUCLEAR_PYTHON: '/mine', NUCLEAR_NODE: '/n' }, has(included), 'linux');
  assert.equal(mine.NUCLEAR_PYTHON, '/mine');
  assert.equal(mine.NUCLEAR_NODE, '/n');
});

test('Windows: the included Python is python.exe', () => {
  assert.equal(ownPaths('python', base, 'win32')[0], path.join(ROOT, 'ai', 'python', 'python.exe'));
});

test('the status follows the CLI order: setting, variable, NuclearLang\'s own, PATH', () => {
  assert.deepEqual(probe('node', { node: '/n/node' }, base, has('/n/node'), 'linux'), { id: 'node', where: 'setting', path: '/n/node' });
  assert.deepEqual(probe('node', { node: '/gone' }, base, has(), 'linux'), { id: 'node', where: 'missing', path: '/gone' });
  assert.equal(probe('node', {}, { ...base, NUCLEAR_NODE: '/e/node' }, has('/e/node'), 'linux').where, 'env');
  assert.deepEqual(probe('python', {}, base, has(included, '/usr/bin/python3'), 'linux'), { id: 'python', where: 'nuclear', path: included });
  assert.deepEqual(probe('python', {}, base, has('/usr/bin/python3'), 'linux'), { id: 'python', where: 'path', path: '/usr/bin/python3' });
  assert.equal(probe('flutter', { flutter: '/sdk' }, base, has('/sdk/bin/flutter'), 'linux').where, 'setting');
  assert.equal(probe('flutter', {}, { ...base, FLUTTER_ROOT: '/sdk' }, has('/sdk/bin/flutter'), 'linux').where, 'env');
  assert.deepEqual(probe('flutter', {}, base, has(), 'linux'), { id: 'flutter', where: 'missing' });
});

test('the PATH with Windows\' extensions', () => {
  assert.equal(onPath('node', { Path: 'C:\\a;C:\\n' }, has(path.join('C:\\n', 'node.exe')), 'win32'), path.join('C:\\n', 'node.exe'));
  assert.equal(onPath('python', base, has('/bin/python'), 'linux'), '/bin/python');
});

test('nuclear doctor --json, and an older CLI without it', () => {
  const out = parseDoctor('warning\n{"toolchains":{"python":{"found":"nuclear","path":"/p","version":"3.12"},"node":{"found":"env","path":"/n/node"},"flutter":{"found":"weird"}}}', { node: '/n/node' })!;
  assert.deepEqual(out, [
    { id: 'python', where: 'nuclear', path: '/p', version: '3.12' },
    { id: 'node', where: 'setting', path: '/n/node' },
    { id: 'flutter', where: 'missing' },
  ]);
  assert.equal(parseDoctor('Doctor summary for NuclearLang\n[✓] nuclear CLI', {}), null);
  assert.equal(parseDoctor('{"ok":true}', {}), null);
});

test("the language server is the installer's first; the bundled Linux build is never tried on a Mac", () => {
  const env = { NUCLEAR_INSTALL: '/inst', PATH: '/usr/bin' };
  const mac = serverCandidates('/ext', env, 'darwin', 'arm64');
  assert.equal(mac[0], path.join('/inst', 'bin', 'nuclear-lsp'));
  assert.ok(mac.includes(path.join('/usr/bin', 'nuclear-lsp')));
  assert.ok(!mac.includes(path.join('/ext', 'server', 'nuclear-lsp')));
  const linux = serverCandidates('/ext', env, 'linux', 'x64');
  assert.equal(linux[0], path.join('/inst', 'bin', 'nuclear-lsp'));
  assert.ok(linux.includes(path.join('/ext', 'server', 'nuclear-lsp')));
});

test("the Dart extension's Flutter is used: no second Flutter is offered", () => {
  const has = (f: string) => f === path.join('/sdk/flutter', 'bin', 'flutter') || f === path.join('/b/flutter', 'bin', 'flutter');
  assert.equal(dartFlutterRoot('/sdk/flutter', undefined, has, 'darwin'), '/sdk/flutter');
  assert.equal(dartFlutterRoot('', ['/gone', '/b/flutter'], has, 'darwin'), '/b/flutter');
  assert.equal(dartFlutterRoot(undefined, ['/gone'], has, 'darwin'), undefined);
});
