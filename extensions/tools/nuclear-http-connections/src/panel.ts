// A component of the HTTP Connections workspace (ADR-extensions-0002): one editor tab per component (like a Bruno folder), with one inner
// tab per endpoint opened from the tree; each inner tab keeps its request (method, url with path and query
// parameters, header rows, body, auth, post-response rules) and its last response. Requests and OAuth token requests
// are sent by the extension host (fetch), with `{{var}}` resolved by scope (component, project, environment); the
// host also writes the variables a response gives (rules, tokens, "save as variable") to http.json: the webview never
// writes a file. Its state is sent to the host on every change, so a panel closed by a workspace switch comes back as
// it was. The page is plain HTML and script, no framework, with a strict CSP (a nonce): its script is requestScript.ts and
// its pure helpers request.ts's, inlined by their source; its colors are the theme's and the `nuclearHttpConnections.*`
// ones of the extension, so it reads in light, dark and the Chernobyl themes.

import * as vscode from 'vscode';
import { lang, langButton, localize, pageI18n, texts } from '../../../vscode/src/i18n';
import { ICONS } from './icons';
import { HTTP } from './l10n';
import { httpSettings } from './settings';
import { componentKey, Endpoint, HttpModel } from './httpConnections';
import { SocketPanel } from './socketPanel';
import { requestPage } from './requestScript';
import {
  applyAuth,
  defaultHeaders,
  formatJson,
  jsonProblem,
  mergeHeaderRows,
  migrateForm,
  pathOf,
  tokenizeJson,
  tokenizeMarkup,
  Auth,
  autoTokenUpdates,
  editScope,
  Environment,
  oauthTokenRequest,
  parseTokenResponse,
  referencedVars,
  Rule,
  runRules,
  ScopeEdit,
  ScopeName,
  scopedVars,
  scopeOf,
  setVariable,
  variableScope,
} from './request';
import { resolveVars } from './socket';

interface RequestMessage {
  type: 'send';
  tab: string;
  method: string;
  url: string;
  /** The enabled rows of the Headers tab, raw (`{{var}}` resolved here). */
  headers: [string, string][];
  body: string;
  auth?: Auth;
  rules?: Rule[];
}
/** A variable the host changed, with the value it had (undefined: none), so the page can undo it. */
interface Change {
  name: string;
  scope: ScopeName;
  previous?: string;
  auto?: boolean;
}
type Message =
  | RequestMessage
  | { type: 'cancel'; tab: string }
  | { type: 'state'; state: unknown }
  | { type: 'editEnvironments' | 'selectEnvironment' }
  | { type: 'activateEnvironment'; name: string }
  | { type: 'envEdit'; scope: ScopeName; edit: ScopeEdit }
  | { type: 'saveVar'; name: string; value: string; scope: ScopeName }
  | { type: 'undo'; changes: Change[] }
  | { type: 'oauthToken'; tab: string; auth: Auth };

export class ComponentPanel {
  private static readonly open_ = new Map<string, ComponentPanel>();
  private readonly panel: vscode.WebviewPanel;
  /** The project and component of this panel's endpoints: the scopes of their variables. */
  private readonly project: string;
  private readonly component: string;
  private readonly inFlight = new Map<string, AbortController>();

