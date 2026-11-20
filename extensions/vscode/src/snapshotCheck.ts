import * as fs from 'fs';
import * as path from 'path';

/** What a public installer installed (ADR-platform-0011): its version, and the AI services' when they are there. */
export interface Installed {
  root: string;
  version: string;
  ai?: string;
}

/** The installation of the `nuclear` on the PATH (or in ~/.local/bin), when a public installer made it: its folder
 * holds `.version` (and `ai/.version`). A build from source has none: nothing to compare. */
export function findInstalled(
  env: NodeJS.ProcessEnv,
  home: string,
  exists: (f: string) => boolean = fs.existsSync,
  read: (f: string) => string = (f) => fs.readFileSync(f, 'utf8'),
  real: (f: string) => string = (f) => fs.realpathSync(f),
): Installed | undefined {
  const exe = process.platform === 'win32' ? 'nuclear.exe' : 'nuclear';
  const dirs = [...(env.PATH ?? env.Path ?? '').split(path.delimiter), path.join(home, '.local', 'bin')].filter(Boolean);
  for (const dir of dirs) {
    const bin = path.join(dir, exe);
    if (!exists(bin)) continue;
    let root: string;
    try {
      root = path.dirname(path.dirname(real(bin)));
    } catch {
      continue;
    }
    const file = path.join(root, '.version');
    if (!exists(file)) return undefined;
    const ai = path.join(root, 'ai', '.version');
    return { root, version: read(file).trim(), ai: exists(ai) ? read(ai).trim() : undefined };
  }
  return undefined;
}

const parts = (v: string) => v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
function compareVersions(a: string, b: string): number {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/** What makes the installation one snapshot again: nothing; `update` (NuclearLang and its services to the newest
 * release, which brings this extension's version: the stores publish with the release); or `extension` (this
 * extension is older than what is installed: the installed release's extension). */
export type Sync = { kind: 'none' } | { kind: 'update'; to: string } | { kind: 'extension'; to: string };

export function syncFor(extension: string, installed: Installed | undefined): Sync {
  if (!installed) return { kind: 'none' };
  const order = compareVersions(extension, installed.version);
  if (order > 0) return { kind: 'update', to: extension };
  if (order < 0) return { kind: 'extension', to: installed.version };
  if (installed.ai && installed.ai !== installed.version) return { kind: 'update', to: installed.version };
  return { kind: 'none' };
}
