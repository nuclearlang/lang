// The WebSocket page of HTTP Connections: one editor tab per component (or one for the ws:// urls of the
// environment), with one inner tab per socket it talks to. A tab keeps its url, headers, the message being written,
// the messages sent before and the log of what went each way. The socket lives in the extension host (socket.ts),
// never in the webview; `{{var}}` is resolved there; closing an inner tab or the editor tab closes its socket. The
// page's state goes to the host on every change, so a panel closed by a workspace switch comes back as it was (with
// its sockets closed). Plain HTML and script, no framework.

import * as vscode from 'vscode';
import { lang, langButton, localize, pageI18n, texts, l10n } from '../../../vscode/src/i18n';
import { Endpoint, HttpModel } from './httpConnections';
import { WS } from './l10n';
import { scopedVars } from './request';
import {
  appendLog,
  badSocketUrl,
  filterLog,
  LogEntry,
  messageProblem,
  prettyMessage,
  pushHistory,
  resolveVars,
  routeMessage,
  SocketConnection,
  socketUrl,
  subscribeMessage,
  toSocketScheme,
  unsubscribeMessage,
} from './socket';

type Message =
  | { type: 'connect'; tab: string; url: string; headers: Record<string, string> }
  | { type: 'disconnect' | 'closeTab'; tab: string }
  | { type: 'send'; tab: string; text: string }
  | { type: 'state'; state: unknown }
  | { type: 'editEnvironments' | 'selectEnvironment' };

/** What the page opens: a socket tab, with the message the endpoint offers. */
export interface SocketTab {
  key: string;
  title: string;
  url: string;
  headers: [string, string][];
  description: string;
  /** The frames the endpoint offers; the first goes into the draft. */
  templates: { label: string; text: string }[];
}

export class SocketPanel {
  private static readonly open_ = new Map<string, SocketPanel>();
  private readonly panel: vscode.WebviewPanel;
  private readonly sockets = new Map<string, SocketConnection>();

