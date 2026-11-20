// The Environments page's logic (spec 021), with no `vscode` import so node:test drives it: what `nuclear env list
// --json` prints turned into the grid (rows = variables, columns = the shared `.env` and each environment), the
// badges, and the argument lists of `nuclear env set/unset/use`. The page never writes a file: every change is one
// of these commands. A secret's value never goes in an argument: it is written on the command's stdin.

import { spawn } from 'child_process';
import { toolEnv } from '../../nuclear-builder/src/support';

export interface Use {
  file: string;
  line: number;
}
/** One value of a variable in one environment; `null`: none. A secret has no `value`. */
export type Value = { value?: string; secret?: boolean; source: string } | null;
export interface Variable {
  name: string;
  declared: boolean;
  required: boolean;
  default?: string;
  client: boolean;
  uses: Use[];
  values: Record<string, Value>;
}
/** `nuclear env list --json`. */
export interface EnvList {
  project: string;
  active: string;
  environments: string[];
  variables: Variable[];
}

/** The column of the shared `.env` (`--env` absent). */
export const SHARED = '';

export type Badge = 'required' | 'missing' | 'secret' | 'client' | 'unused';
export interface Cell {
  env: string;
  value?: string;
  secret: boolean;
  source?: string;
  /** What an empty cell shows: the default, else nothing. */
  placeholder?: string;
  /** Required and without a value in this environment. */
  missing: boolean;
}
export interface Row {
  name: string;
  badges: Badge[];
  uses: Use[];
  default?: string;
  cells: Cell[];
}
export interface Grid {
  project: string;
  active: string;
  /** SHARED first, then the environments. */
  columns: string[];
  rows: Row[];
}

/** The list as printed, checked enough that a page never draws garbage: throws with what is wrong. */
export function parseList(text: string): EnvList {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('nuclear env list --json printed no JSON');
  const j = JSON.parse(text.slice(start)) as Partial<EnvList>;
  if (typeof j.project !== 'string' || !Array.isArray(j.environments) || !Array.isArray(j.variables)) {
    throw new Error('nuclear env list --json: unexpected format (project, environments, variables)');
  }
  return {
    project: j.project,
    active: typeof j.active === 'string' ? j.active : 'development',
    environments: j.environments.filter((e): e is string => typeof e === 'string'),
    variables: j.variables
      .filter((v) => v && typeof v.name === 'string')
      .map((v) => ({
        name: v.name,
        declared: v.declared !== false,
        required: !!v.required,
        default: typeof v.default === 'string' ? v.default : undefined,
        client: !!v.client,
        uses: Array.isArray(v.uses) ? v.uses.filter((u) => u && typeof u.file === 'string') : [],
        values: v.values && typeof v.values === 'object' ? v.values : {},
      })),
  };
}

/** The value of the shared `.env`: the one an environment took from it. shortcut: when every environment overrides
 * it, `list --json` does not say it, so the cell shows empty; upgrade when the list gives `.env`'s own values. */
function sharedValue(v: Variable): Value {
  return Object.values(v.values).find((x) => x?.source === '.env') ?? null;
}

/** The grid; `extraEnvs` / `extraVars` are the ones added on the page that no file has yet. */
export function toGrid(list: EnvList, extraEnvs: string[] = [], extraVars: string[] = []): Grid {
  const envs = [...list.environments, ...extraEnvs.filter((e) => !list.environments.includes(e))];
  if (!envs.includes(list.active)) envs.push(list.active);
  const vars = [...list.variables];
  for (const name of extraVars) {
    if (!vars.some((v) => v.name === name)) vars.push({ name, declared: false, required: false, client: false, uses: [], values: {} });
  }
  const rows = vars.map((v): Row => {
    const cells = [SHARED, ...envs].map((env): Cell => {
      const x = env === SHARED ? sharedValue(v) : v.values[env] ?? null;
      const missing = env !== SHARED && v.required && !x;
      return { env, value: x?.value, secret: !!x?.secret, source: x?.source, placeholder: x ? undefined : v.default, missing };
    });
    const badges: Badge[] = [];
    if (v.required) badges.push('required');
    if (v.required && !v.values[list.active]) badges.push('missing');
    if (cells.some((c) => c.secret)) badges.push('secret');
    if (v.client) badges.push('client');
    if (!v.declared && !extraVars.includes(v.name)) badges.push('unused');
    return { name: v.name, badges, uses: v.uses, default: v.default, cells };
  });
  return { project: list.project, active: list.active, columns: [SHARED, ...envs], rows };
}

