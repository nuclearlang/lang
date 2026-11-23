// The teams of the software factory as the editors see them: only through `nuclear-builder team … --json` and
// `nuclear-builder vault …` (design.md "Teams", "The vault"), one process per call, JSON on stdout, an error as
// `{"error": "…"}` with exit code 1. The editor never writes a team file itself: the command writes it atomically and
// keeps the previous version, so a team is never lost. No `vscode` import: the squad screen, the onboarding and the
// tests share it.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { builder } from '../../../../vscode/src/aiMachine';

export const ROLES = ['analyst', 'architect', 'developer', 'qa', 'devops'] as const;
export type RoleId = (typeof ROLES)[number];
export const STATIONS = ['analysis', 'design', 'tests', 'code', 'quality', 'delivery'] as const;

/** Who may do the chat, by kind (teams.nuc's PROVIDERS). No `local` kind here: the team page adds the local kind's
 * OpenCode on Ollama (`opencode-local`); the local Nuclear Developer is on standby (ADR-platform-0013) and a stored
 * member of it is converted by the command, with its `warnings`. */
export const PROVIDERS = {
  agent: ['claude-code', 'codex', 'gemini-cli', 'opencode', 'cursor', 'grok'],
  api: ['anthropic', 'openai', 'google', 'openrouter'],
} as const;
export type Kind = keyof typeof PROVIDERS;

export interface Employee {
  id: string;
  name: string;
  location: string;
  age: string | number;
  university: string;
  profile: string;
  bio: string;
  hrNote: string;
  /** One of the temperaments' ids (`team temperaments`). */
  temperament?: string;
  /** The portrait's whole path (`roster/faces/<id>.webp`, 512 px: the open profile), when it is there. */
  face?: string;
  /** Its thumbnail's whole path (`roster/faces/thumb/<id>.webp`, 128 px: the tiles, the cards, the avatars). */
  thumb?: string;
  gender?: string;
  headline?: string;
  skills?: string[];
  endorsements?: Record<string, number>;
  stats: Record<string, number>;
}

/** How a member writes in Nuclear Chat (`nuclear-agents/roles/temperaments.json`). */
export interface Temperament {
  id: string;
  name: { en: string; es: string };
  /** One short sentence for people, in each language (the `voice` is the model's prompt, in English). */
  description?: { en: string; es: string };
  voice: string;
  /** How the portrait shows it (the face generator's prompt). */
  look?: string;
}

/** A role's roster: its employees, the names of their six stats, and the role's skills when the command gives them. */
export interface RoleRoster {
  stats: string[];
  employees: Employee[];
  skills: string[];
  /** What the screens show of each skill, in the roster's language (`title_es` of its front matter): by name. */
  skillTexts?: Record<string, { title: string; description: string }>;
}
export type Roster = Record<RoleId, RoleRoster>;

/** A member's personality: how often they send a gif, when, and a note in their own words. */
export interface Personality {
  gifs: 'never' | 'sometimes' | 'often';
  on: string;
  note: string;
  /** The team's own choice; `team show` gives the hired employee's when there is none. */
  temperament?: string;
}

/** A member of a team (ADR-platform-0010): an employee of a role's roster, any number per role, with who works them. */
export interface Member {
  /** Unique in the team (the employee's id, or the role's, made free with `-2`, `-3`…). */
  id: string;
  role: RoleId;
  employee?: string;
  /** The member's name (the employee's by default). */
  name?: string;
  personality?: Personality;
  kind: Kind;
  provider: string;
  model?: string;
  /** Its role's skills switched on, and library skills by id. */
  skills: string[];
  /** Its own skills (cloned or written by the user): win over the team's and the library's. */
  ownSkills?: OwnSkill[];
  /** An agent of the library the member takes as its base (`nuclear-agents/agents/<id>/agent.md`). */
  agent?: string;
  /** Before the library: its own skills as name and text (the command keeps them as `ownSkills`). */
  extraSkills?: { name: string; text: string }[];
  instructions: string;
  /** Worked by the team's brain (spec 023): its kind, provider and model are then the team's (`team show`). */
  inheritsBrain?: boolean;
  behaviour: Record<string, boolean>;
  tasks: { id: string; title: string; station: string; on: boolean }[];
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  /** What the team is for, and the skills it needs (the wizard's step 2). */
  purpose?: string;
  /** The library skills every member inherits (ids). */
  skills?: string[];
  /** The team's own skills (cloned or written by the user): every member inherits them, over the library's. */
  ownSkills?: OwnSkill[];
  /** The member who leads the team (its id; the first Architect when none is named). */
  techLead?: string | null;
  /** The logo's file, beside the team's (`<id>.logo.<png|svg|jpg>`); none: its initials in its colour. */
  logo?: string;
  updated: number;
  budgetUsd: number;
  /** Who works every member without its own (spec 023); null or absent: each member keeps its own. */
  brain?: { kind: Kind; provider: string; model?: string } | null;
  /** The method the user wrote for the team; empty or absent: Scrum (`methodText` says it whole). */
  method?: string;
  methodText?: string;
  /** What every member of the team follows, written by its user. */
  instructions?: string;
  members: Member[];
  /** The roles it lacks to run every station (`team show`). */
  missing?: RoleId[];
  /** What the command converted on read (a member that named the local kind, ADR-platform-0013). */
  warnings?: string[];
}

