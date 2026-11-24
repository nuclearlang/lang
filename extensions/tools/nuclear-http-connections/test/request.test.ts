// HTTP Connections' request side without VS Code (`vscode` is test/vscode-stub.ts): the environments file of every
// version, the scopes of a variable, the auth, the response → variable links, the page's helpers (also as the page
// runs them: from their source) and the page's script. Bundled with sockets.test.ts, which imports it.
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import * as vscode from 'vscode';
import { HttpModel } from '../src/httpConnections';
import {
  applyAuth,
  autoTokenUpdates,
  basicAuth,
  compactEnvironments,
  defaultHeaders,
  editScope,
  Environment,
  findTokens,
  formatJson,
  jsonPath,
  jsonProblem,
  mergeHeaderRows,
  migrateForm,
  normalizeEnvironments,
  oauthTokenRequest,
  parsePath,
  parseTokenResponse,
  pathOf,
  referencedVars,
  runRules,
  scopedVars,
  setVariable,
  tokenizeJson,
  tokenizeMarkup,
  variableScope,
} from '../src/request';
import { requestPageHtml } from '../src/panel';

// a file as earlier versions wrote it (the guide's example)
const OLD = {
  active: 'local',
  environments: {
    local: {
      vars: { baseUrl: 'http://localhost:8000', token: 'dev' },
      headers: { Authorization: 'Bearer {{token}}' },
      baseUrls: { shop_api: 'http://localhost:8000' },
      openapi: ['https://api.example.com/openapi.json'],
      sockets: ['wss://echo.example.com/ws'],
    },
    staging: { vars: { baseUrl: 'https://staging' } },
  },
};

test('environments: a file of an earlier version loads unchanged and is written back the same', () => {
  const envs = normalizeEnvironments(OLD)!;
  assert.equal(envs.active, 'local');
  assert.deepEqual(envs.environments.local.vars, OLD.environments.local.vars);
  assert.deepEqual(envs.environments.local.projects, {});
  assert.deepEqual(envs.environments.staging.headers, {});
  assert.deepEqual(envs.environments.staging.sockets, []);
  assert.deepEqual(compactEnvironments(envs), {
    active: 'local',
    environments: { local: OLD.environments.local, staging: { vars: { baseUrl: 'https://staging' }, headers: {}, baseUrls: {}, openapi: [], sockets: [] } },
  });
  assert.equal(normalizeEnvironments({}), undefined);
  assert.equal(normalizeEnvironments(null), undefined);
  assert.equal(normalizeEnvironments({ active: 'gone', environments: { a: {} } })!.active, 'a');
  assert.deepEqual(normalizeEnvironments({ environments: { a: { vars: { n: 1, x: null }, openapi: [3, 'u'] } } })!.environments.a.vars, { n: '1', x: '' });
});

const scoped = (): Environment =>
  normalizeEnvironments({
    environments: {
      local: {
        vars: { baseUrl: 'http://g', token: 'g', only: 'g' },
        headers: { 'X-Env': 'g' },
        projects: { shop: { vars: { token: 'p', pv: 'p' }, components: { orders: { vars: { token: 'c' }, headers: { 'X-Env': 'c' }, secrets: ['token'] } } } },
      },
    },
  })!.environments.local;

test('scopes: component over project over the environment; the scope that defines a variable', () => {
  const env = scoped();
  assert.deepEqual(scopedVars(env, 'shop', 'orders'), { baseUrl: 'http://g', token: 'c', only: 'g', pv: 'p' });
  assert.deepEqual(scopedVars(env, 'shop', 'users'), { baseUrl: 'http://g', token: 'p', only: 'g', pv: 'p' });
  assert.deepEqual(scopedVars(env, 'other', 'orders'), { baseUrl: 'http://g', token: 'g', only: 'g' });
  assert.deepEqual(scopedVars(undefined), {});
  assert.equal(variableScope(env, 'token', 'shop', 'orders'), 'component');
  assert.equal(variableScope(env, 'pv', 'shop', 'orders'), 'project');
  assert.equal(variableScope(env, 'only', 'shop', 'orders'), 'global');
  assert.equal(variableScope(env, 'nope', 'shop', 'orders'), undefined);
});

