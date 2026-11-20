// The request side of HTTP Connections without `vscode`, so the tests drive it: the environments file and its scopes
// (global, project, component), `{{var}}` resolution in that order, the auth of a request (Bearer, Basic, API key,
// OAuth 2.0), the response → variable links (post-response rules and the automatic token), and the page's pure
// helpers. The functions marked "page" are also inlined into the request page (panel.ts) by their source, so
// they must not use anything outside their own body.

export type ScopeName = 'global' | 'project' | 'component';

/** Variables and headers of one scope; `secrets` names the variables the editor masks. */
export interface Scope {
  vars: Record<string, string>;
  headers: Record<string, string>;
  secrets: string[];
}
export interface ProjectScope extends Scope {
  components: Record<string, Scope>;
}
export interface Environment extends Scope {
  /** Base url per project or connection name; `vars.baseUrl` otherwise. */
  baseUrls: Record<string, string>;
  /** OpenAPI documents (urls or files) of APIs that are not Nuclear projects. */
  openapi: string[];
  /** WebSocket urls (ws:// or wss://) of servers that are not Nuclear projects. */
  sockets: string[];
  /** The variables and headers of a project, and of its components. */
  projects: Record<string, ProjectScope>;
}
export interface Environments {
  active: string;
  environments: Record<string, Environment>;
}

const record = (v: unknown): Record<string, string> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' ? x : x === null || x === undefined ? '' : String(x)]));
};
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const object = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const scope = (v: unknown): Scope => {
  const o = object(v);
  return { vars: record(o.vars), headers: record(o.headers), secrets: strings(o.secrets) };
};

/** `http.json` as read: every missing field empty, so a file of an earlier version loads unchanged. Undefined when
 * it holds no environment. */
export function normalizeEnvironments(raw: unknown): Environments | undefined {
  const o = object(raw);
  const environments: Record<string, Environment> = {};
  for (const [name, e] of Object.entries(object(o.environments))) {
    const x = object(e);
    const projects: Record<string, ProjectScope> = {};
    for (const [p, ps] of Object.entries(object(x.projects))) {
      const components: Record<string, Scope> = {};
      for (const [c, cs] of Object.entries(object(object(ps).components))) components[c] = scope(cs);
      projects[p] = { ...scope(ps), components };
    }
    environments[name] = { ...scope(x), baseUrls: record(x.baseUrls), openapi: strings(x.openapi), sockets: strings(x.sockets), projects };
  }
  if (!Object.keys(environments).length) return undefined;
  const active = typeof o.active === 'string' && environments[o.active] ? o.active : Object.keys(environments)[0];
  return { active, environments };
}

/** What is written back: the empty fields this version added (`projects`, `secrets`, empty scopes) left out. */
export function compactEnvironments(envs: Environments): unknown {
  const compactScope = (s: Scope, extra: Record<string, unknown> = {}) => {
    const out: Record<string, unknown> = { vars: s.vars };
    if (Object.keys(s.headers).length) out.headers = s.headers;
    if (s.secrets.length) out.secrets = s.secrets;
    return { ...out, ...extra };
  };
  const empty = (s: Scope) => !Object.keys(s.vars).length && !Object.keys(s.headers).length && !s.secrets.length;
  const environments: Record<string, unknown> = {};
  for (const [name, e] of Object.entries(envs.environments)) {
    const projects: Record<string, unknown> = {};
    for (const [p, ps] of Object.entries(e.projects)) {
      const components: Record<string, unknown> = {};
      for (const [c, cs] of Object.entries(ps.components)) if (!empty(cs)) components[c] = compactScope(cs);
      if (!empty(ps) || Object.keys(components).length) projects[p] = compactScope(ps, Object.keys(components).length ? { components } : {});
    }
    environments[name] = {
      vars: e.vars,
      headers: e.headers,
      ...(e.secrets.length ? { secrets: e.secrets } : {}),
      baseUrls: e.baseUrls,
      openapi: e.openapi,
      sockets: e.sockets,
      ...(Object.keys(projects).length ? { projects } : {}),
    };
  }
  return { active: envs.active, environments };
}

