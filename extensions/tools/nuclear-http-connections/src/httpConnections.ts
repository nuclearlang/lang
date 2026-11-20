// HTTP Connections: every project's endpoints (read from the contract the compiler writes, `.nuclear/contract.json`,
// ADR-synapsis-0006), as a tree by platform, project and component like the code; the contracts a client declares; OpenAPI
// documents of APIs that are not Nuclear; environments with variables and headers. The tree is drawn by the Nuclear
// workspace (workspace.ts); a component is a panel with one tab per endpoint (panel.ts), and what is served over
// WebSockets opens in a socket panel (socketPanel.ts). A basic Bruno / Postman inside the editor (ADR-extensions-0002).

import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { l10n } from '../../../vscode/src/i18n';
import { readCard } from '../../../vscode/src/card';
import { ComponentPanel } from './panel';
import { eventsOf, guardHeadersOf, Protocol, socketPathOf, transportsOf } from './socket';
import { SocketPanel } from './socketPanel';
import { compactEnvironments, Environments, normalizeEnvironments } from './request';

export interface Field {
  name: string;
  type: string;
  optional?: boolean;
  default?: unknown;
  json?: string;
  rules?: Record<string, unknown>;
  description?: string;
}
export interface Model {
  description?: string;
  key: string | null;
  fields: Field[];
}
export interface Param {
  name: string;
  type: string;
  optional?: boolean;
  default?: unknown;
  in: 'path' | 'query' | 'body';
}
export interface Route {
  name: string;
  verb: string;
  path: string;
  status?: number;
  description?: string;
  params: Param[];
  returns: string;
  error?: string;
}
export interface Api {
  component: string;
  path: string;
  connection?: string;
  description?: string;
  routes: Route[];
}
export interface Contract {
  app: string;
  version: string;
  platform: string | null;
  dialect: string;
  models: Record<string, Model>;
  controllers: Record<string, Api>;
  repositories: Record<string, Api>;
}
export interface DeclaredContract {
  name: string;
  source: string;
  version?: string;
}
export interface Project {
  root: string;
  name: string;
  platform: string | null;
  dialect: string;
  contract?: Contract;
  contracts: DeclaredContract[];
}
/** One request the tree offers: a backend route, a client call, an OpenAPI operation, a pushed event or a socket url. */
export interface Endpoint {
  project: string;
  kind: 'route' | 'call' | 'openapi' | 'event' | 'socket';
  owner: string;
  component: string;
  verb: string;
  /** The full path with `{name}` parameters (`/tasks/{id}`). */
  path: string;
  description?: string;
  params: Param[];
  returns: string;
  /** A sample body for the route's body model (fields with their defaults), when it has one. */
  body?: unknown;
  /** The environment variable the base url comes from (`baseUrl`, or the client's connection name). */
  connection?: string;
  /** `websocket`: it opens in the socket panel (absent: HTTP). */
  protocol?: Protocol;
  /** Where the project's socket answers (`/ws`), for a `websocket` endpoint of a contract; a `socket` one is a full url. */
  socketPath?: string;
  /** The headers the backend's token guards read, with the value to fill (`Bearer {{token}}` in `Authorization`). */
  guardHeaders?: [string, string][];
}

export type { Environment, Environments } from './request';

const ENV_FILE = path.join('.nuclear', 'http.json');
const PLATFORMS: Record<string, string> = { backend: 'Backend', mobile: 'Mobile', web: 'Web' };
const SKIP = new Set(['node_modules', 'build', 'dist', 'target', '.git', '.dart_tool', '.venv', '.idea', '__pycache__']);

/** The HTTP Connections tool is a workspace of its own (ADR-extensions-0002): every project's endpoints, one panel per component. */
export function activateHttpConnections(context: vscode.ExtensionContext): HttpModel {
  const output = vscode.window.createOutputChannel('HTTP Connections');
  const model = new HttpModel(output, context.globalStorageUri.fsPath);
  const watcher = vscode.workspace.createFileSystemWatcher('**/.nuclear/*.json');
  const refresh = () => model.refresh();
  context.subscriptions.push(
    output,
    watcher,
    watcher.onDidCreate(refresh),
    watcher.onDidChange(refresh),
    watcher.onDidDelete(refresh),
    vscode.workspace.onDidChangeWorkspaceFolders(refresh),
    vscode.commands.registerCommand('nuclear.httpConnections.refresh', refresh),
    vscode.commands.registerCommand('nuclear.httpConnections.open', (e: Endpoint) => (e.protocol === 'websocket' ? SocketPanel.open(context, model, e) : ComponentPanel.open(context, model, e))),
    vscode.commands.registerCommand('nuclear.httpConnections.selectEnvironment', () => model.selectEnvironment()),
    vscode.commands.registerCommand('nuclear.httpConnections.editEnvironments', () => model.editEnvironments()),
    vscode.commands.registerCommand('nuclear.httpConnections.addOpenApi', () => model.addOpenApi()),
    vscode.commands.registerCommand('nuclear.contracts.update', (root?: string, name?: string) => model.updateContracts(root, name)),
  );
  model.refresh();
  return model;
}

