// The editor's collector (spec 015 phase 2): the token, the project's key, CORS only for the app's origin, the
// report written whole.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { Collector, localOrigins, projectKey } from '../src/collector';

test('the key of a project is the CLI\'s (FNV-1a of its folder)', () => {
  // the vector of tools/cli/src/framework/collector.rs
  assert.equal(projectKey('/no/such/project'), 'eebbee3a50ba7537');
});

test('the collector writes the report only with its token, for a known project, from the app\'s origin', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nuclear-collector-'));
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'nuclear-collector-registry-'));
  const c = new Collector(async (key) => (key === projectKey(other) ? { root: other, port: 5300 } : undefined));
  const base = await c.start();
  try {
    c.allow(root, 'http://127.0.0.1:5199/');
    const url = `${base}/${projectKey(root)}`;
    const report = JSON.stringify({ format: 1, app: 'web', roots: [] });
    const file = path.join(root, '.nuclear', 'monitor', 'report.json');
    const post = (u: string, origin?: string, body = report) => fetch(u, { method: 'POST', body, headers: origin ? { origin } : {} });
    assert.equal((await post(url.replace(c.token, '0'.repeat(32)), 'http://127.0.0.1:5199')).status, 403);
    assert.equal((await post(`${base}/0000000000000000`, 'http://127.0.0.1:5199')).status, 403);
    assert.equal((await post(url, 'http://127.0.0.1:5200')).status, 403);
    assert.equal((await post(url, 'http://evil.example')).status, 403);
    assert.equal((await post(url, 'http://127.0.0.1:5199', '{}')).status, 400);
    assert.equal(fs.existsSync(file), false);
    const ok = await post(url, 'http://127.0.0.1:5199');
    assert.equal(ok.status, 204);
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5199');
    assert.equal(fs.readFileSync(file, 'utf8'), report);
    const pre = await fetch(url, { method: 'OPTIONS', headers: { origin: 'http://127.0.0.1:5199' } });
    assert.equal(pre.status, 204);
    // a phone's app names no origin: the token is enough
    assert.equal((await post(url)).status, 204);
    // a project of the registry, from its own port
    assert.equal((await post(`${base}/${projectKey(other)}`, localOrigins(5300)[1])).status, 204);
    assert.ok(fs.existsSync(path.join(other, '.nuclear', 'monitor', 'report.json')));
  } finally {
    c.stop();
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(other, { recursive: true, force: true });
  }
});
