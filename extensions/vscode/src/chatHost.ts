// Nuclear Chat's host in the extension (spec 013, phase 3; ADR-synapsis-0009): the one WebSocket of this window to the
// chat service, opened with the service's token (`nuclear-chat connect --json`), which never reaches a page; the
// frames of every mounted chat (the Builder's dock and tab, Nuclear Atlas) relayed both ways with their ids kept
// apart; the projects registered with the Builder's host file (`nuclear-builder chat-host --json`) and registered
// again after a reconnection, with what a page missed read back (`GET events/{ws}?since=`); and what a run of the
// factory posts in its team's channel. No `vscode` import: the tests drive it with a fake socket.
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SocketConnection, SocketEvents } from '../../tools/nuclear-http-connections/src/socket';
import { installDir } from './aiMachine';
import { toolEnv } from '../../tools/nuclear-builder/src/support';

/** Where the service is and its guard (`nuclear-chat connect --json`). */
export interface ChatInfo {
  url: string;
  header: string;
  token: string;
}

export type Frame = Record<string, unknown>;

/** The command of the chat: the AI archive's own, else the PATH's. */
export function chatCommand(env: NodeJS.ProcessEnv = process.env): string {
  const own = path.join(installDir(env), 'ai', 'bin', process.platform === 'win32' ? 'nuclear-chat.cmd' : 'nuclear-chat');
  return fs.existsSync(own) ? own : 'nuclear-chat';
}

/** What to do when the chat cannot be reached, told plainly. */
export const CHAT_FIX = {
  en: 'Nuclear Chat does not answer ({0}). Set up the AI services: `nuclear-builder setup` in a terminal, or Settings and integrations (Ctrl+Alt+S) → AI services; then `systemctl --user status nuclear-chat`.',
  es: 'Nuclear Chat no responde ({0}). Prepara los servicios de IA: `nuclear-builder setup` en una terminal, o Ajustes e integraciones (Ctrl+Alt+S) → Servicios de IA; luego `systemctl --user status nuclear-chat`.',
};

/** Runs a command and gives its stdout (a missing one or a failure is an error with its words). */
export function capture(cmd: string, args: string[], env = toolEnv()): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile(cmd, args, { env, maxBuffer: 16 * 1024 * 1024, shell: process.platform === 'win32' }, (e, out, err) =>
      e ? reject(new Error(`${cmd} ${args[0]}: ${(err || e.message).trim().split('\n').pop()}`)) : resolve(out),
    ),
  );
}

/** `nuclear-chat connect --json`, read by the extension host only. */
export async function readConnect(run = capture): Promise<ChatInfo> {
  const c = JSON.parse(await run(chatCommand(), ['connect', '--json'])) as ChatInfo & { error?: string };
  if (c.error || !c.url || !c.token) throw new Error(c.error ?? 'no url or token');
  return c;
}

// ---------- the relay ----------

/** The frames of the pages over one socket: each page's request ids mapped to the socket's own, the token header
 * added to every request (the page never has it), one subscription per topic whoever listens to it. The host's own
 * requests are a page too (`HOST`). */
export class Relay {
  private next = 1;
  private readonly waiting = new Map<number, { page: string; id: unknown }>();
  private readonly topics = new Map<string, Set<string>>();

  constructor(private readonly guard: { header: string; token: string }) {}

  /** A page's frame: what goes to the socket (null: nothing, the topic was already listened to). */
  fromPage(page: string, f: Frame): Frame | null {
    if (typeof f.subscribe === 'string') {
      const pages = this.topics.get(f.subscribe) ?? new Set<string>();
      const first = pages.size === 0;
      this.topics.set(f.subscribe, pages.add(page));
      return first ? { subscribe: f.subscribe } : null;
    }
    if (typeof f.unsubscribe === 'string') {
      const pages = this.topics.get(f.unsubscribe);
      if (!pages?.delete(page) || pages.size) return null;
      this.topics.delete(f.unsubscribe);
      return { unsubscribe: f.unsubscribe };
    }
    const id = this.next++;
    this.waiting.set(id, { page, id: f.id });
    return { ...f, id, headers: { ...((f.headers as Record<string, string>) ?? {}), [this.guard.header]: this.guard.token } };
  }