export interface OpenApiDoc {
  source: string;
  title: string;
  endpoints: Endpoint[];
  error?: string;
}

/** A node of the endpoints tree the workspace draws (platform → project → contracts / components → endpoints). */
export interface TreeNode {
  id: string;
  label: string;
  desc?: string;
  tooltip?: string;
  icon: string;
  /** A `nuclearHttpConnections.*` color id. */
  color?: string;
  children?: TreeNode[];
  /** Opens the endpoint in its component's panel. */
  endpoint?: Endpoint;
  /** A small button at the end of the row. */
  button?: { label: string; title: string; action: NodeAction };
  /** A protocol badge after the label (`WS`); with an action it is a button too. */
  badge?: { label: string; title: string; action?: NodeAction };
}
export type NodeAction =
  | { type: 'updateContracts'; root: string; name?: string }
  | { type: 'addOpenApi' }
  | { type: 'addSocket' }
  | { type: 'open'; endpoint: Endpoint };

/** What a component panel keeps between its closings: the webview's own state (tabs, forms, responses). */
export interface PanelMemory {
  key: string;
  title: string;
  state: unknown;
}

export class HttpModel {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changed.event;
  private projects: Project[] = [];
  private openapiDocs: OpenApiDoc[] = [];
  /** The ws:// urls of the active environment (read on refresh: `tree()` is drawn often). */
  private sockets: string[] = [];
  /** The state of every component panel ever opened in this window, by key, so a closed one comes back as it was. */
  readonly memory = new Map<string, PanelMemory>();
  /** The panels open when the HTTP Connections workspace was left, to reopen on return. */
  reopen: string[] = [];
  /** Project roots outside the workspace folders (the tabs of the Nuclear workspace); set by `activateWorkspace`. */
  extraRoots: () => string[] = () => [];

  constructor(
    private readonly output: vscode.OutputChannel,
    private readonly storage: string,
  ) {}

  refresh(): void {
    this.projects = findProjects(this.extraRoots());
    const env = this.environments();
    this.sockets = env.environments[env.active]?.sockets ?? [];
    void this.loadOpenApi(env.environments[env.active]?.openapi ?? []).then(() => this.changed.fire());
    this.changed.fire();
  }

  tree(): TreeNode[] {
    const out: TreeNode[] = [];
    for (const [platform, label] of Object.entries(PLATFORMS)) {
      const projects = this.projects.filter((p) => p.platform === platform);
      if (!projects.length) continue;
      out.push({ id: `platform:${platform}`, label, icon: platform, color: 'platform', children: projects.map((p) => this.projectNode(p)) });
    }
    const docs: TreeNode = {
      id: 'openapi',
      label: l10n.t('OpenAPI documents'),
      icon: 'book',
      color: 'platform',
      tooltip: l10n.t('APIs that are not Nuclear projects: add a url or a file with +'),
      button: { label: '+', title: l10n.t('Add an OpenAPI document (url or file) to this environment'), action: { type: 'addOpenApi' } },
      children: this.openapiDocs.map((doc) => ({
        id: `openapi:${doc.source}`,
        label: doc.title,
        desc: doc.error ? l10n.t('could not load') : doc.source,
        tooltip: doc.error ?? doc.source,
        icon: doc.error ? 'warning' : 'cloud',
        color: doc.error ? 'delete' : undefined,
        children: [...new Set(doc.endpoints.map((e) => e.component))].sort().map((tag) => ({
          id: `openapi:${doc.source}:${tag}`,
          label: tag,
          icon: 'tag',
          children: doc.endpoints.filter((e) => e.component === tag).map((e) => endpointNode(e)),
        })),
      })),
    };
    out.push(docs);
    out.push({
      id: 'sockets',
      label: l10n.t('WebSockets'),
      icon: 'http',
      color: 'platform',
      tooltip: l10n.t('WebSocket servers that are not Nuclear projects: add a ws:// or wss:// url with +'),
      button: { label: '+', title: l10n.t('Add a WebSocket url (ws:// or wss://) to this environment'), action: { type: 'addSocket' } },
      children: this.sockets.map((url) =>
        endpointNode({ project: 'WebSockets', kind: 'socket', owner: '', component: 'WebSockets', verb: 'ws', path: url, params: [], returns: '', protocol: 'websocket' }),
      ),
    });
    return out;
  }