/** The scope of an environment; `create` adds a missing project or component scope. */
export function scopeOf(env: Environment, name: ScopeName, project?: string, component?: string, create = false): Scope | undefined {
  if (name === 'global') return env;
  if (!project) return undefined;
  let p = env.projects[project];
  if (!p && create) p = env.projects[project] = { vars: {}, headers: {}, secrets: [], components: {} };
  if (!p || name === 'project') return p;
  if (!component) return undefined;
  let c = p.components[component];
  if (!c && create) c = p.components[component] = { vars: {}, headers: {}, secrets: [] };
  return c;
}

/** The variables a request of `project` / `component` sees: component over project over the environment's own. */
export function scopedVars(env: Environment | undefined, project?: string, component?: string): Record<string, string> {
  if (!env) return {};
  return { ...env.vars, ...scopeOf(env, 'project', project)?.vars, ...scopeOf(env, 'component', project, component)?.vars };
}

/** The most specific scope that defines `name`, if any. */
export function variableScope(env: Environment | undefined, name: string, project?: string, component?: string): ScopeName | undefined {
  if (!env) return undefined;
  for (const s of ['component', 'project', 'global'] as const) if (scopeOf(env, s, project, component)?.vars[name] !== undefined) return s;
  return undefined;
}

/** One change of a scope from the variables editor. */
export interface ScopeEdit {
  op: 'set' | 'delete' | 'rename' | 'secret';
  kind: 'vars' | 'headers';
  name: string;
  value?: string;
  to?: string;
  on?: boolean;
}

/** Applies an edit to the environment (in place); returns the value it had before (undefined: none). */
export function editScope(env: Environment, name: ScopeName, project: string | undefined, component: string | undefined, e: ScopeEdit): string | undefined {
  const s = scopeOf(env, name, project, component, e.op !== 'delete');
  if (!s || !e.name.trim()) return undefined;
  const table = s[e.kind];
  const key = e.name.trim();
  const before = table[key];
  if (e.op === 'set') table[key] = e.value ?? '';
  if (e.op === 'delete') {
    delete table[key];
    if (e.kind === 'vars') s.secrets = s.secrets.filter((x) => x !== key);
  }
  if (e.op === 'rename' && e.to?.trim() && e.to.trim() !== key) {
    const to = e.to.trim();
    const rebuilt: Record<string, string> = {};
    for (const [k, v] of Object.entries(table)) rebuilt[k === key ? to : k] = v;
    if (!(key in table)) rebuilt[to] = e.value ?? '';
    s[e.kind] = rebuilt;
    if (e.kind === 'vars') s.secrets = s.secrets.map((x) => (x === key ? to : x));
  }
  if (e.op === 'secret' && e.kind === 'vars') s.secrets = e.on ? [...new Set([...s.secrets, key])] : s.secrets.filter((x) => x !== key);
  return before;
}

/** Sets (or, with undefined, deletes) a variable of a scope; returns its earlier value. */
export function setVariable(env: Environment, name: ScopeName, project: string | undefined, component: string | undefined, variable: string, value: string | undefined): string | undefined {
  return editScope(env, name, project, component, value === undefined ? { op: 'delete', kind: 'vars', name: variable } : { op: 'set', kind: 'vars', name: variable, value });
}

/** The `{{name}}` variables used by these texts, once each. */
export function referencedVars(texts: (string | undefined)[]): string[] {
  const out = new Set<string>();
  for (const t of texts) for (const m of (t ?? '').matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g)) out.add(m[1]);
  return [...out];
}

// ---------- JSON paths ----------

