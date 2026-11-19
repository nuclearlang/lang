// What the editor reads of the AI services of this machine (the choice the set-up wrote, where the services answer) and
// how it runs their set-up: `nuclear-builder setup`, written in Nuclear (extensions/tools/nuclear-builder/setup.nuc),
// is a process the editor starts and reads; no process stays alive between actions. No editor here: the set-up page,
// the settings page and Nuclear Builder share it.
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { toolEnv } from '../../tools/nuclear-builder/src/support';

/** The folder of the installation (`NUCLEAR_INSTALL`), as the installers leave it. */
export function installDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.NUCLEAR_INSTALL || (process.platform === 'win32' ? path.join(env.LOCALAPPDATA ?? os.homedir(), 'nuclearlang') : path.join(os.homedir(), '.local', 'share', 'nuclearlang'));
}

/** What the set-up chose on this machine (`KEY=value` lines): the mode, the profile, its models, the ports. */
export function machineFile(env: NodeJS.ProcessEnv = process.env): string {
  const base = process.platform === 'win32' ? (env.APPDATA ?? os.homedir()) : env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'nuclearlang', 'ai.env');
}

export function readMachine(file = machineFile()): Record<string, string> {
  try {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l));
    return Object.fromEntries(lines.map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  } catch {
    return {};
  }
}

/** The ports the services listen on (127.0.0.1) when nothing else holds them. */
export const PORTS = { graph: 7878, developer: 7879 };

export interface Urls {
  graph: string;
  developer: string;
  ollama: string;
}

/** Where the services answer: the environment, else the ports the set-up chose, else the usual ones. */
export function urls(env: NodeJS.ProcessEnv = process.env): Urls {
  const m = readMachine();
  return {
    graph: env.NUCLEAR_GRAPH_URL || `http://127.0.0.1:${m.NUCLEAR_GRAPH_PORT || PORTS.graph}`,
    developer: env.NUCLEAR_DEVELOPER_URL || `http://127.0.0.1:${m.NUCLEAR_DEVELOPER_PORT || PORTS.developer}`,
    ollama: env.OLLAMA_URL || m.OLLAMA_URL || 'http://localhost:11434',
  };
}

/** The set-up's command: the AI archive's own (it runs before the set-up linked it onto the PATH), else the PATH's. */
export function builderCommand(env: NodeJS.ProcessEnv = process.env): string {
  const own = path.join(installDir(env), 'ai', 'bin', process.platform === 'win32' ? 'nuclear-builder.cmd' : 'nuclear-builder');
  return fs.existsSync(own) ? own : 'nuclear-builder';
}

/** Runs `nuclear-builder <args>`; each line it prints goes to `line` as it comes. Resolves with its exit code and all it
 * printed on stdout (stderr only to `line`). `input` is written to its stdin (a team to save, a key for the vault:
 * never a command line argument, which other users of the machine can read). */
export function builder(args: string[], line: (text: string) => void = () => undefined, input?: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const p = spawn(builderCommand(), args, { env: toolEnv(), shell: process.platform === 'win32' });
    p.stdin.on('error', () => undefined); // a command that exits before reading its input
    p.stdin.end(input ?? '');
    let out = '';
    let rest = '';
    p.stdout.on('data', (d: Buffer) => {
      const text = d.toString('utf8');
      out += text;
      const lines = (rest + text).split(/\r?\n/);
      rest = lines.pop() ?? '';
      for (const l of lines) if (l) line(l);
    });
    p.stderr.on('data', (d: Buffer) => d.toString('utf8').split(/\r?\n/).filter(Boolean).forEach(line));
    p.on('error', (e) => resolve({ code: 127, out: `nuclear-builder: ${e.message}` }));
    p.on('close', (code) => {
      if (rest) line(rest);
      resolve({ code: code ?? 1, out });
    });
  });
}

/** `nuclear-builder setup <args> --json`: what it printed, read as JSON; undefined when it failed. */
export async function builderJson<T>(args: string[]): Promise<T | undefined> {
  const r = await builder(['setup', ...args]);
  if (r.code !== 0) return undefined;
  try {
    return JSON.parse(r.out) as T;
  } catch {
    return undefined;
  }
}
