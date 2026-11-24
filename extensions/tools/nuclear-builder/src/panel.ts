// The Builder tool (ADR-platform-0003, spec 011 requirements 19-25): a workbench after n8n, one full-screen page like
// Devices and HTTP. The specs' tree and the runs' accordion live in the Nuclear Workspace's column (`builderSidebar`,
// drawn by vscode/src/workspace.ts; a click there drives this page). In the middle the run's diagram in C4's four
// levels (flow.tsx), or the spec form that *New* opens. The page has no chat of its own: each run is told as a thread
// of its team's channel in Nuclear Chat (followRun), its questions as buttons, and a click on a member or a team opens
// Nuclear Atlas on that conversation (`nuclear.atlas.open`); on
// the right the node picked, as a debugger's tree (its steps by title, each opening to its trace, tool calls,
// decisions, files and log), above the run's log, one line per thing done, with the logo of the team doing the work
// under it. *Who* is one label everywhere: employee · role · provider · model. The column folds and resizes, their sizes kept per viewer (the webview's state). The software factory's engine is Nuclear: each run is a
// process, `nuclear-builder run … --events` (runs.ts), and the chat is the window's one connection to the service
// (vscode/src/chatHost.ts, chatView.ts); both belong to the extension, not to the page; this file draws what they
// write and passes the user's answers. What the page computes from its data is workbench.ts, inlined in its script. Plain HTML and script.
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { jiraAuth, serviceEnv } from '../../../vscode/src/aiSettings';
import { notices } from '../../../vscode/src/notifications';
import { readCard } from '../../../vscode/src/card';
import { SettingsPanel } from '../../../vscode/src/settingsPanel';
import { confirmSpending, mustConfirm, projectForcesConfirm, spendingSettings } from '../../../vscode/src/spending';
import { lang, langButton, localize, pageI18n, texts, l10n } from '../../../vscode/src/i18n';
import { builderSettings } from './settings';
import { BUILDER } from './l10n';
import { faceData, listTeams, logoData, roleMember, roster, Roster, ROLES, showTeam, Team } from './teams/cli';
import { Answer, Ask, Check, FACTORY_ENGINE, LAYERS, LineRun, lineJson, listRuns, loadRun, localSpecs, newRunId, orphaned, Run, runFile, Spec, specMarkdown, STATIONS, writeSpec } from './runs';
import { CONFIG_FILE, githubIssue, jiraIssue, JiraAuth, jiraMine, suggestContext } from './support';
import { missingCommand } from './support';
import { chat, teamChannel } from '../../../vscode/src/chatView';
import { askPost, askText, buttonOf, ChatEvent, fmt, lineDiff, RUN_TEXTS, runPosts } from '../../../vscode/src/chatHost';
import { failedStepOf, inline, initials, providerName, retryText, retryUnit, RunLite, runOutline, SpecEntry, specOfPath, specTree, stepTitle, stepTree, teamColor, teamLog, whoLabel } from './workbench';
import { assetUrl } from '../../../vscode/src/assetsPage';

export interface BuilderProject {
  root: string;
  name: string;
  platform?: string | null;
}

type Message =
  | { type: 'ready' }
  | { type: 'project'; root: string }
  | { type: 'suggest'; text: string }
  | { type: 'jira'; key: string }
  | { type: 'jiraMine' }
  | { type: 'jiraSetup' }
  | { type: 'github'; ref: string }
  | { type: 'team'; id: string }
  | { type: 'start'; spec: Spec; team: string }
  | { type: 'saveSpec'; spec: Spec }
  | { type: 'runSpec'; id: string; path: string; team: string }
  | { type: 'specs' }
  | { type: 'picked'; spec: string | null; run: string | null; stage: string | null; step: string | null }
  | { type: 'atlas'; channel?: string }
  | { type: 'polish'; id: string }
  | { type: 'stop'; id: string }
  | { type: 'retry'; id: string; station?: string; step?: string; scratch?: boolean }
  | { type: 'answer'; id: string; ask: string; answer: Answer }
  | { type: 'resume'; id: string }
  | { type: 'context'; id: string }
  | { type: 'checks'; id: string }
  | { type: 'check'; id: string; op: 'on' | 'off' | 'mark' | 'add'; check?: string; state?: string; title?: string; station?: string; prompt?: string }
  | { type: 'open'; file: string }
  | { type: 'exportCi'; provider: 'github' | 'gitlab' | 'bitbucket' }
  | { type: 'config' }
  | { type: 'teams'; wizard?: boolean }
  | { type: 'openSection'; id: 'builder' | 'spending' };

/** The runs going on, by id: each a process of the extension (a closed page or another tool does not stop it). */
const lines = new Map<string, LineRun>();
/** The projects the Builder has seen (the workspace's at start, the page's): where the teams' work is read from. */
const knownRoots = new Set<string>();
/** Every run of the projects the Builder knows: what the company screen says each team works on. */
export const knownRuns = (): Run[] => [...knownRoots].flatMap((root) => listRuns(root));

/** An answer given to a run that waited with no process: its resume answers the same question with it. */

const CI_PATHS = { github: '.github/workflows/nuclear-builder.yml', gitlab: '.gitlab-ci.yml', bitbucket: 'bitbucket-pipelines.yml' };
const PROVIDER_NAMES: Record<string, string> = { 'nuclear-developer': 'Nuclear Developer', 'claude-code': 'Claude Code', codex: 'Codex', 'gemini-cli': 'Gemini CLI', cursor: 'Cursor', grok: 'Grok Build', opencode: 'OpenCode', 'opencode-local': 'OpenCode + Ollama', anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', openrouter: 'OpenRouter' };

/** The spending's flags for the engine: `--confirm-spending` when the user turned the questions off (and nothing forces
 * them), `--force-confirm` when the user forces them (the project's `"forceConfirm"` is the engine's own). */
export function spendingFlags(root: string): string[] {
  const s = spendingSettings();
  return [...(mustConfirm(s, projectForcesConfirm(root)) ? [] : ['--confirm-spending']), ...(s.forceConfirm ? ['--force-confirm'] : [])];
}

let rosters: Partial<Record<'en' | 'es', Promise<Roster>>> = {};
/** The roster in the editor's language, asked once (nothing when nuclear-builder has none). */
function people(): Promise<Roster | undefined> {
  const l = lang();
  rosters[l] ??= roster(l);
  return rosters[l]!.catch(() => {
    rosters = {};
    return undefined;
  });
}

/** Who works each role of a run: the role, its provider and model from the run's stations, the employee from the run's
 * steps or else from its team, with the employee's funny name and profile from the roster. */
export async function runTeam(run: Run): Promise<{ team: string | null; logo: string | null; techLead: string; roles: { role: string; employee?: string; name: string; profile: string; face: string | null; kind?: string; provider: string; model?: string }[] }> {
  const id = run.team?.id ?? run.factory?.team;
  const [r, team] = await Promise.all([people(), id ? showTeam(id).catch(() => undefined) : Promise.resolve(undefined)]);
  const roles = ROLES.filter((role) => run.stages.some((s) => s.role === role)).map((role) => {
    const stage = run.stages.find((s) => s.role === role)!;
    const step = run.stages.flatMap((s) => s.steps).find((x) => x.role === role && x.employee);
    // the member who works the station (the run names it), else the role's first
    const member = team?.members?.find((m) => m.id === (step?.member ?? stage.member)) ?? roleMember(team, role);
    const employee = step?.employee ?? member?.employee;
    const who = r?.[role].employees.find((e) => e.id === employee);
    // the member's own name (team file), else the employee's of the roster
    const name = (member?.employee === employee ? member?.name : undefined) || who?.name || '';
    return { role, employee, name, profile: who?.profile ?? '', face: faceData(who?.thumb ?? who?.face), kind: step?.kind ?? member?.kind, provider: stage.provider ?? step?.provider ?? 'nuclear-developer', model: stage.model ?? step?.model };
  });
  return { team: run.team?.name ?? run.factory?.teamName ?? team?.name ?? null, logo: team ? logoData(team) : null, techLead: leadRole(team), roles };
}

/** The role of a team's tech lead (the page marks that role's card), the Architect when it names none. */
const leadRole = (t: Team | undefined): string => t?.members?.find((m) => m.id === t.techLead)?.role ?? 'architect';

/** A team as the form shows it: each role with the member who works its stations (its first) and who does the work. */
async function teamCard(t: Team): Promise<unknown> {
  const r = await people();
  return { id: t.id, name: t.name, logo: logoData(t), techLead: leadRole(t), budgetUsd: t.budgetUsd, roles: ROLES.filter((role) => roleMember(t, role)).map((role) => {
    const x = roleMember(t, role)!;
    const who = r?.[role].employees.find((e) => e.id === x.employee);
    return { role, member: x.id, employee: x.employee, name: x.name || who?.name || '', profile: who?.profile ?? '', face: faceData(who?.thumb ?? who?.face), kind: x.kind, provider: x.provider, model: x.model };
  }) };
}

/** Runs `nuclear-builder <args> --events` for a run (one process per run, the extension's: closing the page leaves it
 * running); whatever page is open draws its run file, the spending is confirmed in two modal questions, a gate waits
 * for the page, and a notification says how it ended. */
export function driveRun(root: string, id: string, args: string[]): LineRun {
  const running = lines.get(id);
  if (running) return running;
  const p = new LineRun(root, id, [...args, ...spendingFlags(root)], serviceEnv());
  lines.set(id, p);
  followChat();
  followRun(root, id, p);
  let last = 0;
  p.on('change', (r: Run) => {
    // a step's trace arrives in many small writes: at most ten frames a second
    const now = Date.now();
    if (now - last < 100 && r.status === 'running') return;
    last = now;
    BuilderPanel.refreshRun(r);
  });
  let spendingOk = false;
  p.on('ask', async (a: Ask) => {
    const run = loadRun(root, id);
    if (run) BuilderPanel.refreshRun(run);
    if (a.kind === 'spending') {
      // the engine asks twice; the editor asks its own two modal questions at the first and answers both
      if (a.id === 'spending-2' && spendingOk) return void p.answer({ answer: 'yes' });
      const providers = (a.providers ?? []).map((x) => PROVIDER_NAMES[x] ?? x);
      // only an API's work is asked (an agent's subscription is not), unless the questions are forced
      spendingOk = await confirmSpending({ what: l10n.t('The Builder run "{0}"', run?.spec.title ?? id), providers, amountUsd: a.budgetUsd ?? run?.factory?.budgetUsd ?? 5, root, ...(a.providers?.length ? { ids: a.providers } : {}) });
      p.answer({ answer: spendingOk ? 'yes' : 'no' });
      return;
    }
    notices.add({ tool: 'builder', kind: 'gate', title: l10n.t('Builder "{0}" waits for you', run?.spec.title ?? id), text: askText(a, chatTexts()), level: 'warning', root, ref: id, key: `run:${id}:waits` });
  });
  p.on('exit', (code: number) => {
    lines.delete(id);
    const r = loadRun(root, id);
    if (r) BuilderPanel.refreshRun(r);
    BuilderPanel.current?.state();
    const title = r?.spec.title ?? id;
    if (code === 2 || code === 127 || !r) {
      notices.add({ tool: 'builder', kind: 'failed', title: l10n.t('Builder "{0}" did not start', title), text: p.error.split('\n').slice(-3).join(' ') || l10n.t('exit code {0}', code), level: 'error', root, ref: id });
      return;
    }
    if (r.status === 'waiting') {
      notices.add({ tool: 'builder', kind: 'gate', title: l10n.t('Builder "{0}" waits for you', title), text: r.waiting ? askText(r.waiting, chatTexts()) : '', level: 'warning', root, ref: id, key: `run:${id}:waits` });
      return;
    }
    const failed = r.stages.flatMap((st) => st.steps).reverse().find((s) => s.status === 'failed');
    // a failure opens the Builder on the step that failed
    const stage = failed && r.stages.find((st) => st.steps.includes(failed));
    notices.add({
      tool: 'builder',
      kind: r.status === 'passed' ? 'done' : 'failed',
      ...(stage ? { stage: stage.id, step: failed.id } : {}),
      title: r.status === 'passed' ? l10n.t('Builder "{0}" passed', title) : l10n.t('Builder "{0}" failed', title),
      text: r.status === 'passed' ? l10n.t('every station passed') : failed ? `${failed.title}: ${failed.summary}` : p.error.split('\n').pop() || l10n.t('stopped'),
      level: r.status === 'passed' ? 'info' : 'error',
      root,
      ref: id,
    });
  });
  const r = loadRun(root, id);
  if (r) BuilderPanel.refreshRun(r);
  BuilderPanel.current?.state();
  return p;
}

/** The runs a closed or crashed editor left running: unless `nuclear.builder.resumeInterrupted` is off, each goes on
 * (`nuclear-builder retry`: its unfinished steps failed, what they wrote undone, then on from that station). A run
 * that waits for an answer waits for the page. */
export function resumeOrphans(roots: string[]): void {
  for (const r of roots) knownRoots.add(r);
  const resume = builderSettings().resumeInterrupted;
  for (const root of roots) {
    for (const run of listRuns(root)) {
      if (run.status !== 'running' || (run.engine ?? 0) < FACTORY_ENGINE || lines.has(run.id) || !orphaned(run.owner)) continue;
      const where = run.stages.find((s) => s.status === 'running')?.title ?? l10n.t('a step');
      const title = l10n.t('Builder "{0}" was interrupted', run.spec.title);
      notices.add({ tool: 'builder', kind: 'info', title, text: resume ? l10n.t('at {0}: it goes on from there', where) : l10n.t('at {0}: Retry to go on', where), level: 'warning', root, ref: run.id });
      if (resume) driveRun(root, run.id, ['retry', run.id]);
    }
  }
  // after the orphans: a run resumed here is followed by its own process
  followDetachedRuns(roots);
}

/** The answer to what a run asks: to its process when it waits on that question, else (it ended waiting)
 * `nuclear-builder run answer`, the agents' command too: the run goes on with it. */
export function answerRun(root: string, id: string, ask: string, answer: Answer): void {
  const p = lines.get(id);
  if (p) {
    if (p.ask?.id === ask) p.answer(answer);
    return;
  }
  if (loadRun(root, id)?.waiting?.id !== ask) return;
  driveRun(root, id, ['run', 'answer', id, '--answer', answer.answer, ...(answer.text ? ['--text', answer.text] : [])]);
}

// ---------- Nuclear Chat: a run told in its team's channel, its questions' buttons, a spec's thread, /poc ----------

const chatTexts = () => RUN_TEXTS[lang()];

/** The language of the project's specs (spec 024): '' when the project keeps one (`.nuclear/builder.json`
 * `specLanguage`); else asked once, the editor's language first; undefined when the user dismissed the question. */
async function askSpecLanguage(root: string): Promise<string | undefined> {
  try {
    const kept = (JSON.parse(fs.readFileSync(path.join(root, '.nuclear', 'builder.json'), 'utf8')) as { specLanguage?: unknown }).specLanguage;
    if (typeof kept === 'string' && kept) return '';
  } catch {
    // no builder.json yet
  }
  const mine = lang();
  const names: Record<string, string> = { es: l10n.t('Spanish'), en: l10n.t('English') };
  const order = [mine, ...Object.keys(names).filter((c) => c !== mine)];
  const pick = await vscode.window.showQuickPick(
    order.map((c, i) => ({ label: names[c] ?? c, description: i === 0 ? l10n.t("the editor's language") : '', code: c })),
    { title: l10n.t("The language of this project's specs (asked once)"), ignoreFocusOut: true },
  );
  return pick?.code;
}
/** The messages with buttons this window posted: their text and thread, to say the answer under them. */
const buttoned = new Map<string, { text: string; channel: string; thread?: string }>();

/** Where a run is told: its team's channel when the project's registration has it (else `general`), the member of a
 * role (`<team>-<role>` when the chat has it, else the team's tech lead, who reports the run: the chat lists only the
 * tech leads, spec 023) and the tech lead. */
async function placeOf(root: string, team: string): Promise<{ ws: string; channel: string; member: (role?: string) => string; lead: string }> {
  const ws = await chat().workspace(root);
  const reg = chat().registered(root);
  const lead = reg.lead(team);
  const member = (role?: string) => (role && reg.members.includes(`${team}-${role}`) ? `${team}-${role}` : lead && reg.members.includes(lead) ? lead : 'system');
  return { ws, channel: reg.channels.includes(team) ? team : 'general', member, lead: lead ?? 'system' };
}

/** The thread a host opened for a piece of work (`run:<id>`, `spec:<id>`): the oldest message that links it. */
async function threadOf(ws: string, kind: 'run' | 'spec', id: string): Promise<string | undefined> {
  const r = await chat().request('GET', `/messages/${ws}/search?words=${encodeURIComponent(`${kind}:${id}`)}`);
  const found = (Array.isArray(r.body) ? r.body : []) as { message: { id: string; author: string; thread?: string | null; links?: Record<string, string> } }[];
  return found.map((f) => f.message).filter((m) => m.links?.[kind] === id && !m.thread && m.author !== 'you').pop()?.id;
}

async function postButtons(root: string, channel: string, p: Parameters<ReturnType<typeof chat>['post']>[2]): Promise<void> {
  const m = await chat().post(root, channel, p);
  if (m && p.buttons?.length) buttoned.set(m.id, { text: p.text, channel, thread: p.thread });
}

/** A run of the factory in its team's channel, as a thread: started by the tech lead, each station by its member as
 * it passes or fails (a failure with its moment: the member's GIF personality), its questions with buttons, its end.
 * The chat being down never touches the run. */
function followRun(root: string, id: string, p: EventEmitter & { ask: Ask | null }): void {
  let chain: Promise<unknown> = Promise.resolve();
  const then = (f: () => Promise<unknown>) => (chain = chain.then(f).catch(() => undefined));
  let at: (Awaited<ReturnType<typeof placeOf>> & { thread?: string }) | undefined;
  let prev: Run | undefined;
  const tell = (r: Run) =>
    then(async () => {
      if (!at) {
        at = await placeOf(root, r.team?.id ?? r.factory?.team ?? '');
        at.thread = (await threadOf(at.ws, 'run', id)) ?? (await chat().post(root, at.channel, runPosts(undefined, r, at.member, chatTexts(), at.lead)[0]))?.id;
      } else for (const post of runPosts(prev, r, at.member, chatTexts(), at.lead)) await chat().post(root, at.channel, { ...post, thread: at.thread });
      prev = r;
    });
  p.on('change', (r: Run) => (!prev || r.status !== prev.status || r.stages.some((s, i) => s.status !== prev!.stages[i]?.status)) && tell(r));
  p.on('ask', (a: Ask) =>
    then(async () => {
      if (!at || p.ask?.id !== a.id) return;
      await postButtons(root, at.channel, { ...askPost(prev ?? loadRun(root, id)!, a, at.member, chatTexts()), thread: at.thread });
    }),
  );
  p.on('exit', () => {
    const r = loadRun(root, id);
    if (r) tell(r);
  });
}

/** A run another process drives (`run --detach`: an agent's `run_start`, the chat's tech lead, a terminal): its file
 * watched, told in its team's channel as one this window drives (spec 024 requirement 4): each change, its questions,
 * its end. */
class FileRun extends EventEmitter {
  ask: Ask | null = null;
  constructor(root: string, id: string, done: () => void) {
    super();
    const file = runFile(root, id);
    const look = () => {
      const r = loadRun(root, id);
      if (!r) return;
      this.emit('change', r);
      const w = r.waiting as Ask | null | undefined;
      if (w && w.id !== this.ask?.id) {
        this.ask = w;
        this.emit('ask', w);
      } else if (!w) this.ask = null;
      if (r.status !== 'running' && r.status !== 'waiting') {
        fs.unwatchFile(file);
        done();
        this.emit('exit');
      }
    };
    fs.watchFile(file, { interval: 1000 }, look);
    setImmediate(look);
  }
}

const followedFiles = new Set<string>();
const watchedRunDirs = new Set<string>();
/** The runs of these projects that another process drives, followed into their team's channel: those going on now,
 * and each one a process starts later (its file appears in `.nuclear/builder/runs/`). A run this window drives is
 * followed by its own process (`driveRun`). */
export function followDetachedRuns(roots: string[]): void {
  for (const root of roots) {
    // `fresh`: a run that appeared now (an agent started it): the open page shows it, and a notice says so
    const pick = (id: string, fresh = false) => {
      const key = `${root}\0${id}`;
      if (lines.has(id) || followedFiles.has(key)) return;
      const r = loadRun(root, id);
      if (!r || (r.status !== 'running' && r.status !== 'waiting' && r.status !== 'pending')) return;
      followedFiles.add(key);
      followRun(root, id, new FileRun(root, id, () => followedFiles.delete(key)));
      if (!fresh) return;
      notices.add({ tool: 'builder', kind: 'info', title: l10n.t('The team started "{0}"', r.spec.title), text: l10n.t('Open it to follow its progress'), level: 'info', root, ref: id });
      BuilderPanel.follow(root, id);
    };
    for (const r of listRuns(root)) pick(r.id);
    const dir = path.dirname(runFile(root, 'x'));
    if (watchedRunDirs.has(dir)) continue;
    watchedRunDirs.add(dir);
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.watch(dir, (_e, name) => {
        const n = name ? String(name) : '';
        if (n.endsWith('.json')) setTimeout(() => pick(n.slice(0, -5), true), 300);
      });
    } catch {
      // a folder that cannot be watched: its runs are told when the editor drives them
    }
  }
}