  private constructor(
    context: vscode.ExtensionContext,
    private readonly model: HttpModel,
    readonly key: string,
    title: string,
  ) {
    this.panel = vscode.window.createWebviewPanel('nuclear.httpComponent', title, vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
    this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icons', 'nuc-file.svg');
    const at = key.lastIndexOf('::');
    this.project = key.slice(0, at);
    this.component = key.slice(at + 2);
    const restore = () => {
      this.environments();
      const saved = model.memory.get(key);
      if (saved) void this.panel.webview.postMessage({ type: 'restore', state: saved.state });
    };
    const localized = localize(this.panel.webview, requestPageHtml, restore);
    const listener = model.onDidChange(() => this.environments());
    this.panel.onDidDispose(() => {
      ComponentPanel.open_.delete(key);
      localized.dispose();
      listener.dispose();
      for (const c of this.inFlight.values()) c.abort();
    });
    this.panel.webview.onDidReceiveMessage((m: Message) => {
      if (m.type === 'send') void this.send(m);
      if (m.type === 'cancel') this.inFlight.get(m.tab)?.abort();
      if (m.type === 'state') model.memory.set(key, { key, title, state: m.state });
      if (m.type === 'editEnvironments') void model.editEnvironments();
      if (m.type === 'selectEnvironment') void model.selectEnvironment();
      if (m.type === 'activateEnvironment') model.activateEnvironment(m.name);
      if (m.type === 'envEdit') this.change((env) => void editScope(env, m.scope, this.project, this.component, m.edit));
      if (m.type === 'saveVar') this.setVars([{ name: m.name, value: m.value, scope: m.scope }]);
      if (m.type === 'undo') this.change((env) => m.changes.forEach((c) => setVariable(env, c.scope, this.project, this.component, c.name, c.previous)));
      if (m.type === 'oauthToken') void this.oauthToken(m.tab, m.auth);
    });
    ComponentPanel.open_.set(key, this);
    restore();
  }

  /** The endpoint's component panel, created or revealed, with the endpoint as its active inner tab. */
  static open(context: vscode.ExtensionContext, model: HttpModel, endpoint: Endpoint): void {
    const key = componentKey(endpoint);
    const title = `${endpoint.component} · ${endpoint.kind === 'openapi' ? 'OpenAPI' : endpoint.project.split('/').pop()}`;
    const p = ComponentPanel.open_.get(key) ?? new ComponentPanel(context, model, key, title);
    p.panel.reveal(vscode.ViewColumn.Active);
    void p.panel.webview.postMessage({ type: 'open', endpoint });
  }

  /** The keys of the open panels, the WebSocket ones (`ws::…`) too. */
  static openKeys(): string[] {
    return [...ComponentPanel.open_.keys(), ...SocketPanel.openKeys()];
  }

  /** Reopens the panels of `keys` from their memory (the HTTP Connections workspace entered again). */
  static restore(context: vscode.ExtensionContext, model: HttpModel, keys: string[]): void {
    for (const key of keys) {
      if (key.startsWith('ws::')) {
        SocketPanel.restore(context, model, key);
        continue;
      }
      const saved = model.memory.get(key);
      if (saved && !ComponentPanel.open_.has(key)) new ComponentPanel(context, model, key, saved.title);
    }
  }

  private environments(): void {
    const envs = this.model.environments();
    const env = envs.environments[envs.active];
    const scopes = {
      global: env ? scopeOf(env, 'global') : { vars: {}, headers: {}, secrets: [] },
      project: (env && scopeOf(env, 'project', this.project)) ?? { vars: {}, headers: {}, secrets: [] },
      component: (env && scopeOf(env, 'component', this.project, this.component)) ?? { vars: {}, headers: {}, secrets: [] },
    };
    const vars = scopedVars(env, this.project, this.component);
    const origins = Object.fromEntries(Object.keys(vars).map((n) => [n, variableScope(env, n, this.project, this.component)]));
    void this.panel.webview.postMessage({
      type: 'environments',
      active: envs.active,
      names: Object.keys(envs.environments),
      vars,
      origins,
      scopes,
      baseUrls: env?.baseUrls ?? {},
      projectLabel: this.project.split('/').pop(),
      component: this.component,
    });
  }

  /** Changes the active environment with `f` and writes it; the panels hear it through the model. */
  private change(f: (env: Environment) => void): void {
    const envs = this.model.environments();
    const env = envs.environments[envs.active];
    if (!env) return;
    f(env);
    this.model.saveEnvironments(envs);
  }

  /** Sets variables (a rule, a token, "save as variable"); `scope` absent: where the variable is already defined,
   * else the project. Tells the page, which offers to undo it. */
  private setVars(sets: { name: string; value: string; scope?: ScopeName; auto?: boolean }[], missing: string[] = []): void {
    const changes: Change[] = [];
    this.change((env) => {
      for (const v of sets) {
        const scope = v.scope ?? variableScope(env, v.name, this.project, this.component) ?? 'project';
        const previous = setVariable(env, scope, this.project, this.component, v.name, v.value);
        if (previous !== v.value) changes.push({ name: v.name, scope, previous, auto: v.auto });
      }
    });
    void this.panel.webview.postMessage({ type: 'saved', changes, missing });
  }

  private resolver(): (s: string) => string {
    const envs = this.model.environments();
    const vars = scopedVars(envs.environments[envs.active], this.project, this.component);
    return (s: string) => resolveVars(s, vars);
  }

  private async send(m: RequestMessage): Promise<void> {
    const resolve = this.resolver();
    const raw = applyAuth(m.auth, m.headers, m.url, resolve);
    const url = resolve(raw.url);
    const headers: Record<string, string> = {};
    for (const [k, v] of raw.headers) if (k.trim()) headers[k.trim()] = resolve(v);
    const body = m.body.trim() ? resolve(m.body) : undefined;
    if (body !== undefined && !Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) headers['content-type'] = 'application/json';
    const started = Date.now();
    const abort = new AbortController();
    this.inFlight.get(m.tab)?.abort();
    this.inFlight.set(m.tab, abort);
    let timedOut = false;
    const timer = setTimeout(() => ((timedOut = true), abort.abort()), httpSettings().timeoutMs);
    try {
      const res = await fetch(url, { method: m.method, headers, body, signal: abort.signal });
      const text = await res.text();
      const resHeaders = Object.fromEntries(res.headers.entries());
      void this.panel.webview.postMessage({
        type: 'response',
        tab: m.tab,
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        ms: Date.now() - started,
        size: Buffer.byteLength(text),
        headers: resHeaders,
        body: text,
        url,
      });
      this.afterResponse(m, res.ok, text, resHeaders);
    } catch (e) {
      const cancelled = abort.signal.aborted && !timedOut;
      // the page words a timeout and a cancel in its language; any other error is the system's own text
      void this.panel.webview.postMessage({ type: 'response', tab: m.tab, error: String(e), cancelled, timeout: timedOut ? httpSettings().timeoutMs / 1000 : undefined, ms: Date.now() - started, url });
    } finally {
      clearTimeout(timer);
      if (this.inFlight.get(m.tab) === abort) this.inFlight.delete(m.tab);
    }
  }

  /** The post-response rules, then (a 2xx JSON answer) the tokens that fill the token variables the request used. */
  private afterResponse(m: RequestMessage, ok: boolean, text: string, headers: Record<string, string>): void {
    const { set, missing } = runRulesSafe(m.rules ?? [], text, headers);
    const sets: { name: string; value: string; scope?: ScopeName; auto?: boolean }[] = [...set];
    if (ok) {
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
      const a = m.auth;
      const used = referencedVars([...m.headers.map(([, v]) => v), a?.type === 'bearer' ? a.token : undefined, a?.type === 'apikey' ? a.value : undefined]);
      for (const u of autoTokenUpdates(json, used)) if (!sets.some((s) => s.name === u.name)) sets.push({ name: u.name, value: u.value, auto: true });
    }
    if (sets.length || missing.length) this.setVars(sets, missing);
  }

  /** OAuth 2.0 (client credentials or password): the token url answers, the access token goes into its variable. */
  private async oauthToken(tab: string, auth: Auth): Promise<void> {
    const req = oauthTokenRequest(auth, this.resolver());
    const post = (o: Record<string, unknown>) => void this.panel.webview.postMessage({ type: 'oauth', tab, ...o });
    if ('problem' in req) return post({ ok: false, problem: req.problem });
    try {
      const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body, signal: AbortSignal.timeout(httpSettings().timeoutMs) });
      const got = parseTokenResponse(await res.text(), Date.now());
      if (!got.accessToken) return post({ ok: false, error: `${res.status} ${got.error ?? ''}`.trim() });
      const name = (auth.tokenVar ?? '').trim() || 'accessToken';
      const sets: { name: string; value: string; auto: boolean }[] = [{ name, value: got.accessToken, auto: true }];
      if (got.refreshToken) sets.push({ name: 'refreshToken', value: got.refreshToken, auto: true });
      this.setVars(sets);
      post({ ok: true, expiresAt: got.expiresAt });
    } catch (e) {
      post({ ok: false, error: String(e) });
    }
  }
}