/** A team's or a member's own skill (library.nuc `validOwnSkill`): `name` its title, `text` its markdown body, `from`
 * where it was cloned from (`library:<id>`, `team:<id>`, `role:<id>`). */
export interface OwnSkill {
  id: string;
  name: string;
  description: string;
  text: string;
  from?: string;
  title_es?: string;
  description_es?: string;
  kind?: string;
  tags?: string[];
}

/** A skill or an agent of the library (`skills list`, `team screen`): its file whole as `markdown`. */
export interface LibraryEntry {
  id: string;
  title: string;
  description: string;
  kind: string;
  tags: string[];
  from: 'library';
  markdown?: string;
  /** An agent's role and skills. */
  role?: string;
  skills?: string[];
}

/** Who works a station of `role`: the role's first member (the run's `--assign` may name another). */
export const roleMember = (t: { members?: Member[] } | null | undefined, role: string): Member | undefined => t?.members?.find((m) => m.role === role);

/** A team's tech lead: the member it names, else its first Architect. */
export const leadOf = (t: { techLead?: string | null; members?: Member[] } | null | undefined): string | undefined => t?.techLead || t?.members?.find((m) => m.role === 'architect')?.id;

/** Where a click on a team or one of its members opens Nuclear Chat. The chat lists only the tech leads (spec 023):
 * the lead's direct message for the lead and for any other member (the lead assigns the work), the team's channel
 * when the team or its lead is not known. */
export function chatChannel(team: string, member: string, t?: { techLead?: string | null; members?: Member[] } | null): string {
  const lead = leadOf(t);
  return member && lead ? `dm-${team}-${lead}` : team;
}

/** The wizard's draft for `team create`: the identity, the purpose and skills, the members, the tech lead (an index). */
export interface TeamDraft {
  name: string;
  description?: string;
  purpose?: string;
  skills?: string[];
  ownSkills?: OwnSkill[];
  budgetUsd?: number;
  techLead?: number | string | null;
  /** An image the user picked: copied beside the team as its logo. */
  logoFile?: string;
  members: { role: RoleId; employee?: string; name?: string; kind?: Kind; provider?: string; model?: string; skills?: string[]; ownSkills?: OwnSkill[] }[];
}

/** An employee suggested for a team (`team suggest`): why = the team's words met in their profile. */
export interface Candidate {
  employee: string;
  name: string;
  role: RoleId;
  headline: string;
  score: number;
  why: { term: string; in: string; text: string }[];
}

/** An agent this machine has (`nuclear-builder agents --json`). */
export interface Agent {
  id: string;
  kind: Kind;
  provider: string;
  label: string;
  models: string[];
  defaultModel: string;
  available: boolean;
  paid: boolean;
  why?: string;
}

export interface TeamEntry {
  id: string;
  name: string;
  members?: number;
  updated: number;
  default: boolean;
}

/** The installed `nuclear-builder` has no such command (older than spec 011), or is not installed. */
export class CommandMissing extends Error {}

/** One call of the contract: its JSON, or the error it said. */
export async function call<T>(args: string[], input?: string): Promise<T> {
  const err: string[] = [];
  const r = await builder(args, (l) => err.push(l), input);
  let value: unknown;
  try {
    value = JSON.parse(r.out);
  } catch {
    value = undefined;
  }
  const said = value && typeof value === 'object' && !Array.isArray(value) && typeof (value as { error?: unknown }).error === 'string' ? (value as { error: string }).error : undefined;
  if (r.code === 0 && value !== undefined && !said) return value as T;
  // 127: not found; 2 with no JSON: argparse's "invalid choice" of a command that has no `team` or `vault` yet
  if (r.code === 127 || (value === undefined && (r.code === 2 || /invalid choice|unknown command|unrecognized/i.test(err.join('\n') + r.out)))) {
    throw new CommandMissing(`nuclear-builder ${args[0]}: ${(err.join(' ') || r.out).trim().slice(0, 300) || `exit code ${r.code}`}`);
  }
  throw new Error(said ?? ((err.join('\n') || r.out).trim() || `nuclear-builder ${args.join(' ')}: exit code ${r.code}`));
}

