// What the editors still need of Nuclear Builder in TypeScript, now that the line runs in Nuclear (`nuclear-builder
// run --events`, runs.ts): the environment of the tools, the retry policy of a call to a local service, *Check the
// connections* of the editor's own pages, where a spec comes from (Jira, GitHub) and the context suggested for it.
// No `vscode` import: the Builder page, Nuclear Atlas, the settings and the tests share it.
import { execFile, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** The project's line (`.nuclear/builder.json`): read by the factory's engine, shared with CI. */
export const CONFIG_FILE = path.join('.nuclear', 'builder.json');

// ---------- retries ----------

export interface RetryPolicy {
  /** Tries in all, the first included. */
  attempts: number;
  /** The first wait's ceiling, in milliseconds; each retry doubles it. */
  baseMs: number;
  /** The longest wait, in milliseconds. */
  maxMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = { attempts: 5, baseMs: 1000, maxMs: 30000 };

/** The wait before retry `n` (1 for the first retry): exponential backoff with full jitter, a random time between 0
 * and min(maxMs, baseMs·2^(n-1)). The jitter keeps many clients from retrying in step; the cap keeps a long outage
 * from making waits absurd. A `Retry-After` the server gives wins (capped the same). */
export function backoff(n: number, policy: RetryPolicy, retryAfterMs?: number, random: () => number = Math.random): number {
  const ceiling = Math.min(policy.maxMs, policy.baseMs * 2 ** Math.max(0, n - 1));
  return retryAfterMs !== undefined ? Math.min(policy.maxMs, retryAfterMs) : Math.round(random() * ceiling);
}

/** A status worth retrying: the server is busy or briefly down (408, 425, 429, 500, 502, 503, 504). A 4xx otherwise
 * is the request's fault and fails again the same way. */
export function transientStatus(status: number): boolean {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

/** `Retry-After` in milliseconds (seconds or an HTTP date), or undefined. */
export function retryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

// ---------- processes ----------

/** The environment of every command the pipeline runs: the PATH it was given plus the folders the NuclearLang
 * installers write to (`nuclear`, `synapsis`, `nuclear-graph`, `claude` live there). An editor started from the
 * desktop does not read the shell's profile, so `~/.local/bin` is often missing from its PATH. */
export function toolEnv(env: NodeJS.ProcessEnv = process.env, home = os.homedir(), platform = process.platform): NodeJS.ProcessEnv {
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const sep = platform === 'win32' ? ';' : ':';
  const extra = platform === 'win32'
    ? [env.NUCLEAR_INSTALL && path.join(env.NUCLEAR_INSTALL, 'bin'), env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'nuclearlang', 'bin')]
    : [env.PREFIX && path.join(env.PREFIX, 'bin'), path.join(home, '.local', 'bin'), path.join(home, '.cargo', 'bin'), '/opt/homebrew/bin', '/usr/local/bin'];
  const dirs = [...(env[key] ?? '').split(sep), ...extra].filter((d): d is string => !!d);
  return { ...env, [key]: [...new Set(dirs)].join(sep) };
}

function capture(cmd: string, args: string[], cwd: string): Promise<{ code: number; text: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, env: toolEnv() });
    let text = '';
    p.stdout.on('data', (d) => (text += d));
    p.stderr.on('data', (d) => (text += d));
    p.on('error', (e) => resolve({ code: 127, text: String(e) }));
    p.on('close', (code) => resolve({ code: code ?? 1, text }));
  });
}


// ---------- the services a task needs ----------

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export interface Needs {
  graphUrl: string;
  /** Command line tools that must answer `--version` (`claude` when Claude leads). */
  tools: string[];
  /** Folders that need free space (the project, the temporary folder), at least `minFreeMb` each. */
  folders: string[];
  minFreeMb: number;
}

async function get(url: string, ms = 3000): Promise<{ ok: boolean; status: number; body: string; error?: string }> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
    return { ok: r.ok, status: r.status, body: await r.text() };
  } catch (e) {
    return { ok: false, status: 0, body: '', error: e instanceof Error ? e.message : String(e) };
  }
}