/** The rules, never failing the response (a rule of an older state may lack fields). */
function runRulesSafe(rules: Rule[], text: string, headers: Record<string, string>) {
  try {
    return runRules(rules.filter((r) => r && typeof r.name === 'string' && typeof r.path === 'string'), text, headers);
  } catch {
    return { set: [], missing: [] };
  }
}

// ---------- the page ----------

const helpers = { defaultHeaders, formatJson, jsonProblem, mergeHeaderRows, migrateForm, pathOf, tokenizeJson, tokenizeMarkup };

const CSS = /* css */ `
  :root {
    --c-get: var(--vscode-nuclearHttpConnections-get); --c-post: var(--vscode-nuclearHttpConnections-post);
    --c-put: var(--vscode-nuclearHttpConnections-put); --c-patch: var(--vscode-nuclearHttpConnections-patch);
    --c-delete: var(--vscode-nuclearHttpConnections-delete); --c-platform: var(--vscode-nuclearHttpConnections-platform);
    --c-project: var(--vscode-nuclearHttpConnections-project); --c-component: var(--vscode-nuclearHttpConnections-component);
    --tk-k: var(--vscode-nuclearHttpConnections-jsonKey, var(--vscode-debugTokenExpression-name, var(--vscode-symbolIcon-propertyForeground)));
    --tk-s: var(--vscode-nuclearHttpConnections-jsonString, var(--vscode-debugTokenExpression-string, var(--vscode-symbolIcon-stringForeground)));
    --tk-n: var(--vscode-nuclearHttpConnections-jsonNumber, var(--vscode-debugTokenExpression-number, var(--vscode-symbolIcon-numberForeground)));
    --tk-b: var(--vscode-nuclearHttpConnections-jsonBoolean, var(--vscode-debugTokenExpression-boolean, var(--vscode-symbolIcon-booleanForeground)));
    --tk-z: var(--vscode-nuclearHttpConnections-jsonNull, var(--vscode-debugTokenExpression-value, var(--vscode-symbolIcon-nullForeground)));
    --tk-p: var(--vscode-nuclearHttpConnections-jsonPunctuation, var(--vscode-descriptionForeground));
    --tk-t: var(--vscode-nuclearHttpConnections-markupTag, var(--vscode-symbolIcon-keywordForeground));
    --tk-a: var(--vscode-nuclearHttpConnections-markupAttribute, var(--vscode-symbolIcon-propertyForeground));
    --line: var(--vscode-widget-border, color-mix(in srgb, var(--vscode-foreground) 14%, transparent));
    --soft: color-mix(in srgb, var(--vscode-foreground) 5%, transparent);
    --mono: var(--vscode-editor-font-family); --radius: 6px;
    --ok: var(--vscode-testing-iconPassed, var(--c-get));
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { display: flex; flex-direction: column; font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground); background: var(--vscode-editor-background); overflow: hidden; }
  body.dragging { cursor: col-resize; user-select: none; }
  [hidden] { display: none !important; }
  .ico { display: inline-flex; flex: none; } .ico svg { display: block; }
  button { font: inherit; font-size: 12px; color: inherit; background: none; border: 1px solid transparent; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; white-space: nowrap; }
  button:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground); }
  button:disabled { opacity: .45; cursor: default; }
  :focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
  button.icon { padding: 3px; opacity: .75; } button.icon:hover { opacity: 1; } button.icon.on { opacity: 1; color: var(--c-put); }
  button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); padding: 5px 12px; font-weight: 600; }
  button.primary:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button.secondary:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }
  button.link { color: var(--vscode-textLink-foreground); padding: 2px 4px; }
  input, select, textarea { font-family: var(--mono); font-size: 12px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--line)); padding: 4px 7px; border-radius: 4px; min-width: 0; }
  input:focus, select:focus, textarea:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
  input.bad { outline: 1px solid var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground)); }
  input.k, .k { color: var(--tk-k); } input.s { color: var(--vscode-input-foreground); } input.v, .v { color: var(--c-platform); }
  kbd { font-family: var(--mono); font-size: 10px; padding: 1px 5px; border-radius: 3px; border: 1px solid var(--line); opacity: .75; }

  /* the bar: the endpoints' tabs and the tools */
  .bar { display: flex; align-items: stretch; flex: none; min-height: 34px; background: var(--vscode-editorGroupHeader-tabsBackground); border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder, var(--line)); }
  #tabsBar { display: flex; overflow-x: auto; min-width: 0; flex: 1; scrollbar-width: thin; }
  .t { display: flex; align-items: center; gap: 6px; padding: 0 4px 0 12px; height: 34px; cursor: pointer; border-right: 1px solid var(--vscode-tab-border, transparent); white-space: nowrap; color: var(--vscode-tab-inactiveForeground); font-family: var(--mono); font-size: 12px; }
  .t.on { color: var(--vscode-tab-activeForeground); background: var(--vscode-tab-activeBackground, var(--vscode-editor-background)); box-shadow: inset 0 -2px 0 var(--vscode-tab-activeBorderTop, var(--vscode-focusBorder)); }
  .t .x { opacity: 0; padding: 2px; } .t:hover .x, .t.on .x, .t:focus-visible .x { opacity: .6; } .t .x:hover { opacity: 1; }
  .tpath { max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
  .tools { display: flex; align-items: center; gap: 4px; padding: 0 8px; flex: none; }
  .envpick { display: flex; align-items: center; gap: 4px; color: var(--c-platform); }
  .envpick select { color: var(--vscode-foreground); padding: 2px 4px; max-width: 140px; }
  #varsBtn { color: var(--c-platform); } #varsBtn .count { color: var(--vscode-foreground); }
  .count { font-size: 10px; font-weight: 600; min-width: 16px; padding: 0 5px; border-radius: 8px; text-align: center; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); line-height: 16px; }

  .verb { font-family: var(--mono); font-weight: 700; font-size: 11px; letter-spacing: .02em; }
  .verb.get { color: var(--c-get); } .verb.post { color: var(--c-post); } .verb.put { color: var(--c-put); } .verb.patch { color: var(--c-patch); } .verb.delete { color: var(--c-delete); } .verb.head, .verb.options, .verb.event, .verb.ws { color: var(--c-component); }
  .spin { width: 10px; height: 10px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: spin .8s linear infinite; opacity: .7; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }

  main { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .empty { margin: auto; max-width: 420px; text-align: center; opacity: .75; line-height: 1.6; padding: 24px; }
  .empty .ico { justify-content: center; color: var(--c-platform); margin-bottom: 8px; } .empty .ico svg { width: 36px; height: 36px; }
  #work { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 10px 14px 10px; gap: 8px; }

  /* where you are */
  .crumbs { display: flex; align-items: center; gap: 6px; font-size: 12px; min-width: 0; flex-wrap: wrap; }
  .crumb { display: inline-flex; align-items: center; gap: 5px; }
  .c-project { color: var(--c-project); } .c-component { color: var(--c-component); } .c-endpoint { font-family: var(--mono); color: var(--vscode-foreground); gap: 6px; }
  .sep { opacity: .4; }
  .desc { opacity: .7; font-size: 12px; margin-left: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 120px; }

  /* the request line */
  .reqline { display: flex; gap: 0; align-items: stretch; }
  .method { border-radius: var(--radius) 0 0 var(--radius); font-weight: 700; padding: 6px 8px; border-right: none; }
  .method option { color: var(--vscode-foreground); }
  .urlbox { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  #url { border-radius: 0; padding: 6px 10px; font-size: 13px; width: 100%; }
  #send { border-radius: 0 var(--radius) var(--radius) 0; padding: 6px 14px; }
  #send.busy { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  #send kbd { border-color: color-mix(in srgb, currentColor 40%, transparent); }
  .preview { font-family: var(--mono); font-size: 11px; opacity: .85; padding: 3px 10px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .preview .arrow { opacity: .5; } .var.ok { color: var(--tk-s); } .var.missing { color: var(--vscode-errorForeground); text-decoration: underline wavy; }

  /* request | response */
  .split { flex: 1; min-height: 0; display: flex; gap: 0; }
  .split[data-layout="rows"] { flex-direction: column; }
  @media (max-width: 860px) { .split[data-layout="auto"] { flex-direction: column; } }
  .box { min-width: 0; min-height: 0; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--radius); background: color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-foreground) 2%); overflow: hidden; }
  #reqBox { flex: 0 0 50%; } #resBox { flex: 1 1 0; }
  .gutter { flex: none; width: 10px; cursor: col-resize; display: flex; align-items: center; justify-content: center; }
  .gutter::after { content: ''; width: 2px; height: 32px; border-radius: 2px; background: var(--line); }
  .gutter:hover::after, .gutter:focus-visible::after { background: var(--vscode-focusBorder); }
  .split[data-layout="rows"] .gutter { width: auto; height: 10px; cursor: row-resize; } .split[data-layout="rows"] .gutter::after { width: 32px; height: 2px; }
  @media (max-width: 860px) { .split[data-layout="auto"] .gutter { width: auto; height: 10px; cursor: row-resize; } .split[data-layout="auto"] .gutter::after { width: 32px; height: 2px; } }

  .seg { display: flex; align-items: center; gap: 2px; padding: 4px 6px 0; border-bottom: 1px solid var(--line); flex: none; overflow-x: auto; scrollbar-width: none; }
  .seg [role="tab"], .seg-b { border-radius: 4px 4px 0 0; padding: 6px 10px; opacity: .7; border-bottom: 2px solid transparent; margin-bottom: -1px; }
  .seg [role="tab"].on, .seg-b.on { opacity: 1; border-bottom-color: var(--vscode-focusBorder); }
  .seg .count[hidden] { display: none; }
  .tp-params .ico { color: var(--c-component); } .tp-headers .ico { color: var(--c-project); } .tp-body .ico { color: var(--c-patch); } .tp-auth .ico { color: var(--c-put); } .tp-rules .ico { color: var(--c-post); }
  .rpane { flex: 1; min-height: 0; overflow: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
  h4 { display: flex; align-items: center; gap: 6px; margin: 2px 0 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; opacity: .7; }
  .hint { margin: 0; font-size: 12px; opacity: .7; line-height: 1.5; }
  table.grid { border-collapse: separate; border-spacing: 0; width: 100%; }
  table.grid th { text-align: left; font-weight: 600; font-size: 11px; opacity: .6; padding: 2px 6px 4px; }
  table.grid td { padding: 2px 3px; vertical-align: middle; }
  table.grid td input:not([type="checkbox"]), table.grid td select { width: 100%; }
  table.grid tr.off input:not([type="checkbox"]) { opacity: .45; text-decoration: line-through; }
  td.chk, th.chk { width: 24px; text-align: center; } td.act { width: 1%; white-space: nowrap; text-align: right; }
  td.pname { width: 34%; font-family: var(--mono); font-size: 12px; } .ptype { opacity: .55; margin-left: 6px; font-size: 11px; }
  td.none { opacity: .55; font-size: 12px; padding: 8px 6px; }
  .cellwrap { display: flex; align-items: center; gap: 4px; position: relative; } .cellwrap input { flex: 1; }
  .src { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; padding: 1px 6px 1px 4px; border-radius: 9px; white-space: nowrap; border: 1px solid color-mix(in srgb, currentColor 35%, transparent); background: color-mix(in srgb, currentColor 10%, transparent); }
  .src .ico svg { width: 11px; height: 11px; }
  .src.edited { border-style: dashed; }
  .src-code { color: var(--c-get); } .src-body { color: var(--c-patch); } .src-global { color: var(--c-platform); } .src-project { color: var(--c-project); } .src-component { color: var(--c-component); }
  .row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .spacer { flex: 1; }

  /* the body editor: a textarea over its highlighted copy */
  .code-edit { position: relative; flex: 1; min-height: 160px; border: 1px solid var(--vscode-input-border, var(--line)); border-radius: 4px; background: var(--vscode-input-background); overflow: hidden; }
  .code-edit.bad { border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground)); }
  .code-edit pre, .code-edit textarea { position: absolute; inset: 0; margin: 0; padding: 8px 10px; font-family: var(--mono); font-size: 12px; line-height: 1.55; white-space: pre; overflow: auto; tab-size: 2; border: 0; border-radius: 0; width: 100%; height: 100%; }
  .code-edit pre { pointer-events: none; color: var(--vscode-input-foreground); }
  .code-edit textarea { background: transparent; color: transparent; caret-color: var(--vscode-editorCursor-foreground, var(--vscode-foreground)); resize: none; outline: none; }
  .code-edit textarea::selection { background: var(--vscode-editor-selectionBackground); color: transparent; }
  .code-edit.plain textarea { color: var(--vscode-input-foreground); } .code-edit.plain pre { display: none; }
  .problem { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--vscode-errorForeground); }
  .bad-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .field { display: grid; grid-template-columns: 150px 1fr; align-items: center; gap: 8px; } .flabel { font-size: 12px; opacity: .8; }
  @media (max-width: 520px) { .field { grid-template-columns: 1fr; gap: 2px; } }
  .inherit-row { font-family: var(--mono); font-size: 12px; display: flex; gap: 2px; align-items: center; } .inherit-row .src { margin-left: 8px; }
  .auth-fields { display: flex; flex-direction: column; gap: 8px; }
  .oauth-row { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
  .oauth-state { font-size: 12px; } .oauth-state.ok { color: var(--ok); } .oauth-state.fail { color: var(--vscode-errorForeground); }

  /* the response */
  .res-head { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--line); flex: none; min-width: 0; }
  .res-title { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--c-get); }
  .res-title span:last-child { color: var(--vscode-foreground); }
  .status { font-family: var(--mono); font-weight: 700; font-size: 12px; padding: 2px 8px; border-radius: 10px; }
  .status.s2 { color: var(--ok); background: color-mix(in srgb, var(--ok) 16%, transparent); }
  .status.s3 { color: var(--c-post); background: color-mix(in srgb, var(--c-post) 16%, transparent); }
  .status.s4 { color: var(--c-put); background: color-mix(in srgb, var(--c-put) 18%, transparent); }
  .status.s5, .status.s0 { color: var(--vscode-errorForeground); background: color-mix(in srgb, var(--vscode-errorForeground) 16%, transparent); }
  .meta { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; opacity: .75; font-family: var(--mono); }
  .res-head .seg { border: none; padding: 0; margin-left: auto; min-width: 0; }
  @media (max-width: 1100px) { .res-title span:last-child, .meta[title] .ico { display: none; } }
  .res-head .seg-b { border-radius: 4px; border-bottom: none; padding: 3px 8px; margin: 0; } .res-head .seg-b.on { background: var(--soft); box-shadow: inset 0 -2px 0 var(--vscode-focusBorder); }
  .res-head > * { flex: none; white-space: nowrap; } .res-head > .seg { flex: 0 1 auto; }
  .kind { font-size: 10px; font-weight: 700; opacity: .5; padding: 0 4px; letter-spacing: .05em; }
  .tree-tools { display: flex; gap: 2px; padding: 4px 8px 0; flex: none; }
  .res-body { flex: 1; min-height: 0; overflow: auto; position: relative; }
  .res-body.dim { opacity: .45; }
  .res-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; opacity: .55; padding: 20px; text-align: center; }
  .res-empty .big svg { width: 34px; height: 34px; color: var(--c-get); }
  .res-error { padding: 14px; color: var(--vscode-errorForeground); } .res-error pre { white-space: pre-wrap; font-family: var(--mono); font-size: 12px; margin: 8px 0 0; }
  pre.code { margin: 0; padding: 10px 12px; font-family: var(--mono); font-size: 12px; line-height: 1.55; white-space: pre; } pre.code.wrap { white-space: pre-wrap; word-break: break-word; }
  .preview-frame { border: 0; width: 100%; height: 100%; background: #fff; display: block; }
  table.kv { border-collapse: collapse; width: 100%; font-family: var(--mono); font-size: 12px; }
  table.kv td { padding: 4px 10px; border-bottom: 1px solid var(--soft); vertical-align: top; word-break: break-word; } table.kv td.k { width: 32%; } table.kv td.s { color: var(--tk-s); }
  table.kv td.act { opacity: 0; } table.kv tr:hover td.act, table.kv tr:focus-within td.act { opacity: 1; }

  /* the JSON tree */
  .jtree { font-family: var(--mono); font-size: 12px; line-height: 1.6; padding: 6px 0 10px; }
  .jr > span { white-space: pre; }
  .jr { display: flex; align-items: center; gap: 0; padding-right: 8px; cursor: default; white-space: nowrap; min-height: 20px; }
  .jr:hover { background: var(--vscode-list-hoverBackground); } .jr:focus-visible { background: var(--vscode-list-focusBackground, var(--vscode-list-hoverBackground)); }
  .jn[aria-expanded] > .jr { cursor: pointer; }
  .tw { width: 16px; display: inline-flex; justify-content: center; opacity: .6; transition: transform .1s; } .tw.leaf { visibility: hidden; }
  .jn[aria-expanded="true"] > .jr > .tw { transform: rotate(90deg); }
  .tw svg { width: 12px; height: 12px; }
  .cnt { margin-left: 8px; font-size: 10px; opacity: .5; font-family: var(--vscode-font-family); }
  .val { overflow: hidden; text-overflow: ellipsis; max-width: 70ch; }
  .acts { display: inline-flex; gap: 0; margin-left: 10px; opacity: 0; } .jr:hover .acts, .jr:focus-within .acts { opacity: 1; }
  .acts button { padding: 1px 3px; } .acts svg { width: 13px; height: 13px; }
  .ell { opacity: .6; padding: 0 2px; }
  .tk-k { color: var(--tk-k); } .tk-s { color: var(--tk-s); } .tk-n { color: var(--tk-n); } .tk-b { color: var(--tk-b); } .tk-z { color: var(--tk-z); font-style: italic; }
  .tk-p { color: var(--tk-p); } .tk-v { color: var(--c-platform); font-weight: 600; } .tk-t { color: var(--tk-t); } .tk-a { color: var(--tk-a); } .tk-c { color: var(--vscode-descriptionForeground); font-style: italic; }
  .tk-idx { color: var(--tk-n); opacity: .7; }

  /* the variables drawer */
  .drawer { position: fixed; top: 34px; right: 0; bottom: 0; width: min(560px, 100vw); z-index: 20; display: flex; flex-direction: column; background: var(--vscode-sideBar-background, var(--vscode-editorWidget-background)); border-left: 1px solid var(--line); box-shadow: -8px 0 24px #0004; }
  .dhead { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--line); }
  .dhead .ico { color: var(--c-platform); } .dhead h2 { margin: 0; font-size: 13px; font-weight: 600; } .dhead .envname { font-family: var(--mono); font-size: 12px; opacity: .7; }
  .scope-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 10px 12px 4px; }
  .scope-tab { border: 1px solid var(--line); border-radius: var(--radius); padding: 6px 8px; justify-content: flex-start; text-align: left; min-width: 0; }
  .scope-tab.on { background: var(--soft); border-color: currentColor; }
  .scope-global { color: var(--c-platform); } .scope-project { color: var(--c-project); } .scope-component { color: var(--c-component); }
  .stext { display: flex; flex-direction: column; min-width: 0; flex: 1; } .sname { font-weight: 600; } .sof { font-size: 11px; color: var(--vscode-foreground); opacity: .7; overflow: hidden; text-overflow: ellipsis; font-family: var(--mono); }
  .dbody { flex: 1; overflow: auto; padding: 6px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
  .dfoot { display: flex; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--line); align-items: center; font-size: 12px; }
  .peek { position: absolute; right: 4px; }

  /* the save-as-variable dialog and the notices */
  .pop { position: fixed; z-index: 30; width: 320px; padding: 12px; border-radius: var(--radius); background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-editorWidget-border, var(--line)); box-shadow: 0 6px 24px #0006; display: flex; flex-direction: column; gap: 8px; }
  .pop h3 { margin: 0; font-size: 12px; display: flex; align-items: center; gap: 6px; color: var(--c-platform); } .pop h3 span:last-child { color: var(--vscode-foreground); }
  .pop .dvalue { font-family: var(--mono); font-size: 11px; color: var(--tk-s); background: var(--soft); padding: 4px 6px; border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pop label { display: flex; align-items: center; gap: 6px; font-size: 12px; }
  .toasts { position: fixed; right: 14px; bottom: 14px; z-index: 40; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; pointer-events: none; }
  .toast { pointer-events: auto; display: flex; align-items: center; gap: 8px; padding: 7px 8px 7px 10px; border-radius: var(--radius); font-size: 12px; max-width: min(520px, 90vw); background: var(--vscode-notifications-background, var(--vscode-editorWidget-background)); color: var(--vscode-notifications-foreground, var(--vscode-foreground)); border: 1px solid var(--vscode-notifications-border, var(--line)); box-shadow: 0 4px 16px #0005; }
  .toast.ok > .ico { color: var(--c-platform); } .toast.fail > .ico { color: var(--vscode-errorForeground); } .toast.info > .ico { color: var(--c-get); }
`;

