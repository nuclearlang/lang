// A run of the software factory as the editors see it: the run file the engine in Nuclear writes
// (`.nuclear/builder/runs/<id>.json`, `engine: 3`, docs/02-architecture/engine.md) and the process that runs it
// (`nuclear-builder run|retry|restart … --events`: JSON lines on stdout, the answers as JSON lines on stdin, exit 3
// when it waits for the user). The editors draw the file, not the events. No `vscode` import: the Builder page,
// Nuclear Atlas and the tests share it.
import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { builderCommand } from '../../../vscode/src/aiMachine';
import { toolEnv } from './support';
import { SpecEntry, specOfPath } from './workbench';

export const RUNS_DIR = path.join('.nuclear', 'builder', 'runs');
export const SPECS_DIR = 'specs';
/** The engine of the software factory; the TypeScript engine's runs are 2 (only restarted). */
export const FACTORY_ENGINE = 3;
export const STATIONS = ['analysis', 'design', 'tests', 'code', 'quality', 'delivery'] as const;
const STALE_MS = 45_000;

export type Status = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'waiting';
export type UseCase = 'feature' | 'refactor' | 'bug' | 'docs' | 'diagram' | 'test' | 'security';

export interface TraceItem {
  step: string;
  detail: string;
  /** `tool`: an agent's tool call (Glob, Read, Write…), shown only in the diagram's technical details. */
  kind?: string;
}

export interface Decision {
  what: string;
  why: string;
}

export interface Step {
  id: string;
  /** The engine's English title (the journal's); `key` and `args` say it in the page's language (`stepTitle`). */
  title: string;
  key?: string;
  args?: string[];
  /** A role (`analyst`…), `shell` for a command, `you` for an answer; an older run's actors (`coder`…) too. */
  actor: string;
  status: Status;
  started?: number;
  ended?: number;
  summary: string;
  log?: string;
  trace?: TraceItem[];
  decisions?: Decision[];
  files?: string[];
  role?: string;
  /** The team's member who worked the step (its id in the team). */
  member?: string;
  employee?: string;
  kind?: string;
  provider?: string;
  model?: string;
  costUsd?: number;
  phase?: string;
  /** An older run's fields. */
  code?: string;
  input?: string;
  agent?: string;
  file?: string;
  tool?: string;
}

export interface Stage {
  id: string;
  title: string;
  about: string;
  actors: string[];
  status: Status;
  steps: Step[];
  started?: number;
  ended?: number;
  role?: string;
  /** The team's member who works the station: the run's `assign`, else the role's first member. */
  member?: string;
  provider?: string;
  model?: string;
  phases?: string[];
}

export interface Piece {
  path: string;
  kind: string;
  task: string;
  by?: string;
}

export interface Spec {
  id: string;
  title: string;
  useCase: UseCase;
  description: string;
  criteria: string[];
  context: string[];
  source: { kind: 'local' | 'jira' | 'github'; key?: string; url?: string };
  pieces: Piece[];
  resources?: string[];
  strategy?: string;
  /** The business component it belongs to (`_global`: the whole project) and, when it touches one, its layer. */
  component?: string;
  layer?: string | null;
}

/** What a run asks the user (`{"type": "ask", …}`, kept in the run as `waiting`). */
export interface Ask {
  id: string;
  kind: 'gate' | 'spending' | 'checks';
  question: string;
  station?: string;
  documents?: string[];
  providers?: string[];
  budgetUsd?: number;
  /** The checks file (`specs/<id>/checks.json`) of QA's plan. */
  checks?: string;
  /** The question's kind and arguments for the screens (`question` is the engine's English): `gate`, `gateQuestions`,
   * `qaPlan`, `deliver`. */
  key?: string;
  args?: string[];
}

export interface Answer {
  answer: 'approve' | 'yes' | 'change' | 'no' | 'stop';
  text?: string;
}

export interface Owner {
  pid: number;
  host: string;
  beat: number;
}