function version(cmd: string, env: NodeJS.ProcessEnv): Promise<Check> {
  return new Promise((resolve) => {
    execFile(cmd, ['--version'], { timeout: 15000, env }, (e, out, err) =>
      resolve({ name: cmd, ok: !e, detail: e ? `${cmd} does not answer (${e.message.split('\n')[0]})` : `${(out || err).trim().split('\n')[0]}` }),
    );
  });
}

/** Free space of the volume that holds a folder, in megabytes. */
export function freeMb(folder: string): number {
  const s = fs.statfsSync(folder);
  return Math.floor((s.bavail * s.bsize) / 1024 / 1024);
}

/** Every service a task will use, checked now: each answers, the disks have room. */
export async function checkConnections(n: Needs, env: NodeJS.ProcessEnv = process.env): Promise<Check[]> {
  // no Developer, Ollama or local model: the local models are on standby (ADR-platform-0013)
  const graph = await get(n.graphUrl + '/v1/health');
  const out: Check[] = [{ name: 'Smart Graph', ok: graph.ok, detail: graph.ok ? n.graphUrl : `${n.graphUrl} does not answer (${graph.error ?? graph.status}): nuclear-graph serve` }];
  out.push(...(await Promise.all(n.tools.map((t) => version(t, env)))));
  for (const f of n.folders) {
    try {
      const mb = freeMb(f);
      out.push({ name: `disk ${f}`, ok: mb >= n.minFreeMb, detail: `${mb} MB free in ${f}${mb >= n.minFreeMb ? '' : ` (at least ${n.minFreeMb} MB are needed: free some space there)`}` });
    } catch {
      // a folder that does not exist yet has nothing to fill
    }
  }
  return out;
}

// ---------- context suggestions ----------

export interface Suggestion {
  path: string;
  kind: 'agents' | 'spec' | 'context' | 'adr' | 'skill' | 'agent' | 'doc' | 'graph';
  reason: string;
  score: number;
}

function walk(dir: string, depth: number, out: string[]): void {
  if (depth < 0 || !fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && !['.claude', '.agents', '.cursor'].includes(e.name)) continue;
    if (['node_modules', 'build', 'dist', 'out', '.venv', 'target'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, depth - 1, out);
    else if (e.name.endsWith('.md') || e.name.endsWith('.mdc')) out.push(p);
  }
}

/** The files worth giving the agents for this spec: the project's agent instructions always, then the specs,
 * context, ADRs, skills and agent definitions whose words match the spec best. */
export function suggestContext(root: string, text: string): Suggestion[] {
  const files: string[] = [];
  walk(root, 4, files);
  walk(path.join(os.homedir(), '.claude', 'skills'), 2, files);
  walk(path.join(os.homedir(), '.claude', 'agents'), 1, files);
  const words = new Set(text.toLowerCase().match(/[a-z][a-z0-9_]{3,}/g) ?? []);
  const out: Suggestion[] = [];
  for (const f of files) {
    const rel = f.startsWith(root) ? path.relative(root, f) : f.replace(os.homedir(), '~');
    const name = path.basename(f);
    let kind: Suggestion['kind'] = 'doc';
    if (/^(AGENTS|CLAUDE|GEMINI)\.md$/.test(name) || rel.includes('.cursor/rules')) kind = 'agents';
    else if (name === 'SKILL.md') kind = 'skill';
    else if (rel.includes('.claude/agents') || rel.includes('/agents/')) kind = 'agent';
    else if (rel.startsWith('specs') || rel.includes('/spec/')) kind = 'spec';
    else if (rel.includes('/adr/')) kind = 'adr';
    else if (rel.includes('/context/')) kind = 'context';
    let head = '';
    try {
      head = fs.readFileSync(f, 'utf8').slice(0, 4000).toLowerCase();
    } catch {
      continue;
    }
    let hits = 0;
    for (const w of words) if (head.includes(w)) hits += 1;
    const score = (kind === 'agents' ? 100 : 0) + hits * (kind === 'skill' ? 2 : 1);
    if (kind !== 'agents' && hits < 2) continue;
    const reason = kind === 'agents' ? 'instructions for agents in this project' : `${hits} words of the spec`;
    out.push({ path: rel, kind, reason, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 24);
}

// ---------- spec sources ----------

export interface Issue {
  key: string;
  title: string;
  description: string;
  criteria: string[];
  url: string;
}

/** Plain text of Jira's document format (ADF). */
function adfText(node: unknown): string {
  if (!node || typeof node !== 'object') return typeof node === 'string' ? node : '';
  const n = node as { type?: string; text?: string; content?: unknown[] };
  const inner = (n.content ?? []).map(adfText).join(n.type === 'bulletList' || n.type === 'orderedList' ? '' : '');
  if (n.type === 'text') return n.text ?? '';
  if (n.type === 'paragraph' || n.type === 'heading') return inner + '\n';
  if (n.type === 'listItem') return '- ' + inner.trim() + '\n';
  return inner;
}

/** The acceptance criteria of a description: the list after a line that says so. */
export function criteriaOf(text: string): string[] {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => /acceptance criteria|criterios de aceptaci/i.test(l));
  if (at < 0) return [];
  const out: string[] = [];
  for (const l of lines.slice(at + 1)) {
    const m = l.match(/^\s*(?:[-*]|\d+[.)]|\[[ x]\])\s+(.*)$/);
    if (m) out.push(m[1].trim());
    else if (out.length && l.trim() === '') break;
  }
  return out;
}