/** The page (exported so a test parses its script and a script renders it with sample data). */
export function requestPageHtml(): string {
  const nonce = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('');
  const L = texts(HTTP);
  const I = ICONS;
  const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
  const fns = Object.entries(helpers).map(([k, f]) => `${k}: ${f.toString()}`).join(',\n');
  const tabBtn = (pane: string, icon: string, label: string) =>
    `<button type="button" role="tab" class="tp-${pane}" data-pane="${pane}" aria-controls="p-${pane}">${I[icon as keyof typeof I]}<span>${label}</span><span class="count" hidden></span></button>`;
  return /* html */ `<!DOCTYPE html>
<html lang="${lang()}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-src 'self' about:; script-src 'nonce-${nonce}';">
<style>${CSS}</style>
</head>
<body>
<header class="bar"> <div id="tabsBar" role="tablist" aria-label="${L.endpoints}"></div> <div class="tools"> <label class="envpick" title="${L.envTitle}">${I.env}<select id="envSelect" aria-label="${L.envTitle}"></select></label> <button type="button" id="varsBtn" aria-expanded="false" aria-controls="drawer" title="${L.varsTitle}">${I.vars}<span>${L.variables}</span><span class="count" id="varsCount">0</span></button> <button type="button" class="icon" id="layoutBtn"><span class="ico">${I.columns}</span></button> ${langButton()} </div> </header>
<main>
  <div class="empty" id="empty"><span class="ico">${I.send}</span>${L.empty}</div>
  <div id="work" hidden>
    <nav class="crumbs" aria-label="${L.where}"><span id="crumbs" class="crumbs"></span><span class="desc" id="desc"></span></nav>
    <div class="reqline">
      <select id="method" class="method" aria-label="${L.method}"></select>
      <div class="urlbox"><input id="url" placeholder="${L.urlPlaceholder}" spellcheck="false" aria-label="URL"><div class="preview" id="urlPreview" hidden></div></div>
      <button type="button" class="primary" id="send" title="${L.sendTitle}">${I.send}<span class="label">${L.send}</span><kbd>⌃↵</kbd></button>
    </div>
    <div class="split" id="split" data-layout="auto">
      <section class="box" id="reqBox" aria-label="${L.request}">
        <div class="seg" role="tablist" id="reqTabs" aria-label="${L.request}">
          ${tabBtn('params', 'params', L.params)}${tabBtn('headers', 'headers', 'Headers')}${tabBtn('body', 'body', 'Body')}${tabBtn('auth', 'auth', L.auth)}${tabBtn('rules', 'rules', L.rules)}
        </div>
        <div class="rpane" id="p-params" role="tabpanel">
          <h4>${I.params}Path</h4><table class="grid" id="pathParams"></table>
          <h4>${I.params}Query</h4><table class="grid" id="queryParams"></table>
        </div>
        <div class="rpane" id="p-headers" role="tabpanel" hidden>
          <table class="grid" id="headers"></table>
          <div class="row"><button type="button" class="secondary" id="addHeader">${I.plus}<span>${L.addHeader}</span></button><button type="button" class="link" id="restoreHeaders">${I.restore}<span>${L.restoreDefaults}</span></button><span class="spacer"></span><span class="hint">${L.headersHint}</span></div>
        </div>
        <div class="rpane" id="p-body" role="tabpanel" hidden>
          <div class="row">
            <select id="bodyMode" aria-label="${L.bodyMode}"><option value="json">JSON</option><option value="text">${L.text}</option></select>
            <button type="button" class="secondary" id="format" title="${L.formatTitle}">${I.format}<span>${L.format}</span></button>
            <span class="problem" id="bodyProblem" role="alert" hidden></span>
          </div>
          <div class="code-edit" id="bodyEdit"><pre id="bodyHl" aria-hidden="true"></pre><textarea id="body" spellcheck="false" placeholder="${L.bodyPlaceholder}" aria-label="Body"></textarea></div>
        </div>
        <div class="rpane" id="p-auth" role="tabpanel" hidden>
          <label class="field"><span class="flabel">${L.authType}</span><select id="authType">
            <option value="inherit">${L['auth.inherit']}</option><option value="none">${L['auth.none']}</option><option value="bearer">${L['auth.bearer']}</option><option value="basic">${L['auth.basic']}</option><option value="apikey">${L['auth.apikey']}</option><option value="oauth2">${L['auth.oauth2']}</option>
          </select></label>
          <div id="authFields" class="auth-fields"></div>
        </div>
        <div class="rpane" id="p-rules" role="tabpanel" hidden>
          <p class="hint">${L.rulesHint}</p>
          <table class="grid" id="rules"></table>
          <div class="row"><button type="button" class="secondary" id="addRule">${I.plus}<span>${L.addRule}</span></button><span class="spacer"></span><span class="hint">${I.bolt} ${L.autoTokenHint}</span></div>
        </div>
      </section>
      <div class="gutter" id="gutter" role="separator" tabindex="0" aria-label="${L.resize}"></div>
      <section class="box" id="resBox" aria-label="${L.response}">
        <div class="res-head">
          <span class="res-title">${I.response}<span>${L.response}</span></span>
          <span class="status" id="status" role="status" hidden></span>
          <span class="meta" id="resTime" hidden title="${L.time}">${I.clock}<span></span></span>
          <span class="meta" id="resSize" hidden title="${L.size}">${I.size}<span></span></span>
          <div class="seg" role="tablist" id="resViews" aria-label="${L.views}"></div>
          <button type="button" class="icon" id="copyBody" title="${L.copyBody}" aria-label="${L.copyBody}" hidden>${I.copy}</button>
          <button type="button" class="icon" id="copyCurl" title="${L.copyCurl}" aria-label="${L.copyCurl}">${I.raw}</button>
        </div>
        <div class="tree-tools" id="treeTools" hidden>
          <button type="button" class="link" id="expandAll">${I.expand}<span>${L.expandAll}</span></button>
          <button type="button" class="link" id="collapseAll">${I.collapse}<span>${L.collapseAll}</span></button>
        </div>
        <div class="res-body" id="resBody"></div>
      </section>
    </div>
  </div>
</main>
<aside class="drawer" id="drawer" role="dialog" aria-label="${L.variables}" hidden>
  <div class="dhead">${I.vars}<h2>${L.variables}</h2><span class="envname" id="drawerEnv"></span><span class="spacer"></span>
    <button type="button" class="icon" id="drawerClose" title="${L.close}" aria-label="${L.close}">${I.close}</button></div>
  <div class="scope-tabs" role="tablist" id="scopeTabs" aria-label="${L.scopes}"></div>
  <div class="dbody">
    <p class="hint" id="scopeHint"></p>
    <h4>${I.vars}${L.variables}</h4>
    <table class="grid" id="dVars"></table>
    <div class="row"><button type="button" class="secondary" id="addVar">${I.plus}<span>${L.addVar}</span></button></div>
    <h4>${I.headers}Headers</h4>
    <table class="grid" id="dHeaders"></table>
    <div class="row"><button type="button" class="secondary" id="addEnvHeader">${I.plus}<span>${L.addHeader}</span></button></div>
  </div>
  <div class="dfoot"><span class="hint">${L.order}</span><span class="spacer"></span><button type="button" class="link" id="editJson">${I.raw}<span>${L.editJson}</span></button></div>
</aside>
<div class="pop" id="dialog" role="dialog" aria-label="${L.saveAsVar}" hidden>
  <h3>${I.save}<span>${L.saveAsVar}</span></h3>
  <div class="dvalue" id="dlgValue"></div>
  <label class="field"><span class="flabel">${L.name}</span><input id="dlgName" class="v" spellcheck="false"></label>
  <label class="field"><span class="flabel">${L['rules.scope']}</span><select id="dlgScope"><option value="component">${L['scope.component']}</option><option value="project">${L['scope.project']}</option><option value="global">${L['scope.global']}</option></select></label>
  <label><input type="checkbox" id="dlgRule"><span id="dlgRuleText"></span></label>
  <div class="row"><span class="spacer"></span><button type="button" class="secondary" id="dlgCancel">${L.cancel}</button><button type="button" class="primary" id="dlgSave">${L.save}</button></div>
</div>
<div class="toasts" id="toasts" aria-live="polite"></div>
<script nonce="${nonce}">
${pageI18n(HTTP)}
(${requestPage.toString()})({ t, vscode }, {
${fns}
}, ${json(ICONS)});
</script>
</body>
</html>`;
}
