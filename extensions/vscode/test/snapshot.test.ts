import assert from 'node:assert/strict';
import * as path from 'node:path';
import { test } from 'node:test';
import { findInstalled, newerVersion, syncFor, versionFromLatestUrl } from '../src/snapshotCheck';

const inst = (version: string, ai?: string) => ({ root: '/i', version, ai });

test('one version everywhere: nothing to do; a build from source (no .version): nothing to compare', () => {
  assert.deepEqual(syncFor('0.80.0', inst('0.80.0', '0.80.0')), { kind: 'none' });
  assert.deepEqual(syncFor('0.80.0', undefined), { kind: 'none' });
});

test('the store updated the extension: NuclearLang and its services follow it', () => {
  assert.deepEqual(syncFor('0.81.0', inst('0.80.0')), { kind: 'update', to: '0.81.0' });
  assert.deepEqual(syncFor('0.80.10', inst('0.80.9')), { kind: 'update', to: '0.80.10' });
});

test('an older extension than the installation: the installed release brings its own', () => {
  assert.deepEqual(syncFor('0.79.0', inst('0.80.0')), { kind: 'extension', to: '0.80.0' });
});

test('AI services of another version: updated to the installation', () => {
  assert.deepEqual(syncFor('0.80.0', inst('0.80.0', '0.79.0')), { kind: 'update', to: '0.80.0' });
});

test('the installation is found through the PATH, the link resolved', () => {
  const files: Record<string, string> = { '/opt/nl/bin/nuclear': '', '/opt/nl/.version': '0.80.0\n', '/opt/nl/ai/.version': '0.80.0\n' };
  const found = findInstalled({ PATH: ['/usr/bin', '/home/u/.local/bin'].join(path.delimiter) }, '/home/u', (f) => f in files || f === '/home/u/.local/bin/nuclear', (f) => files[f], () => '/opt/nl/bin/nuclear');
  assert.deepEqual(found, { root: '/opt/nl', version: '0.80.0', ai: '0.80.0' });
  assert.equal(findInstalled({ PATH: '/x' }, '/h', (f) => f === '/x/nuclear', () => '', (f) => f), undefined);
});

test('the floating update button: the tag of releases/latest, offered only when newer', () => {
  assert.equal(versionFromLatestUrl('https://github.com/nuclearlang/lang/releases/tag/v0.81.0'), '0.81.0');
  assert.equal(versionFromLatestUrl('https://github.com/nuclearlang/lang/releases/latest'), undefined);
  assert.equal(newerVersion('0.81.0', '0.80.0'), true);
  assert.equal(newerVersion('0.80.10', '0.80.9'), true);
  assert.equal(newerVersion('0.80.0', '0.80.0'), false);
  assert.equal(newerVersion('0.79.9', '0.80.0'), false);
});
