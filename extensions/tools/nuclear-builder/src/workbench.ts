// What the Builder's workbench (panel.ts, spec 011 requirements 19-21) computes from its data, the same in the page and
// in the tests: the specs as a tree by business component and layer, a run as the accordion's stations and steps, the
// team's log. Plain functions with
// no import and no state outside them: panel.ts inlines their source in the page's script (`WORKBENCH_JS`).

/** A spec as `nuclear-builder spec list --json` gives it (or as a run names it). */
export interface SpecEntry {
  id: string;
  title: string;
  /** A business component, `_global` for the whole project, '' for a spec of the earlier flat `specs/<id>/`. */
  component: string;
  /** Its layer ('' or none when it touches no single one). */
  layer?: string | null;
  /** Its folder, relative to the project (`specs/<component>/[<layer>/]<id>`); its file is `<path>/spec.md`. */
  path: string;
  useCase?: string;
}

/** What the tree needs of a run: its id (the spec's), its spec's title and folder, and where it is. */
export interface RunLite {
  id: string;
  status: string;
  created: number;
  specPath?: string;
  spec: { title: string; useCase?: string };
  stages: { id: string; title: string; status: string; role?: string; steps: { id: string; title: string; status: string; actor: string; started?: number; summary?: string; trace?: { step: string; detail: string; kind?: string }[] }[] }[];
}

export interface SpecNode extends SpecEntry {
  layer: string | null;
  /** The status of its run, when it has one (a run's id is its spec's). */
  run: string | null;
}

export interface SpecGroup {
  component: string;
  /** The specs of the component that touch no single layer, then each layer's. */
  specs: SpecNode[];
  layers: { layer: string; specs: SpecNode[] }[];
}

/** Where a spec belongs, read from its folder (or its `spec.md`): `specs/<component>/[<layer>/]<id>`,
 * `specs/_global/<id>`, or the earlier flat `specs/<id>` (component ''). */
export function specOfPath(file: string): { id: string; component: string; layer: string | null } {
  const parts = file.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^specs\//, '').replace(/\/spec\.md$/, '').split('/').filter(Boolean);
  const id = parts[parts.length - 1] ?? '';
  if (parts.length < 2) return { id, component: '', layer: null };
  const layer = parts.length >= 3 && ['presentation', 'domain', 'data'].includes(parts[1]) ? parts[1] : null;
  return { id, component: parts[0], layer };
}

/** The specs by business component (alphabetical; the whole project's and the unsorted ones last), each component's
 * layers in the order presentation, domain, data. A spec that only a run names (the command does not list it yet) is
 * in the tree too, where its folder says. */
export function specTree(specs: SpecEntry[], runs: RunLite[]): SpecGroup[] {
  const all = new Map<string, SpecNode>();
  for (const s of specs) all.set(s.id, { ...s, component: s.component ?? '', layer: s.layer || null, run: null });
  for (const r of runs) {
    const known = all.get(r.id);
    if (known) {
      known.run = known.run ?? r.status;
      continue;
    }
    const folder = r.specPath || 'specs/' + r.id;
    const where = specOfPath(folder);
    all.set(r.id, { id: r.id, title: r.spec.title, useCase: r.spec.useCase, path: folder, component: where.component, layer: where.layer, run: r.status });
  }
  const order = (c: string) => (c === '_global' ? '￿0' : c === '' ? '￿1' : c.toLowerCase());
  const groups = new Map<string, SpecGroup>();
  for (const s of [...all.values()].sort((a, b) => a.title.localeCompare(b.title))) {
    const g = groups.get(s.component) ?? { component: s.component, specs: [], layers: [] };
    groups.set(s.component, g);
    if (!s.layer) g.specs.push(s);
    else (g.layers.find((l) => l.layer === s.layer) ?? (g.layers.push({ layer: s.layer, specs: [] }), g.layers[g.layers.length - 1])).specs.push(s);
  }
  const LAYERS = ['presentation', 'domain', 'data'];
  for (const g of groups.values()) g.layers.sort((a, b) => LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer));
  return [...groups.values()].sort((a, b) => (order(a.component) < order(b.component) ? -1 : 1));
}

/** A run as the accordion draws it: how many stations ended of how many, the step working now, each station with its
 * steps. */
export function runOutline(run: RunLite): { done: number; total: number; now: { stage: string; step: string; title: string; actor: string } | null; stations: { id: string; title: string; status: string; role: string | null; steps: { id: string; title: string; status: string; actor: string }[] }[] } {
  let now: { stage: string; step: string; title: string; actor: string } | null = null;
  for (const s of run.stages) for (const x of s.steps) if (!now && x.status === 'running') now = { stage: s.id, step: x.id, title: x.title, actor: x.actor };
  return {
    done: run.stages.filter((s) => s.status === 'passed' || s.status === 'skipped').length,
    total: run.stages.length,
    now,
    stations: run.stages.map((s) => ({ id: s.id, title: s.title, status: s.status, role: s.role ?? null, steps: s.steps.map((x) => ({ id: x.id, title: x.title, status: x.status, actor: x.actor })) })),
  };
}

