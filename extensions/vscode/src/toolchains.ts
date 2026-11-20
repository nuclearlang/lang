// The platforms' toolchains (`nuclear.toolchains.*`): Python for the fastapi backends, Node.js for TypeScript, NestJS
// and React, Flutter's SDK for mobile. The `nuclear` CLI finds each by its variable (`NUCLEAR_PYTHON`, `NUCLEAR_NODE`,
// `FLUTTER` or `FLUTTER_ROOT`), then Nuclear's own (`<installation>/toolchains/<id>`), then the PATH. Python comes with
// the installation (the AI services' own, `<installation>/ai/python`): it is used when no setting says otherwise.
// No editor here: the environment and the status are tested with node:test (test/toolchains.test.ts).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { installDir } from './aiMachine';
import { toolEnv } from '../../tools/nuclear-builder/src/support';

export type ToolchainId = 'python' | 'node' | 'flutter';
export type Platform = 'mobile' | 'backend' | 'web';
/** Where a toolchain was found: the setting, the editor's environment, the installation's own, the PATH, nowhere. */
export type Where = 'setting' | 'env' | 'included' | 'nuclear' | 'path' | 'missing' | 'broken';

export interface Toolchain {
  id: ToolchainId;
  name: string;
  /** The platforms that need it. */
  platforms: Platform[];
  /** Mobile cannot build without Flutter. */
  required: boolean;
  variable: string;
}

export const TOOLCHAINS: Toolchain[] = [
  { id: 'python', name: 'Python', platforms: ['backend'], required: false, variable: 'NUCLEAR_PYTHON' },
  { id: 'node', name: 'Node.js', platforms: ['backend', 'web'], required: false, variable: 'NUCLEAR_NODE' },
  { id: 'flutter', name: 'Flutter', platforms: ['mobile'], required: true, variable: 'FLUTTER' },
];

export type Paths = Partial<Record<ToolchainId, string>>;

export interface Status {
  id: ToolchainId;
  where: Where;
  path?: string;
  version?: string;
}

type Exists = (file: string) => boolean;

/** The executables of the installation, in the order they are tried: Python's included one first. */
export function ownPaths(id: ToolchainId, env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): string[] {
  const root = installDir(env);
  const win = platform === 'win32';
  if (id === 'python') return [win ? path.join(root, 'ai', 'python', 'python.exe') : path.join(root, 'ai', 'python', 'bin', 'python3'), win ? path.join(root, 'toolchains', 'python', 'python.exe') : path.join(root, 'toolchains', 'python', 'bin', 'python3')];
  if (id === 'node') return [win ? path.join(root, 'toolchains', 'node', 'node.exe') : path.join(root, 'toolchains', 'node', 'bin', 'node')];
  // `nuclear setup flutter` installs it in ~/develop/flutter (not under the installation)
  return [path.join(env.HOME ?? env.USERPROFILE ?? '', 'develop', 'flutter', 'bin', win ? 'flutter.bat' : 'flutter')];
}

/** A Flutter setting is the executable (`…/bin/flutter`, `flutter.bat`) or the SDK's root (often a folder named flutter). */
export const isFlutterExecutable = (p: string): boolean => /^flutter\.(bat|exe)$/i.test(path.basename(p)) || (path.basename(p) === 'flutter' && path.basename(path.dirname(p)) === 'bin');
const flutterBin = (p: string, platform: NodeJS.Platform) => (isFlutterExecutable(p) ? p : path.join(p, 'bin', platform === 'win32' ? 'flutter.bat' : 'flutter'));

/** The variables each setting gives `nuclear`, over `env`: a setting wins; with no Python setting (and no variable),
 * the included Python. Variables the user set themselves stay when their setting is empty. */
export function toolchainEnv(paths: Paths, env: NodeJS.ProcessEnv = process.env, exists: Exists = fs.existsSync, platform: NodeJS.Platform = process.platform): NodeJS.ProcessEnv {
  const out = { ...env };
  const python = paths.python?.trim() || env.NUCLEAR_PYTHON || ownPaths('python', env, platform).find(exists);
  if (python) out.NUCLEAR_PYTHON = python;
  if (paths.node?.trim()) out.NUCLEAR_NODE = paths.node.trim();
  const flutter = paths.flutter?.trim();
  if (flutter && isFlutterExecutable(flutter)) {
    out.FLUTTER = flutter;
    out.FLUTTER_ROOT = path.dirname(path.dirname(flutter));
  } else if (flutter) {
    out.FLUTTER_ROOT = flutter;
    delete out.FLUTTER;
  }
  return out;
}

const COMMANDS: Record<ToolchainId, string[]> = { python: ['python3', 'python'], node: ['node'], flutter: ['flutter'] };

/** The first of a toolchain's commands in a PATH (with Windows' extensions). */
export function onPath(id: ToolchainId, env: NodeJS.ProcessEnv = process.env, exists: Exists = fs.existsSync, platform: NodeJS.Platform = process.platform): string | undefined {
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const dirs = (env[key] ?? '').split(platform === 'win32' ? ';' : ':').filter(Boolean);
  const exts = platform === 'win32' ? ['.exe', '.bat', '.cmd'] : [''];
  for (const cmd of COMMANDS[id]) for (const d of dirs) for (const x of exts) if (exists(path.join(d, cmd + x))) return path.join(d, cmd + x);
  return undefined;
}

