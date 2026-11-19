// The launch of an app on a device, step by step: what the device shows while it starts, the step it got stuck in,
// and the project's log `.nuclear/logs/run.log`, which outlives the window (a person or an agent reads it after a
// failure). No `vscode` import: the tests drive it.

import * as fs from 'fs';
import * as path from 'path';

/** The steps of a launch on the Synapsis device (a mobile app), in order. */
export type Step = 'build' | 'flutter' | 'compile' | 'browser' | 'live';
export const STEPS: Step[] = ['build', 'flutter', 'compile', 'browser', 'live'];

/** How long a step may go without news (a line of output or the next step) before the launch is called stuck.
 * The keys are the launch's steps, in order. `compile` is Flutter's web build: the first one takes minutes, but it
 * keeps printing. */
export const STALL_MS: Record<Step, number> = {
  build: 5 * 60_000,
  flutter: 90_000,
  compile: 6 * 60_000,
  browser: 2 * 60_000,
  live: Infinity,
};

/** The web device: the build, the packages (only when the app has none yet), the dialect's dev server, the
 * headless browser. */
export type WebStep = 'build' | 'install' | 'server' | 'browser' | 'live';
export const WEB_STALL_MS: Record<WebStep, number> = {
  build: 5 * 60_000,
  install: 10 * 60_000,
  server: 2 * 60_000,
  browser: 90_000,
  live: Infinity,
};

/** `nuclear run` in a terminal (a backend or a web app), followed through the log the command writes. */
export type RunStep = 'build' | 'install' | 'serve' | 'live';
export const RUN_STALL_MS: Record<RunStep, number> = {
  build: 5 * 60_000,
  install: 10 * 60_000,
  serve: 2 * 60_000,
  live: Infinity,
};

/** The log of a project: `<root>/.nuclear/logs/run.log`; `undefined` without a root. */
export function logFile(root: string | undefined): string | undefined {
  return root ? path.join(root, '.nuclear', 'logs', 'run.log') : undefined;
}

/** Appends timestamped lines to the project's log, kept under 1 MB (the older half dropped). Never throws: a log
 * that cannot be written must not stop the app. */
export function appendLog(root: string | undefined, text: string): void {
  const file = logFile(root);
  if (!file || !text) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const at = new Date().toISOString();
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
    if (!lines.length) return;
    fs.appendFileSync(file, lines.map((l) => `${at} ${l}`).join('\n') + '\n');
    if (fs.statSync(file).size > 1 << 20) {
      const all = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, all.slice(all.indexOf('\n', all.length / 2) + 1));
    }
  } catch {
    // shortcut: a read-only project keeps no log; the device still shows the steps and the error
  }
}

/** The lines of output that explain a failure: Flutter's and Dart's errors first, else the last lines. */
export function reason(lines: string[], max = 8): string[] {
  const errors = lines.filter((l) => /error|exception|failed|could not|cannot|not found|unable/i.test(l));
  return (errors.length ? errors : lines).slice(-max);
}

/** One launch: its steps (the keys of `stall`, in order), its recent output, and a timer that calls `stuck` when a
 * step goes silent too long. Without a root nothing is logged (a launch followed through the log it reads). */
export class Launch<S extends string = Step> {
  step: S;
  readonly steps: S[];
  readonly started = Date.now();
  readonly output: string[] = [];
  private news = Date.now();
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    readonly root: string | undefined,
    private readonly changed: (l: Launch<S>) => void,
    private readonly stuck: (l: Launch<S>) => void,
    private readonly stall: Record<S, number> = STALL_MS as Record<S, number>,
    tick = 5_000,
    what = 'the Synapsis device',
  ) {
    this.steps = Object.keys(stall) as S[];
    this.step = this.steps[0];
    appendLog(root, `--- launch on ${what}`);
    this.timer = setInterval(() => this.check(), tick);
  }

  to(step: S): void {
    if (this.done || this.steps.indexOf(step) < this.steps.indexOf(this.step)) return;
    this.step = step;
    this.news = Date.now();
    appendLog(this.root, `step: ${step}`);
    if (step === 'live') this.end();
    this.changed(this);
  }

  /** Output of the build or of Flutter: it is news (the step is not stuck) and goes to the log. */
  out(text: string): void {
    if (!text.trim()) return;
    this.news = Date.now();
    appendLog(this.root, text);
    for (const l of text.replace(/\r/g, '').split('\n')) if (l.trim()) this.output.push(l.trimEnd());
    if (this.output.length > 200) this.output.splice(0, this.output.length - 200);
  }

  get done(): boolean {
    return this.timer === undefined;
  }

  /** The launch failed: logged with its reason, the timer stopped. */
  fail(why: string): void {
    appendLog(this.root, `failed at ${this.step}: ${why}`);
    this.end();
  }

  end(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  check(now = Date.now()): void {
    if (this.done || now - this.news <= this.stall[this.step]) return;
    this.fail(`no progress for ${Math.round((now - this.news) / 1000)} s`);
    this.stuck(this);
  }
}

/** The size of the project's log now: where a follower starts reading. */
export function logSize(root: string | undefined): number {
  try {
    return fs.statSync(logFile(root)!).size;
  } catch {
    return 0;
  }
}

/** `nuclear run` followed through the lines it appends to the project's log (from `offset`, the log's size when the
 * command was sent): `step: <step> [<url>]` moves the launch, `failed: <why>` and `exited: <code>` end it with
 * `failed`, any other line is its output. The launch has no root: it logs nothing of its own. */
export class RunFollower {
  url?: string;
  private rest = '';

  constructor(
    readonly root: string,
    readonly launch: Launch<RunStep>,
    private readonly failed: (why: string) => void,
    private offset = logSize(root),
  ) {}

  /** Reads the new lines; call it on a timer. */
  poll(): void {
    if (this.launch.done) return;
    let text = '';
    try {
      const fd = fs.openSync(logFile(this.root)!, 'r');
      try {
        const size = fs.fstatSync(fd).size;
        if (size < this.offset) this.offset = size; // trimmed: the new lines are at its end
        const buf = Buffer.alloc(size - this.offset);
        fs.readSync(fd, buf, 0, buf.length, this.offset);
        this.offset = size;
        text = buf.toString('utf8');
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      return; // no log yet
    }
    const lines = (this.rest + text).split('\n');
    this.rest = lines.pop() ?? '';
    for (const l of lines) if (!this.launch.done) this.line(l.replace(/^\d{4}-\d\d-\d\dT\S+ /, ''));
  }

  private line(l: string): void {
    const step = /^step: (\S+)(?: (\S+))?$/.exec(l);
    const end = /^(failed|exited): (.*)$/.exec(l);
    if (step && (this.launch.steps as string[]).includes(step[1])) {
      if (step[2]) this.url = step[2];
      this.launch.to(step[1] as RunStep);
    } else if (end) {
      const why = end[1] === 'failed' ? end[2] : `the command ended (exit code ${end[2]})`;
      this.launch.fail(why);
      this.failed(why);
    } else if (!l.startsWith('--- ')) this.launch.out(l);
  }
}