  /** The actions of the tree's rows that are not the contracts' (the workspace forwards them). */
  runAction(a: NodeAction): void {
    if (a.type === 'open') void vscode.commands.executeCommand('nuclear.httpConnections.open', a.endpoint);
    if (a.type === 'addSocket') void this.addSocket();
  }

  private projectNode(p: Project): TreeNode {
    const children: TreeNode[] = [];
    if (p.contracts.length) {
      children.push({
        id: `contracts:${p.root}`,
        label: l10n.t('Contracts'),
        icon: 'law',
        color: 'project',
        button: { label: '↓', title: l10n.t('nuclear contracts update (every contract of the project)'), action: { type: 'updateContracts', root: p.root } },
        children: p.contracts.map((c) => ({
          id: `contract:${p.root}:${c.name}`,
          label: c.name,
          desc: `${c.version ?? l10n.t('not fetched')} · ${c.source}`,
          tooltip: l10n.t('contract {0} from {1}: generated into contracts/{0}/ (nuclear contracts update)', c.name, c.source),
          icon: c.version ? 'check' : 'warning',
          color: c.version ? 'get' : 'put',
          button: { label: '↓', title: `nuclear contracts update ${c.name}`, action: { type: 'updateContracts', root: p.root, name: c.name } },
        })),
      });
    }
    const apis = Object.entries(p.platform === 'backend' ? p.contract?.controllers ?? {} : p.contract?.repositories ?? {});
    const byComponent = new Map<string, Endpoint[]>();
    for (const [owner, api] of apis) {
      const key = api.component || 'shared';
      byComponent.set(key, [...(byComponent.get(key) ?? []), ...api.routes.map((route) => endpointOf(p, owner, api, route))]);
    }
    // the topics the app publishes, under the component that publishes them (a backend with a WebSocket)
    const socketPath = socketPathOf(p.contract);
    if (p.platform === 'backend' && socketPath) {
      for (const ev of eventsOf(p.contract)) {
        const event: Endpoint = {
          project: p.name,
          kind: 'event',
          owner: '',
          component: ev.component,
          verb: 'event',
          path: ev.topic,
          description: ev.fields ? `{ ${ev.fields.join(', ')} }` : undefined,
          params: [],
          returns: ev.payload,
          protocol: 'websocket',
          socketPath,
          guardHeaders: guardHeadersOf(p.contract),
        };
        byComponent.set(ev.component, [...(byComponent.get(ev.component) ?? []), event]);
      }
    }
    for (const [name, endpoints] of [...byComponent.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      children.push({ id: `component:${p.root}:${name}`, label: name, icon: 'component', color: 'component', children: endpoints.map((e) => endpointNode(e)) });
    }
    if (!apis.length && !p.contracts.length) {
      children.push({ id: `empty:${p.root}`, label: l10n.t('no endpoints'), desc: l10n.t('no controller or repository with http methods in the contract'), icon: 'info' });
    }
    return { id: `project:${p.root}`, label: p.name, desc: p.dialect, tooltip: p.root, icon: 'project', color: 'project', children };
  }

  // ---------- environments (the window's: <first folder>/.nuclear/http.json, else the extension's storage) ----------

  envFile(): string {
    const folder = vscode.workspace.workspaceFolders?.[0];
    return folder ? path.join(folder.uri.fsPath, ENV_FILE) : path.join(this.storage, 'http.json');
  }

  environments(): Environments {
    // the first environment points to where the backends of the workspace answer (their dialect's `url`, in their card)
    const urls = findProjects(this.extraRoots()).flatMap((project) => {
      const card = readCard(project.root);
      return card?.platform === 'backend' && card.toolchain?.url ? [[card.name, card.toolchain.url] as const] : [];
    });
    const fallback: Environments = {
      active: 'local',
      environments: { local: { vars: { baseUrl: urls[0]?.[1] ?? '' }, headers: {}, secrets: [], baseUrls: Object.fromEntries(urls), openapi: [], sockets: [], projects: {} } },
    };
    try {
      // every field this version added is optional: a file of an earlier version loads unchanged
      return normalizeEnvironments(JSON.parse(fs.readFileSync(this.envFile(), 'utf8'))) ?? fallback;
    } catch {
      return fallback;
    }
  }

  private writeEnvironments(envs: Environments): void {
    const file = this.envFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(compactEnvironments(envs), null, 2) + '\n');
  }

