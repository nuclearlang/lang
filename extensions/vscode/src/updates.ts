// What the editor's automatic update computes (autoUpdate.ts), with no `vscode` import: test/notify.test.ts.
import * as os from 'node:os';
import * as path from 'node:path';

/** The command's cache folder (`$XDG_CACHE_HOME/nuclearlang`, else `~/.cache/nuclearlang`), where it writes `updated`. */
export function cacheDir(env: NodeJS.ProcessEnv = process.env, platform = process.platform, home = os.homedir()): string {
  const base = platform !== 'win32' && env.XDG_CACHE_HOME ? env.XDG_CACHE_HOME : path.join(home, '.cache');
  return path.join(base, 'nuclearlang');
}

/** `a` is a later version than `b` (numbers compared, a leading `v` aside); anything unreadable is not. */
export function later(a: string, b: string): boolean {
  const n = (v: string) => v.trim().replace(/^v/, '').split(/[^0-9]+/).slice(0, 3).map(Number);
  const x = n(a), y = n(b);
  if (x.length < 3 || y.length < 3 || [...x, ...y].some(Number.isNaN)) return false;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}