/** Says under a message with buttons what was answered (its buttons gone). */
async function answered(root: string, message: string, label: string): Promise<void> {
  const ws = await chat().workspace(root);
  const was = buttoned.get(message);
  buttoned.delete(message);
  await chat().request('PATCH', `/messages/${ws}/message/${message}`, { buttons: [], ...(was ? { text: `${was.text}\n\n${fmt(chatTexts().answered, label)}` } : {}) });
}

/** *Polish in the chat*: the spec's thread in the team's channel (opened once, by the tech lead, with its text). */
async function polishSpec(root: string, id: string): Promise<void> {
  const spec = (await lineJson<{ id: string; path: string; title?: string }[]>(root, ['spec', 'list', '--json'])).find((x) => x.id === id);
  if (!spec) throw new Error(l10n.t('no spec {0}', id));
  const run = loadRun(root, id);
  const at = await placeOf(root, run?.team?.id ?? (chat().registered(root).channels.find((c) => c !== 'general') ?? ''));
  if (await threadOf(at.ws, 'spec', id)) return;
  const text = fs.readFileSync(path.join(root, spec.path, 'spec.md'), 'utf8');
  await chat().post(root, at.channel, { author: at.lead, text: fmt(chatTexts().polish, id, spec.title ?? id, text.trim()), links: { spec: id } });
}

/** A member's draft of a spec (its tool `spec_draft`): the difference posted in the thread, Accept or Discard. */
async function draftPosted(root: string, channel: string, thread: string | undefined, member: string, said: string): Promise<void> {
  const d = JSON.parse(said) as { id: string; path: string };
  const dir = path.join(root, d.path);
  const was = fs.readFileSync(path.join(dir, 'spec.md'), 'utf8');
  const now = fs.readFileSync(path.join(dir, 'spec.draft.md'), 'utf8');
  const T = chatTexts();
  await postButtons(root, channel, { author: member, text: `${fmt(T.draft, d.id)}\n\n${lineDiff(was, now)}`, thread, buttons: [{ id: `spec|${d.id}|accept`, label: T.accept, style: 'primary' }, { id: `spec|${d.id}|discard`, label: T.discard }], links: { spec: d.id } });
}

/** The folder's own channel (`home`) with no team assigned (nobody in it): Atlas offers the saved teams as buttons,
 * each with its tech lead and whether it is free, or *Create a team* when there is none. Once while an offer is still
 * open; a host file of before 0.87 (no `home`) gets none. */
async function offerTeams(root: string): Promise<void> {
  // the registered host file keeps the channels, not `assigned`: `home` with nobody in it is a folder with no team
  const body = chat().hostBody(root) as { channels?: { id: string; members?: string[] }[] } | undefined;
  const home = body?.channels?.find((c) => c.id === 'home');
  if (!home || (home.members ?? []).length > 0) return;
  const ws = await chat().workspace(root);
  const said = await chat().request('GET', `/messages/${ws}/home`);
  const open = Array.isArray(said.body) && (said.body as { buttons?: { id: string }[] }[]).some((m) => m.buttons?.some((b) => b.id.startsWith('team|')));
  if (open) return;
  const teams = await lineJson<{ id: string; name: string; lead?: { name?: string } | null; free?: boolean }[]>(root, ['team', 'list', '--json']).catch(() => []);
  const T = chatTexts();
  const buttons = teams.length
    ? teams.map((t) => ({ id: `team|assign|${t.id}`, label: `${t.name}${t.lead?.name ? ` · ${t.lead.name}` : ''} (${t.free === false ? T.busy : T.free})`, style: t.free === false ? '' : 'primary' }))
    : [{ id: 'team|create', label: T.createTeam, style: 'primary' }];
  await postButtons(root, 'home', { author: 'atlas', text: teams.length ? T.noTeam : T.noTeams, buttons });
}

const ANSWER_LABEL: Record<string, keyof ReturnType<typeof chatTexts>> = { approve: 'approve', change: 'change', stop: 'later', yes: 'goOn', no: 'no' };

/** What the Builder does with its workspaces' events: a button of a run's question answers the run (`answerRun`),
 * one of a spec's draft accepts or discards it (`nuclear-builder spec accept|discard`), `/poc` is told it is not
 * there yet, and a member's spec tool refreshes the specs' tree. */
async function onChatEvent(root: string, e: ChatEvent): Promise<void> {
  const T = chatTexts();
  if (e.type === 'action' && e.data.action === 'button') {
    const b = buttonOf(String(e.data.button));
    const message = String(e.data.message);
    if (b?.kind === 'run') {
      let answer: Answer = { answer: b.answer as Answer['answer'] };
      if (b.answer === 'change') {
        const text = await vscode.window.showInputBox({ title: l10n.t('What should change?'), ignoreFocusOut: true });
        if (!text) return;
        answer = { answer: 'change', text };
      }
      answerRun(root, b.run, b.ask, answer);
      return answered(root, message, T[ANSWER_LABEL[b.answer] ?? 'approve'] + (answer.text ? `: ${answer.text}` : ''));
    }
    if (b?.kind === 'team') {
      if (!b.team) {
        void vscode.commands.executeCommand('nuclear.builder.teams');
        return answered(root, message, T.creating);
      }
      // the folder's `.nuclear/builder.json` names the team: its tech lead joins the channel when the folder registers again
      await lineJson(root, ['line', 'set', `team=${b.team}`]);
      await chat().workspace(root, true);
      const name = (chat().hostBody(root) as { teams?: { id: string; name?: string }[] } | undefined)?.teams?.find((t) => t.id === b.team)?.name ?? b.team;
      return answered(root, message, fmt(T.assigned, name));
    }
    if (b?.kind === 'spec') {
      await lineJson(root, ['spec', b.answer, b.spec, '--json']);
      await answered(root, message, fmt(b.answer === 'accept' ? T.accepted : T.discarded, b.spec));
      if (b.answer === 'accept') void BuilderPanel.current?.specsAfterChat(root, [b.spec]);
    }
    return;
  }
  if (e.type === 'action' && e.data.action === 'poc') {
    await chat().post(root, e.channel, { author: 'system', text: fmt(T.poc, String(e.data.what ?? '')), thread: String(e.data.thread ?? e.data.message) });
    return;
  }
  const tool = e.type === 'tool' ? (e.data.tool as { tool?: string; ok?: boolean; text?: string }) : undefined;
  if (tool?.ok !== true) return;
  if (tool.tool === 'spec_new') void BuilderPanel.current?.specsAfterChat(root, []);
  if (tool.tool === 'spec_draft' && tool.text) await draftPosted(root, e.channel, (e.data.thread as string | null) ?? undefined, String(e.data.member), tool.text);
}

let following = false;
/** The Builder listens to its workspaces once per window. */
export function followChat(): void {
  if (following) return;
  following = true;
  chat().onRegistered((root) => void offerTeams(root).catch(() => undefined));
  chat().onEvent((root, e) => void onChatEvent(root, e).catch((x) => notices.add({ tool: 'builder', title: l10n.t('Nuclear Chat'), text: String(x instanceof Error ? x.message : x), level: 'error', root })));
}

/** What the Nuclear Workspace's column shows while the Builder is the open tool (requirement 25): the specs and the
 * runs of the page's project, and what the page has picked. `sidebarChanged` fires when any of it changes. */
export interface BuilderSidebar {
  root: string;
  project: string;
  specs: SpecEntry[];
  runs: RunLite[];
  running: string[];
  picked: { spec: string | null; run: string | null; stage: string | null; step: string | null };
}
export const sidebarChanged = new vscode.EventEmitter<void>();
let sidebar: BuilderSidebar = { root: '', project: '', specs: [], runs: [], running: [], picked: { spec: null, run: null, stage: null, step: null } };
let sidebarTimer: NodeJS.Timeout | undefined;
function setSidebar(part: Partial<BuilderSidebar>): void {
  sidebar = { ...sidebar, ...part };
  // a run's steps change many times a second: the column follows at most twice and a half a second
  sidebarTimer ??= setTimeout(() => {
    sidebarTimer = undefined;
    sidebarChanged.fire();
  }, 400);
}
export const builderSidebar = (): BuilderSidebar => sidebar;
/** A run as the column needs it, its stations in the editor's language. */
function lite(r: Run): RunLite {
  const T = texts(BUILDER) as Record<string, string>;
  return { id: r.id, status: r.status, created: r.created, specPath: r.specPath, spec: { title: r.spec.title, useCase: r.spec.useCase }, stages: r.stages.map((s) => ({ id: s.id, title: T['station.' + s.id] ?? s.title, status: s.status, role: s.role, steps: s.steps.map((x) => ({ id: x.id, title: stepTitle(x, T), status: x.status, actor: x.actor })) })) };
}

/** The page's helpers, inlined in its script: their source, and `W` naming them whatever the bundle called them. */
const WORKBENCH_JS = inline({ failedStepOf, retryUnit, retryText, specTree, specOfPath, runOutline, teamLog, providerName, whoLabel, stepTree, stepTitle, initials, teamColor });