/** Where each toolchain is, by the CLI's own order (setting → variable → Nuclear's own → PATH), without running anything. */
export function probe(id: ToolchainId, paths: Paths, env: NodeJS.ProcessEnv = process.env, exists: Exists = fs.existsSync, platform: NodeJS.Platform = process.platform): Status {
  const set = paths[id]?.trim();
  if (set) return exists(id === 'flutter' ? flutterBin(set, platform) : set) ? { id, where: 'setting', path: set } : { id, where: 'missing', path: set };
  const variable = id === 'flutter' ? env.FLUTTER || (env.FLUTTER_ROOT && flutterBin(env.FLUTTER_ROOT, platform)) : env[id === 'python' ? 'NUCLEAR_PYTHON' : 'NUCLEAR_NODE'];
  if (variable && exists(variable)) return { id, where: 'env', path: variable };
  const own = ownPaths(id, env, platform).find(exists);
  if (own) return { id, where: 'nuclear', path: own };
  const found = onPath(id, env, exists, platform);
  return found ? { id, where: 'path', path: found } : { id, where: 'missing' };
}

/** The toolchains of `nuclear doctor --json` (`{ toolchains: { python: { found, path, version } } }`), or null when it
 * has none (an older CLI). Its `env` is the setting when the path is the setting's (the editor passes it). */
export function parseDoctor(text: string, paths: Paths): Status[] | null {
  let json: { toolchains?: Record<string, { found?: string; source?: string; path?: string; version?: string }> };
  try {
    json = JSON.parse(text.slice(text.indexOf('{')));
  } catch {
    return null;
  }
  const t = json?.toolchains;
  if (!t || typeof t !== 'object') return null;
  const valid: Where[] = ['env', 'included', 'nuclear', 'path', 'missing', 'broken'];
  return TOOLCHAINS.map(({ id }) => {
    const x = t[id];
    const raw = String(x?.found ?? x?.source ?? 'missing').toLowerCase() as Where;
    const where = valid.includes(raw) ? raw : 'missing';
    const p = typeof x?.path === 'string' ? x.path : undefined;
    const setting = paths[id]?.trim();
    return { id, where: where === 'env' && setting && p && (p === setting || p.startsWith(setting)) ? 'setting' : where, ...(p ? { path: p } : {}), ...(x?.version ? { version: String(x.version) } : {}) };
  });
}

/**
 * The `nuclear` the extension runs: the installer's, then the PATH, else the bare name. Never a command a project
 * names in its files: a cloned repository's `build/*.code-workspace` could name any program (spec 018 M2).
 */
export function nuclearCommand(env: NodeJS.ProcessEnv = process.env, platform = process.platform, exists: (file: string) => boolean = fs.existsSync): string {
  const exe = platform === 'win32' ? 'nuclear.exe' : 'nuclear';
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const sep = platform === 'win32' ? ';' : ':';
  const onPath = (toolEnv(env, undefined, platform)[key] ?? '').split(sep).filter(Boolean).map((d) => path.join(d, exe));
  return [path.join(installDir(env), 'bin', exe), ...onPath].find((c) => exists(c)) ?? 'nuclear';
}

/** The variables of a project's build task the extension passes on: only the toolchains' own (`FLUTTER_ROOT`), never
 * one that loads code into a process (`LD_PRELOAD`, `NODE_OPTIONS`...) from a cloned repository (spec 018 M2). */
export function taskEnv(env: Record<string, unknown> | undefined): Record<string, string> {
  const allowed = ['FLUTTER_ROOT', 'JAVA_HOME', 'ANDROID_HOME', 'ANDROID_SDK_ROOT'];
  return Object.fromEntries(Object.entries(env ?? {}).filter(([k, v]) => allowed.includes(k) && typeof v === 'string')) as Record<string, string>;
}

/**
 * Where the language server may be, in order: the installer's (this system's own build) → the PATH → the one bundled in
 * the extension → a build of the repository (development). The bundled one is a Linux x86_64 build: anywhere else it
 * cannot run (spawn ENOEXEC on a Mac), so it is not a candidate there.
 */
export function serverCandidates(extensionDir: string, env: NodeJS.ProcessEnv = process.env, platform = process.platform, arch = process.arch): string[] {
  const exe = platform === 'win32' ? 'nuclear-lsp.exe' : 'nuclear-lsp';
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const sep = platform === 'win32' ? ';' : ':';
  const onPath = (toolEnv(env, undefined, platform)[key] ?? '').split(sep).filter(Boolean).map((d) => path.join(d, exe));
  return [
    path.join(installDir(env), 'bin', exe),
    ...onPath,
    ...(platform === 'linux' && arch === 'x64' ? [path.join(extensionDir, 'server', exe)] : []),
    path.join(extensionDir, '..', 'target', 'release', exe),
    path.join(extensionDir, '..', 'target', 'debug', exe),
  ];
}

/**
 * The Flutter SDK the Dart extension already uses (`dart.flutterSdkPath`, or the first of `dart.flutterSdkPaths` that
 * holds an SDK): with no setting of Nuclear's and no variable, it is Flutter's root for `nuclear`, so a Flutter already
 * on the machine is never offered again.
 */
export function dartFlutterRoot(sdkPath: unknown, sdkPaths: unknown, exists: Exists = fs.existsSync, platform: NodeJS.Platform = process.platform): string | undefined {
  const all = [sdkPath, ...(Array.isArray(sdkPaths) ? sdkPaths : [])].filter((p): p is string => typeof p === 'string' && p.trim() !== '');
  return all.map((p) => p.trim()).find((p) => exists(flutterBin(p, platform)));
}