  /** Writes the environments the panels changed (variables, headers, tokens) and redraws what reads them. */
  saveEnvironments(envs: Environments): void {
    this.writeEnvironments(envs);
    this.refresh();
  }

  activateEnvironment(name: string): void {
    const envs = this.environments();
    if (!envs.environments[name]) return;
    envs.active = name;
    this.writeEnvironments(envs);
    this.refresh();
  }

  async selectEnvironment(): Promise<void> {
    const envs = this.environments();
    const names = Object.keys(envs.environments);
    const add = l10n.t('$(add) New environment…');
    const picked = await vscode.window.showQuickPick(
      [...names.map((n) => ({ label: n, description: n === envs.active ? l10n.t('active') : '', add: false })), { label: add, description: '', add: true }],
      { placeHolder: l10n.t('Environment for the requests (variables, headers, base urls)') },
    );
    if (!picked) return;
    if (picked.add) {
      const name = await vscode.window.showInputBox({ prompt: l10n.t('Name of the environment'), value: 'staging' });
      if (!name) return;
      envs.environments[name] = { vars: { baseUrl: 'https://' }, headers: {}, secrets: [], baseUrls: {}, openapi: [], sockets: [], projects: {} };
      envs.active = name;
      this.writeEnvironments(envs);
      await this.editEnvironments();
    } else {
      envs.active = picked.label;
      this.writeEnvironments(envs);
    }
    this.refresh();
  }

  async editEnvironments(): Promise<void> {
    const file = this.envFile();
    if (!fs.existsSync(file)) this.writeEnvironments(this.environments());
    await vscode.window.showTextDocument(vscode.Uri.file(file), { viewColumn: vscode.ViewColumn.Beside });
  }

  async addOpenApi(): Promise<void> {
    const source = await vscode.window.showInputBox({
      prompt: l10n.t('OpenAPI document of an API that is not a Nuclear project: a url or a file path'),
      placeHolder: l10n.t('https://api.example.com/openapi.json or ./openapi.yaml'),
    });
    if (!source) return;
    const envs = this.environments();
    const env = envs.environments[envs.active];
    if (!env.openapi.includes(source)) env.openapi.push(source);
    this.writeEnvironments(envs);
    this.refresh();
  }

