// The pages' files, local first (spec 023, requirement 7): no page loads anything from the internet (its HTML and
// scripts, and the bundled out/*.js, scanned), and a missing bundled file is taken from the release of the same
// version, checked, kept in the storage (src/assets.ts), with the network stubbed. node:test, no editor.
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import * as zlib from 'node:zlib';
import { assetDir, brokenInstall, Fetch, resolveAssets, vsixUrl, zipEntries } from '../src/assets';

const VSCODE = path.resolve(__dirname, '..', '..');
const EXTENSIONS = path.dirname(VSCODE);

/** A zip of stored (or deflated) entries: what the reader needs, no checksums. */
function zip(files: Record<string, string>, deflate = false): Buffer {
  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let at = 0;
  for (const [name, text] of Object.entries(files)) {
    const n = Buffer.from(name), data = deflate ? zlib.deflateRawSync(Buffer.from(text)) : Buffer.from(text);
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt32LE(data.length, 18); l.writeUInt32LE(data.length, 22); l.writeUInt16LE(n.length, 26); l.writeUInt16LE(deflate ? 8 : 0, 8);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt16LE(deflate ? 8 : 0, 10); c.writeUInt32LE(at, 42);
    locals.push(l, n, data); centrals.push(c, n);
    at += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(at, 16);
  return Buffer.concat([...locals, cd, end]);
}

const FILES = ['out/chat-embed.js', 'icons/'];
const vsix = (version: string) => zip({ 'extension/package.json': JSON.stringify({ version }), 'extension/out/chat-embed.js': 'export const mount = 1;', 'extension/out/other.js': 'no', 'extension/icons/icon.svg': '<svg/>', 'extension/../evil.js': 'x' });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nuc-assets-'));
/** A release on a stubbed network: the `.vsix`, its `.sha256` when given; every URL asked kept. */
function release(bytes: Buffer, sha?: string, length = bytes.length): { fetch: Fetch; asked: string[] } {
  const asked: string[] = [];
  return { asked, fetch: async (url) => (asked.push(url), url.endsWith('.sha256') ? (sha === undefined ? { status: 404, bytes: Buffer.alloc(0) } : { status: 200, bytes: Buffer.from(`${sha}  x.vsix\n`) }) : url === vsixUrl('1.2.3') ? { status: 200, bytes, length } : { status: 404, bytes: Buffer.alloc(0) }) };
}

test('a file the extension has is the bundled one: nothing is downloaded', async () => {
  const ext = tmp(), cache = path.join(tmp(), 'assets', '1.2.3');
  fs.mkdirSync(path.join(ext, 'out')); fs.writeFileSync(path.join(ext, 'out', 'chat-embed.js'), ''); fs.mkdirSync(path.join(ext, 'icons'));
  const r = release(Buffer.alloc(0));
  assert.deepEqual(await resolveAssets(FILES, { extensionDir: ext, cache, version: '1.2.3', fetch: r.fetch }), { from: 'bundled', dir: ext });
  assert.deepEqual(r.asked, []);
  assert.equal(assetDir('out/chat-embed.js', ext, cache), ext);
  assert.equal(assetDir('../etc/passwd', ext, cache), null, 'never outside the folders');
});

test('a missing file is taken from the release, checked by its .sha256, only the files asked; then the kept copy is used', async () => {
  const ext = tmp(), cache = path.join(tmp(), 'assets', '1.2.3');
  const bytes = vsix('1.2.3'), r = release(bytes, crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.equal(assetDir('out/chat-embed.js', ext, cache), null);
  assert.equal(brokenInstall('out/chat-embed.js', ext), true);
  assert.deepEqual(await resolveAssets(FILES, { extensionDir: ext, cache, version: '1.2.3', fetch: r.fetch }), { from: 'release', dir: cache });
  assert.deepEqual(r.asked, [vsixUrl('1.2.3'), vsixUrl('1.2.3') + '.sha256']);
  assert.equal(r.asked[0], 'https://github.com/nuclearlang/lang/releases/download/v1.2.3/nuclearlang-1.2.3.vsix');
  assert.equal(fs.readFileSync(path.join(cache, 'out', 'chat-embed.js'), 'utf8'), 'export const mount = 1;');
  assert.ok(fs.existsSync(path.join(cache, 'icons', 'icon.svg')));
  assert.equal(fs.existsSync(path.join(cache, 'out', 'other.js')), false, 'only what the pages need');
  assert.equal(fs.existsSync(path.join(path.dirname(cache), 'evil.js')), false);
  assert.equal(assetDir('out/chat-embed.js', ext, cache), cache);
  // the kept copy: no download again
  const again = release(Buffer.alloc(0));
  assert.deepEqual(await resolveAssets(FILES, { extensionDir: ext, cache, version: '1.2.3', fetch: again.fetch }), { from: 'cache', dir: cache });
  assert.deepEqual(again.asked, []);
});

test('a release that does not check out is refused and nothing is kept', async () => {
  const ext = tmp(), dir = tmp(), cache = path.join(dir, 'assets', '1.2.3');
  const opts = (fetch: Fetch) => ({ extensionDir: ext, cache, version: '1.2.3', fetch });
  await assert.rejects(resolveAssets(FILES, opts(release(vsix('1.2.3'), 'f'.repeat(64)).fetch)), /checksum/);
  // no .sha256: the size the server said, and the zip of this version
  await assert.rejects(resolveAssets(FILES, opts(release(vsix('1.2.3'), undefined, 10).fetch)), /bytes/);
  await assert.rejects(resolveAssets(FILES, opts(release(vsix('9.9.9')).fetch)), /not NuclearLang 1\.2\.3/);
  await assert.rejects(resolveAssets(FILES, opts(release(Buffer.from('<html>not found</html>')).fetch)), /not a zip/);
  await assert.rejects(resolveAssets(FILES, opts(async () => ({ status: 404, bytes: Buffer.alloc(0) }))), /HTTP 404/);
  assert.equal(fs.existsSync(cache), false);
  // with no .sha256 and a good zip of this version, it is taken
  assert.equal((await resolveAssets(FILES, opts(release(vsix('1.2.3')).fetch))).from, 'release');
  assert.equal(fs.readdirSync(path.dirname(cache)).length, 1, 'no half copy left beside it');
});

test('the zip reader reads deflated entries too', () => {
  const entries = zipEntries(zip({ 'a.txt': 'hello hello hello' }, true));
  assert.equal(entries.get('a.txt')!().toString(), 'hello hello hello');
});

// ---------- no page loads anything from the internet ----------

/** The links a page may show for the user to click (the project's own), and this machine. */
const ALLOWED = /^(https:\/\/(github\.com\/nuclearlang\b|nuclearlang\.github\.io\b)|http:\/\/(localhost|127\.0\.0\.1)\b)/;
/** What a page loads: an http(s) URL in src=, href= of a <link>, import(…)/import … from, url(…), @import. */
const LOADS = [/\bsrc\s*=\s*\\?["'`]?(https?:\/\/[^"'`\s)>]+)/gi, /<link\b[^>]*\bhref\s*=\s*\\?["'`]?(https?:\/\/[^"'`\s)>]+)/gi, /\bimport\s*\(\s*["'`](https?:\/\/[^"'`]+)/gi, /\bfrom\s*["'`](https?:\/\/[^"'`]+)/gi, /\burl\(\s*["']?(https?:\/\/[^"')\s]+)/g, /@import\s+(?:url\()?["']?(https?:\/\/[^"')\s;]+)/gi];
const sources = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(path.join(dir, e.name)) : /\.(tsx?|css|html)$/.test(e.name) ? [path.join(dir, e.name)] : [])) : []);

test('no page loads a script, a style, a font or an image from the internet', () => {
  const files = [path.join(VSCODE, 'src'), ...fs.readdirSync(path.join(EXTENSIONS, 'tools')).map((t) => path.join(EXTENSIONS, 'tools', t, 'src'))].flatMap(sources);
  // the bundles the pages load (out/chat-embed.js is Nuclear Chat's UI, out/builder-flow.* the diagram)
  for (const f of ['out/chat-embed.js', 'out/builder-flow.js', 'out/builder-flow.css']) if (fs.existsSync(path.join(VSCODE, f))) files.push(path.join(VSCODE, f));
  assert.ok(files.length > 50, `only ${files.length} files scanned: the scan is broken`);
  const bad: string[] = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const re of LOADS) for (const m of text.matchAll(re)) if (!ALLOWED.test(m[1])) bad.push(`${path.relative(EXTENSIONS, f)}: ${m[1]}`);
  }
  assert.deepEqual(bad, []);
});