  /** A frame of the socket: to which pages it goes, each with its own id back. */
  fromService(f: Frame): [string, Frame][] {
    if (typeof f.event === 'string') return [...(this.topics.get(f.event) ?? [])].map((p) => [p, f]);
    const w = this.waiting.get(f.id as number);
    if (!w) return [];
    this.waiting.delete(f.id as number);
    return [[w.page, { ...f, id: w.id }]];
  }

  /** A page gone: its subscriptions end (the frames to send) and its answers are dropped. */
  drop(page: string): Frame[] {
    for (const [id, w] of this.waiting) if (w.page === page) this.waiting.delete(id);
    return [...this.topics.keys()].map((t) => this.fromPage(page, { unsubscribe: t })).filter((f): f is Frame => !!f);
  }

  /** The socket closed: every request in flight answered 503 (a page retries or shows its error). */
  fail(why: string): [string, Frame][] {
    const out: [string, Frame][] = [...this.waiting.values()].map((w) => [w.page, { id: w.id, status: 503, body: { detail: why } }]);
    this.waiting.clear();
    return out;
  }

  /** The topics listened to, to subscribe again after a reconnection. */
  listened(): string[] {
    return [...this.topics.keys()];
  }

  /** The pages that listen to a topic. */
  listeners(topic: string): string[] {
    return [...(this.topics.get(topic) ?? [])];
  }
}

// ---------- the registration ----------

/** One agent a conversation can be answered by (`nuclear-builder agents`), with the command that answers as it. */
export interface HostChoice {
  id: string;
  label: string;
  kind: string;
  command: string[];
  paid?: boolean;
  models?: string[];
  defaultModel?: string;
  available?: boolean;
  why?: string;
  /** Why it cannot work here as a kind and its arguments (`agents --json`): said in the chat's language. */
  whyKey?: string;
  whyArgs?: string[];
}

/** Why an agent cannot answer, by its kind (`agents --json`'s `whyKey`), in the chat's language. */
export const WHY_TEXTS: Record<'en' | 'es', Record<string, string>> = {
  en: { notOnPath: 'not installed: `{0}` is not on the PATH', noKey: 'no API key: nuclear-builder vault set {0}', noPrice: 'no model with a price: .nuclear/builder.json "prices"', noAnswer: '{0} does not answer', noLocalModel: 'no local model: start Ollama and pull one (ollama pull <model>)' },
  es: { notOnPath: 'no instalado: `{0}` no está en el PATH', noKey: 'sin clave de API: nuclear-builder vault set {0}', noPrice: 'ningún modelo con precio: .nuclear/builder.json "prices"', noAnswer: '{0} no responde', noLocalModel: 'ningún modelo local: inicia Ollama y descarga uno (ollama pull <modelo>)' },
};
/** A choice's `why` in `lang`, else the English the host file gave. */
export const whyOf = (c: HostChoice, lang: 'en' | 'es'): string | undefined => (c.whyKey && WHY_TEXTS[lang][c.whyKey] ? fmt(WHY_TEXTS[lang][c.whyKey], ...(c.whyArgs ?? [])) : c.why);
/** A member as the Builder's host file gives it (`nuclear-builder chat-host --json`); the general agent (`atlas`,
 * role `chat`) with its `choices`. */
export interface HostMember {
  id: string;
  name: string;
  role: string;
  team: string;
  avatar?: string;
  face?: string | null;
  temperament?: string | null;
  /** The member's own id in their team (the chat's id is `<team>-<member>`). */
  member?: string;
  /** What the chat's profile shows and changes (temperament, skills, instructions), and whether it may be changed. */
  card?: { editable: boolean; temperament: string; temperaments: { id: string; name: string }[]; skills: string[]; instructions: string };
  profile?: Record<string, unknown>;
  personality?: Record<string, unknown> | null;
  responder?: { command: string[]; paid?: boolean; choice?: string; model?: string; choices?: HostChoice[] };
  /** Who works the member, shown under their name in a direct message: `Claude Code · opus · paid`. */
  brain?: { agent: string; kind: string; provider: string; model: string; paid: boolean };
}
export interface HostFile {
  host: string;
  members: HostMember[];
  teams: { id: string; name: string; lead: string }[];
  channels: { id: string; name: string; topic?: string; members?: string[]; team?: string }[];
  lang: string;
  error?: string;
  /** Several teams and none is the project's nor the default: the teams to choose from (saved as the project's). */
  chooseTeam?: { id: string; name: string }[];
}

