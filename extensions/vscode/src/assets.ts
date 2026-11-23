// The pages' bundled files, local first (spec 023, requirement 7): every script, style and icon a page loads comes
// with the extension. When one is missing (a broken install), the files are taken, as a contingency, from the
// release of this same version on GitHub (its `.vsix`), checked (its `.sha256` when the release has one, else its
// size and that it is the zip of this version) and kept in the extension's storage (`<storage>/assets/<version>/`).
// No `vscode` import: the tests drive the decision with the network stubbed; `assetsPage.ts` is the editor's side.
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

export const RELEASES = 'https://github.com/nuclearlang/nuclearlang/releases/download';
export const vsixUrl = (version: string) => `${RELEASES}/v${version}/nuclearlang-${version}.vsix`;

/** What the pages load from the extension's folder: taken together when one is missing. A folder ends in `/`. */
export const PAGE_ASSETS = ['out/chat-embed.js', 'out/builder-flow.js', 'out/builder-flow.css', 'icons/', 'icon-themes/'];

/** One download: its status and bytes, and the length the server announced. */
export type Fetch = (url: string) => Promise<{ status: number; bytes: Buffer; length?: number }>;

/** Where the copy of a version is kept. */
export const cacheDir = (storage: string, version: string) => path.join(storage, 'assets', version);

const safe = (rel: string) => !!rel && !path.isAbsolute(rel) && !rel.split(/[\\/]/).includes('..');

/** The folder that has `rel` now: the extension's, else the kept copy, else null (to be taken from the release). */
export function assetDir(rel: string, extensionDir: string, cache: string): string | null {
  if (!safe(rel)) return null;
  if (fs.existsSync(path.join(extensionDir, rel))) return extensionDir;
  if (fs.existsSync(path.join(cache, rel))) return cache;
  return null;
}

/** Whether a file found nowhere means a broken install, to be mended from the release: one of the pages' own files
 * is missing, or a folder of them is gone. An icon a theme does not have, in a whole install, is not. */
export function brokenInstall(rel: string, extensionDir: string): boolean {
  return PAGE_ASSETS.includes(rel) || PAGE_ASSETS.some((f) => !fs.existsSync(path.join(extensionDir, f)));
}

/** The entries of a zip (stored or deflated; no zip64: a `.vsix` is far below 4 GB), each read when asked. */
export function zipEntries(zip: Buffer): Map<string, () => Buffer> {
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) if (zip.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('not a zip');
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const out = new Map<string, () => Buffer>();
  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(at) !== 0x02014b50) throw new Error('a broken zip');
    const method = zip.readUInt16LE(at + 10), size = zip.readUInt32LE(at + 20);
    const nameLen = zip.readUInt16LE(at + 28), extraLen = zip.readUInt16LE(at + 30), commentLen = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLen);
    out.set(name, () => {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return zlib.inflateRawSync(data);
      throw new Error(`${name}: compression ${method}`);
    });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** The release's `.vsix` checked: its `.sha256` when the release has one; else the size the server announced and
 * that it is the zip of this version (its `extension/package.json`). The entries, or why it was refused. */
export async function checkedVsix(version: string, fetch: Fetch): Promise<Map<string, () => Buffer>> {
  const url = vsixUrl(version);
  const got = await fetch(url);
  if (got.status !== 200) throw new Error(`${url}: HTTP ${got.status}`);
  const sum = await fetch(`${url}.sha256`).catch(() => ({ status: 0, bytes: Buffer.alloc(0) }));
  if (sum.status === 200) {
    const want = sum.bytes.toString('utf8').trim().split(/\s+/)[0]?.toLowerCase();
    const have = crypto.createHash('sha256').update(got.bytes).digest('hex');
    if (want !== have) throw new Error(`${url}: its checksum does not match the release's`);
  } else if (got.length !== undefined && got.length !== got.bytes.length) {
    throw new Error(`${url}: ${got.bytes.length} bytes, the release says ${got.length}`);
  }
  const entries = zipEntries(got.bytes);
  const pkg = entries.get('extension/package.json');
  const v = pkg && (JSON.parse(pkg().toString('utf8')) as { version?: string }).version;
  if (v !== version) throw new Error(`${url}: it is not NuclearLang ${version} (${v ?? 'no package.json'})`);
  return entries;
}

/** The kept copy of `files` (a name ending in `/` is a folder) written from the release's `.vsix`: only those, under
 * `cache`, written apart first and moved into place, so a half download never counts as a copy. */
export async function restoreAssets(files: string[], o: { version: string; cache: string; fetch: Fetch }): Promise<string[]> {
  const entries = await checkedVsix(o.version, o.fetch);
  const tmp = `${o.cache}.part-${process.pid}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  const written: string[] = [];
  for (const [name, read] of entries) {
    if (!name.startsWith('extension/') || name.endsWith('/')) continue;
    const rel = name.slice('extension/'.length);
    if (!safe(rel) || !files.some((f) => (f.endsWith('/') ? rel.startsWith(f) : rel === f))) continue;
    const to = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, read());
    written.push(rel);
  }
  const lacking = files.filter((f) => !written.some((w) => (f.endsWith('/') ? w.startsWith(f) : w === f)));
  if (lacking.length) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error(`${vsixUrl(o.version)} has no ${lacking.join(', ')}`);
  }
  fs.rmSync(o.cache, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(o.cache), { recursive: true });
  fs.renameSync(tmp, o.cache);
  return written;
}

/** The whole decision for `files`: the extension's own folder when it has them, else the kept copy, else the copy
 * taken from the release now. */
export async function resolveAssets(files: string[], o: { extensionDir: string; cache: string; version: string; fetch: Fetch }): Promise<{ from: 'bundled' | 'cache' | 'release'; dir: string }> {
  const has = (dir: string) => files.every((f) => fs.existsSync(path.join(dir, f)));
  if (has(o.extensionDir)) return { from: 'bundled', dir: o.extensionDir };
  if (has(o.cache)) return { from: 'cache', dir: o.cache };
  await restoreAssets(files, o);
  return { from: 'release', dir: o.cache };
}

/** A download with the platform's `fetch` (redirects followed: a release's file is served from another host). */
export const httpFetch: Fetch = async (url) => {
  const r = await fetch(url, { redirect: 'follow' });
  const length = Number(r.headers.get('content-length'));
  return { status: r.status, bytes: Buffer.from(await r.arrayBuffer()), length: Number.isFinite(length) && length > 0 ? length : undefined };
};