export interface Run {
  id: string;
  root: string;
  project: string;
  platform: string | null;
  dialect: string;
  spec: Spec;
  status: Status;
  created: number;
  ended?: number | null;
  stages: Stage[];
  costUsd?: number;
  engine?: number;
  /** The spec's folder, relative to the project (`specs/<component>/[<layer>/]<id>`; none: `specs/<id>`). */
  specPath?: string;
  factory?: { team: string; teamName: string; budgetUsd: number };
  /** The team that worked it, as it was then (its logo stays the run's after the team changes). */
  team?: { id: string; name: string };
  spending?: { confirmed: boolean; by: string; at: number; budgetUsd: number; providers: string[] };
  waiting?: Ask | null;
  owner?: Owner | null;
  writes?: { path: string; step: string }[];
  previous?: { at: number; from: string; status: string; why?: string; undone?: string[] }[];
  interrupted?: { at: number; stage: string; step: string; undone: string[] }[];
}

/** A check of the run (`specs/<id>/checks.json`, `nuclear-builder checks <id> --json`). */
export interface Check {
  id: string;
  title: string;
  station: string;
  on: boolean;
  by: 'role' | 'user';
  role?: string;
  state: 'pending' | 'passed' | 'failed' | 'skipped';
  note?: string;
  prompt?: string;
  command?: string;
}

export function runFile(root: string, id: string): string {
  return path.join(root, RUNS_DIR, `${id}.json`);
}

/** The role ids earlier versions wrote, as today's (roles.nuc's OLD_ROLES: the Delivery station's role is DevOps). */
export const OLD_ROLES: Record<string, string> = { delivery: 'devops' };

export function loadRun(root: string, id: string): Run | undefined {
  try {
    const run = JSON.parse(fs.readFileSync(runFile(root, id), 'utf8')) as Run;
    // an earlier run's role ids read as today's (run.nuc's upgradeRun); the file is not rewritten
    for (const st of Array.isArray(run.stages) ? run.stages : []) {
      if (st.role && OLD_ROLES[st.role]) st.role = OLD_ROLES[st.role];
      if (Array.isArray(st.actors)) st.actors = st.actors.map((a) => OLD_ROLES[a] ?? a);
    }
    return run;
  } catch {
    return undefined;
  }
}

/** The runs of a project, newest first. */
export function listRuns(root: string): Run[] {
  const dir = path.join(root, RUNS_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => loadRun(root, f.slice(0, -5)))
    .filter((r): r is Run => !!r && Array.isArray(r.stages))
    .sort((a, b) => b.created - a.created);
}

/** Whether a process of this machine still lives (signal 0 asks without touching it). */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** A run said to be running whose owner is gone: no beat for 45 s, or its process is dead on this machine (run.nuc's
 * rule, read the same here). */
export function orphaned(o: Owner | null | undefined, now = Date.now()): boolean {
  if (!o) return true;
  if (now - o.beat > STALE_MS) return true;
  return o.host === os.hostname() && !alive(o.pid);
}

export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/, '') || 'spec';
}

/** A new run's id: the day and the title (`20261117-loans-of-books`), unique in the project. */
export function newRunId(root: string, title: string, day = new Date()): string {
  const id = `${day.toISOString().slice(0, 10).replace(/-/g, '')}-${slug(title)}`.slice(0, 36).replace(/-$/, ''); // the engine cuts an id at 40 (run.nuc runSlug): room for "-99"
  const specs = new Set(localSpecs(root).map((x) => x.id));
  let unique = id;
  for (let n = 2; fs.existsSync(runFile(root, unique)) || specs.has(unique); n++) unique = `${id}-${n}`;
  return unique;
}