/** The rows a search and the "Missing only" filter keep. */
export function filterRows(rows: Row[], query: string, missingOnly: boolean): Row[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => (!missingOnly || r.badges.includes('missing')) && (!q || r.name.toLowerCase().includes(q) || r.cells.some((c) => c.value?.toLowerCase().includes(q))));
}

export const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const ENV_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** A command to run: its arguments (after `nuclear`) and what goes on its stdin. */
export interface Command {
  args: string[];
  stdin?: string;
}

const scope = (env: string, local: boolean, project: string) => [...(env === SHARED ? [] : ['--env', env]), ...(local ? ['--local'] : []), '--project', project];

/** `nuclear env set`: a secret's value goes on stdin, never in the arguments. */
export function setCommand(o: { name: string; value: string; env: string; local: boolean; secret: boolean; project: string }): Command {
  if (!NAME_RE.test(o.name)) throw new Error(`not a variable name: ${o.name}`);
  if (o.secret) return { args: ['env', 'set', o.name, '--secret', ...scope(o.env, false, o.project)], stdin: o.value };
  return { args: ['env', 'set', o.name, o.value, ...scope(o.env, o.local, o.project)] };
}

/** `nuclear env unset` of the file or keyring entry the cell's value came from; undefined when no command can (the
 * process environment). */
export function unsetCommand(o: { name: string; env: string; source?: string; project: string }): Command | undefined {
  const src = o.source ?? '';
  if (src === 'process') return undefined;
  if (src === 'keyring') return { args: ['env', 'unset', o.name, '--secret', ...scope(o.env, false, o.project)] };
  return { args: ['env', 'unset', o.name, ...scope(o.env, src.endsWith('.local'), o.project)] };
}

export function useCommand(env: string, project: string): Command {
  if (!ENV_RE.test(env)) throw new Error(`not an environment name: ${env}`);
  return { args: ['env', 'use', env, '--project', project] };
}

export function listCommand(project: string): Command {
  return { args: ['env', 'list', '--json', '--project', project] };
}

/** The file of a column: `.env`, `.env.<name>`, and its `.local` version. */
export function fileOf(env: string, local: boolean): string {
  return (env === SHARED ? '.env' : `.env.${env}`) + (local ? '.local' : '');
}

// ---------- running ----------

export interface Result {
  code: number;
  stdout: string;
  stderr: string;
  /** The process could not start (no `nuclear` on the PATH). */
  error?: string;
}
/** Runs `nuclear <args>` in `cwd`; injected so the tests use a fake. */
export type Runner = (args: string[], cwd: string, stdin?: string) => Promise<Result>;

export const nuclearRunner: Runner = (args, cwd, stdin) =>
  new Promise((resolve) => {
    const p = spawn('nuclear', args, { cwd, env: toolEnv() });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    p.on('error', (e) => resolve({ code: -1, stdout, stderr, error: String(e) }));
    p.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
    p.stdin.on('error', () => undefined);
    p.stdin.end(stdin ?? '');
  });

/** Why a command failed, for the page: `missing` (no `nuclear`), `outdated` (a `nuclear` without `env`: its usage
 * printed, which never names `nuclear env`) or the command's own message. */
export type Failure = { kind: 'missing' | 'outdated'; detail: string } | { kind: 'error'; detail: string };

export function failureOf(r: Result): Failure | undefined {
  if (r.error) return { kind: 'missing', detail: r.error };
  if (r.code === 0) return undefined;
  const text = (r.stderr || r.stdout).trim();
  if (/^usage:/.test(text) && !text.includes('nuclear env')) return { kind: 'outdated', detail: text.split('\n')[0] };
  return { kind: 'error', detail: text || `nuclear exited with ${r.code}` };
}

export type Loaded = { grid: Grid } | { failure: Failure };

/** `nuclear env list --json` of a project, as the grid or why not. */
export async function load(run: Runner, project: string, extraEnvs: string[] = [], extraVars: string[] = []): Promise<Loaded> {
  const r = await run(listCommand(project).args, project);
  const failure = failureOf(r);
  if (failure) return { failure };
  try {
    return { grid: toGrid(parseList(r.stdout), extraEnvs, extraVars) };
  } catch (e) {
    return { failure: { kind: 'error', detail: e instanceof Error ? e.message : String(e) } };
  }
}