export class BuilderPanel {
  static current: BuilderPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private root = '';
  private disposed = false;
  /** The ids of the specs the page knows: a new one the chat wrote opens. */
  private known = new Set<string>();
  /** What the column asked before the page was ready: sent on its `ready`. */
  private pending: unknown;
  /** The project's `spec.md` files watched (a spec written by the MCP server or a terminal shows at once). */
  private specsWatch: { root: string; watcher: vscode.Disposable } | undefined;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly projects: () => BuilderProject[],
  ) {
    this.panel = vscode.window.createWebviewPanel('nuclear.builder', l10n.t('Builder'), vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
    this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icons', 'nuc-file.svg');
    const localized = localize(this.panel.webview, () => html(this.panel.webview, context.extensionUri));
    this.panel.onDidDispose(() => {
      this.disposed = true;
      localized.dispose();
      this.specsWatch?.watcher.dispose();
      BuilderPanel.current = undefined;
      notices.watch('builder', false);
    });
    // the team or the money changed (here or in Settings and integrations): the form shows what a run will use
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => (e.affectsConfiguration('nuclear.builder') || e.affectsConfiguration('nuclear.spending')) && !this.disposed && (this.state(), void this.teams())));
    this.panel.onDidChangeViewState((e) => {
      notices.watch('builder', e.webviewPanel.visible && e.webviewPanel.active);
      // back from the squad screen: its teams may have changed
      if (e.webviewPanel.visible) void this.teams();
    });
    followChat();
    this.panel.webview.onDidReceiveMessage((m: Message) => void this.receive(m).catch((e) => this.post({ type: 'error', text: String(e instanceof Error ? e.message : e) })));
  }

  /** The Builder page, created or revealed, on the active project (or the first one). */
  static show(context: vscode.ExtensionContext, projects: () => BuilderProject[], active?: string, run?: string): void {
    const fresh = !BuilderPanel.current;
    const p = BuilderPanel.current ?? (BuilderPanel.current = new BuilderPanel(context, projects));
    for (const x of projects()) knownRoots.add(x.root);
    // a page opened with nothing asked shows the run the team is working on now (the newest one alive, of any app)
    if (fresh && !run) {
      const alive = projects().flatMap((x) => listRuns(x.root).filter((r) => r.status === 'running' || r.status === 'waiting').map((r) => ({ root: x.root, r }))).sort((a, b) => b.r.created - a.r.created)[0];
      if (alive) ((active = alive.root), (run = alive.r.id));
    }
    if (active && projects().some((x) => x.root === active)) p.root = active;
    p.panel.reveal(vscode.ViewColumn.Active);
    notices.watch('builder', true);
    p.state();
    const r = run ? loadRun(p.root, run) : undefined;
    if (r) p.post({ type: 'run', run: r, select: true });
  }

  /** A run an agent started: the open page moves to its project and shows it (nothing when the page is closed: the
   * notice opens it). */
  static follow(root: string, id: string): void {
    const p = BuilderPanel.current;
    if (!p || p.disposed || !p.projects().some((x) => x.root === root)) return;
    p.root = root;
    p.state();
    const r = loadRun(root, id);
    if (r) p.post({ type: 'run', run: r, select: true });
  }

  /** A click in the Workspace's column: the page opens and does it (a spec, a run, a node of a run, a new spec). */
  static drive(context: vscode.ExtensionContext, projects: () => BuilderProject[], m: { op: string; id?: string; stage?: string; step?: string }): void {
    BuilderPanel.show(context, projects);
    const p = BuilderPanel.current!;
    if (p.ready) p.post({ type: 'drive', ...m });
    else p.pending = { type: 'drive', ...m };
  }
  private ready = false;

  static close(): void {
    BuilderPanel.current?.panel.dispose();
  }

  static visible(): boolean {
    return !!BuilderPanel.current?.panel.visible;
  }

  /** Draws a run that changed on the open page (nothing when it is closed). */
  static refreshRun(run: Run): void {
    // a run that no longer waits was answered: its notice is done
    if (run.status !== 'waiting') notices.settle(`run:${run.id}:waits`);
    BuilderPanel.current?.post({ type: 'run', run, running: lines.has(run.id) });
    if (run.root === sidebar.root || sidebar.runs.some((x) => x.id === run.id)) setSidebar({ runs: [lite(run), ...sidebar.runs.filter((x) => x.id !== run.id)], running: [...lines.keys()] });
    if (run.status !== 'running') BuilderPanel.current?.state();
  }

  private post(m: unknown): void {
    // a run's question goes in the user's language, as its notification and the chat say it (the engine writes English)
    const msg = m as { type?: string; run?: Run };
    const w = msg.type === 'run' ? msg.run?.waiting : undefined;
    if (w?.key) m = { ...msg, run: { ...msg.run, waiting: { ...w, question: askText(w, chatTexts()) } } };
    if (!this.disposed) void this.panel.webview.postMessage(m);
  }

  state(): void {
    const projects = this.projects();
    if (!projects.some((p) => p.root === this.root)) this.root = projects[0]?.root ?? '';
    this.watchSpecs();
    const card = this.root ? readCard(this.root) : undefined;
    const runs = this.root ? listRuns(this.root) : [];
    setSidebar({ root: this.root, project: projects.find((p) => p.root === this.root)?.name ?? '', runs: runs.map(lite), running: [...lines.keys()], ...(sidebar.root === this.root ? {} : { specs: [] }) });
    this.post({
      type: 'state',
      projects: projects.map((p) => ({ root: p.root, name: p.name, platform: p.platform ?? '' })),
      root: this.root,
      card: card ? { name: card.name, platform: card.platform, dialect: card.dialect } : null,
      runs,
      running: [...lines.keys()],
      spending: { ...spendingSettings(), projectForces: projectForcesConfirm(this.root) },
    });
  }

  /** A spec created, changed or deleted in the project (by the MCP server's `spec_create`, a terminal, git): the
   * tree read again, once per burst (300 ms). */
  private watchSpecs(): void {
    if (this.specsWatch?.root === this.root) return;
    this.specsWatch?.watcher.dispose();
    this.specsWatch = undefined;
    if (!this.root || this.disposed) return;
    const w = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(this.root), 'specs/**/spec.md'));
    let timer: NodeJS.Timeout | undefined;
    const again = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void this.specs().catch(() => undefined), 300);
    };
    this.specsWatch = { root: this.root, watcher: vscode.Disposable.from(w, w.onDidCreate(again), w.onDidChange(again), w.onDidDelete(again), { dispose: () => clearTimeout(timer) }) };
  }

  /** The specs of the project (`nuclear-builder spec list --json`; read from disk when the installed command has no
   * `spec` yet) and its business components (`components/<name>/`) for the form. */
  private async specs(): Promise<SpecEntry[]> {
    if (!this.root) {
      this.post({ type: 'specs', specs: [], components: [] });
      return [];
    }
    let specs: SpecEntry[] = [];
    let note = '';
    try {
      const r = await lineJson<SpecEntry[] | { specs: SpecEntry[] }>(this.root, ['spec', 'list', '--json']);
      specs = (Array.isArray(r) ? r : r.specs ?? []).map((x) => ({ ...specOfPath(x.path ?? ''), ...x }));
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      if (!missingCommand(text)) note = text;
      specs = localSpecs(this.root);
    }
    let components: string[] = [];
    try {
      components = fs.readdirSync(path.join(this.root, 'components'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      // a project with no business components yet
    }
    this.known = new Set(specs.map((x) => x.id));
    setSidebar({ specs });
    this.post({ type: 'specs', specs, components, note });
    return specs;
  }

  /** After a member used a spec tool in the chat: the tree again, and the spec it wrote (said, or new in the list) opens. */
  async specsAfterChat(root: string, said: string[]): Promise<void> {
    if (root !== this.root) return;
    const before = this.known;
    const now = await this.specs();
    const fresh = now.find((x) => said.includes(x.id) && !before.has(x.id)) ?? now.find((x) => !before.has(x.id));
    if (fresh) this.post({ type: 'selectSpec', id: fresh.id });
  }

  /** Writes a spec: `nuclear-builder spec new` places its base by its component and layer and gives its id (never one
   * in use), then the form's whole spec (criteria, context, pieces, source) is written in that file; with a
   * `nuclear-builder` that has no `spec` yet, it is written there by the editor. With a team, its run starts. */
  private async saveSpec(spec: Spec, team?: string): Promise<void> {
    const language = await askSpecLanguage(this.root);
    if (language === undefined) return;
    if (team !== undefined && !readCard(this.root)) throw new Error(l10n.t('the project has no card yet (.nuclear/project.json): build it once (nuclear build . or nuclear build)'));
    const component = spec.component || '_global';
    const layer = component !== '_global' && spec.layer && (LAYERS as readonly string[]).includes(spec.layer) ? spec.layer : null;
    const full = { ...spec, component, layer };
    let file: string;
    let id: string;
    try {
      // the command places the spec and writes the form's whole markdown (criteria, context, pieces, source)
      const made = await lineJson<{ id: string; path: string }>(this.root, ['spec', 'new', '--title', spec.title, '--component', component, ...(layer ? ['--layer', layer] : []), '--use-case', spec.useCase, ...(language ? ['--language', language] : []), '--stdin', '--json'], undefined, specMarkdown({ ...full, id: '' }));
      id = made.id;
      file = path.join(made.path, 'spec.md');
    } catch (e) {
      if (!missingCommand(e instanceof Error ? e.message : String(e))) throw e;
      id = newRunId(this.root, spec.title);
      file = writeSpec(this.root, { ...full, id });
    }
    await this.specs();
    if (team === undefined) return this.post({ type: 'selectSpec', id });
    this.post({ type: 'select', id });
    driveRun(this.root, id, ['run', file, ...(team ? ['--team', team] : [])]);
  }

  private jiraAuth(ask: boolean): Promise<JiraAuth | undefined> {
    return jiraAuth(this.context, ask);
  }

  private async receive(m: Message): Promise<void> {
    switch (m.type) {
      case 'ready':
        this.ready = true;
        if (this.pending) this.post(this.pending);
        this.pending = undefined;
        void this.defaults();
        void this.teams();
        void this.specs();
        return this.state();
      case 'project':
        this.root = m.root;
        void this.teams();
        void this.specs();
        return this.state();
      case 'specs':
        return void (await this.specs());
      case 'picked':
        return setSidebar({ picked: { spec: m.spec, run: m.run, stage: m.stage, step: m.step } });
      case 'saveSpec':
        return this.saveSpec(m.spec);
      case 'runSpec':
        if (!readCard(this.root)) throw new Error(l10n.t('the project has no card yet (.nuclear/project.json): build it once (nuclear build . or nuclear build)'));
        this.post({ type: 'select', id: m.id });
        driveRun(this.root, m.id, ['run', m.path.endsWith('.md') ? m.path : m.path + '/spec.md', ...(m.team ? ['--team', m.team] : [])]);
        return;
      case 'atlas':
        // a member's direct message or a team's channel, in Nuclear Atlas (no channel: the project's team channel)
        return void vscode.commands.executeCommand('nuclear.atlas.open', this.root, m.channel || (this.root ? teamChannel(this.root) : undefined));
      case 'polish':
        await polishSpec(this.root, m.id);
        return void vscode.commands.executeCommand('nuclear.atlas.open', this.root, teamChannel(this.root));
      case 'suggest':
        return this.post({ type: 'suggestions', list: this.root ? suggestContext(this.root, m.text) : [] });
      case 'jiraSetup':
        await this.jiraAuth(true);
        return this.post({ type: 'info', text: l10n.t('Jira connected.') });
      case 'jira': {
        const auth = await this.jiraAuth(false);
        if (auth) this.post({ type: 'issue', issue: await jiraIssue(auth, m.key.trim().toUpperCase()), source: 'jira' });
        return;
      }
      case 'jiraMine': {
        const auth = await this.jiraAuth(false);
        if (auth) this.post({ type: 'mine', issues: await jiraMine(auth) });
        return;
      }
      case 'github':
        return this.post({ type: 'issue', issue: await githubIssue(this.root, m.ref.trim()), source: 'github' });
      case 'team':
        return this.post({ type: 'teamCard', team: await teamCard(await showTeam(m.id)) });
      case 'start':
        return this.saveSpec(m.spec, m.team);
      case 'stop':
        await lineJson<unknown>(this.root, ['run', 'stop', m.id]);
        return;
      case 'retry': {
        const run = loadRun(this.root, m.id);
        if (!run || lines.has(m.id)) return;
        if (m.scratch || (run.engine ?? 0) < FACTORY_ENGINE) {
          // it undoes files: said before it is done (a file changed since the run wrote it is kept either way)
          const files = [...new Set((run.writes ?? []).map((w) => w.path))];
          const scratch = l10n.t('Start over');
          const go = await vscode.window.showWarningMessage(l10n.t('Start "{0}" over from the Analysis?', run.spec.title), { modal: true, detail: [l10n.t('Every station runs again from the Analysis, the ones that passed too.'), files.length ? l10n.t('The {0} file(s) this run wrote go back to what they were first ({1}); a file you changed since is kept.', files.length, files.slice(0, 6).join(', ') + (files.length > 6 ? '…' : '')) : l10n.t('This run wrote no file.'), files.length ? l10n.t('Nothing is lost: what they hold now is set aside first in {0}.', '.nuclear/builder/runs/' + run.id + '.set-aside/') : '', l10n.t("The attempt that ends here stays in the run's history.")].filter(Boolean).join(' ') }, scratch);
          if (go !== scratch) return;
          driveRun(this.root, m.id, ['restart', m.id, '--yes']);
          return;
        }
        const args = ['retry', m.id, ...(m.step ? ['--step', m.step] : m.station ? ['--from', m.station] : [])];
        // a station or a step that passed run again takes back what the agents wrote: the engine says which files, the user confirms
        const plan = await lineJson<{ files?: string[]; setAside?: string; error?: string }>(this.root, [...args, '--plan']).catch(() => ({ files: [] as string[], setAside: '' }));
        const taken = plan.files ?? [];
        if (taken.length) {
          const back = l10n.t('Take them back');
          const go = await vscode.window.showWarningMessage(l10n.t('Run "{0}" again and take back {1} file(s) the agents wrote?', run.spec.title, taken.length), { modal: true, detail: [l10n.t('The steps run again wrote them: {0}.', taken.slice(0, 6).join(', ') + (taken.length > 6 ? '…' : '')), l10n.t('Nothing is lost: what they hold now is set aside first in {0}.', plan.setAside ?? ''), l10n.t('Every step before it is kept.')].join(' ') }, back);
          if (go !== back) return;
        }
        driveRun(this.root, m.id, [...args, '--yes']);
        return;
      }
      case 'answer':
        return answerRun(this.root, m.id, m.ask, m.answer);
      case 'resume':
        if (!lines.has(m.id)) driveRun(this.root, m.id, ['run', '--resume', m.id]);
        return;
      case 'context': {
        const run = loadRun(this.root, m.id);
        if (run) this.post({ type: 'context', id: m.id, context: await runTeam(run) });
        return;
      }
      case 'checks':
        return this.post({ type: 'checks', id: m.id, checks: await lineJson<Check[]>(this.root, ['checks', m.id, '--json']) });
      case 'check': {
        const args = m.op === 'add'
          ? ['add', '--title', m.title ?? '', '--station', m.station ?? 'quality', '--by', 'user', ...(m.prompt ? ['--prompt', m.prompt] : [])]
          : m.op === 'mark' ? ['mark', m.check ?? '', m.state ?? 'passed'] : [m.op, m.check ?? ''];
        await lineJson<unknown>(this.root, ['checks', m.id, ...args, '--json']);
        return this.receive({ type: 'checks', id: m.id });
      }
      case 'open': {
        const file = path.isAbsolute(m.file) ? m.file : path.join(this.root, m.file);
        if (!fs.existsSync(file)) return;
        // a spec, a decision, an ADR: read rendered first (what matters to the user); its source is one click from the preview
        if (file.endsWith('.md')) return void (await vscode.commands.executeCommand('markdown.showPreviewToSide', vscode.Uri.file(file)));
        await vscode.window.showTextDocument(vscode.Uri.file(file), { viewColumn: vscode.ViewColumn.Beside, preview: true });
        return;
      }
      case 'teams':
        // the squad screen (spec 011): who does each role, the employees, their settings
        await vscode.commands.executeCommand('nuclear.builder.teams', { wizard: !!m.wizard });
        return;
      case 'openSection':
        return SettingsPanel.show(this.context, m.id === 'spending' ? 'spending' : 'builder');
      case 'config': {
        const file = path.join(this.root, CONFIG_FILE);
        if (!fs.existsSync(file)) await lineJson<unknown>(this.root, ['line', 'set', `stations=${JSON.stringify(STATIONS)}`, 'gates=["analysis","design","delivery"]', 'forceConfirm=false']);
        await vscode.window.showTextDocument(vscode.Uri.file(file), { viewColumn: vscode.ViewColumn.Beside });
        return;
      }
      case 'exportCi': {
        const rel = CI_PATHS[m.provider];
        const file = path.join(this.root, rel);
        if (fs.existsSync(file)) {
          const replace = l10n.t('Replace');
          const ok = await vscode.window.showWarningMessage(l10n.t('{0} exists. Replace it?', rel), { modal: true }, replace);
          if (ok !== replace) return;
        }
        await lineJson<unknown>(this.root, ['export', m.provider, '--json']);
        await vscode.window.showTextDocument(vscode.Uri.file(file), { viewColumn: vscode.ViewColumn.Beside });
        return;
      }
    }
  }

  /** One roster employee per role (the roster's first), the face of a station when no team says who works it. */
  private async defaults(): Promise<void> {
    const r = await people();
    if (r) this.post({ type: 'defaults', roles: ROLES.flatMap((role) => r[role].employees.slice(0, 1).map((e) => ({ role, employee: e.id, name: e.name, profile: e.profile, face: faceData(e.thumb ?? e.face) }))) });
  }

  /** The teams to choose from (`nuclear-builder team list`), the one a run takes now (the project's
   * `.nuclear/builder.json` "team", else `nuclear.builder.team`, else the default team) and its card. */
  private async teams(): Promise<void> {
    try {
      const list = await listTeams();
      const own = this.ownConfig().team;
      const chosen = [typeof own === 'string' ? own : '', builderSettings().team, list.find((x) => x.default)?.id ?? ''].find((id) => id && list.some((x) => x.id === id)) ?? '';
      this.post({ type: 'teams', teams: list, chosen, project: typeof own === 'string' && own === chosen });
      if (chosen) this.post({ type: 'teamCard', team: await teamCard(await showTeam(chosen)) });
    } catch (e) {
      this.post({ type: 'teams', teams: [], chosen: '', error: e instanceof Error ? e.message : String(e) });
    }
  }

  /** The project's own `.nuclear/builder.json`, as written (empty when it has none or it is not valid JSON). */
  private ownConfig(): Record<string, unknown> {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.root, CONFIG_FILE), 'utf8')) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

export function html(webview: vscode.Webview, extension: vscode.Uri): string {
  const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  // the run's diagram (flow.tsx, React Flow) is bundled apart by the extension's `npm run flow`
  const out = (f: string) => assetUrl(webview, extension, `out/${f}`);
  const T = texts(BUILDER);
  const e = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return `<!DOCTYPE html><html lang="${lang()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src data: https:; script-src 'nonce-${nonce}' ${webview.cspSource};">
<link rel="stylesheet" href="${out('builder-flow.css')}"><style>${CSS}</style></head><body>
<header>
  <div class="brand"><svg viewBox="0 0 16 16"><path d="M8 1.5a6.5 6.5 0 1 0 6.3 8"/><path d="M14.5 4.5v4h-4"/></svg><b>Builder</b><span class="muted">${e(T.stagesLine)}</span></div>
  <select id="project" title="${e(T.project)}"></select>
  <button id="new" class="primary" title="${e(T.newHint)}">＋ ${e(T.newSpec)}</button>
  <div class="grow"></div>
  <div class="menu"><button id="ci">${e(T.exportCi)} ▾</button><div class="pop" id="ciPop"><a data-ci="github">GitHub Actions</a><a data-ci="gitlab">GitLab CI</a><a data-ci="bitbucket">Bitbucket Pipelines</a></div></div>
  <button id="config" title="${e(T.pipelineSettingsHint)}">${e(T.pipelineSettings)}</button>
  ${langButton()}
</header>
<div class="wb" id="wb">
  <div class="mid">
    <main id="main"></main>
  </div>
  <div class="gutter v" data-g="right"></div>
  <aside id="right" class="col">
    <div class="rail" data-unfold="right" title="${e(T.unfoldRight)}"><span>«</span><b>${e(T.nodeTitle)} · ${e(T.logTitle)}</b></div>
    <div class="colbody rcol">
      <div class="colhead"><span class="sec">${e(T.nodeTitle)}</span><span class="level" id="nodeLevel"></span><div class="grow"></div><button class="fold" data-fold="right" title="${e(T.foldRight)}" aria-label="${e(T.foldRight)}">»</button></div>
      <div id="node" class="drawer"></div>
      <div class="gutter h" data-g="crew"></div>
      <div id="crew"><div class="colhead"><span class="sec">${e(T.logTitle)}</span><span class="count" id="logCount"></span></div><div id="log" role="log"></div><div id="teamFoot"></div></div>
    </div>
  </aside>
</div>
<div id="toast"></div>
<script nonce="${nonce}">${pageI18n(BUILDER)}</script>
<script nonce="${nonce}" src="${out('builder-flow.js')}"></script>
<script nonce="${nonce}">${WORKBENCH_JS}</script>
<script nonce="${nonce}">${SCRIPT}</script>
</body></html>`;
}