const team = <T>(args: string[], input?: string) => call<T>(['team', ...args, '--json'], input);

export const listTeams = () => team<TeamEntry[]>(['list']);
export const showTeam = (id: string) => team<Team>(['show', id]);
export const saveTeam = (t: Team) => team<Team>(['save'], JSON.stringify(t));
export const deleteTeam = (id: string) => team<unknown>(['delete', id]);
export const setDefaultTeam = (id: string) => team<unknown>(['default', id]);
export const exportTeam = (id: string, file: string) => team<unknown>(['export', id, file]);
export const importTeam = (file: string) => team<Team>(['import', file]);
/** Copies an image beside the team as its logo (`team logo <id> <image>`): the team with its `logo`. */
export const setTeamLogo = (id: string, image: string) => team<Team>(['logo', id, image]);
/** Removes the team's logo (`team logo <id> --clear`): the team, drawn with its initials again. */
export const clearTeamLogo = (id: string) => team<Team>(['logo', id, '--clear']);
/** The temperaments a member can have; none from an older nuclear-builder. */
export const temperaments = () => team<Temperament[]>(['temperaments']).catch(() => [] as Temperament[]);
/** Members hired, several at once (`team member add <id>`, the list on stdin): who works one not said is the local
 * default. */
export const addMembers = (id: string, members: TeamDraft['members']) => team<Team>(['member', 'add', id], JSON.stringify(members));
/** A member let go (`team member remove <id> <member>`). */
export const removeMember = (id: string, member: string) => team<Team>(['member', 'remove', id, member]);
/** What `team member update` changes of a member: who works it, and what makes it different. */
export interface MemberChange {
  /** Their name in the team. */
  name?: string;
  /** How often they send a GIF: never, sometimes, often. */
  gifs?: string;
  kind?: Kind;
  provider?: string;
  model?: string;
  instructions?: string;
  skills?: string[];
  extraSkills?: { name: string; text: string }[];
  temperament?: string;
  note?: string;
  /** A library agent as its base; '' takes it away. */
  agent?: string;
  /** Worked by the team's brain again (its own kind, provider and model given up). */
  teamBrain?: boolean;
}
/** A member changed (`team member update <id> <member>`): only what is given. */
export function updateMember(id: string, member: string, c: MemberChange): Promise<Team> {
  const flag = (name: string, v: string | undefined) => (v === undefined ? [] : [name, v]);
  return team<Team>(['member', 'update', id, member, ...flag('--name', c.name), ...flag('--gifs', c.gifs), ...flag('--kind', c.kind), ...flag('--provider', c.provider), ...flag('--model', c.model), ...flag('--instructions', c.instructions), ...flag('--skills', c.skills?.join(',')), ...flag('--extra-skills', c.extraSkills && JSON.stringify(c.extraSkills)), ...flag('--temperament', c.temperament), ...flag('--note', c.note), ...flag('--agent', c.agent), ...(c.teamBrain ? ['--team-brain'] : [])]);
}
/** The place of a skill: the team, or one of its members. */
const skillPlace = (id: string, member?: string) => ['--team', id, ...(member ? ['--member', member] : [])];
/** A skill copied into the team or a member with its id (`skills clone`): the team. */
export const cloneSkill = (id: string, skill: string, member?: string) => call<Team>(['skills', 'clone', skill, ...skillPlace(id, member), '--json']);
/** A new own skill from its SKILL.md (`skills create`, on stdin): the team. */
export const createSkill = (id: string, markdown: string, member?: string) => call<Team>(['skills', 'create', ...skillPlace(id, member), '--json'], markdown);
/** An own skill changed (`skills update`, its SKILL.md on stdin): the team. */
export const updateSkill = (id: string, skill: string, markdown: string, member?: string) => call<Team>(['skills', 'update', skill, ...skillPlace(id, member), '--json'], markdown);
/** An own skill taken away (`skills delete`): the team. */
export const deleteSkill = (id: string, skill: string, member?: string) => call<Team>(['skills', 'delete', skill, ...skillPlace(id, member), '--json']);
/** The library skills of the team or a member (`team skills set`): the team. */
export const setSkills = (id: string, skills: string[], member?: string) => team<Team>(['skills', 'set', id, ...(member ? ['--member', member] : []), '--skills', skills.join(',')]);
/** A new team from the wizard's draft (`team create`, the draft on stdin). */
export const createTeam = (d: TeamDraft) => team<Team>(['create'], JSON.stringify(d));
/** The roster's best employees of each role for a purpose and skills, each with why (`team suggest`). */
export const suggestMembers = (purpose: string, skills: string[], lang: 'en' | 'es') => team<{ roles: { role: RoleId; candidates: Candidate[] }[] }>(['suggest', '--purpose', purpose, '--skills', skills.join(','), '--lang', lang]);
/** Five satirical names for a team (`team name-suggest`). */
export const suggestNames = (purpose: string, lang: 'en' | 'es') => team<string[]>(['name-suggest', '--purpose', purpose, '--lang', lang]);
/** The agents of this machine (`agents --json`): who can work a member here; none from an older nuclear-builder. */
// an older nuclear-builder may still list the local kind: never offered (ADR-platform-0013)
export const agentsHere = () => call<Agent[]>(['agents', '--json']).then((xs) => xs.filter((a) => a.provider !== 'nuclear-developer'), () => [] as Agent[]);