/** The spec as markdown (`specs/<id>/spec.md`), the shape the engine reads (run.nuc `parseSpec`). */
export function specMarkdown(spec: Spec): string {
  const source = `${spec.source.kind}${spec.source.key ? ` ${spec.source.key}` : ''}${spec.source.url ? ` (${spec.source.url})` : ''}`;
  const lines = [`# ${spec.title}`, '', `- Use case: ${spec.useCase}`, `- Source: ${source}`];
  if (spec.component) lines.push(`- Component: ${spec.component}`);
  if (spec.layer) lines.push(`- Layer: ${spec.layer}`);
  if (spec.strategy) lines.push(`- Strategy: ${spec.strategy}`);
  lines.push('', '## Description', '', spec.description.trim(), '', '## Acceptance criteria', '');
  lines.push(...(spec.criteria.length ? spec.criteria.map((c) => `- [ ] ${c}`) : ['- (none yet)']));
  if (spec.context.length) lines.push('', '## Context', '', ...spec.context.map((c) => `- ${c}`));
  if (spec.resources?.length) lines.push('', '## Resources', '', ...spec.resources.map((r) => `- \`${r}\``));
  // only the pieces the user wrote: the Architect plans the rest
  const own = spec.pieces.filter((p) => !p.by || p.by === 'you');
  if (own.length) lines.push('', '## Pieces', '', ...own.map((p) => `- \`${p.path}\` (${p.kind}): ${p.task}`));
  return lines.join('\n') + '\n';
}

/** The layers a spec may touch (design.md "Specs by component and layer"). */
export const LAYERS = ['presentation', 'domain', 'data'] as const;

/** Where a spec lives: `specs/<component>/[<layer>/]<id>/spec.md`; the whole project's in `specs/_global/<id>/`. */
export function specPathOf(spec: Pick<Spec, 'id' | 'component' | 'layer'>): string {
  const layer = spec.layer && (LAYERS as readonly string[]).includes(spec.layer) ? [spec.layer] : [];
  const component = spec.component || '_global';
  // a folder's name, never a path: the page is a trust boundary
  if (!/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(component)) throw new Error(`not a component's name: ${component}`);
  return path.join(SPECS_DIR, component, ...(component === '_global' ? [] : layer), spec.id, 'spec.md');
}

/** The specs of a project as they are on disk, wherever they are under `specs/` (the earlier flat folders too): what
 * the tree shows when the installed `nuclear-builder` has no `spec list` yet. */
export function localSpecs(root: string): SpecEntry[] {
  const out: SpecEntry[] = [];
  const walk = (rel: string, depth: number) => {
    let names: string[];
    try {
      names = fs.readdirSync(path.join(root, rel));
    } catch {
      return;
    }
    if (names.includes('spec.md')) {
      const folder = rel.split(path.sep).join('/');
      const where = specOfPath(folder);
      const title = /^# (.+)$/m.exec(fs.readFileSync(path.join(root, folder, 'spec.md'), 'utf8'))?.[1].trim() ?? where.id;
      out.push({ id: where.id, title, component: where.component, layer: where.layer, path: folder });
      return;
    }
    if (depth < 3) for (const n of names) if (!n.includes('.')) walk(path.join(rel, n), depth + 1);
  };
  walk(SPECS_DIR, 0);
  return out;
}

/** Writes a spec where its component and layer say, in the shape the engine reads: its path, relative to the project.
 * The editors write through `nuclear-builder spec new`; this is for a `nuclear-builder` that has no `spec` yet. */
export function writeSpec(root: string, spec: Spec): string {
  const rel = specPathOf(spec);
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), specMarkdown(spec));
  return rel;
}

/** `nuclear-builder <args>` in the project, for a short command with JSON on stdout (`checks …`, `spec …`): its JSON,
 * or the error it said; `input` goes on its stdin. */