  /** A WebSocket url of a server that is not a Nuclear project: kept in the environment, opened in the socket panel. */
  async addSocket(): Promise<void> {
    const url = await vscode.window.showInputBox({
      prompt: l10n.t('WebSocket url of a server that is not a Nuclear project'),
      placeHolder: 'wss://echo.example.com/ws  ·  ws://localhost:8080  ·  {{socketUrl}}',
      validateInput: (v) => (/^(wss?:\/\/|\{\{)/i.test(v.trim()) ? undefined : l10n.t('A ws:// or wss:// url (it may start with a {{variable}})')),
    });
    if (!url) return;
    const envs = this.environments();
    const env = envs.environments[envs.active];
    if (!env.sockets.includes(url.trim())) env.sockets.push(url.trim());
    this.writeEnvironments(envs);
    this.refresh();
    await vscode.commands.executeCommand('nuclear.httpConnections.open', { project: 'WebSockets', kind: 'socket', owner: '', component: 'WebSockets', verb: 'ws', path: url.trim(), params: [], returns: '', protocol: 'websocket' } satisfies Endpoint);
  }

  // ---------- contracts ----------

  async updateContracts(root?: string, name?: string): Promise<void> {
    let target = this.projects.find((p) => p.root === root);
    if (!target) {
      const pick = await vscode.window.showQuickPick(
        this.projects.filter((p) => p.contracts.length > 0).map((p) => ({ label: p.name, description: p.root, p })),
        { placeHolder: l10n.t('Project whose contracts to update') },
      );
      target = pick?.p;
    }
    if (!target) return;
    const names = name ? [name] : [];
    this.output.show(true);
    this.output.appendLine(`$ nuclear contracts update ${names.join(' ')}   (${target.root})`);
    try {
      const text = await run(nuclearBinary(), ['contracts', 'update', ...names], target.root);
      this.output.appendLine(text.trim());
      void vscode.window.showInformationMessage(l10n.t('Nuclear: contracts of {0} updated', target.name));
    } catch (e) {
      this.output.appendLine(String(e));
      void vscode.window.showErrorMessage(l10n.t('Nuclear: contracts update failed (see the HTTP Connections output)'));
    }
    this.refresh();
  }

  // ---------- OpenAPI documents ----------

  private async loadOpenApi(sources: string[]): Promise<void> {
    const docs: OpenApiDoc[] = [];
    for (const source of sources) {
      try {
        const text = /^https?:\/\//.test(source)
          ? await (await fetch(source, { signal: AbortSignal.timeout(8000) })).text()
          : fs.readFileSync(path.resolve(path.dirname(this.envFile()), '..', source), 'utf8');
        const doc = JSON.parse(text) as { info?: { title?: string }; paths?: Record<string, Record<string, unknown>> };
        docs.push({ source, title: doc.info?.title ?? source, endpoints: openApiEndpoints(source, doc) });
      } catch (e) {
        docs.push({ source, title: source, endpoints: [], error: String(e) });
      }
    }
    this.openapiDocs = docs;
  }
}

function endpointNode(e: Endpoint): TreeNode {
  const socket = { ...e, protocol: 'websocket' as const };
  const badge =
    e.kind === 'socket'
      ? undefined
      : e.kind === 'event'
      ? { label: 'WS', title: l10n.t('pushed over WebSockets: open it to subscribe') }
      : e.protocol === 'websocket'
        ? { label: 'WS', title: l10n.t('served over WebSockets') }
        : e.socketPath
          ? { label: 'WS', title: l10n.t('also served over WebSockets: open it over the socket'), action: { type: 'open' as const, endpoint: socket } }
          : undefined;
  return {
    badge,
    id: `endpoint:${componentKey(e)}:${e.verb} ${e.path} ${e.owner}`,
    label: `${e.verb.toUpperCase()} ${e.path}`,
    desc: e.kind === 'event' ? (e.description ? `${e.returns} ${e.description}` : e.returns) : e.kind === 'call' ? `${e.owner} · ${e.connection ?? ''}`.replace(/ · $/, '') : e.owner,
    tooltip: `${e.verb.toUpperCase()} ${e.path}\n${e.description ?? ''}\n${l10n.t('returns {0}', e.returns)}` + (e.params.length ? '\n' + e.params.map((p) => `${p.name}: ${p.type} (${p.in})`).join('\n') : ''),
    icon: e.kind === 'socket' ? 'ws' : e.verb.toLowerCase(),
    color: e.kind === 'socket' ? 'ws' : e.verb.toLowerCase(),
    endpoint: e,
  };
}

/** The panel an endpoint belongs to: one per component of a project (or per tag of an OpenAPI document). */
export function componentKey(e: Endpoint): string {
  return `${e.project}::${e.component}`;
}

// ---------- projects and contracts ----------

/** Every project of the workspace folders (a folder with `.nuclear/project.json`, walked a few levels deep) plus `extra` roots. */
export function findProjects(extra: string[] = []): Project[] {
  const out: Project[] = [];
  const seen = new Set<string>();
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    walk(folder.uri.fsPath, 0, (root) => {
      if (seen.has(root)) return;
      seen.add(root);
      const project = readProject(root);
      if (project) out.push(project);
    });
  }
  for (const root of extra) {
    if (seen.has(root)) continue;
    seen.add(root);
    const project = readProject(root);
    if (project) out.push(project);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function walk(dir: string, depth: number, found: (root: string) => void): void {
  if (fs.existsSync(path.join(dir, '.nuclear', 'project.json'))) found(dir);
  if (depth >= 4) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith('.')) walk(path.join(dir, e.name), depth + 1, found);
  }
}

export function readProject(root: string): Project | undefined {
  try {
    const card = JSON.parse(fs.readFileSync(path.join(root, '.nuclear', 'project.json'), 'utf8')) as { name: string; platform: string | null; dialect: string };
    let contract: Contract | undefined;
    try {
      contract = JSON.parse(fs.readFileSync(path.join(root, '.nuclear', 'contract.json'), 'utf8')) as Contract;
    } catch {
      contract = undefined;
    }
    return { root, name: card.name, platform: card.platform, dialect: card.dialect, contract, contracts: declaredContracts(root) };
  } catch {
    return undefined;
  }
}

/** `contracts(name = "source", ...)` of config.nuc, with the version of the local copy when it exists. */
export function declaredContracts(root: string): DeclaredContract[] {
  let text: string;
  try {
    text = fs.readFileSync(path.join(root, 'config.nuc'), 'utf8');
  } catch {
    return [];
  }
  const out: DeclaredContract[] = [];
  for (const section of text.matchAll(/^\s*contracts\s*\(([^)]*)\)/gm)) {
    for (const pair of section[1].matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"/g)) {
      let version: string | undefined;
      try {
        version = (JSON.parse(fs.readFileSync(path.join(root, 'contracts', pair[1], 'contract.json'), 'utf8')) as Contract).version;
      } catch {
        version = undefined;
      }
      out.push({ name: pair[1], source: pair[2], version });
    }
  }
  return out;
}