/** `data.items[0].id`, `$.token`, `a["x y"]` or `items.0.id` as keys; undefined when it does not parse. */
export function parsePath(path: string): (string | number)[] | undefined {
  const s = path.trim().replace(/^\$\.?/, '');
  const out: (string | number)[] = [];
  const re = /\.?([^.[\]"\s]+)|\[(\d+)\]|\[\s*"((?:[^"\\]|\\.)*)"\s*\]/y;
  let at = 0;
  while (at < s.length) {
    re.lastIndex = at;
    const m = re.exec(s);
    if (!m) return undefined;
    out.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? Number(m[2]) : JSON.parse(`"${m[3]}"`));
    at = re.lastIndex;
  }
  return out;
}

/** The value at `path` in a parsed JSON, undefined when any step is missing. */
export function jsonPath(value: unknown, path: string): unknown {
  const parts = parsePath(path);
  if (!parts) return undefined;
  let cur: unknown = value;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p as string];
  }
  return cur;
}

/** page: the path of a node of the tree, as `jsonPath` reads it. */
export function pathOf(parts: (string | number)[]): string {
  return parts.map((p, i) => (typeof p === 'number' ? `[${p}]` : /^[A-Za-z_$][\w$]*$/.test(p) ? (i ? '.' : '') + p : `[${JSON.stringify(p)}]`)).join('');
}

const asText = (v: unknown): string | undefined => (v === undefined ? undefined : typeof v === 'string' ? v : JSON.stringify(v));

// ---------- response → variables ----------

/** The fields of a response that hold a token, in the order they are preferred. */
export const TOKEN_FIELDS = ['access_token', 'accessToken', 'token', 'jwt', 'id_token', 'idToken', 'refresh_token', 'refreshToken'];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const ACCESS = ['accesstoken', 'token', 'jwt', 'idtoken'];
const TOKEN_VARS = new Set(['token', 'accesstoken', 'jwt', 'authtoken', 'bearertoken', 'bearer', 'apitoken', 'idtoken', 'refreshtoken', 'oauthtoken']);

/** The token fields of a JSON response (a few levels deep: `data.access_token`), with their path. */
export function findTokens(json: unknown): { path: string; field: string; value: string }[] {
  const out: { path: string; field: string; value: string }[] = [];
  const walk = (v: unknown, parts: string[], depth: number) => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || depth > 3) return;
    for (const [k, x] of Object.entries(v)) {
      if (TOKEN_FIELDS.includes(k) && typeof x === 'string' && x) out.push({ path: pathOf([...parts, k]), field: k, value: x });
      else walk(x, [...parts, k], depth + 1);
    }
  };
  walk(json, [], 0);
  return out.sort((a, b) => TOKEN_FIELDS.indexOf(a.field) - TOKEN_FIELDS.indexOf(b.field));
}

/** The variables a response's tokens fill: each token-like variable the request used (`{{token}}`) takes the field
 * of its own name, else (an access token) the preferred access field. */
export function autoTokenUpdates(json: unknown, used: string[]): { name: string; value: string; path: string }[] {
  const tokens = findTokens(json);
  const out: { name: string; value: string; path: string }[] = [];
  for (const name of used) {
    const n = norm(name);
    if (!TOKEN_VARS.has(n)) continue;
    const exact = tokens.find((t) => norm(t.field) === n);
    const access = n === 'refreshtoken' || n === 'idtoken' ? undefined : ACCESS.map((a) => tokens.find((t) => norm(t.field) === a)).find(Boolean);
    const hit = exact ?? access;
    if (hit) out.push({ name, value: hit.value, path: hit.path });
  }
  return out;
}

/** A post-response rule: after every send, `name` ← a JSON path of the body or a header of the response. */
export interface Rule {
  on: boolean;
  name: string;
  from: 'body' | 'header';
  path: string;
  scope: ScopeName;
}

/** The variables the rules take from a response; `missing` names the rules whose path found nothing. */
export function runRules(rules: Rule[], body: string, headers: Record<string, string>): { set: { name: string; value: string; scope: ScopeName; path: string }[]; missing: string[] } {
  const set: { name: string; value: string; scope: ScopeName; path: string }[] = [];
  const missing: string[] = [];
  let parsed: unknown;
  let parsedOk = false;
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  for (const r of rules) {
    if (!r.on || !r.name.trim() || !r.path.trim()) continue;
    let value: string | undefined;
    if (r.from === 'header') value = lower[r.path.trim().toLowerCase()];
    else {
      if (!parsedOk) {
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = undefined;
        }
        parsedOk = true;
      }
      value = asText(jsonPath(parsed, r.path));
    }
    if (value === undefined) missing.push(r.name.trim());
    else set.push({ name: r.name.trim(), value, scope: r.scope, path: r.path.trim() });
  }
  return { set, missing };
}