export interface JiraAuth {
  baseUrl: string;
  email: string;
  token: string;
  criteriaField?: string;
}

async function jira(auth: JiraAuth, route: string): Promise<unknown> {
  const r = await fetch(auth.baseUrl.replace(/\/$/, '') + route, {
    headers: { Authorization: 'Basic ' + Buffer.from(`${auth.email}:${auth.token}`).toString('base64'), Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`Jira ${route}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

export async function jiraIssue(auth: JiraAuth, key: string): Promise<Issue> {
  if (!/^[A-Z][A-Z0-9_]+-\d+$/.test(key)) throw new Error(`'${key}' is not a Jira key (PROJ-123)`);
  const fields = ['summary', 'description', auth.criteriaField].filter(Boolean).join(',');
  const data = (await jira(auth, `/rest/api/3/issue/${key}?fields=${fields}`)) as { fields: Record<string, unknown> };
  const description = adfText(data.fields.description).trim();
  const own = auth.criteriaField ? adfText(data.fields[auth.criteriaField]) : '';
  const criteria = own ? own.split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean) : criteriaOf(description);
  return { key, title: String(data.fields.summary ?? key), description, criteria, url: `${auth.baseUrl.replace(/\/$/, '')}/browse/${key}` };
}

/** The open issues assigned to the user. */
export async function jiraMine(auth: JiraAuth): Promise<{ key: string; title: string }[]> {
  const jql = encodeURIComponent('assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC');
  const data = (await jira(auth, `/rest/api/3/search/jql?jql=${jql}&fields=summary&maxResults=30`)) as { issues: { key: string; fields: { summary: string } }[] };
  return data.issues.map((i) => ({ key: i.key, title: i.fields.summary }));
}

/** A GitHub issue through the `gh` CLI (its own login). */
export async function githubIssue(root: string, ref: string): Promise<Issue> {
  if (!/^[\w.-]+\/[\w.-]+#\d+$|^#?\d+$/.test(ref)) throw new Error(`'${ref}' is not an issue (123, #123 or owner/repo#123)`);
  const [repo, num] = ref.includes('/') ? ref.split('#') : ['', ref.replace('#', '')];
  const args = ['issue', 'view', num, '--json', 'title,body,url', ...(repo ? ['--repo', repo] : [])];
  const out = await capture('gh', args, root);
  if (out.code !== 0) throw new Error(out.text.trim() || 'gh issue view failed');
  const data = JSON.parse(out.text) as { title: string; body: string; url: string };
  return { key: ref, title: data.title, description: data.body, criteria: criteriaOf(data.body), url: data.url };
}


/** The installed `nuclear-builder` has no such command (older than it, or not installed): what it said. */
export function missingCommand(text: string): boolean {
  return /invalid choice|unrecognized arguments|unknown command|ENOENT|command not found/i.test(text);
}