export interface LogEntry {
  actor: string;
  stage: string;
  step: string;
  status: string;
  /** `step`: a step it started (its title, then its summary when it ended); `trace`: what its agent followed; `tool`: a tool its agent called. */
  kind: 'step' | 'trace' | 'tool';
  text: string;
  detail: string;
  at?: number;
}

/** What each one of the team did, in the order it happened, from the run file: every step with who did it, and under
 * it what its agent followed and the tools it called. The last `limit`, when one is given. */
export function teamLog(run: RunLite, limit = 0): LogEntry[] {
  const steps = run.stages.flatMap((s) => s.steps.map((x, i) => ({ s, x, i })));
  // by when each started; a step that never started keeps its place in the line
  steps.sort((a, b) => (a.x.started ?? Infinity) - (b.x.started ?? Infinity) || run.stages.indexOf(a.s) - run.stages.indexOf(b.s) || a.i - b.i);
  const out: LogEntry[] = [];
  for (const { s, x } of steps) {
    if (x.status === 'pending' && !x.started) continue;
    out.push({ actor: x.actor, stage: s.id, step: x.id, status: x.status, kind: 'step', text: x.title, detail: x.status === 'running' ? '' : x.summary ?? '', at: x.started });
    for (const tr of x.trace ?? []) out.push({ actor: x.actor, stage: s.id, step: x.id, status: x.status, kind: tr.kind === 'tool' ? 'tool' : 'trace', text: tr.step, detail: tr.detail });
  }
  return limit > 0 ? out.slice(-limit) : out;
}

/** A step's title in the page's language: its kind's text (`step.<key>` of `T`) with its arguments (a role's or a
 * station's id said by `flow.role.<id>` / `station.<id>`), else the engine's English title (a step named by a path or a
 * command, a run of an older engine). */
export function stepTitle(x: { title: string; key?: string; args?: string[] }, T: Record<string, string>): string {
  const text = x.key ? T['step.' + x.key] : undefined;
  if (!text) return x.title;
  const args = (x.args ?? []).map((a) => T['flow.role.' + a] ?? T['station.' + a] ?? a);
  return text.replace(/\{(\d+)\}/g, (_, i: string) => args[+i] ?? '');
}