test('scopes: set, rename, secret and delete; a new scope is created and written only when it holds something', () => {
  const env = scoped();
  assert.equal(setVariable(env, 'component', 'new', 'c1', 'a', '1'), undefined);
  assert.equal(env.projects.new.components.c1.vars.a, '1');
  assert.equal(editScope(env, 'component', 'shop', 'orders', { op: 'rename', kind: 'vars', name: 'token', to: 'jwt' }), 'c');
  assert.deepEqual(env.projects.shop.components.orders.vars, { jwt: 'c' });
  assert.deepEqual(env.projects.shop.components.orders.secrets, ['jwt']);
  editScope(env, 'component', 'shop', 'orders', { op: 'secret', kind: 'vars', name: 'jwt', on: false });
  assert.deepEqual(env.projects.shop.components.orders.secrets, []);
  editScope(env, 'project', 'shop', undefined, { op: 'set', kind: 'headers', name: 'X-P', value: '1' });
  assert.deepEqual(env.projects.shop.headers, { 'X-P': '1' });
  assert.equal(setVariable(env, 'global', undefined, undefined, 'only', undefined), 'g');
  assert.equal(env.vars.only, undefined);
  editScope(env, 'component', 'ghost', 'none', { op: 'delete', kind: 'vars', name: 'x' });
  assert.equal(env.projects.ghost, undefined, 'a delete never creates a scope');
  setVariable(env, 'component', 'new', 'c1', 'a', undefined);
  const out = compactEnvironments({ active: 'local', environments: { local: env } }) as { environments: { local: { projects: Record<string, unknown> } } };
  assert.equal(out.environments.local.projects.new, undefined, 'an emptied scope is left out');
  assert.deepEqual(Object.keys(out.environments.local.projects), ['shop']);
});

test('the model reads and writes http.json with the scopes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nuc-http-'));
  fs.mkdirSync(path.join(root, '.nuclear'));
  fs.writeFileSync(path.join(root, '.nuclear', 'http.json'), JSON.stringify(OLD));
  (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [{ uri: { fsPath: root } }];
  const model = new HttpModel({ appendLine() {}, show() {} } as never, path.join(root, 'storage'));
  const envs = model.environments();
  assert.deepEqual(envs.environments.local.vars, OLD.environments.local.vars);
  setVariable(envs.environments.local, 'project', 'shop', undefined, 'token', 'from-login');
  model.saveEnvironments(envs);
  const written = JSON.parse(fs.readFileSync(path.join(root, '.nuclear', 'http.json'), 'utf8'));
  assert.deepEqual(written.environments.local.projects, { shop: { vars: { token: 'from-login' } } });
  assert.deepEqual(written.environments.local.sockets, OLD.environments.local.sockets);
  assert.equal(scopedVars(model.environments().environments.local, 'shop', 'x').token, 'from-login');
});

test('JSON paths: parsed, read and written back by the tree', () => {
  const v = { data: { access_token: 'abc', items: [{ id: 7 }], 'odd key': true } };
  assert.equal(jsonPath(v, 'data.access_token'), 'abc');
  assert.equal(jsonPath(v, '$.data.items[0].id'), 7);
  assert.equal(jsonPath(v, 'data.items.0.id'), 7);
  assert.equal(jsonPath(v, 'data["odd key"]'), true);
  assert.equal(jsonPath(v, 'data.nope.x'), undefined);
  assert.equal(parsePath('a..b]'), undefined);
  for (const parts of [['data', 'items', 0, 'id'], ['data', 'odd key'], ['1x']] as (string | number)[][]) assert.deepEqual(parsePath(pathOf(parts)), parts);
  assert.equal(pathOf(['data', 'items', 0, 'id']), 'data.items[0].id');
});

test('tokens: found in the answer, matched to the token variables the request used', () => {
  const answer = { data: { user: { id: 1 }, accessToken: 'A', refresh_token: 'R' }, token: 'T' };
  assert.deepEqual(findTokens(answer).map((t) => t.path), ['data.accessToken', 'token', 'data.refresh_token']);
  assert.deepEqual(autoTokenUpdates(answer, ['token', 'refreshToken', 'baseUrl']), [
    { name: 'token', value: 'T', path: 'token' },
    { name: 'refreshToken', value: 'R', path: 'data.refresh_token' },
  ]);
  assert.deepEqual(autoTokenUpdates({ access_token: 'A' }, ['token']), [{ name: 'token', value: 'A', path: 'access_token' }]);
  assert.deepEqual(autoTokenUpdates({ access_token: 'A' }, ['refreshToken', 'id']), []);
  assert.deepEqual(autoTokenUpdates([1], ['token']), []);
  assert.deepEqual(referencedVars(['Bearer {{token}}', '{{ baseUrl }}/x/{{token}}', undefined]), ['token', 'baseUrl']);
});