const CSS = `
/* Sala de control, as the teams' and the reports' screens: slate cards, one desaturated teal for what is picked and
   done, gold for what works or waits, a soft red for a failure */
:root { --bg: var(--vscode-editor-background); --fg: var(--vscode-foreground); --muted: var(--vscode-descriptionForeground);
  --line: color-mix(in srgb, var(--fg) 11%, transparent); --card: color-mix(in srgb, var(--bg) 94%, #8fb0c8); --accent: #5cc8b2;
  --ok: #6fc7a4; --bad: #e48a84; --run: #d9b86c; --skip: var(--vscode-disabledForeground, #8b949e); --ease: cubic-bezier(.2, .8, .2, 1); }
body.vscode-light { --card: color-mix(in srgb, var(--bg) 96%, #5b7f99); --line: color-mix(in srgb, var(--fg) 13%, transparent); --accent: #137a68; --ok: #2e7d5b; --bad: #b3443a; --run: #8a6512; }
body.vscode-high-contrast { --line: var(--vscode-contrastBorder, #fff); --accent: var(--vscode-focusBorder); }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition: none !important; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); font: 13px/1.45 var(--vscode-font-family); height: 100vh; overflow: hidden; }
button, select, input, textarea { font: inherit; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--line)); border-radius: 4px; padding: 5px 9px; }
button { cursor: pointer; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; }
button:hover { filter: brightness(1.15); }
button.primary { background: var(--accent); color: #07201b; font-weight: 600; transition: box-shadow .18s var(--ease), filter .18s var(--ease); }
button.primary:hover { filter: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent), 0 6px 18px color-mix(in srgb, var(--accent) 22%, transparent); }
body.vscode-light button.primary { color: #fff; }
button:focus-visible, a:focus-visible, .card:focus-visible, .accept:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
textarea { width: 100%; resize: vertical; }
header { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--line); height: 46px; }
.brand { display: flex; align-items: center; gap: 8px; }
.brand svg { width: 18px; height: 18px; fill: none; stroke: var(--accent); stroke-width: 1.6; }
.brand b { font-size: 15px; }
.muted { color: var(--muted); }
.grow { flex: 1; }
.menu { position: relative; }
.pop { display: none; position: absolute; right: 0; top: 32px; background: var(--vscode-menu-background, var(--card)); border: 1px solid var(--line); border-radius: 6px; z-index: 5; min-width: 180px; }
.pop.open { display: block; }
.pop a { display: block; padding: 7px 12px; cursor: pointer; }
.pop a:hover { background: var(--vscode-list-hoverBackground); }
main { flex: 1; overflow: auto; position: relative; min-width: 0; min-height: 0; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-top: 4px; background: var(--skip); }
.st-passed { background: var(--ok); } .st-failed { background: var(--bad); } .st-running { background: var(--run); animation: pulse 1.2s infinite; } .st-skipped { background: transparent; border: 1.5px solid var(--skip); }
@keyframes pulse { 50% { opacity: .35; } }
.av { width: 20px; height: 20px; border-radius: 50%; display: inline-flex; flex-shrink: 0; }
.av svg, .av img { width: 100%; height: 100%; border-radius: 50%; display: block; }
.av img { object-fit: cover; box-shadow: 0 0 0 1.5px var(--ac, transparent); }
.typing { display: inline-flex; gap: 2px; margin-right: 5px; vertical-align: middle; }
.typing i { width: 4px; height: 4px; border-radius: 50%; background: var(--run); animation: type 1s infinite; }
.typing i:nth-child(2) { animation-delay: .15s; } .typing i:nth-child(3) { animation-delay: .3s; }
@keyframes bob { 50% { transform: translateY(-2px) rotate(-3deg); } }
@keyframes ring { from { transform: scale(.92); opacity: .9; } to { transform: scale(1.28); opacity: 0; } }
@keyframes type { 0%, 60%, 100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-3px); opacity: 1; } }
@keyframes slidein { from { transform: translateY(-8px); opacity: 0; } }
@keyframes nudge { 50% { transform: translateX(3px); } }
/* the team of the run in the form: who works each role, the links to the squad screen and the budget */
.teampick { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; }
.teampick select { min-width: 220px; }
.teampick a.link, .gate a.link { display: inline-flex; gap: 6px; align-items: center; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--line); cursor: pointer; color: var(--vscode-textLink-foreground); }
.teampick a.link:hover, .gate a.link:hover { background: var(--vscode-list-hoverBackground); }
.roster5 { display: grid; grid-template-columns: repeat(auto-fill, minmax(178px, 1fr)); gap: 10px; margin-top: 12px; }
.hire { display: grid; grid-template-columns: 38px 1fr; gap: 9px; align-items: center; padding: 9px 11px 9px 9px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
.hire .av { width: 38px; height: 38px; }
.hire > div { min-width: 0; }
.hire b { display: block; font-size: 12.5px; } .hire small { display: block; color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hire .paid { color: var(--run); }
/* what a station asks: a gate, QA's plan, the spending */
.gate { margin: 10px 0 2px; padding: 12px 14px; border: 1px solid var(--run); border-radius: 10px; background: color-mix(in srgb, var(--run) 9%, var(--card)); display: grid; gap: 8px; animation: slidein .35s ease-out; }
.gate .q { display: flex; gap: 10px; align-items: center; } .gate .q b { font-size: 13.5px; }
.gate .docs { display: flex; flex-wrap: wrap; gap: 6px; }
.gate .decide ul { margin: 4px 0 0; padding-left: 18px; } .gate .decide li { margin: 2px 0; }
.gate textarea { min-height: 54px; }
.gate .acts { margin: 0; }
.bell { display: inline-flex; width: 26px; height: 26px; border-radius: 50%; align-items: center; justify-content: center; background: var(--run); color: #111; animation: ringbell 1.8s ease-in-out infinite; flex-shrink: 0; }
@keyframes ringbell { 0%, 70%, 100% { transform: rotate(0); } 75% { transform: rotate(14deg); } 85% { transform: rotate(-12deg); } 95% { transform: rotate(6deg); } }
/* the console of the run's checks */
table.console { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
table.console th { text-align: left; font-weight: 600; color: var(--muted); font-size: 11px; letter-spacing: .01em; padding: 4px 6px; }
table.console td { border-top: 1px solid var(--line); padding: 5px 6px; vertical-align: top; overflow-wrap: anywhere; }
table.console tr.off td { opacity: .5; }
table.console .st { font-size: 11px; }
table.console th:first-child { width: 26px; } table.console th:last-child { width: 72px; }
.marks { margin: 5px 0 0 !important; gap: 6px !important; } .marks button { padding: 2px 8px; font-size: 11.5px; } .marks button.on { background: color-mix(in srgb, var(--ok) 30%, transparent); } .marks button.on.bad { background: color-mix(in srgb, var(--bad) 30%, transparent); }
button:disabled { opacity: .45; cursor: not-allowed; filter: none; }
.st.passed { color: var(--ok); } .st.failed { color: var(--bad); } .st.pending { color: var(--run); } .st.skipped { color: var(--skip); }
.mine { font-size: 10px; padding: 0 6px; border-radius: 8px; border: 1px solid var(--accent); color: var(--accent); margin-left: 4px; }
.addcheck { display: grid; grid-template-columns: minmax(0, 1fr) 120px auto; gap: 6px; margin-top: 8px; }
.addcheck textarea { grid-column: 1 / -1; min-height: 44px; }
.st-waiting { background: var(--run); animation: pulse 1.8s infinite; }
.chip { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px 2px 2px; border-radius: 12px; background: var(--card); border: 1px solid var(--line); font-size: 11.5px; }
/* the form */
.form { max-width: 920px; margin: 0 auto; padding: 18px 24px 40px; animation: rise .3s ease-out; }
.form h1 { font-size: 20px; margin: 0 0 4px; }
.section { display: grid; grid-template-columns: 34px 1fr; gap: 14px; margin-top: 26px; }
.num { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--accent); }
.section h2 { font-size: 14px; margin: 3px 0 10px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 10px; }
.card { border: 1px solid var(--line); border-radius: 8px; padding: 11px; cursor: pointer; background: var(--card); }
.card:hover { border-color: var(--accent); }
.card.sel { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.card b { display: block; margin: 4px 0 2px; } .card span { color: var(--muted); font-size: 12px; }
.card .ico { font-size: 18px; }
.tabs { display: flex; gap: 4px; margin-bottom: 10px; }
.tabs button.sel { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.row input { flex: 1; }
label.f { display: block; font-size: 12px; color: var(--muted); margin: 10px 0 4px; }
.crit { display: flex; gap: 6px; margin-bottom: 6px; } .crit input { flex: 1; }
.sug { display: grid; grid-template-columns: 18px 1fr auto; gap: 8px; padding: 5px 6px; border-radius: 4px; align-items: center; }
.sug:hover { background: var(--vscode-list-hoverBackground); }
.kind { font-size: 10.5px; color: var(--muted); }
table.pieces { width: 100%; border-collapse: collapse; margin-top: 8px; } table.pieces td { border-top: 1px solid var(--line); padding: 4px; } table.pieces input { width: 100%; }
.go { margin-top: 28px; display: flex; gap: 10px; justify-content: flex-end; }
/* the run: its graph and the node that is open */
main.run { overflow: hidden; display: flex; flex-direction: column; }
.top { padding: 10px 16px 6px; flex-shrink: 0; }
.head { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
.head h1 { font-size: 19px; margin: 0; }
.hint { margin-top: 6px; } .hint a { cursor: pointer; color: var(--vscode-textLink-foreground); }
.diagnosis { margin: 8px 0; padding: 8px 12px; border-left: 3px solid #d97706; background: var(--vscode-textCodeBlock-background); }
.diagnosis pre { white-space: pre-wrap; margin: 6px 0 0; max-height: 22vh; font-family: var(--vscode-editor-font-family); }
.accept { margin: 8px 0 0; padding: 6px 12px; border-left: 3px solid var(--ok); background: var(--vscode-textCodeBlock-background); cursor: pointer; }
.accept.warn { border-left-color: var(--run); } .accept.bad { border-left-color: var(--bad); }
.pill { padding: 2px 9px; border-radius: 10px; font-size: 11.5px; border: 1px solid var(--line); white-space: nowrap; }
.graph { flex: 1; position: relative; overflow: hidden; min-width: 0; min-height: 0; border-top: 1px solid var(--line); }
.prog { height: 100%; overflow: auto; padding: 22px 26px; display: flex; flex-direction: column; gap: 18px; }
.pipe { display: flex; align-items: flex-start; gap: 0; overflow-x: auto; padding-bottom: 4px; }
.pst { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 92px; text-align: center; opacity: .55; }
.pst.st-passed, .pst.st-running, .pst.st-waiting, .pst.st-failed { opacity: 1; }
.pst .av { width: 34px; height: 34px; }
.pst small { opacity: .7; font-size: 11px; }
.pdot { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; border: 2px solid var(--line); }
.st-passed .pdot { background: var(--ok); border-color: transparent; color: #fff; }
.st-running .pdot { border-color: var(--accent); color: var(--accent); animation: ppulse 1.4s ease-in-out infinite; }
.st-waiting .pdot { border-color: var(--run); color: var(--run); }
.st-failed .pdot { background: var(--bad); border-color: transparent; color: #fff; }
.pline { flex: 1; min-width: 18px; height: 2px; margin-top: 10px; background: var(--line); }
.pline.on { background: var(--accent); }
@keyframes ppulse { 50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 25%, transparent); } }
@media (prefers-reduced-motion: reduce) { .st-running .pdot { animation: none; } }
.pnow { border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 6px; padding: 10px 14px; }
.pnow.wait { border-left-color: var(--run); } .pnow.ok { border-left-color: var(--ok); } .pnow.bad { border-left-color: var(--bad); }
.pnow p { margin: 4px 0 8px; }
.pspec { border: 1px solid var(--line); border-radius: 6px; padding: 12px 16px; }
.pspec h3 { margin: 2px 0 6px; font-size: 15px; } .pspec ol { margin: 4px 0 10px; padding-left: 20px; } .pspec li { margin: 2px 0; }
.drawer h2 { font-size: 15px; margin: 0; overflow-wrap: anywhere; }
.drawer h3 { font-size: 12px; letter-spacing: .01em; color: var(--muted); margin: 18px 0 8px; }
.dhead { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 4px; }
.sum { margin: 8px 0; overflow-wrap: anywhere; }
.acts { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
.block { display: block; }
.who { display: grid; gap: 10px; } .who > div { display: grid; grid-template-columns: 22px 1fr; gap: 8px; align-items: start; }
.who small { color: var(--muted); display: block; }
.crow { display: grid; grid-template-columns: 16px 1fr; gap: 8px; align-items: start; padding: 4px 0; }
.crow small { display: block; color: var(--muted); overflow-wrap: anywhere; } .crow .dot { margin-top: 5px; }
.crow.link { cursor: pointer; border-radius: 4px; } .crow.link:hover { background: var(--vscode-list-hoverBackground); }
.okc { color: var(--ok); } .badc { color: var(--run); }
.flow-n { display: grid; grid-template-columns: 22px 1fr; gap: 9px; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; background: var(--card); overflow-wrap: anywhere; }
.flow-n.sel { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.flow-n b { font-size: 11px; color: var(--muted); }
.flow-a { color: var(--muted); padding-left: 16px; line-height: 16px; }
.num2 { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--accent); color: var(--accent); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.decn { display: grid; grid-template-columns: 16px 1fr; gap: 8px; padding: 6px 0; border-top: 1px solid var(--line); overflow-wrap: anywhere; }
.decn > span { color: var(--accent); }
.drawer a { cursor: pointer; color: var(--vscode-textLink-foreground); }
@media (prefers-reduced-motion: reduce) { .st-running, .st-waiting, .bell, .gate, .typing i { animation: none; } }
pre { background: var(--vscode-textCodeBlock-background, #0002); padding: 10px; border-radius: 6px; overflow: auto; max-height: 52vh; white-space: pre-wrap; font: 12px/1.45 var(--vscode-editor-font-family); margin: 0; }
.dtabs { display: flex; gap: 4px; margin: 10px 0; }
.dtabs button.sel { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.empty { padding: 60px; text-align: center; color: var(--muted); }
/* ---------- the workbench: the diagram and the column on the right, foldable and resizable ---------- */
.wb { display: grid; grid-template-columns: minmax(0, 1fr) 5px var(--rw, 380px); height: calc(100vh - 46px); transition: grid-template-columns .28s cubic-bezier(.2,.8,.2,1); }
.wb.drag { transition: none; user-select: none; }
.wb.fold-right { --rw: 30px; }
.col { min-width: 0; min-height: 0; display: flex; flex-direction: column; background: var(--card); overflow: hidden; position: relative; }
.colhead { display: flex; align-items: center; gap: 6px; padding: 8px 10px 6px; flex-shrink: 0; }
.colbody { flex: 1; min-height: 0; overflow: auto; padding: 0 8px 10px; scrollbar-width: thin; }
.rcol { display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.rail { display: none; flex-direction: column; align-items: center; gap: 10px; padding: 10px 0; cursor: pointer; height: 100%; color: var(--muted); }
.rail b { writing-mode: vertical-rl; font-weight: 600; font-size: 11px; letter-spacing: .01em; }
.rail:hover { color: var(--fg); background: var(--vscode-list-hoverBackground); }
.fold-right #right > :not(.rail) { display: none; }
.fold-right #right .rail { display: flex; }
button.fold { background: transparent; color: var(--muted); padding: 2px 7px; font-size: 13px; }
button.fold:hover { color: var(--fg); background: var(--vscode-toolbar-hoverBackground, #8882); }
.gutter { background: transparent; position: relative; z-index: 3; }
.gutter::after { content: ''; position: absolute; background: var(--line); transition: background .15s; }
.gutter.v { cursor: col-resize; } .gutter.v::after { inset: 0 2px; }
.gutter.h { cursor: row-resize; height: 5px; flex-shrink: 0; } .gutter.h::after { inset: 2px 0; }
.gutter:hover::after, .wb.drag .gutter.on::after { background: var(--accent); }
.fold-right .gutter[data-g=right] { pointer-events: none; }
.sec { font-size: 10.5px; letter-spacing: .01em; color: var(--muted); margin: 12px 4px 6px; font-weight: 600; }
.count { display: inline-block; min-width: 16px; padding: 0 5px; border-radius: 8px; background: var(--vscode-badge-background, #8884); color: var(--vscode-badge-foreground, inherit); font-size: 10px; text-align: center; letter-spacing: 0; }
.level { font-size: 10.5px; padding: 1px 7px; border-radius: 8px; border: 1px solid var(--accent); color: var(--accent); white-space: nowrap; }
.mid { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.tnote { font-size: 11.5px; color: var(--muted); padding: 4px 6px; }
/* the middle when nothing is open */
.home { height: 100%; display: grid; place-items: center; padding: 20px; }
.home .hero { max-width: 560px; text-align: center; animation: rise .4s ease-out; }
.home h1 { font-size: 20px; margin: 10px 0 6px; }
.home .line6 { display: flex; justify-content: center; align-items: center; gap: 0; margin: 18px 0; flex-wrap: wrap; }
.home .line6 .n { display: grid; justify-items: center; gap: 4px; width: 74px; font-size: 11px; color: var(--muted); }
.home .line6 .n .av { width: 30px; height: 30px; animation: bob 2.4s ease-in-out infinite; }
.home .line6 .n:nth-child(4n+3) .av { animation-delay: .4s; } .home .line6 .n:nth-child(4n+1) .av { animation-delay: .8s; }
.home .line6 .e { width: 18px; height: 2px; background: linear-gradient(90deg, var(--line) 30%, var(--accent) 50%, var(--line) 70%); background-size: 200% 100%; animation: flow 1.8s linear infinite; margin-bottom: 16px; }
.home .acts { justify-content: center; }
@keyframes flow { to { background-position: -200% 0; } }
@keyframes rise { from { transform: translateY(6px); opacity: 0; } }
/* the right column: the node at its level, the team and its log */
#node { flex: 1; min-height: 0; overflow: auto; padding: 2px 14px 20px; }
#node .gate { margin-top: 0; margin-bottom: 12px; }
#crew { height: var(--cw, 40%); min-height: 110px; display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden; }
#crew .colhead { padding: 6px 12px 4px; }
/* the node: a debugger's tree */
.nh { padding: 4px 0 6px; }
.nh h2 { font-size: 14px; }
.nh .acts { margin: 8px 0 2px; } .nh .acts button { padding: 3px 9px; font-size: 12px; }
button.ghost { background: transparent; color: var(--muted); } button.ghost:hover { color: var(--fg); background: var(--vscode-toolbar-hoverBackground, #8882); }
.who1 { font-size: 12px; color: var(--muted); margin-top: 2px; }
.tree { margin: 4px -8px 8px; font-size: 12.5px; }
.tr { display: grid; grid-template-columns: 14px 14px minmax(0, 1fr); gap: 4px; align-items: start; padding: 3px 8px 3px calc(8px + var(--d, 0) * 16px); cursor: pointer; border-radius: 4px; outline: none; position: relative; }
.tr:hover { background: var(--vscode-list-hoverBackground); }
.tr:focus-visible { box-shadow: inset 0 0 0 1px var(--vscode-list-focusOutline, var(--accent)); }
.tr.sel { background: var(--vscode-list-inactiveSelectionBackground, color-mix(in srgb, var(--accent) 16%, transparent)); }
.tr.sel:focus { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground, var(--fg)); }
.tr .tw { color: var(--muted); font-size: 9px; line-height: 18px; text-align: center; transition: transform .15s; }
.tr.open > .tw { transform: rotate(90deg); }
.tr .dot { width: 8px; height: 8px; margin: 5px 3px 0; }
.tr .ki { font-size: 11px; line-height: 18px; text-align: center; color: var(--muted); }
.ki.k-tool { color: var(--vscode-symbolIcon-functionForeground, #b180d7); } .ki.k-decision { color: var(--accent); } .ki.k-file { color: var(--vscode-symbolIcon-fileForeground, var(--muted)); } .ki.k-io { color: var(--vscode-symbolIcon-variableForeground, #75beff); }
.tb { min-width: 0; }
.tl { display: flex; gap: 8px; align-items: baseline; min-width: 0; line-height: 18px; }
.tl .tt { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex-shrink: 1; min-width: 0; }
.tr.big .tt { font-weight: 600; }
.tr:not(.big) .tt { font-family: var(--vscode-editor-font-family); font-size: 12px; }
.tr:not(.big) .tt:has(+ .tv) { flex-shrink: 0; max-width: 60%; }
.tr.k-decision .tt { font-family: inherit; font-size: 12.5px; }
.tr.k-summary .tt { font-family: inherit; max-width: none; flex-shrink: 1; white-space: normal; }
.tl .tv { color: var(--muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-family: var(--vscode-editor-font-family); font-size: 11.5px; flex: 1; min-width: 0; }
.tl .trr { padding: 0 5px; font-size: 11px; line-height: 16px; flex-shrink: 0; }
.tl .tm { margin-left: auto; color: var(--muted); font-size: 11px; white-space: nowrap; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.tlab { display: block; color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr.file .tt { color: var(--vscode-textLink-foreground); }
.tr.file:hover .tt { text-decoration: underline; }
pre.tx { margin: 2px 8px 6px calc(44px + var(--d, 0) * 16px); max-height: 260px; font-size: 11.5px; }
details.more { border-top: 1px solid var(--line); padding: 6px 0; }
details.more > summary { cursor: pointer; font-size: 11px; letter-spacing: .01em; color: var(--muted); font-weight: 600; list-style: none; }
details.more > summary::before { content: '▸ '; display: inline-block; transition: transform .15s; }
details.more[open] > summary::before { transform: rotate(90deg); }
details.more > summary::-webkit-details-marker { display: none; }
details.more > :not(summary) { margin-top: 6px; }
/* the log, newest last, and the team's logo under it */
#log { flex: 1; min-height: 0; overflow: auto; font-size: 12px; padding: 0 6px 4px; scrollbar-width: thin; }
.le { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 8px; padding: 5px 6px; border-radius: 5px; cursor: pointer; }
.le:hover { background: var(--vscode-list-hoverBackground); }
.le:focus-visible { outline: 1px solid var(--accent); outline-offset: -1px; }
.fresh { animation: rise .25s ease-out; }
.le .av { width: 20px; height: 20px; margin-top: 1px; }
.lb { min-width: 0; }
.ll { display: flex; gap: 8px; align-items: baseline; }
.ll .what { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1; min-width: 0; }
.ll .tm { color: var(--muted); font-size: 11px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.le small { display: block; color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.le.failed .what { color: var(--bad); } .le.running .what::after { content: ' …'; animation: pulse 1.2s infinite; }
.ld { margin-top: 5px; padding: 6px 8px; border-left: 2px solid var(--line); background: var(--vscode-textCodeBlock-background, #0002); border-radius: 0 4px 4px 0; display: grid; gap: 3px; font-size: 11.5px; overflow-wrap: anywhere; cursor: auto; }
.ld .tool { font-family: var(--vscode-editor-font-family); color: var(--vscode-symbolIcon-functionForeground, #b180d7); } .ld .tstep { font-weight: 600; }
.ld a { cursor: pointer; color: var(--vscode-textLink-foreground); font-size: 11px; }
#teamFoot { flex-shrink: 0; border-top: 1px solid var(--line); padding: 7px 10px; display: flex; align-items: center; gap: 6px; } #teamFoot .tf { flex: 1; min-width: 0; }
.tfnew { flex: none; display: inline-flex; align-items: center; gap: 5px; } .ico { vertical-align: -2px; }
.tf { display: flex; gap: 10px; align-items: center; cursor: pointer; padding: 3px 4px; border-radius: 6px; color: inherit; text-decoration: none; }
.tf:hover { background: var(--vscode-list-hoverBackground); }
.tf b { display: block; font-size: 12.5px; } .tf small { display: block; color: var(--muted); font-size: 11px; }
.tlogo { width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0; display: inline-grid; place-items: center; color: #fff; font-weight: 700; font-size: 11.5px; letter-spacing: .02em; object-fit: cover; box-shadow: inset 0 0 0 1px #fff2; }
.spark { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), #a855f7); color: #fff; font-size: 11px; flex-shrink: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: auto 0 0; }
.chips a { cursor: pointer; padding: 4px 10px; border-radius: 12px; border: 1px dashed var(--line); font-size: 12px; color: var(--muted); }
.chips a:hover { color: var(--fg); border-color: var(--accent); }
.where { display: grid; grid-template-columns: minmax(0, 1fr) 190px; gap: 10px; }
.where input, .where select { width: 100%; }
@media (prefers-reduced-motion: reduce) { .wb, .fresh, .form, .home .hero, .home .line6 .n .av, .home .line6 .e { animation: none !important; transition: none !important; } }
#toast { position: fixed; bottom: 16px; right: 16px; padding: 10px 14px; border-radius: 6px; background: var(--vscode-notifications-background, var(--card)); border: 1px solid var(--line); display: none; max-width: 480px; z-index: 9; }
#toast.err { border-color: var(--bad); }
`;