  private constructor(
    context: vscode.ExtensionContext,
    private readonly model: HttpModel,
    readonly key: string,
    title: string,
  ) {
    this.panel = vscode.window.createWebviewPanel('nuclear.socketComponent', title, vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
    this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icons', 'nuc-file.svg');
    const restore = () => {
      this.environments();
      const saved = model.memory.get(key);
      if (saved) void this.panel.webview.postMessage({ type: 'restore', state: saved.state });
    };
    const localized = localize(this.panel.webview, socketPageHtml, restore);
    const listener = model.onDidChange(() => this.environments());
    this.panel.onDidDispose(() => {
      SocketPanel.open_.delete(key);
      localized.dispose();
      listener.dispose();
      for (const s of this.sockets.values()) s.close();
      this.sockets.clear();
    });
    this.panel.webview.onDidReceiveMessage((m: Message) => {
      if (m.type === 'connect') this.connect(m.tab, m.url, m.headers);
      if (m.type === 'disconnect' || m.type === 'closeTab') {
        this.sockets.get(m.tab)?.close();
        if (m.type === 'closeTab') this.sockets.delete(m.tab);
      }
      if (m.type === 'send') this.send(m.tab, m.text);
      if (m.type === 'state') model.memory.set(key, { key, title, state: m.state });
      if (m.type === 'editEnvironments') void model.editEnvironments();
      if (m.type === 'selectEnvironment') void model.selectEnvironment();
    });
    SocketPanel.open_.set(key, this);
    restore();
  }

  /** The endpoint's socket panel, created or revealed, with its socket as the active inner tab. */
  static open(context: vscode.ExtensionContext, model: HttpModel, endpoint: Endpoint): void {
    const key = `ws::${endpoint.project}::${endpoint.component}`;
    const title = endpoint.kind === 'socket' ? 'WebSockets' : `${endpoint.component} · ${endpoint.project.split('/').pop()} · WS`;
    const p = SocketPanel.open_.get(key) ?? new SocketPanel(context, model, key, title);
    p.panel.reveal(vscode.ViewColumn.Active);
    const envs = model.environments();
    void p.panel.webview.postMessage({ type: 'open', tab: socketTab(endpoint, envs.environments[envs.active]?.baseUrls ?? {}, envs.environments[envs.active]?.headers ?? {}) });
  }

  static openKeys(): string[] {
    return [...SocketPanel.open_.keys()];
  }

  /** Reopens the panel of `key` from its memory (the HTTP Connections workspace entered again). */
  static restore(context: vscode.ExtensionContext, model: HttpModel, key: string): void {
    const saved = model.memory.get(key);
    if (saved && !SocketPanel.open_.has(key)) new SocketPanel(context, model, key, saved.title);
  }

  /** The variables this panel's sockets see: its component's over its project's over the environment's. */
  private vars(): Record<string, string> {
    const envs = this.model.environments();
    const rest = this.key.slice('ws::'.length);
    const at = rest.lastIndexOf('::');
    return scopedVars(envs.environments[envs.active], at < 0 ? rest : rest.slice(0, at), at < 0 ? undefined : rest.slice(at + 2));
  }

  private environments(): void {
    const envs = this.model.environments();
    void this.panel.webview.postMessage({ type: 'environments', active: envs.active, vars: this.vars() });
  }

  private post(tab: string, entry: Omit<LogEntry, 'at'>, status?: string): void {
    void this.panel.webview.postMessage({ type: 'log', tab, entry: { at: Date.now(), ...entry }, status });
  }

  private connect(tab: string, rawUrl: string, own: Record<string, string>): void {
    const envs = this.model.environments();
    const env = envs.environments[envs.active];
    const vars = this.vars();
    const url = toSocketScheme(resolveVars(rawUrl.trim(), vars));
    const problem = badSocketUrl(url);
    if (problem) {
      const text = problem === 'variable' ? l10n.t('A variable of {0} is not in the environment {1}', url, envs.active) : problem === 'scheme' ? l10n.t('Not a ws:// or wss:// url: {0}', url) : l10n.t('Not a url: {0}', url);
      return this.post(tab, { dir: 'error', text }, 'closed');
    }
    if (!SocketConnection.available) return this.post(tab, { dir: 'error', text: l10n.t('This editor has no WebSocket client: it needs VS Code 1.101 or newer (Node 22)') }, 'closed');
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(env?.headers ?? {})) headers[k] = resolveVars(v, vars);
    for (const [k, v] of Object.entries(own)) if (k.trim()) headers[k.trim()] = resolveVars(v, vars);
    this.sockets.get(tab)?.close();
    let opened = false;
    const socket = new SocketConnection({
      open: () => {
        opened = true;
        this.post(tab, { dir: 'info', text: l10n.t('connected to {0}', url) }, 'open');
      },
      message: (text) => this.post(tab, { dir: 'in', text }),
      close: (code, reason) => {
        if (this.sockets.get(tab) === socket) this.sockets.delete(tab);
        this.post(tab, { dir: 'info', text: l10n.t('closed ({0})', `${code}${reason ? ' ' + reason : ''}`) }, 'closed');
      },
      error: (message) =>
        this.post(tab, {
          dir: 'error',
          text: message || (opened ? l10n.t('The connection failed') : l10n.t('The server refused the connection (a missing or wrong token, an Origin, a wrong path, or no server there)')),
        }),
    });
    this.sockets.set(tab, socket);
    const names = Object.keys(headers);
    this.post(tab, { dir: 'info', text: names.length ? l10n.t('connecting to {0} · headers: {1}', url, names.join(', ')) : l10n.t('connecting to {0}', url) }, 'connecting');
    socket.connect(url, headers);
  }

  private send(tab: string, text: string): void {
    const resolved = resolveVars(text, this.vars());
    if (this.sockets.get(tab)?.send(resolved)) this.post(tab, { dir: 'out', text: resolved });
    else this.post(tab, { dir: 'error', text: l10n.t('not connected: connect first') });
  }
}