test('post-response rules: a JSON path of the body or a header; what is missing is said', () => {
  const r = runRules(
    [
      { on: true, name: 'token', from: 'body', path: 'data.access_token', scope: 'project' },
      { on: true, name: 'id', from: 'body', path: 'items[0]', scope: 'component' },
      { on: true, name: 'rid', from: 'header', path: 'X-Request-Id', scope: 'global' },
      { on: true, name: 'gone', from: 'body', path: 'nope', scope: 'global' },
      { on: false, name: 'off', from: 'body', path: 'data', scope: 'global' },
    ],
    '{"data":{"access_token":"abc"},"items":[{"a":1}]}',
    { 'x-request-id': '42' },
  );
  assert.deepEqual(r.set, [
    { name: 'token', value: 'abc', scope: 'project', path: 'data.access_token' },
    { name: 'id', value: '{"a":1}', scope: 'component', path: 'items[0]' },
    { name: 'rid', value: '42', scope: 'global', path: 'X-Request-Id' },
  ]);
  assert.deepEqual(r.missing, ['gone']);
  assert.deepEqual(runRules([{ on: true, name: 'x', from: 'body', path: 'a', scope: 'global' }], 'not json', {}).missing, ['x']);
});

test('auth: none, inherit, Bearer, Basic, API key in a header or the query, OAuth 2.0', () => {
  const id = (s: string) => s.replace('{{user}}', 'ana');
  const rows: [string, string][] = [['Authorization', 'Bearer {{token}}'], ['X-A', '1']];
  assert.equal(basicAuth('ana', 'pässword'), 'Basic ' + Buffer.from('ana:pässword').toString('base64'));
  assert.deepEqual(applyAuth(undefined, rows, 'u', id).headers, rows);
  assert.deepEqual(applyAuth({ type: 'none' }, rows, 'u', id).headers, [['X-A', '1']]);
  assert.deepEqual(applyAuth({ type: 'bearer', token: '{{jwt}}' }, rows, 'u', id).headers, [['X-A', '1'], ['Authorization', 'Bearer {{jwt}}']]);
  assert.deepEqual(applyAuth({ type: 'basic', username: '{{user}}', password: 'p' }, [], 'u', id).headers, [['Authorization', basicAuth('ana', 'p')]]);
  assert.deepEqual(applyAuth({ type: 'apikey', key: 'X-Key', value: '{{k}}' }, [], 'u', id).headers, [['X-Key', '{{k}}']]);
  assert.equal(applyAuth({ type: 'apikey', key: 'api key', value: '{{user}}', in: 'query' }, [], 'http://h/p?a=1#f', id).url, 'http://h/p?a=1&api%20key=ana#f');
  assert.equal(applyAuth({ type: 'apikey', key: 'k', value: 'v', in: 'query' }, [], 'http://h/p', id).url, 'http://h/p?k=v');
  assert.deepEqual(applyAuth({ type: 'oauth2' }, [], 'u', id).headers, [['Authorization', 'Bearer {{accessToken}}']]);
  assert.deepEqual(applyAuth({ type: 'oauth2', tokenVar: 'tk' }, [], 'u', id).headers, [['Authorization', 'Bearer {{tk}}']]);
});