/** Who works the general agent by default (the setting `nuclear.builder.chat`). */
export interface AgentProvider {
  kind: 'agent' | 'api';
  provider: string;
  model?: string;
}

/** The general agent's member id: its direct message, `dm-atlas`, is Nuclear Atlas's page. */
export const AGENT = 'atlas';

/** What `POST workspaces` takes from a host file: each member's face (a file path) as a picture the page can draw
 * (`face`: a `data:` URL); the general agent's default for a new conversation, the setting's provider when it is on
 * this machine (else the host file's own default, an external agent: the local models are on standby, ADR-platform-0013); the language and the GIFs of the settings. */
export function registration(file: HostFile, o: { root: string; lang: 'en' | 'es'; gifs: string; agent: AgentProvider; face: (file: string) => string | null; forceConfirm?: boolean; theme?: string }): Record<string, unknown> {
  // the spending questions (`--confirm-spending` skips them): an agent's subscription is never asked (spec 023,
  // requirement 4); an API's work is not asked again when the user put that provider in a team (a member's or the
  // tech lead's), and is asked when never chosen; a forced confirmation (the setting or the project's `forceConfirm`)
  // always asks
  const chosen = new Set(o.forceConfirm ? [] : file.members.filter((m) => m.team && m.brain?.paid).map((m) => m.brain!.provider));
  const free = (kind: string | undefined, provider: string | undefined) => !o.forceConfirm && (kind === 'agent' || (!!provider && chosen.has(provider)));
  const confirmed = (command: string[], kind: string | undefined, provider: string | undefined) => (free(kind, provider) && !command.includes('--confirm-spending') ? [...command, '--confirm-spending'] : command);
  // Nuclear Chat lists Atlas and each team's tech lead, not every member (spec 023, requirement 2): the others are not
  // registered (their old conversations stay in the project, readable, never deleted)
  const leads = new Set(file.teams.map((t) => t.lead));
  const listed = file.members.filter((m) => m.id === AGENT || !m.team || leads.has(m.id));
  const members = listed.map(({ face, temperament: _t, ...m }) => {
    const out = { ...m, personality: m.personality ?? {}, face: face ? o.face(face) ?? '' : '' };
    const r = m.responder;
    const wanted = r?.choices?.find((c) => c.id === o.agent.provider && c.available !== false);
    if (r && wanted) out.responder = { ...r, choice: wanted.id, model: o.agent.model ?? '' };
    if (out.responder?.choices) out.responder = { ...out.responder, choices: out.responder.choices.map(({ whyKey: _k, whyArgs: _a, ...c }) => ({ ...c, command: confirmed(c.command, c.kind, c.id), ...(c.why || _k ? { why: whyOf({ ...c, whyKey: _k, whyArgs: _a }, o.lang) } : {}) })) };
    const picked = out.responder?.choices?.find((c) => c.id === out.responder!.choice);
    if (out.responder) out.responder = { ...out.responder, command: confirmed(out.responder.command, out.responder.choices ? picked?.kind : m.brain?.kind, out.responder.choices ? out.responder.choice : m.brain?.provider) };
    return out;
  });
  return { root: o.root, host: 'builder', members, teams: file.teams, channels: file.channels, lang: o.lang, gifs: o.gifs, theme: o.theme ?? 'auto' };
}

/** What a member's profile in the chat changes (an event `action`, `member`), as `team member update` takes it: only
 * the known fields, each a text (anything else the event carries is dropped). */
export function memberChange(changes: unknown): { name?: string; model?: string; instructions?: string; temperament?: string; gifs?: string } {
  const c = (changes && typeof changes === 'object' ? changes : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of ['name', 'model', 'instructions', 'temperament', 'gifs']) if (typeof c[k] === 'string') out[k] = c[k] as string;
  return out;
}

// ---------- a run in its team's channel ----------

export interface ChatButton {
  id: string;
  label: string;
  style?: string;
}
/** What a host posts (`POST messages/{ws}/{channel}/post`). */
export interface Posted {
  author: string;
  text: string;
  thread?: string;
  buttons?: ChatButton[];
  links?: Record<string, string>;
  moment?: 'failure' | 'success' | 'question';
  costUsd?: number;
  /** A log folded under the message (the chat shows it closed: an accordion). */
  details?: string;
}