const SCRIPT = String.raw`
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// who each actor is: you, the factory's five roles, the shell and the Smart Graph; the texts are the page's
// (t('actor.<id>.role' | '.does' | '.not')); an older run's actors are drawn as the role that does that work now
const ACTORS = {
  you: { icon: '★', color: '#6b7280', look: [4, 0, '#3b2a1a'] },
  analyst: { icon: '🔎', color: '#8b5cf6', look: [1, 1, '#1f1a17', 'glasses'] },
  architect: { icon: '📐', color: '#3b82f6', look: [0, 2, '#5a3825'] },
  developer: { icon: '💻', color: '#f59e0b', look: [2, 0, '#141414', 'headset'] },
  qa: { icon: '🧪', color: '#06b6d4', look: [3, 1, '#2b1b10', 'glasses'] },
  devops: { icon: '🚀', color: '#ef4444', look: [1, 3, '#111827'] },
  shell: { icon: '⚙️', color: '#4b5563', look: [2, 3, '#1f2937'] },
  graph: { icon: '📚', color: '#16a34a', look: [4, 1, '#9ca3af', 'glasses'] },
};
const OLD = { planner: 'analyst', claude: 'architect', coder: 'developer', tester: 'qa', security: 'qa', diagnoser: 'qa', delivery: 'devops' };
const who = (a) => ACTORS[a] ? a : OLD[a] ?? 'shell';
for (const [id, a] of Object.entries(ACTORS)) { a.role = t('actor.' + id + '.role'); a.does = t('actor.' + id + '.does'); a.not = t('actor.' + id + '.not'); }
const ROLES = ['analyst', 'architect', 'developer', 'qa', 'devops'];
const PROVIDERS = { 'nuclear-developer': 'Nuclear Developer', 'claude-code': 'Claude Code', codex: 'Codex', 'gemini-cli': 'Gemini CLI', cursor: 'Cursor', grok: 'Grok Build', opencode: 'OpenCode', 'opencode-local': 'OpenCode + Ollama', anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', openrouter: 'OpenRouter', shell: 'Shell' };
/** Who works a role: on a run, its team's member (from the host); elsewhere the chosen team's; without either, the
 * roster's default employee of the role (the host's defaults), so every station has a face. */
const hired = (a) => {
  const r = who(a), team = view.mode === 'run' ? teamCtx[view.run?.id] : teamCard;
  return (team?.roles ?? []).find((x) => x.role === r) ?? DEFAULTS[r];
};
/** One roster employee per role ({ role, employee, name, face }), sent by the host once. */
let DEFAULTS = {};
/** The provider and model of a role: "Claude Code · haiku", "Nuclear Developer · qwen2.5-coder:3b". */
const workedBy = (x) => x?.provider ? (PROVIDERS[x.provider] ?? x.provider) + (x.model ? ' · ' + x.model : '') : '';
/** The name of an actor: the employee hired for the role (the roster's funny name), else the role. */
const nameOf = (a) => hired(a)?.name || (a === 'shell' ? t('shellName') : a === 'graph' ? 'Smart Graph' : a === 'you' ? t('actor.you.name') : ACTORS[who(a)].role);
/** What an actor is: the role and who does its work. */
const roleOf = (a) => { const by = workedBy(hired(a)); return ACTORS[who(a)].role + (by ? ' · ' + by : ''); };
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const HAIR = [
  'M7.3 9.8c0-3.1 2.1-5 4.7-5s4.7 1.9 4.7 5c-1.2-1.5-2.7-2.2-4.7-2.2s-3.5.7-4.7 2.2z',
  'M7 10.2c0-3.4 2.2-5.6 5-5.6s5 2.2 5 5.6v4.6h-1.7v-4.6c-1.2-1.3-2.2-1.9-3.3-1.9s-2.1.6-3.3 1.9v4.6H7z',
  'M7.3 9.8c0-3.1 2.1-5 4.7-5s4.7 1.9 4.7 5c-1.2-1.5-2.7-2.2-4.7-2.2s-3.5.7-4.7 2.2zM12 2.6a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z',
  'M7.1 9.4a4.9 4.9 0 0 1 9.8 0zM16.9 9.4h1.8v.9h-1.8z',
];
/** The portraits of the employees the page was told of (a run's team, a team's card), by employee id. */
const FACES = {};
const keepFaces = (roles) => (roles ?? []).forEach((x) => { if (x.employee && x.face) FACES[x.employee] = x.face; });
/** An actor's avatar: the employee's portrait, else a person drawn on the actor's colour, so a run reads as a team at
 * work. */
function av(a, employee) {
  const A = ACTORS[who(a)], seed = employee ?? hired(a)?.employee;
  if (seed && FACES[seed]) return '<span class="av" title="' + esc(nameOf(a) + ' · ' + roleOf(a)) + '" style="--ac:' + A.color + '"><img src="' + FACES[seed] + '" alt=""></span>';
  let [skin, hair, hc, extra] = A.look;
  if (seed) { const n = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7); skin = n % 5; hair = (n >> 3) % 3; hc = ['#1f1a17', '#5a3825', '#141414', '#7c4a1e', '#9ca3af', '#b45309'][(n >> 5) % 6]; extra = [undefined, 'glasses', 'headset', undefined][(n >> 8) % 4]; }
  const glasses = extra === 'glasses' ? '<g fill="none" stroke="#1b1b1b" stroke-width=".6"><circle cx="10.2" cy="10.6" r="1.25"/><circle cx="13.8" cy="10.6" r="1.25"/><path d="M11.45 10.6h1.1"/></g>' : '';
  const headset = extra === 'headset' ? '<g fill="none" stroke="#1b1b1b" stroke-width=".9"><path d="M6.9 10.8a5.1 5.1 0 0 1 10.2 0"/><path d="M16.6 11.8c0 2-1.4 3-3.2 3.2"/></g><rect x="6.2" y="10.2" width="1.6" height="2.6" rx=".7" fill="#1b1b1b"/><rect x="16.2" y="10.2" width="1.6" height="2.6" rx=".7" fill="#1b1b1b"/>' : '';
  return '<span class="av" title="' + esc(nameOf(a) + ' · ' + roleOf(a)) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="' + A.color + '"/>'
    + '<path d="M3.5 24c.4-4.6 3.9-7.6 8.5-7.6s8.1 3 8.5 7.6z" fill="#ffffff" fill-opacity=".85"/><path d="M10.4 16.6h3.2L12 19z" fill="' + A.color + '"/>'
    + '<rect x="10.9" y="13.6" width="2.2" height="3" fill="' + SKIN[skin] + '"/><circle cx="12" cy="10.6" r="4.6" fill="' + SKIN[skin] + '"/>'
    + '<path d="' + HAIR[hair] + '" fill="' + (hair === 3 ? A.color : hc) + '"' + (hair === 3 ? ' stroke="#0005" stroke-width=".4"' : '') + '/>'
    + '<circle cx="10.3" cy="10.7" r=".5" fill="#2b2b2b"/><circle cx="13.7" cy="10.7" r=".5" fill="#2b2b2b"/><path d="M10.8 12.7q1.2.9 2.4 0" fill="none" stroke="#7a3b2e" stroke-width=".55" stroke-linecap="round"/>'
    + glasses + headset + '</svg></span>';
}
const USE_CASES = [['feature', '✦'], ['refactor', '⟲'], ['bug', '⚑'], ['test', '✓'], ['security', '⛨'], ['docs', '¶'], ['diagram', '◫']];
const TEMPLATES = Object.fromEntries(USE_CASES.map(([id]) => [id, t('tpl.' + id)]));
const STATUS = (s) => T['status.' + s] ?? s;
let S = { projects: [], root: '', card: null, runs: [], running: [], spending: null };
/** The specs of the project (nuclear-builder spec list), its business components, and what the command said. */
let specs = { list: [], components: [], note: '', loaded: false };
/** The log shows one of the team when one is picked. */
// the stations and the role at each, for the pages that have no run yet
const LINE = [['analysis', 'analyst'], ['design', 'architect'], ['tests', 'developer'], ['code', 'developer'], ['quality', 'qa'], ['delivery', 'devops']];
/** The teams to choose from in the form ({ teams, chosen, project, error }) and the chosen one's card. */
let teams = { teams: [], chosen: '', project: false };
let teamCard = null;
/** Who works each role of a run, by run id ({ team, roles: [{ role, employee, name, profile, kind, provider, model }] }),
 * asked of the host once per run. */
const teamCtx = {};
/** The checks of a run (its console), by run id, asked of the host when the run is drawn. */
const checksOf = {};
/** A run the host just started: selected when it arrives. */
let selectNext = null;
// auto: nothing was chosen, so the drawer follows the run (the step running, else the one that failed)
let view = { mode: 'home', run: null, spec: null, stage: null, step: null, trace: null, tab: 'trace', auto: true, open: null, level: null };
/** A run is drawn as its simple progress (the stations, what is done now, the spec) unless the technical diagram is asked for. */
let detailed = false;
let form = blank();
function blank() { return { useCase: 'feature', title: '', description: TEMPLATES.feature, criteria: [''], context: [], source: { kind: 'local' }, team: '', pieces: [], suggestions: [], srcTab: 'write', mine: [], component: '', layer: '' }; }

// ---------- the layout: the column's size and fold, the open runs and tree nodes, per viewer ----------
const L = Object.assign({ rw: 400, cw: 40, fold: { right: false } }, (vscode.getState() ?? {}).layout ?? {});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function save() { vscode.setState({ layout: L }); }
function layout() {
  const wb = $('#wb');
  wb.style.setProperty('--rw', (L.fold.right ? 30 : L.rw) + 'px');
  wb.style.setProperty('--cw', L.cw + '%');
  wb.classList.toggle('fold-right', !!L.fold.right);
}
// the sizes kept are where the page opens, not where it animates to
$('#wb').classList.add('drag');
requestAnimationFrame(() => requestAnimationFrame(() => $('#wb').classList.remove('drag')));
function fold(k, on) { L.fold[k] = on; layout(); save(); }
document.addEventListener('pointerdown', (e) => {
  const g = e.target.closest('.gutter');
  if (!g || e.button !== 0) return;
  e.preventDefault();
  const wb = $('#wb'), k = g.dataset.g, x0 = e.clientX, y0 = e.clientY, s0 = { ...L };
  wb.classList.add('drag'); g.classList.add('on');
  const move = (ev) => {
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    if (k === 'right') L.rw = clamp(s0.rw - dx, 260, 760);
    if (k === 'crew') L.cw = clamp(s0.cw - (dy / Math.max(1, $('.rcol').clientHeight)) * 100, 18, 82);
    layout();
  };
  const up = () => { wb.classList.remove('drag'); g.classList.remove('on'); removeEventListener('pointermove', move); removeEventListener('pointerup', up); save(); };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
});
layout();
const dur = (s) => { if (!s?.started) return ''; const ms = (s.ended ?? Date.now()) - s.started; return ms < 1000 ? ms + ' ms' : ms < 60000 ? (ms / 1000).toFixed(1) + ' s' : Math.floor(ms / 60000) + ' min ' + Math.round((ms % 60000) / 1000) + ' s'; };
function toast(text, err) { const x = $('#toast'); x.textContent = text; x.className = err ? 'err' : ''; x.style.display = 'block'; clearTimeout(x._h); x._h = setTimeout(() => (x.style.display = 'none'), 6000); }

// ---------- chrome ----------
function drawChrome() {
  $('#project').innerHTML = S.projects.map((p) => '<option value="' + esc(p.root) + '"' + (p.root === S.root ? ' selected' : '') + '>' + esc(p.name) + (p.platform ? ' · ' + esc(p.platform) : '') + '</option>').join('') || '<option>' + esc(t('noProject')) + '</option>';
}

// ---------- the specs (the Workspace's column draws them as a tree) ----------
const whereOf = (s) => s.component === '_global' ? t('wholeProject') : (s.component || t('unsorted')) + (s.layer ? ' · ' + t('layer.' + s.layer) : '');
const allSpecs = () => W.specTree(specs.list, S.runs).flatMap((g) => [...g.specs, ...g.layers.flatMap((l) => l.specs)]);
/** The Workspace's column draws the specs and the runs (requirement 25): the page tells it what is picked. */
let lastPick = '';
function report() {
  const p = { spec: view.spec ?? null, run: view.mode === 'run' ? view.run?.id ?? null : null, stage: view.mode === 'run' ? view.stage : null, step: view.mode === 'run' ? view.step : null };
  const k = JSON.stringify(p);
  if (k !== lastPick) { lastPick = k; vscode.postMessage({ type: 'picked', ...p }); }
}

// ---------- the middle when no run is open: the start, or a spec with no run yet ----------
function drawHome() {
  $('#main').innerHTML = '<div class="home"><div class="hero"><span class="spark" style="width:40px;height:40px;font-size:19px">✦</span><h1>' + esc(t('homeTitle')) + '</h1><div class="muted">' + esc(S.runs.length ? t('homePick') : t('homeEmpty')) + '</div>'
    + '<div class="line6">' + LINE.map(([id, role], i) => (i ? '<span class="e"></span>' : '') + '<div class="n">' + av(role) + '<span>' + esc(T['station.' + id] ?? id) + '</span></div>').join('') + '</div>'
    + '<div class="acts"><button class="primary" data-act="new">＋ ' + esc(t('newSpec')) + '</button><button data-act="askChat">✦ ' + esc(t('homeAskChat')) + '</button><button data-act="buildTeam" title="' + esc(t('buildTeamHint')) + '">' + TEAM_ICON + ' ' + esc(t('buildTeam')) + '</button></div></div></div>';
}
function teamSelect() {
  const chosen = form.team || teams.chosen;
  return teams.teams.length ? '<select id="teamSel" title="' + esc(t('teamPickHint')) + '">' + teams.teams.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === chosen ? ' selected' : '') + '>' + esc(x.name) + (x.default ? ' · ' + esc(t('defaultTeam')) : '') + '</option>').join('') + '</select>' : '';
}
function drawSpec() {
  const x = allSpecs().find((s) => s.id === view.spec);
  if (!x) { view.mode = 'home'; return drawHome(); }
  $('#main').innerHTML = '<div class="home"><div class="hero" style="text-align:left;max-width:640px"><div class="muted">' + esc(whereOf(x)) + '</div><h1>' + esc(x.title) + '</h1><div class="muted"><code>' + esc(x.path + '/spec.md') + '</code></div>'
    + '<div class="muted" style="margin-top:10px">' + esc(t('specNoRun')) + '</div>'
    + '<div class="acts" style="justify-content:flex-start;margin-top:14px">' + teamSelect() + '<button class="primary" data-runspec="' + esc(x.id) + '" data-path="' + esc(x.path) + '">▶ ' + esc(t('startRun')) + '</button><button data-open="' + esc(x.path + '/spec.md') + '">' + esc(t('openSpec')) + '</button><button data-polish="' + esc(x.id) + '" title="' + esc(t('polishHint')) + '">✦ ' + esc(t('polish')) + '</button></div></div></div>';
}

// ---------- the form ----------
/** The selector that finds a field again after the form is drawn again. */
function fieldKey(e) {
  if (e.id) return '#' + CSS.escape(e.id);
  for (const k of ['crit', 'pc', 'sug', 'ctx', 'uc', 'lead', 'src']) if (e.dataset?.[k] !== undefined) return '[data-' + k + '="' + CSS.escape(e.dataset[k]) + '"]' + (e.dataset.k ? '[data-k="' + CSS.escape(e.dataset.k) + '"]' : '');
  return null;
}
function drawForm() {
  // the form is drawn again when suggestions, a run or the settings arrive: whoever is typing keeps the field, the caret and the scroll
  const main = $('#main'), a = document.activeElement, key = a && main.contains(a) ? fieldKey(a) : null;
  const caret = key && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd, a.selectionDirection, a.scrollTop] : null;
  const top = main.scrollTop;
  paintForm();
  main.scrollTop = top;
  const b = key && $(key);
  if (!b) return;
  b.focus({ preventScroll: true });
  if (caret) { try { b.setSelectionRange(caret[0], caret[1], caret[2]); } catch { /* not a text field */ } b.scrollTop = caret[3]; }
}
function paintForm() {
  const f = form;
  const sugs = f.suggestions.map((s, i) => '<label class="sug"><input type="checkbox" data-sug="' + i + '"' + (f.context.includes(s.path) ? ' checked' : '') + '><div>' + esc(s.path) + '<div class="kind">' + esc(s.kind) + ' · ' + esc(s.reason) + '</div></div><a data-open="' + esc(s.path) + '" class="muted" style="cursor:pointer">' + esc(t('open')) + '</a></label>').join('');
  const extra = f.context.filter((c) => !f.suggestions.some((s) => s.path === c)).map((c) => '<label class="sug"><input type="checkbox" checked data-ctx="' + esc(c) + '"><div>' + esc(c) + '<div class="kind">' + esc(t('addedByYou')) + '</div></div><span></span></label>').join('');
  $('#main').innerHTML = '<div class="form">'
    + '<h1>' + esc(t('newSpec')) + '</h1><div class="muted">' + esc(t('formIntro')) + (S.card ? ' ' + esc(t('formProject', S.card.name, (S.card.platform ?? '') + ' · ' + S.card.dialect)) : '') + '</div>'
    + section(1, t('what'), '<div class="cards">' + USE_CASES.map(([id, ico]) => '<div class="card' + (f.useCase === id ? ' sel' : '') + '" data-uc="' + id + '" tabindex="0"><span class="ico">' + ico + '</span><b>' + esc(t('uc.' + id)) + '</b><span>' + esc(t('uc.' + id + '.hint')) + '</span></div>').join('') + '</div>')
    + section(2, t('theSpec'), '<div class="tabs">' + [['write', t('src.write')], ['jira', t('src.jira')], ['github', t('src.github')]].map(([id, n]) => '<button data-src="' + id + '" class="' + (f.srcTab === id ? 'sel' : '') + '">' + esc(n) + '</button>').join('') + '</div>'
      + (f.srcTab === 'jira' ? '<div class="row"><input id="jiraKey" placeholder="PROJ-123"><button id="jiraGo" class="primary">' + esc(t('import')) + '</button><button id="jiraMine">' + esc(t('myIssues')) + '</button><button id="jiraSetup" title="' + esc(t('jiraConnectHint')) + '">' + esc(t('connect')) + '</button></div>' + (f.mine.length ? '<div class="box" style="margin-bottom:10px">' + f.mine.map((i) => '<div class="sug" style="grid-template-columns:90px 1fr"><a data-jira="' + esc(i.key) + '" style="cursor:pointer">' + esc(i.key) + '</a><span>' + esc(i.title) + '</span></div>').join('') + '</div>' : '') : '')
      + (f.srcTab === 'github' ? '<div class="row"><input id="ghRef" placeholder="' + esc(t('ghPlaceholder')) + '"><button id="ghGo" class="primary">' + esc(t('import')) + '</button></div>' : '')
      + (f.source.key ? '<div class="muted" style="margin-bottom:6px">' + esc(t('importedFrom', f.source.kind)) + ' <a data-url="' + esc(f.source.url) + '">' + esc(f.source.key) + '</a></div>' : '')
      + where(f)
      + '<label class="f">' + esc(t('specTitle')) + '</label><input id="title" style="width:100%" value="' + esc(f.title) + '" placeholder="' + esc(t('titlePlaceholder')) + '">'
      + '<label class="f">' + esc(t('description')) + '</label><textarea id="desc" rows="8">' + esc(f.description) + '</textarea>'
      + '<label class="f">' + esc(t('criteria')) + '</label>' + f.criteria.map((c, i) => '<div class="crit"><input data-crit="' + i + '" value="' + esc(c) + '" placeholder="' + esc(t('criterionPlaceholder')) + '"><button data-delcrit="' + i + '" title="' + esc(t('remove')) + '">✕</button></div>').join('') + '<div class="row"><button id="addCrit">＋ ' + esc(t('criterion')) + '</button><button id="readCrit" title="' + esc(t('readCritHint')) + '">' + esc(t('readCrit')) + '</button></div>')
    + section(3, t('context'), '<div class="muted" style="margin-bottom:8px">' + esc(t('contextHint')) + '</div><div class="row"><button id="suggest">↻ ' + esc(t('suggestAgain')) + '</button><input id="addCtx" placeholder="' + esc(t('anotherFile')) + '"><button id="addCtxGo">' + esc(t('add')) + '</button></div><div>' + (sugs + extra || '<div class="muted">' + esc(t('writeThenSuggest')) + '</div>') + '</div>')
    + section(4, t('theTeam'), teamPick()
      + (f.pieces.length ? '<table class="pieces"><tr class="muted"><td>' + esc(t('pc.file')) + '</td><td>' + esc(t('pc.kind')) + '</td><td>' + esc(t('pc.task')) + '</td><td></td></tr>' + f.pieces.map((p, i) => '<tr><td><input data-pc="' + i + '" data-k="path" value="' + esc(p.path) + '"></td><td style="width:110px"><input data-pc="' + i + '" data-k="kind" value="' + esc(p.kind) + '"></td><td><input data-pc="' + i + '" data-k="task" value="' + esc(p.task) + '"></td><td><button data-delpc="' + i + '">✕</button></td></tr>').join('') + '</table>' : ''))
    + '<div class="go"><button id="reset">' + esc(t('clear')) + '</button><button id="saveSpec" title="' + esc(t('saveSpecHint')) + '">✓ ' + esc(t('saveSpec')) + '</button><button id="start" class="primary">▶ ' + esc(t('startRun')) + '</button></div></div>';
}
/** Where the spec belongs: a business component of the project (or the whole project) and, when it touches one, a layer. */
function where(f) {
  const comps = [...new Set([...specs.components, ...specs.list.map((x) => x.component)].filter((c) => c && c !== '_global'))].sort();
  if (!f.component) f.component = comps[0] ?? '_global';
  const global = f.component === '_global';
  return '<label class="f">' + esc(t('whereBelongs')) + '</label><div class="where"><input id="component" list="components" value="' + esc(f.component) + '" placeholder="' + esc(t('componentPlaceholder')) + '" title="' + esc(t('componentHint')) + '">'
    + '<select id="layer"' + (global ? ' disabled' : '') + ' title="' + esc(t('layerHint')) + '">' + ['', 'presentation', 'domain', 'data'].map((l) => '<option value="' + l + '"' + (!global && f.layer === l ? ' selected' : '') + '>' + esc(l ? t('layer.' + l) : t('layer.none')) + '</option>').join('') + '</select></div>'
    + '<datalist id="components">' + comps.map((c) => '<option value="' + esc(c) + '"></option>').join('') + '<option value="_global" label="' + esc(t('wholeProject')) + '"></option></datalist>'
    + '<div class="muted" style="font-size:12px;margin-top:4px">' + esc(global ? t('whereGlobal') : t('whereHint', f.component)) + '</div>';
}
/** The team that works the run: one of nuclear-builder team list (the squad screen makes and changes them, *Team…*),
 * its five with their funny names and who does each one's work, and its budget (*Budget*: the spending's settings). */
function teamPick() {
  const c = teamCard, chosen = form.team || teams.chosen;
  const sp = S.spending ?? {};
  const paid = (c?.roles ?? []).filter((x) => x.kind && x.kind !== 'local');
  const pick = teams.teams.length
    ? '<select id="teamSel" title="' + esc(t('teamPickHint')) + '">' + teams.teams.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === chosen ? ' selected' : '') + '>' + esc(x.name) + (x.default ? ' · ' + esc(t('defaultTeam')) : '') + '</option>').join('') + '</select>'
    : '<span class="muted">' + esc(teams.error ? t('noTeamCommand') : t('noTeams')) + '</span>';
  const budget = c ? Number(c.budgetUsd ?? 5) : null;
  const asks = sp.forceConfirm || sp.projectForces ? t('askedForced') : sp.confirm === false ? t('notAsked') : t('askedTwice');
  return '<div class="teampick">' + pick
    + '<a class="link" id="openTeam" tabindex="0" title="' + esc(t('teamLinkHint')) + '">👥 ' + esc(t('teamLink')) + '</a>'
    + '<a class="link" data-act="buildTeam" tabindex="0" title="' + esc(t('buildTeamHint')) + '">+ ' + esc(t('buildTeam')) + '</a>'
    + '<a class="link" id="openBudget" tabindex="0" title="' + esc(t('budgetLinkHint')) + '">💰 ' + esc(t('budgetLink')) + (budget === null ? '' : ' <span class="muted">' + esc(budget > 0 ? budget.toFixed(2) + ' USD' : t('noLimit')) + '</span>') + '</a></div>'
    + (c && c.id === chosen ? '<div class="roster5">' + c.roles.map((x) => { const lead = c.roles.find((y) => y.role === c.techLead); return '<div class="hire" data-dm="' + esc(lead ? 'dm-' + c.id + '-' + lead.member : c.id) + '" tabindex="0" role="button" title="' + esc(lead === x ? t('chatWith', x.name || ACTORS[x.role].role) : t('askLeadFor', lead?.name || (lead ? ACTORS[lead.role].role : ''), x.name || ACTORS[x.role].role)) + '">' + av(x.role, x.employee) + '<div><b>' + esc(x.name || ACTORS[x.role].role) + '</b><small>' + esc(ACTORS[x.role].role) + '</small><small class="' + (x.kind && x.kind !== 'local' ? 'paid' : '') + '">' + esc(workedBy(x)) + '</small></div></div>'; }).join('') + '</div>' : '')
    + '<div class="muted" style="margin-top:8px;font-size:12px">' + esc(teams.project ? t('projectTeam') : '') + ' ' + esc(paid.length ? t('paidRoles', paid.map((x) => ACTORS[x.role].role).join(', ')) + ' ' + asks : '') + '</div>';
}
function section(n, title, body) { return '<div class="section"><div class="num">' + n + '</div><div><h2>' + esc(title) + '</h2>' + body + '</div></div>'; }
function readForm() {
  const x = $('#title'); if (x) form.title = x.value;
  const c = $('#component'); if (c) form.component = c.value.trim();
  const l = $('#layer'); if (l) form.layer = l.value;
  const d = $('#desc'); if (d) form.description = d.value;
  document.querySelectorAll('[data-crit]').forEach((e) => (form.criteria[+e.dataset.crit] = e.value));
  document.querySelectorAll('[data-pc]').forEach((e) => (form.pieces[+e.dataset.pc][e.dataset.k] = e.value));
}
function specOf() {
  readForm();
  return { id: '', title: form.title.trim(), useCase: form.useCase, description: form.description, criteria: form.criteria.map((c) => c.trim()).filter(Boolean), context: form.context, source: form.source, pieces: form.pieces.filter((p) => p.path && p.task), component: form.component || '_global', layer: form.component === '_global' ? null : form.layer || null };
}

// ---------- the run: a graph of what was done ----------
// The diagram (flow.tsx) in C4's four levels: the context, the pipeline, inside a station, inside a step. A click on
// any node opens it on the right: what it did, the decisions it took and why, its documents and files. What a station
// asks (a gate, QA's plan, the spending) is above the team; a station can be run again, and the whole run from scratch.
const failedStep = (r) => W.failedStepOf(r);
const live = (r) => S.running.includes(r.id);
const factory = (r) => (r.engine ?? 0) >= 3;
/** Where the run is, or where it failed or waits: what is open when the user chose nothing. */
function pick(r) {
  for (const st of r.stages) for (const x of st.steps) if (x.status === 'running') return { stage: st.id, step: x.id };
  if (r.waiting?.kind === 'retry') return { stage: r.waiting.station, step: r.waiting.step };
  const w = r.stages.find((st) => st.status === 'waiting');
  if (w) return { stage: r.waiting?.kind === 'checks' ? null : w.id, step: null };
  const f = failedStep(r);
  return f ? { stage: f.st.id, step: f.x.id } : { stage: null, step: null };
}
const levelOf = () => view.level ?? (view.open ? (view.inStep ? 'code' : 'components') : 'containers');
function drawRun() {
  const r = view.run;
  if (!r) { view.mode = 'home'; return draw(); }
  if (!(r.id in teamCtx)) { teamCtx[r.id] = null; vscode.postMessage({ type: 'context', id: r.id }); }
  if (factory(r) && !(r.id in checksOf)) { checksOf[r.id] = null; vscode.postMessage({ type: 'checks', id: r.id }); }
  if (view.auto) Object.assign(view, pick(r));
  if (!$('#graph')) $('#main').innerHTML = '<div id="runTop"></div><div class="graph" id="graph"></div>';
  const g = $('#graph');
  $('#runTop').innerHTML = head(r);
  const ctx = teamCtx[r.id];
  const again = () => { drawRun(); report(); };
  if (!detailed) { const html = progress(r); if (g._p !== html) { if (window.NuclearFlow && g._flow) window.NuclearFlow.unmount?.(g); g.innerHTML = html; g._p = html; g._flow = false; } drawRight(); return; }
  g._p = null; g._flow = true;
  if (!window.NuclearFlow) g.innerHTML = '<div class="empty">' + esc(t('noDiagram')) + '</div>';
  else window.NuclearFlow.render(g, { run: r, level: levelOf(), open: view.open, step: view.inStep ?? null, picked: { stage: view.stage, step: view.step, trace: view.trace }, avatar: av, role: roleOf, name: nameOf, who: whoFor, t,
    context: ctx ? { team: ctx.team, roles: ctx.roles.map((x) => ({ role: x.role, name: x.name, provider: x.provider, model: x.model, kind: x.kind, employee: x.employee })) } : null,
    onFile: (f) => vscode.postMessage({ type: 'open', file: f }),
    onPick: (stage, step = null, trace = null) => { Object.assign(view, { stage, step, trace, auto: false }); if (trace !== null) view.tab = 'trace'; again(); },
    onOpen: (stage) => { Object.assign(view, { open: stage, inStep: null, level: null, stage, step: null, trace: null, auto: false }); again(); },
    onLevel: (level, stage = null, step = null) => { Object.assign(view, { level: level === 'containers' || level === 'components' || level === 'code' ? null : level, open: level === 'components' || level === 'code' ? stage : null, inStep: level === 'code' ? step : null, stage: stage ?? view.stage, step: step ?? (level === 'code' ? step : view.step), auto: false }); again(); } });
  drawRight();
}

// ---------- the right column: the node as a debugger's tree above, the log and the team's logo below ----------
function drawRight() {
  const r = view.mode === 'run' ? view.run : null, d = $('#node');
  const key = r ? r.id + '|' + view.stage + '|' + (r.waiting?.id ?? '') : view.mode + '|' + view.spec;
  const typing = d.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  // what the user types in the node (a gate's change, a check of their own) survives a run drawn again
  if (!(typing && d.dataset.k === key)) {
    const vals = [...d.querySelectorAll('input[id]:not([type=checkbox]),textarea[id],select[id]')].map((x) => [x.id, x.value]);
    const top = d.dataset.k === key ? d.scrollTop : 0;
    const focus = d.contains(document.activeElement) ? document.activeElement.dataset.tk : null;
    // the question and the node are drawn apart: a time that moves in the node never draws the question again, so
    // its buttons never flicker and a click on them is never lost to a redraw
    const ask = r ? gate(r) : '', body = r ? nodeOf(r) : view.mode === 'spec' ? specInfo() : stationsInfo();
    if (d._h === '' || d.dataset.k !== key || d.children.length !== 2) { d.innerHTML = '<div></div><div></div>'; }
    const [askBox, bodyBox] = d.children;
    if (askBox._h !== ask) { askBox.innerHTML = ask; askBox._h = ask; }
    if (bodyBox._h !== body) { bodyBox.innerHTML = body; bodyBox._h = body; }
    d._h = 'drawn';
    for (const [id, v] of vals) { const x = document.getElementById(id); if (x && d.contains(x)) x.value = v; }
    d.scrollTop = top;
    d.dataset.k = key;
    const rows = [...d.querySelectorAll('.tr')];
    const back = focus && rows.find((x) => x.dataset.tk === focus);
    (back ?? rows.find((x) => x.classList.contains('sel')) ?? rows[0])?.setAttribute('tabindex', '0');
    if (back) back.focus({ preventScroll: true });
  }
  $('#nodeLevel').textContent = r ? t('flow.level.' + levelOf()) : '';
  $('#nodeLevel').style.display = r ? '' : 'none';
  drawLog(r);
  drawFoot(r);
  report();
}
/** The one label of who does a piece of work (requirement 22): "Neo · Developer · Claude Code · haiku". */
function whoFor(a, x) {
  const id = who(a);
  if (a === 'shell' || (id === 'shell' && !OLD[a])) return t('shellName');
  if (a === 'graph') return 'Smart Graph';
  if (a === 'you') return t('actor.you.name');
  const h = hired(a);
  return W.whoLabel({ name: h?.name, role: ACTORS[id].role, provider: x?.provider ?? h?.provider, model: x?.provider ? x.model : h?.model });
}
// ---------- the node: a tree like a debugger's frames and variables (requirement 23); nothing open the user did not open ----------
/** The rows the user opened, by key (run/station/step/inner…). */
const openKeys = new Set();
let openedFor = '';
const ICONS = { summary: '≡', trace: '›', tool: '⚒', io: '⇄', decision: '◆', file: '▤', log: '☰' };
function stationItem(r, s) { return { key: r.id + '/' + s.id, kind: 'station', stage: s.id, title: s.title, status: s.status, who: s.role ? whoFor(s.role, s) : '', time: dur(s), tip: s.about, kids: s.steps.map((x) => stepItem(r, s, x)) }; }
function stepItem(r, s, x) {
  const key = r.id + '/' + s.id + '/' + x.id;
  // every step that ended can be retried by hand (a failed one in place; one that passed after the user confirms what
  // it takes back), and a process of it that failed (a call or command tried again) retries its step
  const can = !live(r) && factory(r) && (x.status === 'failed' || x.status === 'passed') ? x.id : '';
  return { key, kind: 'step', stage: s.id, step: x.id, title: x.title, status: x.status, retry: can, who: whoFor(x.actor, x), time: dur(x) + (x.costUsd ? ' · $' + x.costUsd.toFixed(3) : ''), tip: ACTORS[who(x.actor)]?.does, kids: W.stepTree(x).map((n) => innerItem(key, n, n.kind === 'trace' && n.title === 'retry' ? can : '')) };
}
function innerItem(base, n, retry = '') {
  const key = base + '/' + n.id;
  return { key, kind: n.kind, retry, title: n.kind === 'io' || n.kind === 'log' ? t('node.' + n.title) : n.title, value: n.kind === 'log' ? t('node.lines', n.value) : n.value, text: n.kind === 'decision' ? t('because', n.text) : n.text, file: n.file, kids: n.children.map((c) => innerItem(key, c)) };
}
function rows(items, depth, parent) {
  return items.map((it) => {
    const can = !!(it.kids?.length || it.text);
    const open = can && openKeys.has(it.key);
    const sel = it.kind === 'step' ? view.step === it.step && view.stage === it.stage : false;
    const lead = it.status ? '<span class="dot st-' + esc(it.status) + '"></span>' : '<span class="ki k-' + it.kind + '">' + ICONS[it.kind] + '</span>';
    const big = it.kind === 'step' || it.kind === 'station';
    const head = '<div class="tr k-' + it.kind + (big ? ' big' : '') + (sel ? ' sel' : '') + (open ? ' open' : '') + (it.file ? ' file' : '') + '" role="treeitem" tabindex="-1" aria-level="' + (depth + 1) + '"' + (can ? ' aria-expanded="' + open + '"' : '') + (sel ? ' aria-selected="true"' : '')
      + ' data-tk="' + esc(it.key) + '" data-tp="' + esc(parent) + '"' + (it.file ? ' data-tf="' + esc(it.file) + '"' : '') + (it.step ? ' data-tst="' + esc(it.stage) + '" data-tsp="' + esc(it.step) + '"' : '') + ' style="--d:' + depth + '"' + (it.tip ? ' title="' + esc(it.tip) + '"' : '') + '>'
      + '<span class="tw">' + (can ? '▸' : '') + '</span>' + lead
      + '<div class="tb"><div class="tl"><span class="tt">' + esc(it.title) + '</span>' + (it.value ? '<span class="tv">' + esc(it.value) + '</span>' : '') + (big && it.time ? '<span class="tm">' + esc(it.time) + '</span>' : '') + (it.retry ? '<button class="trr" data-retrystep="' + esc(it.retry) + '" title="' + esc(t(it.status === 'passed' ? 'retryFromHereHint' : 'retryOneHint')) + '" aria-label="' + esc(t(it.status === 'passed' ? 'retryFromHere' : 'retryOne')) + '">↻</button>' : '') + '</div>'
      + (it.who ? '<small class="tlab">' + esc(it.who) + '</small>' : '') + '</div></div>';
    const body = open ? (it.kids?.length ? rows(it.kids, depth + 1, it.key) : '<pre class="tx" style="--d:' + (depth + 1) + '">' + esc(it.text) + '</pre>') : '';
    return head + body;
  }).join('');
}
const tree = (items) => items.length ? '<div class="tree" role="tree" aria-label="' + esc(t('nodeTitle')) + '">' + rows(items, 0, '') + '</div>' : '<div class="tnote">' + esc(t('noSteps')) + '</div>';
function toggle(key) {
  if (openKeys.has(key)) openKeys.delete(key); else openKeys.add(key);
  $('#node')._h = ''; drawRight();
  $('#node').querySelector('[data-tk="' + CSS.escape(key) + '"]')?.focus({ preventScroll: true });
}
function nodeOf(r) {
  const st = r.stages.find((s) => s.id === view.stage);
  if (!st) return runNode(r);
  // a step picked (in the diagram, the column or the log) opens once; the user closes it if they like
  const k = view.step ? r.id + '/' + st.id + '/' + view.step : '';
  if (k && !view.auto && openedFor !== k) { openedFor = k; openKeys.add(k); }
  const x = view.step ? st.steps.find((y) => y.id === view.step) : null;
  return '<div class="nh"><div class="dhead">' + (st.role ? av(st.role) : '') + '<h2>' + esc(st.title) + '</h2><span class="pill"><span class="dot st-' + st.status + '"></span> ' + esc(STATUS(st.status)) + '</span><span class="muted">' + dur(st) + '</span></div>'
    + (st.role ? '<div class="who1" title="' + esc(ACTORS[who(st.role)].does) + '">' + esc(whoFor(st.role, st)) + '</div>' : '')
    + '<div class="acts">' + (!live(r) && factory(r) && st.status !== 'pending' ? '<button id="retryStage" class="primary" title="' + esc(t('retryStageHint')) + '">↻ ' + esc(t('retryStage', st.title)) + '</button>' : '')
    + (x && (x.status === 'failed' || x.status === 'passed') && !live(r) && factory(r) ? '<button id="retryOne" class="primary" title="' + esc(t(x.status === 'failed' ? 'retryOneHint' : 'retryFromHereHint')) + '">↻ ' + esc(t(x.status === 'failed' ? 'retryOne' : 'retryFromHere')) + '</button>' : '')
    + (x ? '<button id="inStep" title="' + esc(t('insideStepHint')) + '">⤢ ' + esc(t('insideStep')) + '</button>' : '')
    + '<button data-over="1" class="ghost" title="' + esc(t('backToRunHint')) + '">‹ ' + esc(t('theRun')) + '</button></div></div>'
    + tree(st.steps.map((y) => stepItem(r, st, y)));
}
function runNode(r) {
  const active = r.stages.find((s) => s.status === 'running' || s.status === 'waiting');
  const aside = (r.setAside ?? []).map((k) => '<div class="crow"><span class="dot st-skipped"></span><div>' + esc(t('setAside', k.files.length, k.folder + '/')) + '<small>' + new Date(k.at).toLocaleString(LANG) + ' · ' + esc(k.files.slice(0, 6).join(', ') + (k.files.length > 6 ? '…' : '')) + '</small></div></div>').join('');
  const retried = (r.retries ?? []).slice().reverse().map((x) => '<div class="crow"><span class="dot st-' + (x.level === 'you' ? 'running' : 'skipped') + '"></span><div>' + esc(W.retryText(x, T)) + '<small>' + new Date(x.at).toLocaleString(LANG) + (x.why ? ' · ' + esc(x.why) : '') + '</small></div></div>').join('');
  const tries = (r.previous ?? []).map((p, i) => '<div class="crow"><span class="dot st-' + p.status + '"></span><div>' + esc(t('attempt', i + 1, STATUS(p.status), p.from)) + (p.why ? ': ' + esc(p.why) : '') + '<small>' + new Date(p.at).toLocaleString(LANG) + (p.undone?.length ? ' · ' + esc(t('undone', p.undone.join(', '))) : '') + '</small></div></div>').join('');
  const crit = r.spec.criteria.map((c) => '<div class="crow">☐<div>' + esc(c) + '</div></div>').join('');
  const docs = r.stages.flatMap((s) => s.steps.flatMap((x) => (x.files ?? []).filter((f) => f.startsWith('specs/')))).filter((f, i, all) => all.indexOf(f) === i);
  const list = checksOf[r.id];
  const fold = (id, title, body) => body ? '<details class="more" data-more="' + id + '"' + (openKeys.has('more:' + id) ? ' open' : '') + '><summary>' + title + '</summary>' + body + '</details>' : '';
  return '<div class="nh"><h2>' + esc(active ? t('now', active.title) : t('theRun')) + '</h2></div>'
    + tree(r.stages.map((s) => stationItem(r, s)))
    + fold('checks', esc(t('checksTitle')) + (list ? ' <span class="muted">' + esc(t('checksCount', list.filter((c) => c.on).length, list.length)) + '</span>' : ''), consoleOf(r))
    + fold('crit', esc(t('accTitle')) + ' <span class="muted">' + r.spec.criteria.length + '</span>', crit)
    + fold('docs', esc(t('documents')), docs.map((f) => '<div><a data-open="' + esc(f) + '">' + esc(f) + '</a></div>').join(''))
    + fold('retried', esc(t('retriesTitle')) + ' <span class="muted">' + (r.retries ?? []).length + '</span>', retried)
    + fold('tries', esc(t('earlierAttempts')) + ' <span class="muted">' + (r.previous ?? []).length + '</span>', tries ? tries + '<small class="muted block">' + esc(t('keptWhole', r.id)) + '</small>' : '')
    + fold('aside', esc(t('setAsideTitle')) + ' <span class="muted">' + (r.setAside ?? []).length + '</span>', aside);
}
/** The stations a spec goes through, each with its role: what the node column says before there is a run. */
function stationsInfo() {
  return '<h2>' + esc(view.mode === 'form' ? t('formNodeTitle') : t('homeNodeTitle')) + '</h2><div class="muted">' + esc(t('homeNodeHint')) + '</div><h3>' + esc(t('theLine')) + '</h3>'
    + LINE.map(([id, role], i) => '<div class="crow" style="grid-template-columns:22px 1fr;padding:6px 0">' + av(role) + '<div><b>' + (i + 1) + ' · ' + esc(T['station.' + id] ?? id) + '</b><small>' + esc(T['station.' + id + '.about'] ?? '') + '</small></div></div>').join('');
}
function specInfo() {
  const x = allSpecs().find((s) => s.id === view.spec);
  if (!x) return stationsInfo();
  return '<h2>' + esc(x.title) + '</h2><div class="muted">' + esc(whereOf(x)) + '</div><h3>' + esc(t('documents')) + '</h3><div><a data-open="' + esc(x.path + '/spec.md') + '">' + esc(x.path + '/spec.md') + '</a></div>'
    + '<h3>' + esc(t('theLine')) + '</h3>' + LINE.map(([id, role]) => '<div class="crow" style="grid-template-columns:22px 1fr">' + av(role) + '<div>' + esc(T['station.' + id] ?? id) + '</div></div>').join('');
}
// ---------- the log: one line per thing done (who, what), each opening to its detail (requirement 24) ----------
const logOpen = new Set();
function drawLog(r) {
  const el = $('#log');
  const all = r ? W.teamLog(r, 0).filter((e) => e.kind === 'step').slice(-150) : [];
  $('#logCount').textContent = all.length || '';
  const k = r?.id ?? '', n0 = el._key === k ? el._n ?? 0 : all.length;
  const html = all.length ? all.map((e, i) => {
    const x = r.stages.find((s) => s.id === e.stage)?.steps.find((y) => y.id === e.step);
    const key = e.stage + '/' + e.step, open = logOpen.has(key), trace = x?.trace ?? [];
    const det = open ? '<div class="ld">' + (e.detail ? '<div>' + esc(e.detail) + '</div>' : '') + trace.map((tr) => '<div class="lt"><span class="' + (tr.kind === 'tool' ? 'tool' : 'tstep') + '">' + (tr.kind === 'tool' ? '⚒ ' : '› ') + esc(tr.step) + '</span> <span class="muted">' + esc(String(tr.detail ?? '').slice(0, 220)) + '</span></div>').join('')
      + (!e.detail && !trace.length ? '<div class="muted">' + esc(t('logNoDetail')) + '</div>' : '') + '<a data-pickstep="' + esc(key) + '">' + esc(t('logShow')) + ' →</a></div>' : '';
    return '<div class="le ' + e.status + (i >= n0 ? ' fresh' : '') + (open ? ' open' : '') + '" data-lk="' + esc(key) + '" tabindex="0" role="button" aria-expanded="' + open + '">' + av(e.actor, x?.employee)
      + '<div class="lb"><div class="ll"><span class="what">' + esc(e.text) + '</span><span class="tm">' + (x ? dur(x) : '') + '</span></div><small>' + esc(whoFor(e.actor, x)) + '</small>' + det + '</div></div>';
  }).join('') : '<div class="tnote">' + esc(r ? t('logNothing') : t('logEmpty')) + '</div>';
  if (el._html === html) return;
  const end = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  const focus = el.contains(document.activeElement) ? document.activeElement.dataset.lk : null;
  el.innerHTML = html; el._html = html; el._n = all.length; el._key = k;
  if (focus) el.querySelector('[data-lk="' + CSS.escape(focus) + '"]')?.focus({ preventScroll: true });
  if (end) el.scrollTop = el.scrollHeight;
}
/** Three people in the line of the page's icons: a team. */
const TEAM_ICON = '<svg class="ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="3.2"/><path d="M6.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="5.5" cy="10" r="2.2"/><path d="M1.8 18a3.8 3.8 0 0 1 5-3.5"/><circle cx="18.5" cy="10" r="2.2"/><path d="M22.2 18a3.8 3.8 0 0 0-5-3.5"/></svg>';
/** A team's logo: its image, else its initials in its colour. */
const logoOf = (name, id, logo) => logo ? '<img class="tlogo" src="' + esc(logo) + '" alt="">' : '<span class="tlogo" style="background:' + W.teamColor(id || name) + '">' + esc(W.initials(name)) + '</span>';
/** Under the log, the team doing the work: its logo and name (the run's, else the one the next run takes). */
function drawFoot(r) {
  const ctx = r ? teamCtx[r.id] : null;
  const name = r ? r.team?.name ?? r.factory?.teamName ?? ctx?.team : teamCard?.name;
  const id = r ? r.team?.id ?? r.factory?.team : teamCard?.id;
  const info = r ? ctx : teamCard, lead = info?.roles?.find((x) => x.role === (info.techLead || 'architect'));
  const status = !r ? t('teamNext') : live(r) ? t('teamWorking') : t('teamWorked');
  const build = '<button class="tfnew" data-act="buildTeam" title="' + esc(t('buildTeamHint')) + '" aria-label="' + esc(t('buildTeam')) + '">' + TEAM_ICON + (name ? '' : ' ' + esc(t('buildTeam'))) + '</button>';
  const html = (name ? '<a class="tf" data-teamchat="' + esc(id ?? '') + '" tabindex="0" title="' + esc(t('teamChatHint', name)) + '">' + logoOf(name, id, info?.logo) + '<span><b>' + esc(name) + '</b><small>' + esc(lead?.name ? t('teamLed', lead.name) + ' · ' + status : status) + '</small></span></a>' : '<span class="tf muted">' + esc(t('noTeamYet')) + '</span>') + build;
  const el = $('#teamFoot');
  if (el._h !== html) { el.innerHTML = html; el._h = html; }
}
/** The run as the user follows it: the six stations in a line (done, working now, waiting for you, failed, next), each
 * with who works it; what is being done now, in one sentence; and the spec it works on (its description and criteria). */
function progress(r) {
  const icon = { passed: '✓', running: '●', waiting: '❗', failed: '✕', pending: '', skipped: '–' };
  const stations = r.stages.map((st, i) => {
    const a = st.role ?? st.actors?.[0] ?? 'analyst';
    return (i ? '<div class="pline ' + (st.status === 'pending' ? '' : 'on') + '"></div>' : '') + '<div class="pst st-' + st.status + '" data-stage="' + esc(st.id) + '"><div class="pdot">' + (icon[st.status] ?? '') + '</div>' + av(a) + '<b>' + esc(T['station.' + st.id] ?? st.title) + '</b><small>' + esc(nameOf(a)) + '</small></div>';
  }).join('');
  const now = r.stages.find((s) => s.status === 'running' || s.status === 'waiting') ?? null;
  const step = now ? [...now.steps].reverse().find((x) => x.status === 'running') ?? [...now.steps].reverse().find((x) => x.status !== 'pending') : null;
  // a station's checks at the same time: one line each, each with its spinner
  const working = now ? now.steps.filter((x) => x.status === 'running') : [];
  const bad = failedStep(r);
  const next = r.stages.find((s) => s.status === 'pending');
  let doing;
  if (r.waiting) doing = '<div class="pnow wait"><b>❗ ' + esc(t('prog.waits')) + '</b><p>' + esc(r.waiting.question ?? '') + '</p><button class="primary" data-act="showAsk">' + esc(t('prog.answer')) + '</button></div>';
  else if (r.status === 'passed') doing = '<div class="pnow ok"><b>✓ ' + esc(t('prog.done')) + '</b></div>';
  else if (bad) doing = '<div class="pnow bad"><b>✕ ' + esc(t('prog.failed')) + ' · ' + esc(T['station.' + bad.st.id] ?? bad.st.title) + '</b><p>' + esc(bad.x.summary || W.stepTitle(bad.x, T)) + '</p></div>';
  else if (now && working.length > 1) doing = '<div class="pnow"><b>' + esc(t('prog.now')) + ' · ' + esc(nameOf(working[0].actor)) + ' · ' + esc(t('prog.together', String(working.length))) + '</b>' + working.map((x) => '<p><span class="dot st-running"></span> ' + esc(W.stepTitle(x, T)) + '</p>').join('') + '</div>';
  else if (now && step) doing = '<div class="pnow"><b>' + esc(t('prog.now')) + ' · ' + esc(nameOf(step.actor)) + '</b><p>' + esc(W.stepTitle(step, T)) + (step.summary ? ' — ' + esc(step.summary) : '') + '</p></div>';
  else doing = '<div class="pnow"><b>' + esc(live(r) ? t('prog.next', next ? T['station.' + next.id] ?? next.title : '') : t('prog.stopped')) + '</b></div>';
  const sp = r.spec ?? {};
  const crit = (sp.criteria ?? []).length ? '<ol>' + sp.criteria.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ol>' : '<p class="muted">' + esc(t('prog.noCriteria')) + '</p>';
  const spec = '<div class="pspec"><div class="muted">' + esc(t('prog.spec')) + '</div><h3>' + esc(sp.title ?? r.id) + '</h3>' + (sp.description ? '<p>' + esc(sp.description) + '</p>' : '') + '<div class="muted">' + esc(t('prog.criteria')) + '</div>' + crit
    + '<button data-open="' + esc((r.specPath ?? 'specs/' + r.id) + '/spec.md') + '">' + esc(t('openSpec')) + '</button></div>';
  return '<div class="prog"><div class="pipe">' + stations + '</div>' + doing + spec + '</div>';
}
function head(r) {
  const bad = failedStep(r);
  // the main action retries the smallest unit that failed: its step, in place
  const unit = W.retryUnit(r);
  const asks = r.waiting?.kind === 'retry' && unit;
  const idle = !live(r);
  const team = r.factory?.teamName ?? teamCtx[r.id]?.team;
  const bits = [esc(t('uc.' + r.spec.useCase)), team ? esc(t('teamOf', team)) : '', dur({ started: r.created, ended: r.ended }), r.costUsd ? 'USD ' + r.costUsd.toFixed(3) + (r.factory?.budgetUsd ? ' / ' + r.factory.budgetUsd.toFixed(2) : '') : ''].filter(Boolean);
  const station = bad ? r.stages.find((s) => s.id === bad.st.id) : null;
  return '<div class="top"><div class="head"><h1>' + esc(r.spec.title) + '</h1><span class="pill"><span class="dot st-' + r.status + '"></span> ' + esc(STATUS(r.status)) + '</span><span class="muted">' + bits.join(' · ') + '</span><div class="grow"></div>'
    + (!idle ? '<button id="stop" title="' + esc(r.waiting ? t('stopWaitingHint') : t('stopHint')) + '">■ ' + esc(t('stop')) + '</button>' : '')
    + (asks ? '<button class="primary" data-answer="yes" title="' + esc(t('retryHint', W.stepTitle(unit.x, T), unit.st.title)) + '">↻ ' + esc(t('retryUnit', W.stepTitle(unit.x, T))) + '</button>' : '')
    + (!asks && idle && station && factory(r) && r.status === 'failed' ? '<button id="retry" class="primary" data-step="' + esc(bad.x.id) + '" title="' + esc(t('retryHint', W.stepTitle(bad.x, T), station.title)) + '">↻ ' + esc(t('retryUnit', W.stepTitle(bad.x, T))) + '</button>' : '')
    + (idle && r.status === 'waiting' && !r.waiting ? '<button id="resume" class="primary" title="' + esc(t('resumeHint')) + '">▶ ' + esc(t('resume')) + '</button>' : '')
    + (idle ? '<button id="scratch" title="' + esc(t('scratchHint')) + '">⟲ ' + esc(t('scratch')) + '</button>' : '')
    + '<button data-act="detail">' + esc(detailed ? t('prog.simple') : t('prog.detail')) + '</button>'
    + '<button data-open="' + esc((r.specPath ?? 'specs/' + r.id) + '/spec.md') + '">' + esc(t('openSpec')) + '</button></div>'
    + (r.waiting && !asks ? '<div class="acts" style="margin:6px 0 0"><button class="primary" data-act="showAsk">❗ ' + esc(t('waitsForYouSee')) + '</button></div>' : '')
    + (factory(r) ? '' : '<div class="muted">⚠ ' + esc(t('olderEngine')) + '</div>')
    + ((r.interrupted ?? []).slice(-1).map((i) => '<div class="muted">⚠ ' + esc(t('interrupted', i.stage + (i.step ? ' · ' + i.step : ''), new Date(i.at).toLocaleString(LANG), i.undone.join(', ') || t('nothing'))) + '</div>').join(''))
    + (!detailed ? '' : '<div class="muted hint">' + esc(t('clickHint')) + ((r.previous ?? []).length ? ' <a data-over="1">' + esc(r.previous.length === 1 ? t('earlierOne') : t('earlierMany', r.previous.length)) + '</a>' : '') + '</div>') + '</div>';
}
// ---------- what a station asks: answered here, sent to the run's process (or to its resume, when it ended waiting) ----------
function gate(r) {
  const w = r.waiting;
  if (!w) return '';
  const st = r.stages.find((s) => s.id === w.station);
  const role = st?.role;
  const docs = (w.documents ?? []).map((d) => '<a class="link" data-open="' + esc(d) + '">▤ ' + esc(d.split('/').pop()) + '</a>').join('');
  if (w.kind === 'spending') {
    return '<div class="gate" role="alert"><div class="q"><span class="bell">💰</span><b>' + esc(t('spendingAsk', (w.providers ?? []).map((p) => PROVIDERS[p] ?? p).join(', '))) + '</b></div>'
      + '<div class="muted">' + esc(live(r) ? t('spendingModal') : t('spendingResume')) + '</div>'
      + (live(r) ? '' : '<div class="acts"><button id="resume" class="primary">💰 ' + esc(t('confirmSpending')) + '</button></div>') + '</div>';
  }
  if (w.kind === 'retry') {
    // every level of retries was tried (or none can fix it): the user retries the failed step in place, ends the run, or later
    const x = st?.steps.find((y) => y.id === w.step);
    const name = x ? W.stepTitle(x, T) : w.step ?? '';
    return '<div class="gate" role="alert"><div class="q"><span class="bell">↻</span>' + (role ? av(role) : '') + '<b>' + esc(t(w.worth === false ? 'retryAskNow' : 'retryAsk', st?.title ?? w.station ?? '', name)) + '</b></div>'
      + (x?.summary ? '<div class="muted">' + esc(x.summary) + '</div>' : '')
      + '<div class="muted">' + esc(t(w.worth === false ? 'retryNotWorth' : 'retryKept')) + '</div>'
      + '<div class="acts"><button class="primary" data-answer="yes">↻ ' + esc(t('retryUnit', name)) + '</button><button data-answer="no">' + esc(t('endFailed')) + '</button><button data-answer="stop" title="' + esc(t('laterHint')) + '">' + esc(t('later')) + '</button></div></div>';
  }
  if (w.kind === 'checks') {
    // the user's own checks up to Quality: Delivery's are asked there, and those a gate answers are marked by its yes
    const gated = ['analyst.user-approves', 'architect.user-approves', 'qa.plan-approved', 'devops.approve-push'];
    const mine = (checksOf[r.id] ?? []).filter((c) => c.on && c.by === 'user' && c.state === 'pending' && c.station !== 'delivery' && !c.gate && !gated.includes(c.id));
    return '<div class="gate" role="alert"><div class="q"><span class="bell">✓</span>' + (role ? av(role) : '') + '<b>' + esc(t('qaPlanAsk', nameOf('qa'))) + '</b></div>'
      + '<div class="muted">' + esc(mine.length ? t('qaPlanMine', mine.length) : t('qaPlanReady')) + '</div>'
      + '<div class="acts"><button data-over="1">☰ ' + esc(t('openConsole')) + '</button><button class="primary" data-answer="yes"' + (mine.length ? ' disabled title="' + esc(t('markYoursFirst')) + '"' : '') + '>▶ ' + esc(t('goOn')) + '</button><button data-answer="stop">' + esc(t('later')) + '</button></div></div>';
  }
  return '<div class="gate" role="alert"><div class="q"><span class="bell">?</span>' + (role ? av(role) : '') + '<b>' + esc(st && w.key !== 'decide' ? t('gateAsk', st.title, nameOf(role)) : w.question) + '</b></div>'
    + (docs ? '<div class="docs"><span class="muted">' + esc(t('readFirst')) + '</span>' + docs + '</div>' : '')
    + ((st && st.needsYou && st.needsYou.length) ? '<div class="decide"><span class="muted">' + esc(t('decideAlso')) + '</span><ul>' + st.needsYou.map((q) => '<li>' + esc(q) + '</li>').join('') + '</ul></div>' : '')
    + '<textarea id="changeText" placeholder="' + esc(t('changePlaceholder')) + '"></textarea>'
    + '<div class="acts"><button class="primary" data-answer="approve">✓ ' + esc(t('approve')) + '</button><button data-answer="change">✎ ' + esc(t('askChange')) + '</button><button data-answer="stop" title="' + esc(t('laterHint')) + '">' + esc(t('later')) + '</button></div></div>';
}
/** The run's checks as a console: on/off, title, station, who runs it, its state; the user's checks marked here. */
function consoleOf(r) {
  const list = checksOf[r.id];
  if (!factory(r)) return '';
  if (!list) return '<h3>' + esc(t('checksTitle')) + '</h3><div class="muted">' + esc(t('loading')) + '</div>';
  const stTitle = (id) => r.stages.find((s) => s.id === id)?.title ?? id;
  // yours to do first, then by station, in the line's order
  const order = (c) => (c.on && c.by === 'user' && c.state === 'pending' ? -1 : r.stages.findIndex((x) => x.id === c.station));
  const rows = [...list].sort((a, b) => order(a) - order(b)).map((c) => '<tr class="' + (c.on ? '' : 'off') + '"><td><input type="checkbox" data-check="' + esc(c.id) + '"' + (c.on ? ' checked' : '') + ' title="' + esc(t('checkOnHint')) + '"></td>'
    + '<td>' + esc(c['title_' + LANG] ?? c.title) + (c.by === 'user' ? '<span class="mine">' + esc(t('yours')) + '</span>' : '')
    + '<small class="muted block">' + esc(stTitle(c.station)) + ' · ' + esc(c.by === 'user' ? t('actor.you.name') : nameOf(c.role ?? r.stages.find((s) => s.id === c.station)?.role ?? 'qa')) + (c.note ? ' — ' + esc(c.note) : '') + '</small>'
    + (c.by === 'user' && c.on ? '<div class="acts marks"><button data-mark="' + esc(c.id) + '" data-state="passed"' + (c.state === 'passed' ? ' class="on"' : '') + '>✓ ' + esc(t('markDone')) + '</button><button data-mark="' + esc(c.id) + '" data-state="failed"' + (c.state === 'failed' ? ' class="on bad"' : '') + '>✕ ' + esc(t('markFailed')) + '</button></div>' : '') + '</td>'
    + '<td class="st ' + esc(c.state) + '">' + esc(t('check.' + c.state)) + '</td></tr>').join('');
  return '<h3>' + esc(t('checksTitle')) + ' <span class="muted">' + esc(t('checksCount', list.filter((c) => c.on).length, list.length)) + '</span></h3>'
    + '<table class="console"><tr><th></th><th>' + esc(t('check.title')) + '</th><th>' + esc(t('check.state')) + '</th></tr>' + rows + '</table>'
    + '<div class="addcheck"><input id="ckTitle" placeholder="' + esc(t('checkTitlePlaceholder')) + '"><select id="ckStation">' + r.stages.map((s) => '<option value="' + esc(s.id) + '"' + (s.id === 'quality' ? ' selected' : '') + '>' + esc(s.title) + '</option>').join('') + '</select><button id="ckAdd">＋ ' + esc(t('addCheck')) + '</button>'
    + '<textarea id="ckPrompt" placeholder="' + esc(t('checkPromptPlaceholder')) + '"></textarea></div>';
}
function draw() {
  drawChrome(); report();
  if (view.mode === 'run' && !view.run) view.mode = 'home';
  $('#main').className = view.mode === 'run' ? 'run' : '';
  if (view.mode === 'run') return drawRun();
  if (view.mode === 'form') drawForm(); else if (view.mode === 'spec') drawSpec(); else drawHome();
  drawRight();
}
// a run opens at C4's first level, its context (requirement 17); a double click goes down
const fresh = (run) => ({ mode: 'run', run, spec: run.id, stage: null, step: null, trace: null, tab: 'trace', auto: true, open: null, level: 'context', inStep: null });
/** A spec picked (in the tree, or written by the chat): its run when it has one, else the spec. */
function openSpec(id) {
  const r = S.runs.find((x) => x.id === id);
  view = r ? fresh(r) : { mode: 'spec', run: null, spec: id, stage: null, step: null, trace: null, tab: 'trace', auto: true, open: null, level: null, inStep: null };
  draw();
}
const answer = (a) => { const w = view.run?.waiting; if (!w) return; const text = $('#changeText')?.value.trim() ?? ''; if (a === 'change' && !text) return toast(t('sayWhatChanges'), true); vscode.postMessage({ type: 'answer', id: view.run.id, ask: w.id, answer: a === 'change' ? { answer: 'change', text } : { answer: a } }); toast(a === 'stop' ? t('itWaits') : t('answerSent')); };

/** A click in the Workspace's column, done here: a spec, a run, a station or step of a run, a new spec. */
let driveNext = null;
function drive(m) {
  if (m.op === 'new') return newSpec();
  if (m.op === 'spec') return openSpec(m.id);
  const r = runFor(m.id);
  if (!r) { driveNext = m; return; }
  if (view.mode !== 'run' || view.run?.id !== r.id) view = fresh(r);
  if (m.op === 'node') {
    Object.assign(view, { stage: m.stage ?? null, step: m.step ?? null, trace: null, open: m.step ? m.stage : null, inStep: null, level: m.stage ? null : view.level, auto: false });
    if (L.fold.right) fold('right', false);
  }
  draw();
}
const newSpec = () => { view = { mode: 'form', run: null, spec: null, stage: null, step: null, trace: null, tab: 'trace', auto: true, open: null, level: null, inStep: null }; draw(); };
const runFor = (id) => S.runs.find((r) => r.id === id);

document.addEventListener('click', (e) => {
  const rb = e.target.closest('[data-retrystep]');
  if (rb && view.mode === 'run') { view.auto = true; return vscode.postMessage({ type: 'retry', id: view.run.id, step: rb.dataset.retrystep }); }
  const tr = e.target.closest('#node .tr');
  if (tr) {
    tr.focus({ preventScroll: true });
    if (tr.dataset.tf) return vscode.postMessage({ type: 'open', file: tr.dataset.tf });
    if (tr.dataset.tsp && view.mode === 'run' && (view.step !== tr.dataset.tsp || view.stage !== tr.dataset.tst)) {
      // a step's row picks it in the diagram too
      Object.assign(view, { stage: tr.dataset.tst, step: tr.dataset.tsp, trace: null, auto: false });
      openedFor = view.run.id + '/' + view.stage + '/' + view.step;
      openKeys.add(openedFor); drawRun();
      return $('#node').querySelector('[data-tk="' + CSS.escape(openedFor) + '"]')?.focus({ preventScroll: true });
    }
    if (tr.hasAttribute('aria-expanded')) toggle(tr.dataset.tk);
    return;
  }
  const more = e.target.closest('#node details.more > summary');
  if (more) { const k = 'more:' + more.parentElement.dataset.more; setTimeout(() => { if (more.parentElement.open) openKeys.add(k); else openKeys.delete(k); $('#node')._h = ''; }); return; }
  const ps = e.target.closest('[data-pickstep]');
  if (ps && view.mode === 'run') { const [stage, step] = ps.dataset.pickstep.split('/'); Object.assign(view, { stage, step, trace: null, open: stage, inStep: null, level: null, auto: false }); drawRun(); return; }
  const le = e.target.closest('#log .le');
  if (le && !e.target.closest('a')) { const k = le.dataset.lk; if (logOpen.has(k)) logOpen.delete(k); else logOpen.add(k); $('#log')._html = ''; return drawLog(view.mode === 'run' ? view.run : null); }
  const x = e.target.closest('[data-uc],[data-src],[data-stage],[data-over],[data-tab],[data-open],[data-ci],[data-jira],[data-delcrit],[data-delpc],[data-sug],[data-ctx],[data-answer],[data-check],[data-mark],[data-spec],[data-fold],[data-unfold],[data-try],[data-squad],[data-runspec],[data-polish],[data-dm],[data-teamchat],[data-act],button,a');
  if (!x) { $('#ciPop').classList.remove('open'); return; }
  const d = x.dataset;
  if (x.id !== 'ci') $('#ciPop').classList.remove('open');
  if (d.fold) return fold(d.fold, true);
  if (d.unfold) return fold(d.unfold, false);
  if (d.spec) return openSpec(d.spec);
  if (d.squad) return vscode.postMessage({ type: 'teams' });
  if (d.runspec) return vscode.postMessage({ type: 'runSpec', id: d.runspec, path: d.path, team: form.team || teams.chosen });
  if (d.act === 'new') return newSpec();
  if (d.act === 'askChat') return vscode.postMessage({ type: 'atlas' });
  if (d.dm) return vscode.postMessage({ type: 'atlas', channel: d.dm });
  if (d.teamchat) return vscode.postMessage({ type: 'atlas', channel: d.teamchat });
  if (d.act === 'buildTeam') return vscode.postMessage({ type: 'teams', wizard: true });
  if (d.polish) return vscode.postMessage({ type: 'polish', id: d.polish });
  if (d.act === 'detail') { detailed = !detailed; drawRun(); return report(); }
  if (d.act === 'showAsk') { fold('right', false); Object.assign(view, { stage: null, step: null, auto: false }); drawRun(); return $('#node').scrollTo({ top: 0, behavior: 'smooth' }); }
  if (d.uc) { readForm(); if (!form.description.trim() || Object.values(TEMPLATES).includes(form.description)) form.description = TEMPLATES[d.uc]; form.useCase = d.uc; return drawForm(); }
  if (d.src) { readForm(); form.srcTab = d.src; return drawForm(); }
  if (d.delcrit) { readForm(); form.criteria.splice(+d.delcrit, 1); return drawForm(); }
  if (d.delpc) { readForm(); form.pieces.splice(+d.delpc, 1); return drawForm(); }
  if (d.sug !== undefined && x.tagName === 'INPUT') { const p = form.suggestions[+d.sug].path; form.context = x.checked ? [...form.context, p] : form.context.filter((c) => c !== p); return; }
  if (d.ctx !== undefined && x.tagName === 'INPUT') { form.context = form.context.filter((c) => c !== d.ctx); readForm(); return drawForm(); }
  if (d.answer) return answer(d.answer);
  if (d.check !== undefined && x.tagName === 'INPUT') return vscode.postMessage({ type: 'check', id: view.run.id, op: x.checked ? 'on' : 'off', check: d.check });
  if (d.mark) return vscode.postMessage({ type: 'check', id: view.run.id, op: 'mark', check: d.mark, state: d.state });
  if (d.stage) { if (view.mode !== 'run') return; Object.assign(view, { stage: d.stage, step: d.step ?? null, trace: d.trace === undefined ? null : +d.trace, auto: false }); if (d.trace !== undefined) view.tab = 'trace'; drawRun(); return report(); }
  if (d.over) { Object.assign(view, { stage: null, step: null, trace: null, auto: false }); drawRun(); return report(); }
  if (d.tab) { view.tab = d.tab; return drawRun(); }
  if (d.open) return vscode.postMessage({ type: 'open', file: d.open });
  if (d.ci) return vscode.postMessage({ type: 'exportCi', provider: d.ci });
  if (d.jira) { $('#jiraKey') && ($('#jiraKey').value = d.jira); return vscode.postMessage({ type: 'jira', key: d.jira }); }
  switch (x.id) {
    case 'new': return newSpec();
    case 'ci': return $('#ciPop').classList.toggle('open');
    case 'config': return vscode.postMessage({ type: 'config' });
    case 'addCrit': readForm(); form.criteria.push(''); drawForm(); return document.querySelector('[data-crit="' + (form.criteria.length - 1) + '"]')?.focus();
    case 'readCrit': { readForm(); const lines = form.description.split('\n'); const at = lines.findIndex((l) => /acceptance criteria|criterios de aceptaci/i.test(l)); const found = at < 0 ? [] : lines.slice(at + 1).map((l) => l.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/)?.[1]).filter(Boolean); if (!found.length) return toast(t('noCritList')); form.criteria = found; return drawForm(); }
    case 'suggest': readForm(); return vscode.postMessage({ type: 'suggest', text: form.title + ' ' + form.description });
    case 'addCtxGo': { const v = $('#addCtx').value.trim(); if (v) { readForm(); form.context.push(v); drawForm(); } return; }
    case 'jiraGo': return vscode.postMessage({ type: 'jira', key: $('#jiraKey').value });
    case 'jiraMine': return vscode.postMessage({ type: 'jiraMine' });
    case 'jiraSetup': return vscode.postMessage({ type: 'jiraSetup' });
    case 'ghGo': return vscode.postMessage({ type: 'github', ref: $('#ghRef').value });
    case 'reset': form = blank(); return drawForm();
    case 'saveSpec': case 'start': {
      const s = specOf();
      if (!s.title) return toast(t('needsTitle'), true);
      if (!/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(s.component)) return toast(t('componentBad'), true);
      if (x.id === 'saveSpec') return vscode.postMessage({ type: 'saveSpec', spec: s });
      if (!s.criteria.length) return toast(t('needsCriterion'), true);
      return vscode.postMessage({ type: 'start', spec: s, team: form.team || teams.chosen });
    }
    case 'openTeam': return vscode.postMessage({ type: 'teams' });
    case 'openBudget': return vscode.postMessage({ type: 'openSection', id: 'spending' });
    case 'stop': return vscode.postMessage({ type: 'stop', id: view.run.id });
    case 'resume': return vscode.postMessage({ type: 'resume', id: view.run.id });
    case 'retry': view.auto = true; return vscode.postMessage({ type: 'retry', id: view.run.id, step: d.step });
    case 'retryOne': { const step = view.step; view.auto = true; return vscode.postMessage({ type: 'retry', id: view.run.id, step }); }
    case 'retryStage': { const station = view.stage; view.auto = true; return vscode.postMessage({ type: 'retry', id: view.run.id, station }); }
    case 'inStep': Object.assign(view, { open: view.stage, inStep: view.step, level: null, auto: false }); drawRun(); return report();
    case 'scratch': view.auto = true; return vscode.postMessage({ type: 'retry', id: view.run.id, scratch: true });
    case 'ckAdd': { const title = $('#ckTitle').value.trim(); if (!title) return toast(t('checkNeedsTitle'), true); return vscode.postMessage({ type: 'check', id: view.run.id, op: 'add', title, station: $('#ckStation').value, prompt: $('#ckPrompt').value.trim() }); }
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'teamSel') { if (view.mode === 'form') readForm(); form.team = e.target.value; teamCard = null; if (view.mode === 'form') drawForm(); vscode.postMessage({ type: 'team', id: form.team }); }
  // the whole project has no layer: the form says so as soon as the component changes
  if (e.target.id === 'component') { readForm(); drawForm(); }
});
document.addEventListener('keydown', (e) => {
  const tr = e.target.closest?.('#node .tr');
  if (tr && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(e.key)) {
    e.preventDefault();
    const all = [...$('#node').querySelectorAll('.tr')], i = all.indexOf(tr), go = (x) => x?.focus();
    const can = tr.hasAttribute('aria-expanded'), open = tr.getAttribute('aria-expanded') === 'true';
    if (e.key === 'ArrowDown') return go(all[i + 1]);
    if (e.key === 'ArrowUp') return go(all[i - 1]);
    if (e.key === 'Home') return go(all[0]);
    if (e.key === 'End') return go(all[all.length - 1]);
    if (e.key === 'ArrowRight') return can && !open ? toggle(tr.dataset.tk) : open && all[i + 1]?.dataset.tp === tr.dataset.tk ? go(all[i + 1]) : undefined;
    if (e.key === 'ArrowLeft') return can && open ? toggle(tr.dataset.tk) : go($('#node').querySelector('[data-tk="' + CSS.escape(tr.dataset.tp) + '"]'));
    return tr.click();
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.card,.accept,a.link,.le,.tf,.chips a')) { e.preventDefault(); e.target.click(); }
  // Escape walks back up the levels: the step, inside the step, inside the station, the station
  if (e.key === 'Escape' && view.mode === 'run' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') { if (view.step && !view.inStep) Object.assign(view, { step: null, trace: null, auto: false }); else if (view.inStep) Object.assign(view, { inStep: null, auto: false }); else if (view.open) Object.assign(view, { open: null, auto: false }); else if (!view.level) Object.assign(view, { level: 'context', auto: false }); else Object.assign(view, { stage: null, auto: false }); drawRun(); report(); }
});
$('#project').addEventListener('change', (e) => vscode.postMessage({ type: 'project', root: e.target.value }));
let suggestTimer;
document.addEventListener('input', (e) => {
  if (e.target.id === 'desc' || e.target.id === 'title') { clearTimeout(suggestTimer); suggestTimer = setTimeout(() => { readForm(); vscode.postMessage({ type: 'suggest', text: form.title + ' ' + form.description }); }, 900); }
});

/** A run with its stations in the page's language (the engine writes them in English, the platform's language). */
const shown = (r) => ({ ...r, stages: r.stages.map((s) => ({ ...s, title: T['station.' + s.id] ?? s.title, about: T['station.' + s.id + '.about'] ?? s.about, steps: s.steps.map((x) => ({ ...x, title: W.stepTitle(x, T) })) })) });
window.addEventListener('message', (e) => {
  const m = e.data;
  if (m.runs) m.runs = m.runs.map(shown);
  if (m.run) m.run = shown(m.run);
  if (m.type === 'state') {
    if (view.mode === 'form') readForm();
    const moved = S.root !== m.root;
    S = m;
    if (moved && view.mode !== 'form') view = { mode: 'home', run: null, spec: null, stage: null, step: null, trace: null, tab: 'trace', auto: true, open: null, level: null, inStep: null };
    if (view.run) view.run = S.runs.find((r) => r.id === view.run.id) ?? view.run;
    if (selectNext) { const r = S.runs.find((x) => x.id === selectNext); if (r) { selectNext = null; view = fresh(r); } }
    if (view.mode === 'form' && !form.suggestions.length) vscode.postMessage({ type: 'suggest', text: form.title + ' ' + form.description });
    draw();
    if (driveNext) { const d = driveNext; driveNext = null; drive(d); }
  }
  if (m.type === 'run') {
    const i = S.runs.findIndex((r) => r.id === m.run.id); if (i >= 0) S.runs[i] = m.run; else S.runs.unshift(m.run);
    if (m.running !== undefined) S.running = m.running ? [...new Set([...S.running, m.run.id])] : S.running.filter((x) => x !== m.run.id);
    if (m.select || selectNext === m.run.id) { selectNext = null; view = fresh(m.run); }
    if (view.run?.id === m.run.id) { view.run = m.run; if (m.run.waiting?.kind === 'checks' || m.run.status !== 'running') vscode.postMessage({ type: 'checks', id: m.run.id }); }
    if (view.mode === 'run' || view.mode === 'spec') draw(); else report();
  }
  if (m.type === 'select') selectNext = m.id;
  if (m.type === 'drive') drive(m);
  if (m.type === 'selectSpec') openSpec(m.id);
  if (m.type === 'specs') { specs = { list: m.specs, components: m.components, note: m.note ?? '', loaded: true }; report(); if (view.mode === 'spec') draw(); }
  if (m.type === 'context') { keepFaces(m.context?.roles); teamCtx[m.id] = m.context; if (view.mode === 'run' && view.run?.id === m.id) drawRun(); }
  if (m.type === 'checks') { checksOf[m.id] = m.checks; if (view.mode === 'run' && view.run?.id === m.id) drawRun(); }
  if (m.type === 'teams') { teams = m; if (!teams.teams.some((x) => x.id === form.team)) form.team = ''; if (view.mode === 'form') { readForm(); drawForm(); } else if (view.mode !== 'run') drawRight(); }
  if (m.type === 'defaults') { keepFaces(m.roles); DEFAULTS = Object.fromEntries((m.roles ?? []).map((x) => [x.role, x])); draw(); }
  if (m.type === 'teamCard') { keepFaces(m.team?.roles); if (m.team.id === (form.team || teams.chosen)) teamCard = m.team; if (view.mode === 'form') { readForm(); drawForm(); drawRight(); } else if (view.mode !== 'run') draw(); }
  if (m.type === 'suggestions') { form.suggestions = m.list; if (!form.context.length) form.context = m.list.filter((s) => s.kind === 'agents').map((s) => s.path); if (view.mode === 'form') { readForm(); drawForm(); } }
  if (m.type === 'issue') { readForm(); const i = m.issue; form.title = i.title; form.description = i.description; form.criteria = i.criteria.length ? i.criteria : ['']; form.source = { kind: m.source, key: i.key, url: i.url }; form.srcTab = 'write'; drawForm(); toast(i.criteria.length ? t('importedWith', i.key, i.criteria.length) : t('importedNoCrit', i.key)); vscode.postMessage({ type: 'suggest', text: i.title + ' ' + i.description }); }
  if (m.type === 'mine') { form.mine = m.issues; drawForm(); }
  if (m.type === 'error') toast(m.text, true);
  if (m.type === 'info') toast(m.text);
});
setInterval(() => { if (view.mode === 'run' && view.run && live(view.run)) drawRun(); }, 1000);
vscode.postMessage({ type: 'ready' });
`;