/** A model a provider offers (`models --json`): a local one with its size, memory need and fit on this machine. */
export interface ModelInfo {
  id: string;
  /** What it is: its family, its version ("latest" for an alias), a label ("opus 5.5"), whether it is an alias. */
  family?: string;
  version?: string;
  label?: string;
  alias?: boolean;
  installed?: boolean;
  sizeGb?: number;
  params?: string;
  quant?: string;
  needGb?: number;
  fit?: 'fits' | 'tight' | 'too-big' | 'unknown';
  downloadGb?: number;
  priced?: boolean;
}
/** Each provider's models on this machine and its memory (`models --json`). */
export interface ModelsHere {
  memory: { totalGb: number; availableGb: number };
  providers: Record<string, { kind: Kind; models: ModelInfo[]; free: boolean; source: string; why?: string }>;
}
/** Each provider's models, from the provider (Ollama's with their memory need), and this machine's memory; none when
 * the command cannot tell (the pickers then list what `agents --json` gave). */
export const modelsHere = () => call<ModelsHere>(['models', '--json']).then((m) => ({ ...m, providers: Object.fromEntries(Object.entries(m.providers ?? {}).filter(([id]) => id !== 'nuclear-developer')) })).catch((): ModelsHere => ({ memory: { totalGb: 0, availableGb: 0 }, providers: {} }));
/** A team's name changed (`team update <id> --name`). */
/** What `team update` changes of a team in the team view (spec 023): its brain (`noBrain`: none, each member keeps
 * its own), its method (empty: Scrum) and its instructions. */
export interface TeamChange {
  kind?: Kind;
  provider?: string;
  model?: string;
  noBrain?: boolean;
  method?: string;
  instructions?: string;
}
export function updateTeam(id: string, c: TeamChange): Promise<Team> {
  const flag = (name: string, v: string | undefined) => (v === undefined ? [] : [name, v]);
  return team<Team>(['update', id, ...(c.noBrain ? ['--no-brain'] : [...flag('--kind', c.kind), ...flag('--provider', c.provider), ...flag('--model', c.model)]), ...flag('--method', c.method), ...flag('--instructions', c.instructions)]);
}
export const renameTeam = (id: string, name: string) => team<Team>(['update', id, '--name', name]);
/** A copy of a team under a new name, its own id (`team duplicate`). */
export const duplicateTeam = (id: string, name: string) => team<Team>(['duplicate', id, '--name', name]);

/** The roster of every role in a language. */
export const roster = async (lang: 'en' | 'es'): Promise<Roster> => rosterOf(await team<Record<string, unknown>>(['roster', '--lang', lang]));

/** Everything the company screen draws, in one process (`team screen`): the teams, each one shown (null: its file could
 * not be read), the roster, the temperaments, the vault's providers (null: the keyring could not be asked). */