/** The little of a run the chat needs (runs.ts `Run`). */
export interface RunLike {
  id: string;
  status: string;
  spec: { title: string };
  stages: { id: string; title: string; status: string; role?: string; steps: { summary: string; status: string; costUsd?: number; log?: string; files?: string[] }[] }[];
  costUsd?: number;
  /** The engine's repairs (spec 024 requirement 6): a failed station diagnosed, then run once more with it. */
  repairs?: { station: string; diagnosis: string; at: number }[];
}

/** The most a folded log carries: its end, where a failure is. */
export const DETAILS_MAX = 4000;

/** A station's log as the chat folds it under its post: each step's line (✓, ✗ or ·) with the files it wrote, then
 * the failed step's own log; its last `DETAILS_MAX` characters. */
export function stationDetails(st: RunLike['stages'][number]): string {
  const mark = (s: string) => (s === 'passed' ? '✓' : s === 'failed' ? '✗' : '·');
  const lines = st.steps.flatMap((s) => [`${mark(s.status)} ${s.summary || '…'}`, ...(s.files ?? []).map((f) => `    ${f}`)]);
  const failed = [...st.steps].reverse().find((s) => s.status === 'failed' && s.log);
  const text = [...lines, ...(failed ? ['', failed.log!.trim()] : [])].join('\n');
  return text.length > DETAILS_MAX ? `…${text.slice(-DETAILS_MAX)}` : text;
}
export interface AskLike {
  id: string;
  kind: string;
  question: string;
  station?: string;
  /** The question's kind and arguments (the engine's `key`, `args`): said in the chat's language by `askText`. */
  key?: string;
  args?: string[];
}

export const RUN_TEXTS = {
  en: { noTeam: 'This channel has no team yet: assign one and its tech lead answers here, for every app of the folder.', noTeams: 'This channel has no team, and there is no team yet: make one, then assign it here.', createTeam: 'Create a team', free: 'free', busy: 'busy', assigned: 'the team {0}', creating: 'The company screen is open: make the team, then open this chat again to assign it.', start: 'Started run:{0}: **{1}**', started: '**{0}** started', repairing: '**{0}** failed and is being repaired', passed: '**{0}** passed', failed: '**{0}** failed', end: 'Every station passed (USD {0}).', endFailed: 'The run failed: {0}', approve: 'Approve', change: 'Ask for a change', later: 'Later', goOn: 'Go on', yes: 'Yes', no: 'No', answered: 'Answered by you: {0}', spending: '{0} (asked in the editor: money is confirmed twice)', accept: 'Accept', discard: 'Discard', draft: 'A new draft of spec:{0}:', accepted: 'Accepted: spec:{0} is written.', discarded: 'Discarded: spec:{0} stays as it was.', polish: 'Let us polish spec:{0}: **{1}**. Reply in this thread; a change comes as a difference you accept or not.\n\n```markdown\n{2}\n```', poc: 'A proof of concept (`/poc {0}`) is not available yet: the factory runs only on a project\'s own code, not on a scratch folder (`.nuclear/poc/`).', stations: { analysis: 'Analysis', design: 'Design', tests: 'Tests first', code: 'Code', quality: 'Quality', delivery: 'Delivery' }, ask: { gate: '', gateQuestions: '', qaPlan: '', deliver: '', decide: '' } },
  es: { noTeam: 'Este canal aún no tiene equipo: asigna uno y su tech lead responde aquí, para todas las apps de la carpeta.', noTeams: 'Este canal no tiene equipo y aún no hay ninguno: crea uno y luego asígnalo aquí.', createTeam: 'Crear un equipo', free: 'libre', busy: 'ocupado', assigned: 'el equipo {0}', creating: 'La pantalla de equipos está abierta: crea el equipo y vuelve a abrir este chat para asignarlo.', start: 'Empezó run:{0}: **{1}**', started: '**{0}** empezó', repairing: '**{0}** falló y se está reparando', passed: '**{0}** pasó', failed: '**{0}** falló', end: 'Pasaron todas las estaciones (USD {0}).', endFailed: 'La ejecución falló: {0}', approve: 'Aprobar', change: 'Pedir un cambio', later: 'Más tarde', goOn: 'Seguir', yes: 'Sí', no: 'No', answered: 'Respondido por ti: {0}', spending: '{0} (preguntado en el editor: el dinero se confirma dos veces)', accept: 'Aceptar', discard: 'Descartar', draft: 'Un nuevo borrador de spec:{0}:', accepted: 'Aceptado: spec:{0} está escrita.', discarded: 'Descartado: spec:{0} queda como estaba.', polish: 'Puliremos spec:{0}: **{1}**. Responde en este hilo; un cambio llega como una diferencia que aceptas o no.\n\n```markdown\n{2}\n```', poc: 'Una prueba de concepto (`/poc {0}`) aún no está disponible: la fábrica trabaja solo sobre el código del proyecto, no en una carpeta de pruebas (`.nuclear/poc/`).', stations: { analysis: 'Análisis', design: 'Diseño', tests: 'Pruebas primero', code: 'Código', quality: 'Calidad', delivery: 'Entrega' }, ask: { gate: '¿Apruebas la estación {0}? Lee sus documentos antes.', gateQuestions: 'El pedido deja preguntas abiertas en la estación {0}: respóndelas (un cambio con tus respuestas), o aprueba para seguir sin ellas.', qaPlan: 'El plan de QA está listo: activa o desactiva comprobaciones, añade las tuyas, córrelas y márcalas. ¿Seguimos?', deliver: '¿Creo la rama factory/{0}, hago el commit a tu nombre y abro el pull request?', decide: 'La estación {0} no puede arreglarlo sola. Su diagnóstico: {1} Pide un cambio con tu decisión, aprueba para seguir tal cual, o déjalo para más tarde.' } },
};
export type RunTexts = (typeof RUN_TEXTS)['en'];
export const fmt = (s: string, ...a: unknown[]) => s.replace(/\{(\d+)\}/g, (_, i) => String(a[+i] ?? ''));