function endpointOf(project: Project, owner: string, api: Api, route: Route): Endpoint {
  const backend = project.platform === 'backend';
  const full = '/' + [api.path, route.path].map((s) => s.replace(/^\/|\/$/g, '')).filter(Boolean).join('/');
  const bodyParam = route.params.find((p) => p.in === 'body');
  return {
    project: project.name,
    kind: backend ? 'route' : 'call',
    owner,
    component: api.component || 'shared',
    verb: route.verb,
    path: full.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}'),
    description: route.description,
    params: route.params,
    returns: route.returns,
    body: bodyParam ? sampleOf(bodyParam.type, project.contract?.models ?? {}, 0) : undefined,
    connection: backend ? undefined : api.connection || undefined,
    ...socketFields(project, api),
  };
}

/** What a route its controller also serves over the app's WebSocket adds: the socket's path and the guards' headers
 * (`protocol` stays HTTP unless the controller has no HTTP). */
function socketFields(project: Project, api: Api): Partial<Endpoint> {
  const transports = transportsOf(api);
  if (!transports.has('websocket')) return {};
  return { protocol: transports.has('http') ? undefined : 'websocket', socketPath: socketPathOf(project.contract) ?? '/ws', guardHeaders: guardHeadersOf(project.contract, api) };
}

/** A sample value of a Nuclear type, from the contract's models (what a request body looks like). */
export function sampleOf(type: string, models: Record<string, Model>, depth: number): unknown {
  const t = type.replace(/\?$/, '');
  if (t.endsWith('[]')) return [sampleOf(t.slice(0, -2), models, depth + 1)];
  if (t.startsWith('<')) return {};
  switch (t) {
    case 'int':
      return 0;
    case 'double':
    case 'number':
      return 0;
    case 'string':
      return '';
    case 'boolean':
    case 'bool':
      return false;
    case 'DateTime':
      return new Date().toISOString();
  }
  const model = models[t.split('<')[0]];
  if (!model || depth > 3) return null;
  const out: Record<string, unknown> = {};
  for (const f of model.fields) {
    if (f.optional && f.default === undefined) continue;
    out[f.json ?? f.name] = f.default !== undefined ? f.default : sampleOf(f.type, models, depth + 1);
  }
  return out;
}

/** The operations of an OpenAPI document as endpoints, grouped by their first tag. */
function openApiEndpoints(source: string, doc: { paths?: Record<string, Record<string, unknown>> }): Endpoint[] {
  const out: Endpoint[] = [];
  for (const [p, ops] of Object.entries(doc.paths ?? {})) {
    for (const [verb, op] of Object.entries(ops)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(verb) || !op || typeof op !== 'object') continue;
      const o = op as { tags?: string[]; summary?: string; operationId?: string; parameters?: { name: string; in: string; required?: boolean; schema?: { type?: string } }[]; requestBody?: unknown };
      const params: Param[] = (o.parameters ?? [])
        .filter((x) => x.in === 'path' || x.in === 'query')
        .map((x) => ({ name: x.name, type: x.schema?.type ?? 'string', optional: !x.required, in: x.in as 'path' | 'query' }));
      out.push({
        project: source,
        kind: 'openapi',
        owner: o.operationId ?? '',
        component: o.tags?.[0] ?? 'default',
        verb,
        path: p,
        description: o.summary,
        params,
        returns: '',
        body: o.requestBody ? {} : undefined,
      });
    }
  }
  return out;
}



/** The `nuclear` CLI: the user's PATH, else the install folder. */
export function nuclearBinary(): string {
  const local = path.join(os.homedir(), '.local', 'bin', 'nuclear');
  return fs.existsSync(local) ? local : 'nuclear';
}

export function run(bin: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { cwd, env: process.env }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${stdout}${stderr}`.trim() || error.message));
      else resolve(`${stdout}${stderr}`);
    });
  });
}