test('OAuth 2.0: the token request of each grant, what is missing, the answer', () => {
  const same = (s: string) => s;
  const cc = oauthTokenRequest({ type: 'oauth2', tokenUrl: 'https://a/token', clientId: 'id:1', clientSecret: 's', scope: 'read write' }, same);
  assert.ok(!('problem' in cc));
  if ('problem' in cc) return;
  assert.equal(cc.url, 'https://a/token');
  assert.equal(cc.headers.authorization, basicAuth('id%3A1', 's'));
  assert.deepEqual(Object.fromEntries(new URLSearchParams(cc.body)), { grant_type: 'client_credentials', scope: 'read write' });
  const pw = oauthTokenRequest({ type: 'oauth2', grant: 'password', tokenUrl: 'https://a/token', clientId: 'id', username: 'ana', password: 'p', credentials: 'body' }, same);
  if ('problem' in pw) return assert.fail(pw.problem);
  assert.equal(pw.headers.authorization, undefined);
  assert.deepEqual(Object.fromEntries(new URLSearchParams(pw.body)), { grant_type: 'password', username: 'ana', password: 'p', client_id: 'id' });
  assert.deepEqual(oauthTokenRequest({ type: 'oauth2', tokenUrl: 'ftp://x', clientId: 'a' }, same), { problem: 'tokenUrl' });
  assert.deepEqual(oauthTokenRequest({ type: 'oauth2', tokenUrl: 'https://x' }, same), { problem: 'clientId' });
  assert.deepEqual(oauthTokenRequest({ type: 'oauth2', grant: 'password', tokenUrl: 'https://x', clientId: 'a' }, same), { problem: 'username' });
  assert.deepEqual(parseTokenResponse('{"access_token":"A","expires_in":60,"refresh_token":"R"}', 1000), { accessToken: 'A', refreshToken: 'R', expiresAt: 61000 });
  assert.deepEqual(parseTokenResponse('{"error":"invalid_client","error_description":"bad secret"}', 0), { error: 'invalid_client: bad secret' });
  assert.ok(parseTokenResponse('<html>', 0).error);
  assert.ok(parseTokenResponse('{}', 0).error);
});

test('header rows: the defaults from the code, the body and the scopes; deleted stays deleted; edits and own rows win', () => {
  const d = defaultHeaders([['Authorization', 'Bearer {{token}}'], ['X-Tasks-Token', '{{token}}']], [['global', { 'X-Env': 'g' }], ['component', { 'x-env': 'c' }]], '{"a":1}');
  assert.deepEqual(d.map((r) => [r.name, r.value, r.source]), [
    ['Authorization', 'Bearer {{token}}', 'code'],
    ['X-Tasks-Token', '{{token}}', 'code'],
    ['Content-Type', 'application/json', 'body'],
    ['x-env', 'c', 'component'],
  ]);
  let rows = mergeHeaderRows([], d, []);
  assert.equal(rows.length, 4);
  rows[0] = { ...rows[0], value: 'Bearer x', edited: true };
  rows = rows.filter((r) => r.name !== 'X-Tasks-Token');
  const removed = ['code:x-tasks-token'];
  rows.push({ on: true, name: 'x-env', value: 'mine' });
  const again = mergeHeaderRows(rows, defaultHeaders([['Authorization', 'Bearer {{token}}'], ['X-Tasks-Token', '{{token}}']], [['component', { 'x-env': 'c2' }]], ''), removed);
  assert.deepEqual(again.map((r) => [r.name, r.value, r.source ?? '']), [
    ['Authorization', 'Bearer x', 'code'],
    ['x-env', 'mine', ''],
  ]);
});

test('a saved state of an earlier version restores: header pairs become rows', () => {
  const f = migrateForm({ method: 'POST', url: 'u', path: {}, query: {}, headers: [['A', '1'], ['', '']], body: '{}', pane: 'body' });
  assert.deepEqual(f.headers, [{ on: true, name: 'A', value: '1' }, { on: true, name: '', value: '' }]);
  assert.deepEqual(f.auth, { type: 'inherit' });
  assert.deepEqual(f.rules, []);
  assert.deepEqual(f.removed, []);
  assert.equal(f.method, 'POST');
  assert.deepEqual(migrateForm({}).headers, []);
});

test('the body: where JSON breaks (line and column), {{var}} as a value; Format keeps the variables', () => {
  assert.equal(jsonProblem('{"a": {{id}}, "b": "{{token}}"}'), undefined);
  assert.equal(jsonProblem(''), undefined);
  const p = jsonProblem('{\n  "a": 1,\n  "b" 2\n}')!;
  assert.deepEqual([p.line, p.col], [3, 7]);
  assert.ok(p.message.length > 0);
  assert.equal(jsonProblem('{"a":')!.line, 1);
  assert.equal(formatJson('{"a":{{id}},"b":["{{x}}"]}'), '{\n  "a": {{id}},\n  "b": [\n    "{{x}}"\n  ]\n}');
  assert.equal(formatJson('{nope'), undefined);
});