/** The posts a run's change makes (`prev` undefined: the run was just seen, its thread starts): each station that
 * started, passed or failed, by the member of its role (passed or failed with its log folded, `stationDetails`; a
 * failure with its moment: the member's GIF personality applies); each repair (`repairs`: the diagnosis folded); the
 * run's end. `member(role)` is the member's id in the workspace (`system` when it has none). */
export function runPosts(prev: RunLike | undefined, next: RunLike, member: (role?: string) => string, T: RunTexts, lead: string): Posted[] {
  const out: Posted[] = [];
  if (!prev) out.push({ author: lead, text: fmt(T.start, next.id, next.spec.title), links: { run: next.id } });
  for (const st of next.stages) {
    const was = prev?.stages.find((s) => s.id === st.id)?.status;
    const name = T.stations[st.id as keyof RunTexts['stations']] ?? st.title;
    if (was !== st.status && st.status === 'running') out.push({ author: member(st.role), text: fmt(T.started, name) });
    if (was === st.status || (st.status !== 'passed' && st.status !== 'failed')) continue;
    // a failed station says why: its failed step's summary, not the last step's ("Analysis failed: passed")
    const said = [...st.steps].reverse().find((s) => s.summary && (st.status !== 'failed' || s.status === 'failed'))?.summary ?? [...st.steps].reverse().find((s) => s.summary)?.summary ?? '';
    const cost = st.steps.reduce((n, s) => n + (s.costUsd ?? 0), 0);
    const details = stationDetails(st);
    out.push({ author: member(st.role), text: fmt(st.status === 'passed' ? T.passed : T.failed, name) + (said ? `: ${said}` : ''), ...(st.status === 'failed' ? { moment: 'failure' as const } : {}), ...(cost ? { costUsd: cost } : {}), ...(details ? { details } : {}) });
  }
  for (const r of (next.repairs ?? []).slice(prev?.repairs?.length ?? 0)) {
    const st = next.stages.find((s) => s.id === r.station);
    const first = r.diagnosis.trim().split('\n')[0] ?? '';
    out.push({ author: member(st?.role), text: fmt(T.repairing, T.stations[r.station as keyof RunTexts['stations']] ?? st?.title ?? r.station) + (first ? `: ${first}` : ''), details: r.diagnosis.length > DETAILS_MAX ? `…${r.diagnosis.slice(-DETAILS_MAX)}` : r.diagnosis });
  }
  if (prev && prev.status !== next.status && next.status === 'passed') out.push({ author: lead, text: fmt(T.end, (next.costUsd ?? 0).toFixed(3)), moment: 'success' });
  // the station's post already carried the failure's moment: the end only says it
  const failed = next.stages.flatMap((s) => s.steps).reverse().find((s) => s.status === 'failed');
  if (prev && prev.status !== next.status && next.status === 'failed') out.push({ author: lead, text: fmt(T.endFailed, failed?.summary || next.spec.title) });
  return out;
}