// ---------- auth ----------

export type AuthType = 'none' | 'inherit' | 'bearer' | 'basic' | 'apikey' | 'oauth2';
export interface Auth {
  type: AuthType;
  token?: string;
  username?: string;
  password?: string;
  key?: string;
  value?: string;
  in?: 'header' | 'query';
  grant?: 'client_credentials' | 'password';
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  /** How the client authenticates at the token url: an HTTP Basic header (the default, RFC 6749 §2.3.1) or the body. */
  credentials?: 'basic' | 'body';
  /** The variable the access token is kept in (`accessToken`). */
  tokenVar?: string;
  expiresAt?: number;
}

/** `user:password` as HTTP Basic credentials (UTF-8, base64). */
export function basicAuth(user: string, password: string): string {
  return 'Basic ' + Buffer.from(`${user}:${password}`, 'utf8').toString('base64');
}

const withHeader = (headers: [string, string][], name: string, value: string): [string, string][] => [...headers.filter(([k]) => k.toLowerCase() !== name.toLowerCase()), [name, value]];

/** The request's headers and url with its auth applied. `resolve` fills `{{var}}` where a value must be computed
 * here (Basic's base64, an API key in the query); the rest stays raw for the caller to resolve. */
export function applyAuth(auth: Auth | undefined, headers: [string, string][], url: string, resolve: (s: string) => string): { headers: [string, string][]; url: string } {
  const a = auth ?? { type: 'inherit' };
  switch (a.type) {
    case 'none':
      return { headers: headers.filter(([k]) => k.toLowerCase() !== 'authorization'), url };
    case 'bearer':
      return { headers: withHeader(headers, 'Authorization', `Bearer ${a.token ?? ''}`), url };
    case 'basic':
      return { headers: withHeader(headers, 'Authorization', basicAuth(resolve(a.username ?? ''), resolve(a.password ?? ''))), url };
    case 'apikey': {
      const key = (a.key ?? '').trim();
      if (!key) return { headers, url };
      if (a.in === 'query') {
        const [base, hash] = url.split('#', 2);
        const q = `${encodeURIComponent(resolve(key))}=${encodeURIComponent(resolve(a.value ?? ''))}`;
        return { headers, url: base + (base.includes('?') ? '&' : '?') + q + (hash !== undefined ? '#' + hash : '') };
      }
      return { headers: withHeader(headers, key, a.value ?? ''), url };
    }
    case 'oauth2':
      return { headers: withHeader(headers, 'Authorization', `Bearer {{${(a.tokenVar ?? '').trim() || 'accessToken'}}}`), url };
    default:
      return { headers, url };
  }
}

