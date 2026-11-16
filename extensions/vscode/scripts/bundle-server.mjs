// Copies what the extension ships besides its own code into server/ (and refreshes the Code Metrics settings):
//   server/nuclear-lsp     the language server (`cargo build --release -p nuclear-lsp`)
//   server/dialects/       every dialect of the tree, each language with its frameworks and type definitions
//                          (the server finds them next to its binary)
//   server/platforms/      the contract of each platform (found as dialects/../platforms)
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeCodeMetricsSettings } from './codemetrics-settings.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ext = join(here, '..');
// the working tree's root, with nuclear-lsp in its workspace
const repo = join(ext, '..', '..');
const editors = repo;
const exe = process.platform === 'win32' ? 'nuclear-lsp.exe' : 'nuclear-lsp';

execFileSync('cargo', ['build', '--release', '-p', 'nuclear-lsp'], { cwd: editors, stdio: 'inherit' });
// the Code Metrics settings of package.json come from the server's defaults
writeCodeMetricsSettings();

const out = join(ext, 'server');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(editors, 'target', 'release', exe), join(out, exe));
chmodSync(join(out, exe), 0o755);
// every dialect (its `docs/` stays behind) and the contract of each platform
cpSync(join(repo, 'nuclearlang', 'dialects'), join(out, 'dialects'), { recursive: true, filter: src => !/[\\/]dialects[\\/][^\\/]+[\\/]docs$/.test(src) });
const platforms = join(repo, 'nuclear-synapsis-framework', 'platforms');
for (const p of readdirSync(platforms).filter(n => existsSync(join(platforms, n, 'platform.toml')))) {
  mkdirSync(join(out, 'platforms', p), { recursive: true });
  cpSync(join(platforms, p, 'platform.toml'), join(out, 'platforms', p, 'platform.toml'));
}
// the bundled server must load its dialects without the repository
execFileSync(join(out, exe), ['--check-bundle'], { stdio: 'inherit' });
console.log('server bundled in', out);