/** A run's question in `T`'s language: its kind's text (`ask.<key>`, a station's id said by its name), else the
 * engine's own English question (English, an older engine, a question with no kind). */
export function askText(a: { question: string; key?: string; args?: string[] }, T: RunTexts): string {
  const text = a.key ? T.ask[a.key as keyof RunTexts['ask']] : '';
  return text ? fmt(text, ...(a.args ?? []).map((x) => T.stations[x as keyof RunTexts['stations']] ?? x)) : a.question;
}

/** A run's question as a member's message with its answers as buttons (`run|<run>|<ask>|<answer>`). Spending has
 * none: money is confirmed in the editor's two modal questions. */
export function askPost(run: RunLike, a: AskLike, member: (role?: string) => string, T: RunTexts): Posted {
  const role = run.stages.find((s) => s.id === a.station)?.role ?? (a.kind === 'checks' ? 'qa' : undefined);
  const b = (answer: string, label: string, style = ''): ChatButton => ({ id: `run|${run.id}|${a.id}|${answer}`, label, style });
  const buttons = a.kind === 'gate' ? [b('approve', T.approve, 'primary'), b('change', T.change), b('stop', T.later)] : a.kind === 'checks' ? [b('yes', T.goOn, 'primary'), b('stop', T.later)] : [];
  return { author: a.kind === 'spending' ? 'system' : member(role), text: a.kind === 'spending' ? fmt(T.spending, a.question) : askText(a, T), buttons, moment: 'question' };
}

/** A button's id read back: a run's answer, a spec draft's (`spec|<id>|accept|discard`), a team offered to the folder's
 * channel (`team|assign|<id>`) or the offer to make one (`team|create`). */
export function buttonOf(id: string): { kind: 'run'; run: string; ask: string; answer: string } | { kind: 'spec'; spec: string; answer: 'accept' | 'discard' } | { kind: 'team'; team: string } | null {
  const p = id.split('|');
  if (p[0] === 'team' && p[1] === 'assign' && p.length === 3 && p[2]) return { kind: 'team', team: p[2] };
  if (p[0] === 'team' && p[1] === 'create' && p.length === 2) return { kind: 'team', team: '' };
  if (p[0] === 'run' && p.length === 4) return { kind: 'run', run: p[1], ask: p[2], answer: p[3] };
  if (p[0] === 'spec' && p.length === 3 && (p[2] === 'accept' || p[2] === 'discard')) return { kind: 'spec', spec: p[1], answer: p[2] };
  return null;
}

/** The difference of two texts, line by line (`-` taken away, `+` added, two lines of context), as a diff block. */
export function lineDiff(a: string, b: string): string {
  const x = a.split('\n');
  const y = b.split('\n');
  // the longest common subsequence, from the end
  const n = x.length;
  const m = y.length;
  const L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops: [string, string][] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) ops.push([' ', x[i++]]), j++;
    else if (i < n && (j === m || L[i + 1][j] >= L[i][j + 1])) ops.push(['-', x[i++]]);
    else ops.push(['+', y[j++]]);
  }
  const near = ops.map((_, k) => ops.slice(Math.max(0, k - 2), k + 3).some((o) => o[0] !== ' '));
  const lines: string[] = [];
  ops.forEach((o, k) => {
    if (near[k]) lines.push(o[0] + ' ' + o[1]);
    else if (lines[lines.length - 1] !== '…') lines.push('…');
  });
  return '```diff\n' + lines.join('\n') + '\n```';
}

// ---------- the connection ----------

/** A socket as the host uses it (SocketConnection in the editor, a fake in the tests). */
export interface Socket {
  connect(url: string, headers: Record<string, string>): void;
  send(text: string): boolean;
  close(): void;
  readonly open: boolean;
}

/** A service event (`ChatEvent`). */
export interface ChatEvent {
  n: number;
  workspace: string;
  type: string;
  channel: string;
  data: Record<string, unknown>;
  at?: number;
}

export const HOST = '#host';

/** The window's one connection to the chat: pages attach (their frames relayed), projects register (again after a
 * reconnection), the host calls routes and listens to its workspaces' events. */