/** The tab an endpoint opens: a component's socket (its backend's url and path) or a url of the environment. */
export function socketTab(e: Endpoint, baseUrls: Record<string, string>, envHeaders: Record<string, string>): SocketTab {
  if (e.kind === 'socket') return { key: e.path, title: e.path.replace(/^wss?:\/\//, ''), url: e.path, headers: [], description: '', templates: [] };
  const base = baseUrls[e.connection || ''] || baseUrls[e.project] || '{{baseUrl}}';
  const url = socketUrl(base, e.socketPath ?? '/ws');
  const sent = new Set(Object.keys(envHeaders).map((h) => h.toLowerCase()));
  const headers = (e.guardHeaders ?? []).filter(([h]) => !sent.has(h.toLowerCase()));
  const templates =
    e.kind === 'event'
      ? [
          { label: `subscribe ${e.path}`, text: subscribeMessage(e.path) },
          { label: `unsubscribe ${e.path}`, text: unsubscribeMessage(e.path) },
        ]
      : [{ label: `${e.verb.toUpperCase()} ${e.path}`, text: routeMessage(e.verb, e.path, e.body) }];
  const description = (e.guardHeaders ?? []).map(([h]) => h).join(', ');
  return { key: url, title: `${e.project.split('/').pop()} ${e.socketPath ?? '/ws'}`, url, headers, description, templates };
}

/** The page (exported so a test parses its script and a script renders it with sample data). */
export function socketPageHtml(): string {
  const nonce = Math.random().toString(36).slice(2);
  const L = texts(WS);
  return /* html */ `<!DOCTYPE html>
<html lang="${lang()}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  html, body { height: 100%; margin: 0; }
  body { display: flex; flex-direction: column; font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground); background: var(--vscode-editor-background); overflow: hidden; }
  .bar { display: flex; align-items: stretch; flex: none; min-height: 32px; background: var(--vscode-editorGroupHeader-tabsBackground); border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder, var(--vscode-widget-border, transparent)); overflow-x: auto; }
  .t { display: flex; align-items: center; gap: 6px; padding: 0 8px 0 12px; height: 32px; cursor: pointer; border-right: 1px solid var(--vscode-tab-border, transparent); white-space: nowrap; opacity: .75; font-family: var(--vscode-editor-font-family); font-size: 12px; }
  .t.on { opacity: 1; background: var(--vscode-tab-activeBackground, var(--vscode-editor-background)); box-shadow: inset 0 -1px 0 var(--vscode-tab-activeBorder, var(--vscode-focusBorder)); }
  .t .x { opacity: .5; padding: 0 2px; border-radius: 3px; } .t .x:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
  .proto { font-weight: 700; font-size: 10px; letter-spacing: .03em; color: var(--vscode-nuclearHttpConnections-component); }
  .lang { display: flex; align-items: center; padding: 0 8px; flex: none; }
  .env { margin-left: auto; display: flex; align-items: center; gap: 6px; padding: 0 10px; font-size: 11px; opacity: .8; white-space: nowrap; }
  .env a { color: var(--vscode-textLink-foreground); cursor: pointer; }
  main { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 10px 16px 8px; box-sizing: border-box; }
  #form { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
  select, input, textarea, button { font-family: var(--vscode-editor-font-family); font-size: 12px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); padding: 4px 6px; border-radius: 2px; }
  input:focus, textarea:focus, select:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
  input.url { flex: 1; min-width: 0; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; padding: 5px 12px; white-space: nowrap; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  button:disabled { opacity: .5; cursor: default; }
  button.link { background: none; color: var(--vscode-textLink-foreground); padding: 2px 4px; }
  .state { display: flex; align-items: center; gap: 6px; min-width: 104px; font-size: 11px; opacity: .9; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--vscode-disabledForeground); flex: none; }
  .dot.open { background: var(--vscode-testing-iconPassed, #73c991); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vscode-testing-iconPassed) 25%, transparent); }
  .dot.connecting { background: var(--vscode-nuclearHttpConnections-put); }
  .muted { opacity: .7; font-size: 11px; }
  .desc { margin: 0 0 6px; min-height: 1.2em; }
  .tabs { display: flex; gap: 14px; margin: 6px 0 6px; border-bottom: 1px solid var(--vscode-widget-border, transparent); }
  .tabs span { cursor: pointer; opacity: .6; padding-bottom: 4px; } .tabs span.on { opacity: 1; box-shadow: inset 0 -1px 0 var(--vscode-focusBorder); }
  .pane { display: none; } .pane.on { display: block; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 6px; }
  .chip { font-family: var(--vscode-editor-font-family); font-size: 11px; padding: 2px 8px; border-radius: 10px; cursor: pointer; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .chip:hover { filter: brightness(1.15); }
  textarea { width: 100%; box-sizing: border-box; min-height: 92px; height: 110px; resize: vertical; display: block; }
  textarea.bad { outline: 1px solid var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground)); outline-offset: -1px; }
  .problem { color: var(--vscode-errorForeground); font-size: 11px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .spacer { flex: 1; }
  table { border-collapse: collapse; width: 100%; } td { padding: 2px 4px 2px 0; } td input { width: 100%; box-sizing: border-box; }
  h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; opacity: .7; margin: 0; font-weight: 600; }
  .loghead { display: flex; gap: 8px; align-items: center; margin: 12px 0 6px; }
  .loghead input { width: 180px; }
  .log { flex: 1; min-height: 80px; overflow: auto; border: 1px solid var(--vscode-widget-border, var(--vscode-input-border, transparent)); border-radius: 3px; background: var(--vscode-textCodeBlock-background); font-family: var(--vscode-editor-font-family); font-size: 12px; }
  .m { display: grid; grid-template-columns: 92px 18px 1fr auto; gap: 0 8px; align-items: baseline; padding: 4px 10px; border-bottom: 1px solid color-mix(in srgb, var(--vscode-foreground) 8%, transparent); cursor: pointer; }
  .m:hover { background: var(--vscode-list-hoverBackground); }
  .m .time { opacity: .55; font-size: 11px; }
  .m .dir { font-weight: 700; text-align: center; }
  .m.in .dir { color: var(--vscode-nuclearHttpConnections-post); } .m.out .dir { color: var(--vscode-nuclearHttpConnections-get); }
  .m.info { opacity: .75; } .m.info .dir { opacity: .6; } .m.error .dir, .m.error .body { color: var(--vscode-errorForeground); }
  .m .body { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .m .size { opacity: .5; font-size: 11px; }
  .m.open { background: color-mix(in srgb, var(--vscode-foreground) 4%, transparent); }
  .m pre { grid-column: 3 / 5; margin: 6px 0 4px; white-space: pre-wrap; word-break: break-word; }
  .m.open .body { opacity: .4; }
  .m .copy { display: none; } .m.open .copy { display: inline; }
  .k { color: var(--vscode-nuclearHttpConnections-jsonKey, var(--vscode-debugTokenExpression-name)); } .s { color: var(--vscode-nuclearHttpConnections-jsonString, var(--vscode-debugTokenExpression-string)); } .n { color: var(--vscode-nuclearHttpConnections-jsonNumber, var(--vscode-debugTokenExpression-number)); } .b { color: var(--vscode-nuclearHttpConnections-jsonBoolean, var(--vscode-debugTokenExpression-boolean)); }
  .none { padding: 18px; text-align: center; opacity: .6; font-family: var(--vscode-font-family); font-size: 12px; }
  .empty { opacity: .7; padding: 24px 0; text-align: center; }
</style>
</head>
<body>
<div class="bar"><div id="tabsBar" style="display:flex"></div><div class="env">${L.env} <b id="envName"></b> · <a id="pickEnv">${L.change}</a> · <a id="editEnv">${L.edit}</a></div><div class="lang">${langButton()}</div></div>
<main>
  <div class="empty" id="empty">${L.empty}</div>
  <div id="form" style="display:none">
    <div class="row">
      <span class="state"><span class="dot" id="dot"></span><span id="stateText"></span></span>
      <input class="url" id="url" placeholder="${L.urlPlaceholder}" spellcheck="false">
      <button id="connect">${L.connect}</button>
    </div>
    <div class="muted desc" id="desc"></div>
    <div class="tabs"><span class="on" data-pane="message">${L.message}</span><span data-pane="headers">Headers</span></div>
    <div class="pane on" id="pane-message">
      <div class="chips" id="chips"></div>
      <textarea id="draft" placeholder="${L.messagePlaceholder}" spellcheck="false"></textarea>
      <div class="row" style="margin-top:6px">
        <select id="format"><option value="json">${L.json}</option><option value="text">${L.text}</option></select>
        <button id="send">${L.send}</button>
        <span class="problem" id="problem"></span>
        <select id="history"></select>
      </div>
    </div>
    <div class="pane" id="pane-headers">
      <table id="headers"></table>
      <div class="row" style="margin-top:4px"><button class="secondary" id="addHeader">${L.addHeader}</button><span class="muted">${L.headersHint}</span></div>
    </div>
    <div class="loghead">
      <h3>${L.messages}</h3><span class="muted" id="count"></span><span class="spacer"></span>
      <input id="filter" placeholder="${L.filter}" spellcheck="false">
      <select id="dir"><option value="all">${L.all}</option><option value="in">${L.received}</option><option value="out">${L.sent}</option></select>
      <button class="secondary" id="clear">${L.clear}</button>
    </div>
    <div class="log" id="log"></div>
  </div>
</main>
<script nonce="${nonce}">
  ${pageI18n(WS)}
  const appendLog = ${appendLog.toString()};
  const filterLog = ${filterLog.toString()};
  const prettyMessage = ${prettyMessage.toString()};
  const pushHistory = ${pushHistory.toString()};
  const messageProblem = ${messageProblem.toString()};
  const LOG_MAX = 500, HISTORY_MAX = 30;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text !== undefined) d.textContent = text; return d; };
  let envs = { active: 'local', vars: {} };
  // tabs: [{ key, title, url, headers: [[k, v]], description, templates: [{label, text}], draft, format, history, log, filter, dir, pane, status }]
  let tabs = [], active = -1, saveTimer;
  const expanded = new Set();
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { readForm(); vscode.postMessage({ type: 'state', state: { tabs, active } }); }, 150); }
  const tab = () => tabs[active];

  function readForm() {
    const tb = tab(); if (!tb) return;
    tb.url = $('url').value; tb.draft = $('draft').value; tb.format = $('format').value; tb.filter = $('filter').value; tb.dir = $('dir').value;
    tb.headers = []; for (const tr of $('headers').querySelectorAll('tr')) { const [k, v] = tr.querySelectorAll('input'); if (k) tb.headers.push([k.value, v ? v.value : '']); }
    tb.pane = document.querySelector('.tabs span.on')?.dataset.pane || 'message';
  }
  function addHeader(k, v) {
    const tr = el('tr'); const a = el('td'); a.style.width = '30%'; const ia = el('input'); ia.placeholder = t('name'); ia.value = k ?? ''; a.appendChild(ia);
    const b = el('td'); const ib = el('input'); ib.placeholder = t('value'); ib.value = v ?? ''; b.appendChild(ib); tr.append(a, b); $('headers').appendChild(tr);
  }
  function showPane(name) {
    document.querySelectorAll('.tabs span').forEach((s) => s.classList.toggle('on', s.dataset.pane === name));
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === 'pane-' + name));
  }
  function showStatus() {
    const s = tab()?.status || 'closed';
    $('dot').className = 'dot ' + s; $('stateText').textContent = t(s);
    $('connect').textContent = s === 'closed' ? t('connect') : t('disconnect');
    $('url').disabled = s !== 'closed';
    checkDraft();
  }
  function checkDraft() {
    const p = messageProblem($('draft').value, $('format').value);
    const bad = p && p !== 'empty';
    $('problem').textContent = bad ? t('invalidJson', p) : ''; $('draft').classList.toggle('bad', !!bad);
    $('send').disabled = (tab()?.status || 'closed') !== 'open' || !!p;
    return p;
  }
  function renderHistory() {
    const h = tab().history; const s = $('history'); s.innerHTML = '';
    const head = el('option', '', h.length ? t('history', h.length) : t('noHistory')); head.value = ''; s.appendChild(head);
    h.forEach((m, i) => { const o = el('option', '', m.replace(/\\s+/g, ' ').slice(0, 80)); o.value = String(i); s.appendChild(o); });
    s.disabled = !h.length;
  }
  function renderChips() {
    const c = $('chips'); c.innerHTML = ''; const ts = tab().templates;
    if (!ts.length) { c.style.display = 'none'; return; }
    c.style.display = ''; c.appendChild(el('span', 'muted', t('templates')));
    for (const tp of ts) { const b = el('span', 'chip', tp.label); b.title = tp.text; b.addEventListener('click', () => { $('draft').value = tp.text; $('format').value = 'json'; checkDraft(); save(); }); c.appendChild(b); }
  }
  // JSON with its keys, strings, numbers and literals colored (text nodes only, never HTML from the message)
  function colored(text, pre) {
    const re = /("(?:[^"\\\\]|\\\\.)*")(\\s*:)?|(-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)|\\b(true|false|null)\\b/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) pre.appendChild(document.createTextNode(text.slice(last, m.index)));
      const cls = m[1] ? (m[2] ? 'k' : 's') : m[3] ? 'n' : 'b';
      pre.appendChild(el('span', cls, m[1] || m[3] || m[4]));
      if (m[2]) pre.appendChild(document.createTextNode(m[2]));
      last = re.lastIndex;
    }
    pre.appendChild(document.createTextNode(text.slice(last)));
  }
  const ARROW = { in: '↓', out: '↑', info: '•', error: '!' };
  function time(at) { const d = new Date(at); return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0'); }
  // follow: a new message keeps the view at the end when it was there
  function renderLog(follow) {
    const t0 = tab(); const box = $('log');
    const atEnd = follow && box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
    const top = box.scrollTop;
    const shown = filterLog(t0.log, $('filter').value, $('dir').value);
    $('count').textContent = shown.length === t0.log.length ? String(t0.log.length) : t('count', shown.length, t0.log.length);
    box.innerHTML = '';
    if (!shown.length) box.appendChild(el('div', 'none', t('noMessages')));
    for (const e of shown) {
      const id = e.at + ':' + e.dir + ':' + e.text.length;
      const open = expanded.has(id);
      const d = el('div', 'm ' + e.dir + (open ? ' open' : ''));
      d.title = e.dir === 'in' ? t('received') : e.dir === 'out' ? t('sent') : '';
      d.append(el('span', 'time', time(e.at)), el('span', 'dir', ARROW[e.dir]), el('span', 'body', e.text.replace(/\\s+/g, ' ')));
      const side = el('span', 'size', e.dir === 'in' || e.dir === 'out' ? t('bytes', new TextEncoder().encode(e.text).length) : '');
      const copy = el('button', 'link copy', t('copy'));
      copy.addEventListener('click', (ev) => { ev.stopPropagation(); navigator.clipboard.writeText(e.text); });
      side.prepend(copy, document.createTextNode(' ')); d.appendChild(side);
      if (open) { const p = prettyMessage(e.text); const pre = el('pre'); if (p.json) colored(p.text, pre); else pre.textContent = p.text; d.appendChild(pre); }
      d.addEventListener('click', () => { if (getSelection().toString()) return; open ? expanded.delete(id) : expanded.add(id); renderLog(); });
      box.appendChild(d);
    }
    box.scrollTop = atEnd ? box.scrollHeight : top;
  }
  function renderTabs() {
    const bar = $('tabsBar'); bar.innerHTML = '';
    tabs.forEach((tb, i) => {
      const d = el('div', 't' + (i === active ? ' on' : ''));
      const dot = el('span', 'dot ' + (tb.status || 'closed')); d.appendChild(dot);
      d.appendChild(el('span', 'proto', 'WS'));
      d.appendChild(el('span', '', tb.title));
      const x = el('span', 'x', '×'); x.title = t('close'); x.addEventListener('click', (ev) => { ev.stopPropagation(); close(i); }); d.appendChild(x);
      d.title = tb.url; d.addEventListener('click', () => show(i)); bar.appendChild(d);
    });
  }
  function show(i) {
    if (tab()) readForm();
    active = i;
    const tb = tab();
    $('empty').style.display = tb ? 'none' : ''; $('form').style.display = tb ? '' : 'none';
    renderTabs();
    if (!tb) { save(); return; }
    $('url').value = tb.url; $('draft').value = tb.draft; $('format').value = tb.format; $('filter').value = tb.filter; $('dir').value = tb.dir;
    $('headers').innerHTML = ''; for (const [k, v] of tb.headers) addHeader(k, v);
    const vars = Object.keys(envs.vars).map((k) => '{{' + k + '}}').join(' ');
    $('desc').textContent = [tb.description ? t('guard', tb.description) : '', vars ? t('variables') + ' ' + vars : ''].filter(Boolean).join(' · ');
    renderChips(); renderHistory(); showPane(tb.pane); showStatus(); renderLog(true);
    save();
  }
  function close(i) {
    vscode.postMessage({ type: 'closeTab', tab: tabs[i].key });
    tabs.splice(i, 1);
    const next = tabs.length ? Math.min(active >= i ? active - 1 : active, tabs.length - 1) : -1;
    active = -1; show(Math.max(next, tabs.length ? 0 : -1));
  }
  function open(o) {
    let i = tabs.findIndex((x) => x.key === o.key);
    if (i < 0) {
      tabs.push({ key: o.key, title: o.title, url: o.url, headers: o.headers, description: o.description, templates: [], draft: '', format: 'json', history: [], log: [], filter: '', dir: 'all', pane: 'message', status: 'closed' });
      i = tabs.length - 1;
    }
    if (o.templates.length) {
      const tb = tabs[i];
      for (const tp of o.templates) if (!tb.templates.some((x) => x.label === tp.label)) tb.templates.push(tp);
      if (active === i) readForm();
      tb.draft = o.templates[0].text; tb.format = 'json'; tb.pane = 'message';
      if (active === i) active = -1;
    }
    show(i);
  }
  window.addEventListener('message', (ev) => {
    const m = ev.data;
    if (m.type === 'environments') { envs = m; $('envName').textContent = m.active; if (tab()) show(active); }
    if (m.type === 'open') open(m.tab);
    if (m.type === 'restore' && m.state && m.state.tabs) {
      tabs = m.state.tabs.map((x) => ({ ...x, status: 'closed' })); active = -1;
      show(m.state.active >= 0 && m.state.active < tabs.length ? m.state.active : tabs.length ? 0 : -1);
    }
    if (m.type === 'log') {
      const tb = tabs.find((x) => x.key === m.tab); if (!tb) return;
      tb.log = appendLog(tb.log, m.entry, LOG_MAX);
      if (m.status) tb.status = m.status;
      if (tb === tab()) { renderLog(true); if (m.status) { showStatus(); renderTabs(); } } else if (m.status) renderTabs();
      save();
    }
  });
  document.addEventListener('input', (ev) => { if (ev.target.id === 'draft') checkDraft(); if (ev.target.id === 'filter') renderLog(); save(); });
  document.addEventListener('change', (ev) => { if (ev.target.id === 'format') checkDraft(); if (ev.target.id === 'dir') renderLog(); save(); });
  document.querySelectorAll('.tabs span').forEach((s) => s.addEventListener('click', () => { showPane(s.dataset.pane); save(); }));
  $('addHeader').addEventListener('click', () => { addHeader('', ''); save(); });
  $('editEnv').addEventListener('click', () => vscode.postMessage({ type: 'editEnvironments' }));
  $('pickEnv').addEventListener('click', () => vscode.postMessage({ type: 'selectEnvironment' }));
  $('connect').addEventListener('click', () => {
    readForm(); const tb = tab();
    if (tb.status === 'closed') { tb.status = 'connecting'; vscode.postMessage({ type: 'connect', tab: tb.key, url: tb.url, headers: Object.fromEntries(tb.headers.filter(([k]) => k.trim())) }); }
    else vscode.postMessage({ type: 'disconnect', tab: tb.key });
    showStatus(); renderTabs();
  });
  function sendDraft() {
    readForm(); const tb = tab();
    if (tb.status !== 'open' || checkDraft()) return;
    vscode.postMessage({ type: 'send', tab: tb.key, text: tb.draft });
    tb.history = pushHistory(tb.history, tb.draft, HISTORY_MAX); renderHistory(); save();
  }
  $('send').addEventListener('click', sendDraft);
  $('draft').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); sendDraft(); } });
  $('history').addEventListener('change', () => { const i = $('history').value; if (i !== '') { $('draft').value = tab().history[+i]; $('format').value = prettyMessage($('draft').value).json ? 'json' : 'text'; checkDraft(); } $('history').value = ''; save(); });
  $('clear').addEventListener('click', () => { tab().log = []; expanded.clear(); renderLog(); save(); });
</script>
</body>
</html>`;
}