/** The token request of an OAuth 2.0 grant (client credentials or password, RFC 6749 §4.3, §4.4), or what is missing. */
export function oauthTokenRequest(a: Auth, resolve: (s: string) => string): { url: string; headers: Record<string, string>; body: string } | { problem: string } {
  const url = resolve(a.tokenUrl ?? '').trim();
  const id = resolve(a.clientId ?? '');
  const secret = resolve(a.clientSecret ?? '');
  if (!/^https?:\/\//i.test(url)) return { problem: 'tokenUrl' };
  if (!id) return { problem: 'clientId' };
  const grant = a.grant ?? 'client_credentials';
  if (grant === 'password' && !resolve(a.username ?? '')) return { problem: 'username' };
  const body = new URLSearchParams({ grant_type: grant });
  if (grant === 'password') {
    body.set('username', resolve(a.username ?? ''));
    body.set('password', resolve(a.password ?? ''));
  }
  if (resolve(a.scope ?? '').trim()) body.set('scope', resolve(a.scope ?? '').trim());
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' };
  if ((a.credentials ?? 'basic') === 'basic') headers.authorization = basicAuth(encodeURIComponent(id), encodeURIComponent(secret));
  else {
    body.set('client_id', id);
    if (secret) body.set('client_secret', secret);
  }
  return { url, headers, body: body.toString() };
}

/** A token endpoint's answer: the access token and when it expires, or its error. */
export function parseTokenResponse(text: string, now: number): { accessToken?: string; refreshToken?: string; expiresAt?: number; error?: string } {
  let o: Record<string, unknown>;
  try {
    o = object(JSON.parse(text));
  } catch {
    return { error: text.trim().slice(0, 200) || 'empty answer' };
  }
  if (typeof o.error === 'string') return { error: o.error + (typeof o.error_description === 'string' ? `: ${o.error_description}` : '') };
  if (typeof o.access_token !== 'string' || !o.access_token) return { error: 'no access_token in the answer' };
  const expires = Number(o.expires_in);
  return {
    accessToken: o.access_token,
    refreshToken: typeof o.refresh_token === 'string' ? o.refresh_token : undefined,
    expiresAt: Number.isFinite(expires) && expires > 0 ? now + expires * 1000 : undefined,
  };
}

// ---------- the page's pure helpers (inlined by their source) ----------

/** A header row of the request: an auto row has the `source` it came from (`code`, `body`, `global`, `project`,
 * `component`) and is followed by its default until it is `edited`. */
export interface HeaderRow {
  on: boolean;
  name: string;
  value: string;
  source?: string;
  edited?: boolean;
}

/** page: the auto header rows: the guards' (`code`), Content-Type of a body, then each scope's headers; a name in a
 * later source replaces the earlier one. */
export function defaultHeaders(guards: [string, string][], scopes: [string, Record<string, string>][], body: string): HeaderRow[] {
  const out: HeaderRow[] = [];
  const add = (name: string, value: string, source: string) => {
    const i = out.findIndex((r) => r.name.toLowerCase() === name.toLowerCase());
    if (i >= 0) out.splice(i, 1);
    out.push({ on: true, name, value, source });
  };
  for (const [k, v] of guards) add(k, v, 'code');
  const b = body.trim();
  if (b) add('Content-Type', b[0] === '{' || b[0] === '[' ? 'application/json' : 'text/plain', 'body');
  for (const [source, headers] of scopes) for (const [k, v] of Object.entries(headers || {})) add(k, v, source);
  return out;
}

/** page: the tab's rows with the current defaults: the user's rows kept, an auto row the user deleted stays deleted
 * (`removed`), a user row of the same name wins over a default, an auto row not edited follows its default. */
export function mergeHeaderRows(rows: HeaderRow[], defaults: HeaderRow[], removed: string[]): HeaderRow[] {
  const key = (r: HeaderRow) => r.source + ':' + r.name.toLowerCase();
  const mine = new Set(rows.filter((r) => !r.source).map((r) => r.name.trim().toLowerCase()));
  const out = rows.filter((r) => !r.source || r.edited || (defaults.some((d) => key(d) === key(r)) && !mine.has(r.name.toLowerCase())));
  for (const d of defaults) {
    if (removed.includes(key(d)) || mine.has(d.name.toLowerCase()) || out.some((r) => r.source && key(r) === key(d))) continue;
    out.push({ on: true, name: d.name, value: d.value, source: d.source });
  }
  return out.map((r) => {
    if (!r.source || r.edited) return r;
    const d = defaults.find((x) => key(x) === key(r));
    return d ? { ...r, name: d.name, value: d.value } : r;
  });
}

/** page: a tab's form as saved by any version: the header pairs of earlier versions (`[[k, v]]`) become rows. */
export function migrateForm(f: Record<string, unknown>): Record<string, unknown> {
  const headers = Array.isArray(f.headers) ? f.headers : [];
  const rows = headers.map((h) => (Array.isArray(h) ? { on: true, name: String(h[0] ?? ''), value: String(h[1] ?? '') } : h));
  return {
    method: 'GET',
    url: '',
    path: {},
    query: {},
    body: '',
    pane: 'params',
    ...f,
    headers: rows,
    removed: Array.isArray(f.removed) ? f.removed : [],
    auth: f.auth && typeof f.auth === 'object' ? f.auth : { type: 'inherit' },
    rules: Array.isArray(f.rules) ? f.rules : [],
  };
}

/** page: why a JSON text does not parse, with its line and column (1-based); `{{var}}` counts as a value. */
export function jsonProblem(text: string): { message: string; line: number; col: number } | undefined {
  if (!text.trim()) return undefined;
  const probe = text.replace(/\{\{[^{}]*\}\}/g, (m) => '1' + '0'.repeat(m.length - 1));
  try {
    JSON.parse(probe);
    return undefined;
  } catch (e) {
    const message = String((e as Error).message || e);
    const m = /position (\d+)/.exec(message);
    const lc = /line (\d+) column (\d+)/.exec(message);
    let line = 1;
    let col = 1;
    if (lc) {
      line = Number(lc[1]);
      col = Number(lc[2]);
    } else {
      const at = m ? Number(m[1]) : probe.length;
      const before = probe.slice(0, at).split('\n');
      line = before.length;
      col = before[before.length - 1].length + 1;
    }
    return { message: message.replace(/^JSON\.parse: /, '').replace(/ in JSON at position \d+( \(line \d+ column \d+\))?/, ''), line, col };
  }
}

/** page: a JSON text indented by two spaces, its `{{var}}` kept where they were; undefined when it does not parse. */
export function formatJson(text: string): string | undefined {
  const vars: string[] = [];
  const probe = text.replace(/\{\{[^{}]*\}\}/g, (m) => String(987654321000 + vars.push(m) - 1));
  try {
    const out = JSON.stringify(JSON.parse(probe), null, 2);
    return out.replace(/9876543210\d\d/g, (n) => vars[Number(n) - 987654321000] ?? n);
  } catch {
    return undefined;
  }
}

/** page: JSON as colored pieces: `k` key, `s` string, `n` number, `b` boolean, `z` null, `p` punctuation, `v` a
 * `{{var}}`, `` the rest. */
export function tokenizeJson(text: string): [string, string][] {
  const out: [string, string][] = [];
  const re = /("(?:[^"\\\n]|\\.)*"?)(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|(\{\{[^{}\n]*\}\})|([{}[\],:])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(['', text.slice(last, m.index)]);
    if (m[1] !== undefined) {
      out.push([m[2] ? 'k' : 's', m[1]]);
      if (m[2]) out.push(['p', m[2]]);
    } else if (m[3] !== undefined) out.push(['n', m[3]]);
    else if (m[4] !== undefined) out.push(['b', m[4]]);
    else if (m[5] !== undefined) out.push(['z', m[5]]);
    else if (m[6] !== undefined) out.push(['v', m[6]]);
    else out.push(['p', m[7]]);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(['', text.slice(last)]);
  return out;
}