export class ChatHost {
  private socket?: Socket;
  private relay?: Relay;
  private info?: Promise<ChatInfo>;
  private readonly pages = new Map<string, (f: Frame) => void>();
  private readonly queue: string[] = [];
  private readonly mine = new Map<unknown, (f: Frame) => void>();
  private ownId = 1;
  private readonly bodies = new Map<string, Record<string, unknown>>();
  private readonly ids = new Map<string, Promise<string>>();
  private readonly lastN = new Map<string, number>();
  private readonly listeners: ((root: string, e: ChatEvent) => void)[] = [];
  private readonly registrations: ((root: string) => void)[] = [];
  private retries = 0;
  private wasOpen = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly deps: {
      connect: () => Promise<ChatInfo>;
      socket?: (on: SocketEvents) => Socket;
      registrationOf: (root: string) => Promise<Record<string, unknown>>;
    },
  ) {}

  /** Opens the socket (once; again after a close, with growing waits). Rejects when the service cannot be reached. */
  private ready(): Promise<ChatInfo> {
    this.info ??= this.deps.connect().then((info) => {
      this.relay = new Relay(info);
      this.openSocket(info);
      return info;
    });
    this.info.catch(() => (this.info = undefined));
    return this.info;
  }

  private openSocket(info: ChatInfo): void {
    const on: SocketEvents = {
      open: () => void this.opened(),
      message: (text) => this.received(text),
      close: () => this.closed('closed'),
      error: (why) => this.closed(why || 'refused'),
    };
    this.socket = (this.deps.socket ?? ((o) => new SocketConnection(o)))(on);
    this.socket.connect(info.url.replace(/^http/, 'ws') + '/ws', { [info.header]: info.token });
  }

  private async opened(): Promise<void> {
    this.retries = 0;
    const again = this.wasOpen;
    this.wasOpen = true;
    for (const t of this.relay!.listened()) this.socket!.send(JSON.stringify({ subscribe: t }));
    for (const text of this.queue.splice(0)) this.socket!.send(text);
    if (!again) return;
    // a reconnection: the projects again (a restarted service forgot them), then what the pages missed
    for (const root of this.bodies.keys()) {
      const id = await this.register(root).catch(() => undefined);
      const since = id ? this.lastN.get(id) : undefined;
      if (!id || since === undefined) continue;
      const r = await this.request('GET', `/events/${id}?since=${since}`);
      if (r.status === 200) for (const e of r.body as ChatEvent[]) this.received(JSON.stringify({ event: `chat.${id}`, data: e }));
    }
  }

  private closed(why: string): void {
    if (!this.relay) return;
    for (const [page, f] of this.relay.fail(why)) this.deliver(page, f);
    if (this.timer || (!this.pages.size && !this.bodies.size)) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.ready().then((info) => this.openSocket(info));
    }, Math.min(30_000, 1000 * 2 ** this.retries++));
    this.timer.unref?.();
  }

  private received(text: string): void {
    let f: Frame;
    try {
      f = JSON.parse(text) as Frame;
    } catch {
      return;
    }
    if (typeof f.event === 'string' && f.data) {
      const e = f.data as ChatEvent;
      if (typeof e.n === 'number' && e.n > (this.lastN.get(e.workspace) ?? -1)) this.lastN.set(e.workspace, e.n);
      const root = [...this.bodies.keys()].find((r) => this.known.get(r) === e.workspace);
      if (root) for (const l of this.listeners) l(root, e);
    }
    for (const [page, out] of this.relay!.fromService(f)) this.deliver(page, out);
  }

  private deliver(page: string, f: Frame): void {
    if (page === HOST) return void (typeof f.event === 'string' ? undefined : this.mine.get(f.id)?.(f));
    this.pages.get(page)?.(f);
  }

  private send(page: string, f: Frame): void {
    const out = this.relay!.fromPage(page, f);
    if (!out) return;
    const text = JSON.stringify(out);
    if (!this.socket?.open || !this.socket.send(text)) {
      // subscriptions are sent again on open; a request waits for it
      if (!('subscribe' in out) && !('unsubscribe' in out)) this.queue.push(text);
    }
  }

  /** A page that mounts the chat: its frames come in `fromPage`, the service's go to `deliver`. */
  attach(page: string, deliver: (f: Frame) => void): void {
    this.pages.set(page, deliver);
  }

  detach(page: string): void {
    this.pages.delete(page);
    for (const f of this.relay?.drop(page) ?? []) this.socket?.send(JSON.stringify(f));
  }

  async fromPage(page: string, f: Frame): Promise<void> {
    try {
      await this.ready();
    } catch (e) {
      if (f.id !== undefined) this.deliver(page, { id: f.id, status: 503, body: { detail: String((e as Error).message) } });
      return;
    }
    this.send(page, f);
  }

  /** A route called by the host (with the token, as every request). */
  async request(method: string, route: string, body?: unknown): Promise<{ status: number; body: unknown }> {
    await this.ready();
    const id = `h${this.ownId++}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => (this.mine.delete(id), resolve({ status: 504, body: { detail: 'no answer' } })), 30_000);
      timer.unref?.();
      this.mine.set(id, (f) => (clearTimeout(timer), this.mine.delete(id), resolve({ status: Number(f.status), body: f.body })));
      this.send(HOST, { id, method, path: route, headers: {}, ...(body !== undefined ? { body } : {}) });
    });
  }

  private readonly known = new Map<string, string>();

  /** The project's workspace id: registered once (its host file read then), again with `again`. */
  workspace(root: string, again = false): Promise<string> {
    if (again || !this.ids.has(root)) {
      const p = this.deps.registrationOf(root).then((body) => {
        this.bodies.set(root, body);
        return this.register(root);
      });
      p.catch(() => this.ids.delete(root));
      this.ids.set(root, p);
    }
    return this.ids.get(root)!;
  }

  private async register(root: string): Promise<string> {
    const r = await this.request('POST', '/workspaces', this.bodies.get(root));
    const id = (r.body as { id?: string })?.id;
    if (r.status >= 300 || !id) throw new Error(`POST workspaces: ${r.status} ${JSON.stringify((r.body as { detail?: unknown })?.detail ?? r.body)}`);
    this.known.set(root, id);
    // the host listens to its workspace: the buttons, the commands and the members' tools are its
    this.send(HOST, { subscribe: `chat.${id}` });
    for (const l of this.registrations) l(root);
    return id;
  }

  /** A folder registered (again): its host file is `hostBody(root)`. */
  onRegistered(l: (root: string) => void): void {
    this.registrations.push(l);
  }

  /** The host file a folder was last registered with. */
  hostBody(root: string): unknown {
    return this.bodies.get(root);
  }

  /** The host's own listening: every event of a registered project. */
  onEvent(l: (root: string, e: ChatEvent) => void): void {
    this.listeners.push(l);
  }

  /** Posts as a member (or `system`): the message, or null when the service refused it. */
  async post(root: string, channel: string, p: Posted): Promise<{ id: string } | null> {
    const ws = await this.workspace(root);
    const r = await this.request('POST', `/messages/${ws}/${channel}/post`, p);
    return r.status < 300 ? (r.body as { id: string }) : null;
  }

  /** The member ids and channel ids the registration gave. */
  registered(root: string): { members: string[]; channels: string[]; teams: string[]; lead: (team: string) => string | undefined } {
    const b = (this.bodies.get(root) ?? {}) as { members?: { id: string }[]; channels?: { id: string }[]; teams?: { id: string; lead: string }[] };
    return { members: (b.members ?? []).map((m) => m.id), channels: (b.channels ?? []).map((c) => c.id), teams: (b.teams ?? []).map((t) => t.id), lead: (t) => b.teams?.find((x) => x.id === t)?.lead };
  }

  /** A registered member's team and own id in it (the chat's id is `<team>-<member>`), or undefined. */
  teamMember(root: string, id: string): { team: string; member: string } | undefined {
    const b = (this.bodies.get(root) ?? {}) as { members?: { id: string; team?: string; member?: string }[] };
    const m = b.members?.find((x) => x.id === id);
    return m?.team && m.member ? { team: m.team, member: m.member } : undefined;
  }

  /** A member's name in a registered project (its id when unknown). */
  nameOf(root: string, id: string): string {
    const b = (this.bodies.get(root) ?? {}) as { members?: { id: string; name?: string }[] };
    return b.members?.find((m) => m.id === id)?.name || id;
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.bodies.clear();
    this.pages.clear();
    this.socket?.close();
  }
}