export function lineJson<T>(root: string, args: string[], env: NodeJS.ProcessEnv = toolEnv(), input?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const p = spawn(builderCommand(env), args, { cwd: root, env, shell: process.platform === 'win32' });
    let out = '';
    let err = '';
    p.stdout.on('data', (d: Buffer) => (out += d.toString('utf8')));
    p.stderr.on('data', (d: Buffer) => (err += d.toString('utf8')));
    p.stdin.on('error', () => undefined); // a command that exits before it reads
    p.stdin.end(input ?? '');
    p.on('error', (e) => reject(new Error(`nuclear-builder: ${e.message}`)));
    p.on('close', (code) => {
      let value: unknown;
      try {
        value = JSON.parse(out);
      } catch {
        return reject(new Error((err || out).trim() || `nuclear-builder ${args.join(' ')}: exit code ${code}`));
      }
      const said = (value as { error?: unknown } | null)?.error;
      if (code === 0 && typeof said !== 'string') resolve(value as T);
      else reject(new Error(typeof said === 'string' ? said : `nuclear-builder ${args.join(' ')}: exit code ${code}`));
    });
  });
}

/** One run's process: `nuclear-builder <args> --events` in the project. Events: `ask` (an `Ask`), `event` (what a
 * provider does), `done`, `change` (the run file, read again), `exit` (the exit code: 0 passed, 1 failed, 2 a wrong
 * call, 3 waiting for the user). */
export class LineRun extends EventEmitter {
  readonly child: ChildProcess;
  /** The question the process waits on, until it is answered. */
  ask: Ask | null = null;
  readonly exited: Promise<number>;
  private readonly err: string[] = [];
  private readonly file: string;

  constructor(readonly root: string, readonly id: string, args: string[], env: NodeJS.ProcessEnv = toolEnv()) {
    super();
    this.file = runFile(root, id);
    this.child = spawn(builderCommand(env), [...args, '--events'], { cwd: root, env, shell: process.platform === 'win32' });
    this.child.stdin!.on('error', () => undefined); // a process that exits before it reads
    let rest = '';
    this.child.stdout!.on('data', (d: Buffer) => {
      const lines = (rest + d.toString('utf8')).split(/\r?\n/);
      rest = lines.pop() ?? '';
      for (const l of lines) this.line(l);
    });
    this.child.stderr!.on('data', (d: Buffer) => {
      this.err.push(...d.toString('utf8').split(/\r?\n/).filter(Boolean));
      this.err.splice(0, Math.max(0, this.err.length - 20));
    });
    // the engine writes the file atomically on every change: its stat is watched, not its inode
    fs.watchFile(this.file, { interval: 250 }, () => {
      const r = loadRun(root, id);
      if (r) this.emit('change', r);
    });
    this.exited = new Promise((resolve) => {
      let code = -1;
      this.child.on('error', (e) => {
        this.err.push(`nuclear-builder: ${e.message}`);
        code = 127;
      });
      this.child.on('close', (c) => {
        if (rest) this.line(rest);
        fs.unwatchFile(this.file);
        this.ask = null;
        const exit = code === 127 ? 127 : c ?? 1;
        this.emit('exit', exit);
        resolve(exit);
      });
    });
  }

  private line(text: string): void {
    let m: { type?: string } & Record<string, unknown>;
    try {
      m = JSON.parse(text);
    } catch {
      return; // a line that is not JSON (a tool's own print) is not the contract
    }
    if (m.type === 'ask') {
      this.ask = m as unknown as Ask;
      this.emit('ask', this.ask);
    } else if (m.type === 'event') this.emit('event', m);
    else if (m.type === 'done') this.emit('done', m);
  }

  /** The answer to the question it waits on (false: it waits on none). */
  answer(a: Answer): boolean {
    if (!this.ask || !this.child.stdin?.writable) return false;
    this.ask = null;
    this.child.stdin.write(JSON.stringify(a) + '\n');
    return true;
  }

  /** Stops it: a run that waits keeps waiting (its stdin is closed); one that works is interrupted (SIGINT), its
   * running steps fail and what they wrote is undone. */
  stop(): void {
    if (this.ask) this.child.stdin?.end();
    else this.child.kill('SIGINT');
  }

  /** The last lines it said on stderr (a wrong call, a crash). */
  get error(): string {
    return this.err.join('\n');
  }
}