/** page: HTML or XML as colored pieces: `t` tag name, `a` attribute, `s` its value, `c` comment, `p` punctuation. */
export function tokenizeMarkup(text: string): [string, string][] {
  const out: [string, string][] = [];
  const re = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<[^<>]*>?/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(['', text.slice(last, m.index)]);
    const tag = m[0];
    if (tag.startsWith('<!--') || tag.startsWith('<![CDATA[')) out.push(['c', tag]);
    else {
      const head = /^(<\/?[!?]?)([\w:.-]*)/.exec(tag)!;
      out.push(['p', head[1]]);
      if (head[2]) out.push(['t', head[2]]);
      const inner = /([^\s=>/"']+)(\s*=\s*)?("[^"]*"?|'[^']*'?|[^\s>"']+)?|(\s+)|(\/?\??>)|([\s\S])/g;
      inner.lastIndex = head[0].length;
      let a: RegExpExecArray | null;
      while ((a = inner.exec(tag))) {
        if (a[1] !== undefined) {
          out.push(['a', a[1]]);
          if (a[2]) out.push(['p', a[2]]);
          if (a[3]) out.push(['s', a[3]]);
        } else if (a[4] !== undefined) out.push(['', a[4]]);
        else if (a[5] !== undefined) out.push(['p', a[5]]);
        else out.push(['p', a[6]]);
      }
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(['', text.slice(last)]);
  return out;
}