test('highlighting: every piece of JSON and markup keeps the text as it was', () => {
  const json = '{"a": [1, -2.5e3, true, null, "x\\"y"], "b": {{v}}}';
  const tj = tokenizeJson(json);
  assert.equal(tj.map(([, s]) => s).join(''), json);
  assert.deepEqual(tj.filter(([c]) => c && c !== 'p').map(([c, s]) => c + ':' + s), ['k:"a"', 'n:1', 'n:-2.5e3', 'b:true', 'z:null', 's:"x\\"y"', 'k:"b"', 'v:{{v}}']);
  const html = '<!doctype html><!-- c --><a href="x" data-x=1 disabled>t&amp;</a><br/>';
  const tm = tokenizeMarkup(html);
  assert.equal(tm.map(([, s]) => s).join(''), html);
  assert.deepEqual(tm.filter(([c]) => c === 't' || c === 'a' || c === 's' || c === 'c').map(([c, s]) => c + ':' + s), ['t:doctype', 'a:html', 'c:<!-- c -->', 't:a', 'a:href', 's:"x"', 'a:data-x', 's:1', 'a:disabled', 't:a', 't:br']);
  assert.equal(tokenizeMarkup('a < b').map(([, s]) => s).join(''), 'a < b');
});

test('the page runs the same helpers, from their source alone', () => {
  const page = <T>(f: T): T => new Function(`return (${String(f)});`)() as T;
  assert.equal(page(tokenizeJson)('[1]').length, 3);
  assert.equal(page(tokenizeMarkup)('<a>').length, 3);
  assert.equal(page(jsonProblem)('{')?.line, 1);
  assert.equal(page(formatJson)('[{{a}}]'), '[\n  {{a}}\n]');
  assert.equal(page(pathOf)(['a', 0]), 'a[0]');
  assert.equal(page(mergeHeaderRows)([], page(defaultHeaders)([['A', 'b']], [], ''), []).length, 1);
  assert.equal((page(migrateForm)({ headers: [['a', 'b']] }).headers as unknown[]).length, 1);
});

test('the request page: its script parses, in English and in Spanish; no text key is missing', () => {
  for (const language of ['en', 'es']) {
    (vscode.env as { language: string }).language = language;
    const html = requestPageHtml();
    const script = /<script nonce="[^"]+">([\s\S]*)<\/script>/.exec(html)![1];
    assert.doesNotThrow(() => new Function(script), language);
    assert.ok(!/\$\{/.test(html.replace(script, '')), 'no template left in the markup');
    const T = JSON.parse(/const T = (\{.*?\});\n/.exec(script)![1]) as Record<string, string>;
    const used = [...script.matchAll(/\bt\('([A-Za-z.]+)'/g)].map((m) => m[1]).filter((k) => !k.endsWith('.'));
    for (const k of used) assert.ok(k in T, `${language}: ${k}`);
    for (const k of ['scope.global', 'scope.project', 'scope.component', 'from.code', 'from.body', 'view.raw', 'view.headers', 'layout.rows', 'auth.basic.short', 'scopeHint.component'])
      assert.ok(k in T, `${language}: ${k}`);
  }
  (vscode.env as { language: string }).language = 'en';
});

// A client's calls to one of our backends are that backend's routes: listed once, under the backend, with who calls them;
// a call through another connection (a weather API) stays under the client.
test('the calls of a client to our own backend are not listed twice', async () => {
  const { oursOf, routeKey } = await import('../src/httpConnections');
  const api = (component: string, path: string, routes: { verb: string; path: string }[], connection = '') =>
    ({ component, path, connection, description: '', routes: routes.map((r) => ({ name: r.verb + r.path, verb: r.verb, path: r.path, params: [], returns: '' })) }) as never;
  const backend = { root: '/w/api', name: 'api', platform: 'backend', dialect: 'fastapi', contracts: [],
    contract: { controllers: { FilmsController: api('films', 'films', [{ verb: 'get', path: '' }, { verb: 'get', path: '{id}' }]) }, repositories: {} } } as never;
  const app = { root: '/w/app', name: 'app', platform: 'mobile', dialect: 'flutter', contracts: [],
    contract: { controllers: {}, repositories: {
      FilmRepository: api('films', 'films', [{ verb: 'get', path: '' }, { verb: 'get', path: ':id' }]),
      WeatherRepository: api('weather', 'forecast', [{ verb: 'get', path: '' }], 'weather'),
    } } } as never;
  const ours = oursOf([backend, app]);
  assert.equal(ours.calls.size, 2, 'both film calls are the backend\'s routes; the weather call is not');
  assert.deepEqual(ours.users.get(routeKey('get', '/films/{id}', 'api')), ['app']);
  assert.equal(routeKey('GET', '/films/{name}/', 'api'), routeKey('get', '/films/{id}', 'api'));
});