export interface Screen {
  teams: TeamEntry[];
  shown: Record<string, Team | null>;
  roster: Roster;
  temperaments: Temperament[];
  vault: Record<string, boolean> | null;
  /** The library's skills and agents, each with its file (none from an older nuclear-builder). */
  library: LibraryEntry[];
  agents: LibraryEntry[];
  /** What the command converted on read (ADR-platform-0013); none from an older nuclear-builder. */
  warnings: string[];
}
export async function teamScreen(lang: 'en' | 'es'): Promise<Screen> {
  const raw = await team<{ teams: TeamEntry[]; shown: Record<string, Team | { error: string }>; roster: Record<string, unknown>; temperaments?: Temperament[]; vault?: Record<string, boolean> | null; library?: LibraryEntry[]; agents?: LibraryEntry[]; warnings?: string[] }>(['screen', '--lang', lang]);
  const shown: Record<string, Team | null> = {};
  for (const [id, t] of Object.entries(raw.shown ?? {})) shown[id] = 'error' in t ? null : t;
  return { teams: raw.teams ?? [], shown, roster: rosterOf(raw.roster ?? {}), temperaments: raw.temperaments ?? [], vault: raw.vault ?? null, library: raw.library ?? [], agents: raw.agents ?? [], warnings: raw.warnings ?? [] };
}

/** A roster as the command gives it: each role as its roster file (`{ role, stats, employees }`) or as the list of its
 * employees; both are read. */
function rosterOf(raw: Record<string, unknown>): Roster {
  const out = {} as Roster;
  for (const role of ROLES) {
    const r = raw[role] as { stats?: unknown; employees?: unknown; skills?: unknown; skillTexts?: RoleRoster['skillTexts'] } | Employee[] | undefined;
    const employees = (Array.isArray(r) ? r : Array.isArray(r?.employees) ? r.employees : []) as Employee[];
    const stats = !Array.isArray(r) && Array.isArray(r?.stats) ? (r.stats as string[]) : Object.keys(employees[0]?.stats ?? {});
    const skills = !Array.isArray(r) && Array.isArray(r?.skills) ? (r.skills as unknown[]).map((s) => (typeof s === 'string' ? s : String((s as { id?: unknown }).id ?? ''))).filter(Boolean) : [];
    out[role] = { stats, employees, skills, skillTexts: (!Array.isArray(r) && r?.skillTexts) || {} };
  }
  return out;
}

/** The API providers and whether the vault keeps a key of each (never the key). */
export const vaultList = () => call<Record<string, boolean>>(['vault', 'list', '--json']);
/** Keeps a key in the system's keyring: on stdin, never as an argument. */
export const vaultSet = (provider: string, key: string) => call<unknown>(['vault', 'set', provider, '--json'], key);
export const vaultRemove = (provider: string) => call<unknown>(['vault', 'remove', provider, '--json']);

/** Where the factory keeps its teams (teams.nuc's `factoryDir`): `NUCLEAR_FACTORY_HOME`, else `%APPDATA%\nuclearlang\factory`
 * on Windows, else `$XDG_CONFIG_HOME` or `~/.config`, `nuclearlang/factory`. */
export function factoryDir(env: NodeJS.ProcessEnv = process.env, platform: string = process.platform): string {
  if (env.NUCLEAR_FACTORY_HOME) return env.NUCLEAR_FACTORY_HOME;
  if (platform === 'win32') return path.join(env.APPDATA || os.homedir(), 'nuclearlang', 'factory');
  return path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'nuclearlang', 'factory');
}

const IMAGE: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp' };
/** A team's logo as a `data:` URL for a page (read only: the command copied it there), or null when it has none, it is
 * not an image or it is too big (1 MB). */
export function logoData(t: { logo?: string | null }, dir: string = path.join(factoryDir(), 'teams')): string | null {
  if (!t.logo) return null;
  return imageData(path.isAbsolute(t.logo) ? t.logo : path.join(dir, t.logo));
}

/** An employee's portrait (`face`, the roster's whole path) as a `data:` URL for a page, or null without one. */
export const faceData = (face?: string | null): string | null => (face ? imageData(face) : null);

/** The faces of a roster by employee id (`which`: the portraits, or their thumbnails): `data:` URLs, or the page's own
 * URLs of the files (`toUrl`: 200 painted portraits are some 9 MB as `data:`); the pages draw initials for the rest. */
export function rosterFaces(r: Roster, toUrl: (face?: string | null) => string | null = faceData, which: 'face' | 'thumb' = 'face'): Record<string, string> {
  const out: Record<string, string> = {};
  for (const role of ROLES) for (const e of r[role]?.employees ?? []) {
    const url = toUrl(e[which]);
    if (url) out[e.id] = url;
  }
  return out;
}

/** An image file as a `data:` URL (read only), or null when it is not an image or it is too big (1 MB). */
function imageData(file: string): string | null {
  const type = IMAGE[path.extname(file).toLowerCase()];
  try {
    if (!type || fs.statSync(file).size > 1_000_000) return null;
    return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
  } catch {
    return null;
  }
}