/** A provider as people know it ("claude-code" → "Claude Code"). */
export function providerName(id: string): string {
  const names: Record<string, string> = { 'nuclear-developer': 'Nuclear Developer', 'claude-code': 'Claude Code', codex: 'Codex', 'gemini-cli': 'Gemini CLI', cursor: 'Cursor', grok: 'Grok Build', opencode: 'OpenCode', 'opencode-local': 'OpenCode + Ollama', anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', openrouter: 'OpenRouter', shell: 'Shell' };
  return names[id] ?? id;
}

/** Who does a piece of work, one label everywhere (requirement 22): `<employee> · <role> · <provider> · <model>`, the
 * parts it does not know left out, a part said twice once ("Shell"). */
export function whoLabel(w: { name?: string; role?: string; provider?: string; model?: string }): string {
  const parts = [w.name, w.role, w.provider ? providerName(w.provider) : '', w.model].map((x) => (x ?? '').trim()).filter(Boolean);
  return [...new Set(parts)].join(' · ');
}

/** A row of the node's tree (requirement 23): a title, a short value on its line, and what it opens to: its children,
 * else its whole text (a log, an input), else a file to open. */
export interface TreeNode {
  id: string;
  kind: 'summary' | 'trace' | 'tool' | 'io' | 'decision' | 'file' | 'log';
  title: string;
  value: string;
  text?: string;
  file?: string;
  children: TreeNode[];
}

/** What a step's row opens to, as a debugger's frames and variables: its outcome, what its agent followed and the tools
 * it called (in the order they came; a call opens to its input and output), its decisions (each to its reason), the
 * files it wrote, and its log; an older run's code, input and diagnosis as logs too. */
export function stepTree(x: { summary?: string; status?: string; trace?: { step: string; detail: string; kind?: string; output?: string }[]; decisions?: { what: string; why: string }[]; files?: string[]; file?: string; log?: string; code?: string; input?: string; agent?: string }): TreeNode[] {
  const line = (s: string) => {
    const one = s.replace(/\s+/g, ' ').trim();
    return one.length > 90 ? one.slice(0, 89) + '…' : one;
  };
  const long = (s: string) => (s.length > 90 || s.includes('\n') ? s : undefined);
  const out: TreeNode[] = [];
  if (x.summary && x.status !== 'running') out.push({ id: 'sum', kind: 'summary', title: line(x.summary), value: '', text: long(x.summary), children: [] });
  (x.trace ?? []).forEach((t, k) => {
    const detail = t.detail ?? '';
    if (t.kind !== 'tool') return void out.push({ id: 't' + k, kind: 'trace', title: t.step, value: line(detail), text: long(detail), children: [] });
    const io: TreeNode[] = [];
    if (detail) io.push({ id: 't' + k + 'i', kind: 'io', title: 'input', value: line(detail), text: detail, children: [] });
    if (t.output) io.push({ id: 't' + k + 'o', kind: 'io', title: 'output', value: line(t.output), text: t.output, children: [] });
    out.push({ id: 't' + k, kind: 'tool', title: t.step, value: line(detail), children: io });
  });
  (x.decisions ?? []).forEach((d, k) => out.push({ id: 'd' + k, kind: 'decision', title: d.what, value: '', text: d.why, children: [] }));
  [...new Set([...(x.file ? [x.file] : []), ...(x.files ?? [])])].forEach((f, k) => out.push({ id: 'f' + k, kind: 'file', title: f.split('/').pop() ?? f, value: f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '', file: f, children: [] }));
  for (const [key, text] of [['log', x.log], ['code', x.code], ['input', x.input], ['agent', x.agent]] as const) if (text) out.push({ id: key, kind: 'log', title: key, value: String(text.split('\n').length), text, children: [] });
  return out;
}

/** What a team works on: its runs, the ones going on first, then the newest (the company screen's card). */
export function teamWork(runs: { id: string; status: string; created: number; spec: { title: string }; team?: { id?: string } | null; factory?: { team?: string } | null }[], team: string, limit = 3): { id: string; title: string; status: string }[] {
  const on = (s: string) => (s === 'running' || s === 'waiting' ? 0 : 1);
  return runs.filter((r) => (r.team?.id ?? r.factory?.team) === team).sort((a, b) => on(a.status) - on(b.status) || b.created - a.created).slice(0, limit).map((r) => ({ id: r.id, title: r.spec.title, status: r.status }));
}

/** A team's logo when it has no image: the initials of its name ("Night shift" → "NS")… */
export function initials(name: string): string {
  const words = name.trim().split(/[\s_-]+/).filter(Boolean).map((w) => [...w]);
  if (!words.length) return '?';
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2).join('')).toUpperCase();
}

/** …in the team's colour, the same for the same id everywhere. */
export function teamColor(id: string): string {
  let h = 7;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 'hsl(' + (h % 360) + ', 52%, 42%)';
}

/** The step a retry starts from, as `nuclear-builder retry <id>` takes it (run.nuc `failedStepOf`): in the station
 * that failed, the first step that failed after its last step that passed (a failure the station repaired by itself is
 * behind it). Null: no station failed. */
export function failedStepOf<S extends { status: string; steps: { id: string; status: string }[] }>(run: { stages: S[] }): { st: S; x: S['steps'][number] } | null {
  for (const st of run.stages) {
    if (st.status !== 'failed') continue;
    let bad: S['steps'][number] | null = null;
    for (const x of st.steps) {
      if (x.status === 'passed') bad = null;
      else if (x.status === 'failed' && !bad) bad = x;
    }
    if (bad) return { st, x: bad };
  }
  return null;
}

/** The smallest unit a run's main action retries: the failed step of a run that failed or that waits for its retry
 * (the engine's `retry <id>` goes on in place from it, its files kept). Null when there is none to retry. */
export function retryUnit<S extends { status: string; steps: { id: string; status: string }[] }>(run: { status: string; waiting?: { kind: string } | null; stages: S[] }): { st: S; x: S['steps'][number] } | null {
  return run.status === 'failed' || run.waiting?.kind === 'retry' ? failedStepOf(run) : null;
}

/** A retry of the run said in the page's language: `retry.<level>` with the attempt, the bound and the step's title. */
export function retryText(x: { level: string; attempt: number; of: number; title: string; key?: string; args?: string[] }, T: Record<string, string>): string {
  const text = T['retry.' + x.level] ?? x.level;
  const vals = [String(x.attempt), String(x.of), stepTitle(x, T)];
  return text.replace(/\{(\d+)\}/g, (_, i: string) => vals[+i] ?? '');
}

/** The source of `fns` for a page's script, and `W` naming each by its key (whatever name the bundle gave it): the
 * functions must use nothing outside themselves but each other. */
export function inline(fns: Record<string, (...a: never[]) => unknown>): string {
  return Object.values(fns).map((f) => f.toString()).join('\n') + '\nconst W = { ' + Object.entries(fns).map(([k, f]) => k + ': ' + f.name).join(', ') + ' };';
}

