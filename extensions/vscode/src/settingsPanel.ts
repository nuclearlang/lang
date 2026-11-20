// The Settings and integrations tool (Ctrl+Alt+S): every setting of the platform, one section per tool (spec 011,
// settings by component), the same sections as VS Code's settings. *AI services*: the Smart Graph with its state and
// Start / Restart (the local models are on standby, ADR-platform-0013: no Developer, no Ollama, no local model), the
// MCP server in Claude Code, Codex, Cursor and OpenCode, the connections
// (the graph's clients and pending access requests, Jira, GitHub), the retries (`nuclear.ai.*`, aiSettings.ts). The
// Builder (its default team and the squad screen), the spending, Nuclear Atlas, HTTP Connections, the devices and the
// language are drawn from their contributed settings (settingsForm.ts). The welcome can be run again from here.
// Plain HTML and script, no framework; its texts are settingsL10n.ts.
import { ChildProcess, execFile, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { aiSettings, JIRA_SECRET, jiraAuth, serviceEnv } from './aiSettings';
import { builder, builderJson, readMachine } from './aiMachine';
import { checkAll } from './connections';
import { notices } from './notifications';
import { lang, localize, pageI18n, l10n } from './i18n';
import { SETTINGS } from './settingsL10n';
import { applySetting, FORM_CSS, FORM_JS, settingSections } from './settingsForm';
import { CommandMissing, listTeams } from '../../tools/nuclear-builder/src/teams/cli';
import { chatGifKey } from './chatView';
import { TeamsPanel } from '../../tools/nuclear-builder/src/teams/panel';
import { handleToolchain, TC_CSS, TC_JS, TC_TEXTS, toolchainState } from './toolchainHost';

type Message =
  | { type: 'ready' }
  | { type: 'set'; key: string; value: unknown }
  | { type: 'start'; service: 'graph' }
  | { type: 'mcp'; client: 'claude' | 'codex' | 'cursor' | 'opencode' }
  | { type: 'allow' | 'deny'; id: string }
  | { type: 'revoke'; client: string }
  | { type: 'connectMcp' }
  | { type: 'setSetting'; key: string; value: unknown }
  | { type: 'jira' | 'jiraOff' | 'openSettings' | 'setup' | 'teams' | 'gifKey' };

const own = new Map<string, ChildProcess>(); // services started from the editor

function run(cmd: string, args: string[], cwd?: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout: 20000, env: serviceEnv() }, (e, stdout, stderr) => resolve({ code: e ? (typeof e.code === 'number' ? e.code : 1) : 0, out: `${stdout}${stderr}` }));
  });
}

/** Claude Code on this machine: missing, or whether the Nuclear MCP server is added to it. The Builder asks it too. */
export async function claudeMcpState(): Promise<'not installed' | 'added' | 'not added'> {
  const cmd = vscode.workspace.getConfiguration('nuclear.ai').get('claude.command', 'claude');
  if ((await run('sh', ['-c', 'command -v "$1"', 'sh', cmd])).code !== 0) return 'not installed';
  return (await run(cmd, ['mcp', 'get', 'nuclear'])).code === 0 ? 'added' : 'not added';
}

/** `claude mcp add --scope user nuclear -- nuclear-mcp`, with the commands of the settings. */
export async function addClaudeMcp(): Promise<void> {
  const args = ['mcp', 'add', '--scope', 'user', 'nuclear', '--', aiSettings().mcpCommand];
  const cmd = vscode.workspace.getConfiguration('nuclear.ai').get('claude.command', 'claude');
  const r = await run(cmd, args);
  if (r.code !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${r.out.trim()}`);
}

async function up(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return r.status < 500;
  } catch {
    return false;
  }
}

export class SettingsPanel {
  private static current: SettingsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  private constructor(private readonly context: vscode.ExtensionContext) {
    this.panel = vscode.window.createWebviewPanel('nuclear.settings', l10n.t('Settings and integrations'), vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
    this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icons', 'nuc-file.svg');
    const localized = localize(this.panel.webview, () => html(this.panel.webview));
    this.panel.onDidDispose(() => {
      SettingsPanel.current = undefined;
      localized.dispose();
      notices.watch('settings', false);
    });
    this.panel.onDidChangeViewState((e) => notices.watch('settings', e.webviewPanel.visible && e.webviewPanel.active));
    this.panel.webview.onDidReceiveMessage((m: Message) => void this.receive(m).catch((e) => void vscode.window.showErrorMessage(l10n.t('Nuclear settings: {0}', e instanceof Error ? e.message : String(e)))));
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('nuclear') && void this.state()));
  }

  /** The page, on a section (`language`, `toolchains`, `ai`, `builder`, `spending`, `chat`, `atlas`, `http`, `devices`). */
  static show(context: vscode.ExtensionContext, section?: string): void {
    const p = SettingsPanel.current ?? (SettingsPanel.current = new SettingsPanel(context));
    p.panel.reveal(vscode.ViewColumn.Active);
    notices.watch('settings', true);
    if (section) p.post({ type: 'section', id: section });
    void p.state();
  }

  static close(): void {
    SettingsPanel.current?.panel.dispose();
  }

  /** Stops the services the editor started (on deactivation). */
  static stopServices(): void {
    for (const p of own.values()) p.kill();
    own.clear();
  }

  private post(m: unknown): void {
    void this.panel.webview.postMessage(m);
  }

  private async mcpState(): Promise<Record<string, string>> {
    const has = async (cmd: string) => (await run('sh', ['-c', 'command -v "$1"', 'sh', cmd])).code === 0;
    const out: Record<string, string> = {};
    out.claude = await claudeMcpState();
    out.codex = !(await has('codex')) ? 'not installed' : /\bnuclear\b/.test((await run('codex', ['mcp', 'list'])).out) ? 'added' : 'not added';
    const c = vscode.workspace.getConfiguration('nuclear.ai');
    const home = (f: string) => f.replace(/^~(?=\/|$)/, os.homedir());
    const cursor = home(c.get('cursor.mcpFile', '~/.cursor/mcp.json'));
    try {
      out.cursor = (JSON.parse(fs.readFileSync(cursor, 'utf8')) as { mcpServers?: Record<string, unknown> }).mcpServers?.nuclear ? 'added' : 'not added';
    } catch {
      out.cursor = fs.existsSync(path.join(os.homedir(), '.cursor')) ? 'not added' : 'not installed';
    }
    const oc = home(c.get('opencode.configFile', '~/.config/opencode/opencode.json'));
    try {
      out.opencode = (JSON.parse(fs.readFileSync(oc, 'utf8')) as { mcp?: Record<string, unknown> }).mcp?.nuclear ? 'added' : 'not added';
    } catch {
      out.opencode = (await has(c.get('opencode.command', 'opencode'))) ? 'not added' : 'not installed';
    }
    return out;
  }

  private async state(): Promise<void> {
    const s = aiSettings();
    const access = await run(s.graphCommand, ['requests']);
    let graphAccess: { requests: Record<string, { client: string; scopes: string[]; reason: string; status: string }>; clients: Record<string, { scopes: string[] }> } | null = null;
    try {
      graphAccess = JSON.parse(access.out.slice(access.out.indexOf('{')));
    } catch {
      graphAccess = null;
    }
    const c = vscode.workspace.getConfiguration('nuclear.ai');
    const integrations = {
      claude: { command: c.get('claude.command', 'claude') },
      codex: { enabled: c.get('codex.enabled', false), command: c.get('codex.command', 'codex') },
      opencode: { enabled: c.get('opencode.enabled', false), command: c.get('opencode.command', 'opencode'), configFile: c.get('opencode.configFile', '~/.config/opencode/opencode.json') },
      cursor: { mcpFile: c.get('cursor.mcpFile', '~/.cursor/mcp.json') },
      github: { command: c.get('github.command', 'gh') },
      jira: { site: c.get('jira.site', ''), email: c.get('jira.email', ''), criteriaField: c.get('jira.criteriaField', '') },
      watch: { callTimeoutMinutes: c.get('watch.callTimeoutMinutes', 15) },
      checkEveryMinutes: c.get('checkEveryMinutes', 5),
    };
    const [checks, graph, mcp, gh, machine] = await Promise.all([
      checkAll(this.context),
      up(s.graphUrl + '/v1/health'),
      this.mcpState(),
      run('gh', ['auth', 'status']),
      builderJson<{ atLogin: boolean }>(['--status', '--json']),
    ]);
    // the Builder's teams, from nuclear-builder (a missing command is said on the page, not as an error)
    const teams = await listTeams().then((list) => ({ list, missing: '' }), (e: unknown) => ({ list: [], missing: e instanceof CommandMissing ? l10n.t('This nuclear-builder has no teams yet: update NuclearLang.') : e instanceof Error ? e.message : String(e) }));
    this.post({
      type: 'state',
      settings: s,
      services: { graph, own: [...own.keys()], atLogin: machine?.atLogin ?? false },
      profile: readMachine().NUCLEAR_AI_PROFILE ?? '',
      mcp,
      graphAccess,
      jira: !!(await this.context.secrets.get(JIRA_SECRET)),
      github: gh.code === 0,
      checks,
      integrations,
      sections: settingSections(this.context),
      teams,
      toolchains: await toolchainState(),
    });
  }

  private async receive(m: Message): Promise<void> {
    if (await handleToolchain(m as { type: string }, () => void this.state())) return;
    switch (m.type) {
      case 'ready':
        return this.state();
      case 'set':
        await vscode.workspace.getConfiguration('nuclear.ai').update(m.key, m.value, vscode.ConfigurationTarget.Global);
        return; // onDidChangeConfiguration redraws
      case 'setSetting':
        return applySetting(this.context, m.key, m.value);
      case 'teams':
        return TeamsPanel.show(this.context);
      case 'gifKey':
        return chatGifKey();
      case 'start':
        return this.start(m.service);
      case 'mcp':
        return this.addMcp(m.client);
      case 'connectMcp': {
        const r = await run(aiSettings().graphCommand, ['connect', 'mcp', '--scopes', 'read,write']);
        void vscode.window.showInformationMessage(r.out.trim() || l10n.t('done'));
        return this.state();
      }
      case 'allow':
      case 'deny': {
        const r = await run(aiSettings().graphCommand, [m.type, m.id]);
        void vscode.window.showInformationMessage(r.out.trim());
        return this.state();
      }
      case 'revoke': {
        const revoke = l10n.t('Revoke');
        const ok = await vscode.window.showWarningMessage(l10n.t("Take the graph's access away from '{0}'?", m.client), { modal: true }, revoke);
        if (ok !== revoke) return;
        await run(aiSettings().graphCommand, ['revoke', m.client]);
        return this.state();
      }
      case 'jira':
        await jiraAuth(this.context, true);
        return this.state();
      case 'jiraOff':
        await this.context.secrets.delete(JIRA_SECRET);
        return this.state();
      case 'openSettings':
        await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:nuclearlang.nuclearlang');
        return;
      case 'setup':
        await vscode.commands.executeCommand('nuclear.ai.setup');
        return;
    }
  }

  /** Starts (or restarts, when the editor started it) the Smart Graph. */
  private async start(service: 'graph'): Promise<void> {
    const s = aiSettings();
    const [cmd, args, url] = [s.graphCommand, ['serve'], s.graphUrl + '/v1/health'];
    // the service the set-up left in this system (ADR-installer-0002): the system's manager starts it again
    if (!own.has(service) && (await builder(['setup', '--restart', service])).code === 0) {
      for (let i = 0; i < 40 && !(await up(url)); i++) await new Promise((r) => setTimeout(r, 500));
      return this.state();
    }
    const mine = own.get(service);
    if (mine) {
      mine.kill();
      own.delete(service);
      await new Promise((r) => setTimeout(r, 800));
    } else if (await up(url)) {
      void vscode.window.showWarningMessage(l10n.t('The {0} is already running, started outside the editor: stop it there to restart it with these settings.', 'Smart Graph'));
      return;
    }
    if ((await run('sh', ['-c', 'command -v "$1"', 'sh', cmd])).code !== 0) {
      const go = await vscode.window.showErrorMessage(l10n.t('{0} is not installed.', cmd), l10n.t('Set up the AI services'));
      if (go) await vscode.commands.executeCommand('nuclear.ai.setup');
      return;
    }
    const p = spawn(cmd, args, { env: serviceEnv(), stdio: 'ignore' });
    own.set(service, p);
    p.on('exit', () => {
      if (own.get(service) === p) own.delete(service);
      void this.state();
    });
    for (let i = 0; i < 20 && !(await up(url)); i++) await new Promise((r) => setTimeout(r, 500));
    return this.state();
  }

  private async addMcp(client: 'claude' | 'codex' | 'cursor' | 'opencode'): Promise<void> {
    const cmd = aiSettings().mcpCommand;
    const c = vscode.workspace.getConfiguration('nuclear.ai');
    const home = (f: string) => f.replace(/^~(?=\/|$)/, os.homedir());
    if (client === 'opencode') {
      // OpenCode reads its MCP servers from the `mcp` table of its config: a local command
      const file = home(c.get('opencode.configFile', '~/.config/opencode/opencode.json'));
      let json: { mcp?: Record<string, unknown> } = {};
      try {
        json = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        if (fs.existsSync(file)) throw new Error(l10n.t('{0} is not valid JSON: fix it first', file));
      }
      json.mcp = { ...(json.mcp ?? {}), nuclear: { type: 'local', command: [cmd], enabled: true } };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
    } else if (client === 'cursor') {
      const file = home(c.get('cursor.mcpFile', '~/.cursor/mcp.json'));
      let json: { mcpServers?: Record<string, unknown> } = {};
      try {
        json = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        if (fs.existsSync(file)) throw new Error(l10n.t('{0} is not valid JSON: fix it first', file));
      }
      json.mcpServers = { ...(json.mcpServers ?? {}), nuclear: { command: cmd, args: [] } };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
    } else if (client === 'claude') {
      await addClaudeMcp();
    } else {
      const args = ['mcp', 'add', 'nuclear', '--', cmd];
      const r = await run(c.get('codex.command', 'codex'), args);
      if (r.code !== 0) throw new Error(`codex ${args.join(' ')}: ${r.out.trim()}`);
    }
    void vscode.window.showInformationMessage(l10n.t('The Nuclear MCP server is in {0}.', { claude: 'Claude Code', codex: 'Codex', cursor: 'Cursor', opencode: 'OpenCode' }[client]));
    return this.state();
  }
}

export function html(webview: vscode.Webview): string {
  const nonce = Math.random().toString(36).slice(2);
  return `<!doctype html><html lang="${lang()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  body { margin: 0; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  .page { display: grid; grid-template-columns: 220px minmax(0, 980px); gap: 28px; padding: 16px 28px 40px; }
  nav { position: sticky; top: 16px; align-self: start; display: flex; flex-direction: column; gap: 2px; }
  nav a { padding: 7px 10px; border-radius: 6px; cursor: pointer; color: var(--vscode-foreground); text-decoration: none; border-left: 2px solid transparent; }
  nav a:hover { background: var(--vscode-list-hoverBackground); } nav a.sel { background: var(--vscode-list-activeSelectionBackground, #8883); color: var(--vscode-list-activeSelectionForeground, inherit); border-left-color: var(--vscode-focusBorder); font-weight: 600; }
  nav .sep { height: 1px; background: var(--vscode-panel-border); margin: 8px 0; }
  h1 { font-size: 20px; margin: 4px 0 2px; } h2 { font-size: 14px; margin: 26px 0 8px; text-transform: uppercase; letter-spacing: .05em; opacity: .8; }
  .muted { opacity: .65; } .grid { display: grid; grid-template-columns: 220px 1fr; gap: 8px 16px; align-items: center; }
  input, select, button { font: inherit; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; padding: 3px 8px; }
  button { cursor: pointer; } button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; }
  input { width: 100%; box-sizing: border-box; } input[type=number] { width: 120px; }
  .card { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 10px 14px; margin-bottom: 8px; display: flex; gap: 12px; align-items: center; }
  .card .grow { flex: 1; } .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  .on { background: #16a34a; } .off { background: #b91c1c; }
  table { border-collapse: collapse; width: 100%; } td, th { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--vscode-panel-border); }
  .over { color: var(--vscode-errorForeground); } .badge { font-size: 11px; padding: 1px 6px; border-radius: 8px; border: 1px solid var(--vscode-panel-border); }
  .hero { display: flex; gap: 14px; align-items: center; padding: 14px 16px; border-radius: 10px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background, #8881); margin: 10px 0 6px; }
  .hero .grow { flex: 1; } .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  ${FORM_CSS}
  ${TC_CSS}
</style></head><body>
<div class="page"><nav id="nav"></nav><div><div id="head"></div><div id="root">…</div></div></div>
<script nonce="${nonce}">
${pageI18n(SETTINGS, TC_TEXTS)}
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
${FORM_JS}
${TC_JS}
const SECTIONS = ['language', 'toolchains', 'ai', 'builder', 'spending', 'chat', 'atlas', 'http', 'devices'];
// the section shown survives a re-render (a change of language)
let S = null, section = vscode.getState()?.section ?? 'ai';
function field(key, label, value, help, type) {
  return '<label>' + esc(label) + '<div class="muted">' + esc(help) + '</div></label><input data-key="' + key + '" type="' + (type || 'text') + '" value="' + esc(value) + '">';
}
function service(id, name, on, what, startable) {
  return '<div class="card"><span class="dot ' + (on ? 'on' : 'off') + '"></span><div class="grow"><b>' + esc(name) + '</b> <span class="muted">' + esc(what) + '</span></div>' + (startable ? '<button data-start="' + id + '">' + esc(S.services.own.includes(id) || (S.services.atLogin && on) ? t('restart') : on ? t('running') : t('start')) + '</button>' : '') + '</div>';
}
const sectionOf = (id) => (S.sections || []).find((s) => s.id === id);
function drawNav() {
  document.getElementById('nav').innerHTML = SECTIONS.map((id) => '<a data-section="' + id + '" class="' + (id === section ? 'sel' : '') + '" tabindex="0">' + esc(sectionOf(id)?.title ?? t('nav.' + id)) + '</a>').join('')
    + '<div class="sep"></div><a data-act="setup" tabindex="0">↻ ' + esc(t('runWelcome')) + '</a><a id="openSettings" tabindex="0">' + esc(t('vsSettings')) + '</a>';
  document.getElementById('head').innerHTML = '<div class="head"><h1>' + esc(t('title')) + '</h1>' + langButton() + '</div><div class="muted">' + esc(t('intro')) + '</div>';
}
function drawAi() {
  const s = S.settings;
  const access = S.graphAccess;
  const mcpName = { claude: 'Claude Code', codex: 'Codex', cursor: 'Cursor', opencode: 'OpenCode' };
  const I = S.integrations;
  const check = (c) => '<div class="card"><span class="dot ' + (c.ok ? 'on' : 'off') + '"></span><div class="grow"><b>' + esc(c.name) + '</b> <span class="muted">' + esc(c.detail) + '</span></div></div>';
  const toggle = (key, label, value, help) => '<label>' + esc(label) + '<div class="muted">' + esc(help) + '</div></label><div><input type="checkbox" data-key="' + key + '"' + (value ? ' checked' : '') + ' style="width:auto"></div>';
  return '<h2>' + esc(t('checkedNow')) + '</h2><div class="muted">' + esc(t('checkedNowHint', I.checkEveryMinutes)) + '</div>'
    + S.checks.map(check).join('')
    + '<h2>' + esc(t('services')) + '</h2><div class="muted" style="margin-bottom:8px">' + (S.profile ? esc(t('profile', S.profile)) + (S.services.atLogin ? esc(t('atLogin')) : '') + '. ' : esc(t('notSetUp')) + ' ') + '<button data-act="setup">' + esc(t('setUp')) + '</button></div>'
    + service('graph', 'Nuclear Smart Graph', S.services.graph, s.graphUrl + ' · ' + t('graphWhat'), true)
    + '<div class="grid">' + field('graphUrl', t('graphUrl'), s.graphUrl, 'nuclear-graph serve') + '</div>'
    + '<h2>' + esc(t('mcp')) + '</h2><div class="muted">' + esc(t('mcpHint', s.mcpCommand)) + '</div>'
    + Object.keys(mcpName).map((c) => '<div class="card"><span class="dot ' + (S.mcp[c] === 'added' ? 'on' : 'off') + '"></span><div class="grow"><b>' + mcpName[c] + '</b> <span class="muted">' + esc(t('mcp.' + S.mcp[c])) + '</span></div>' + (S.mcp[c] === 'not added' ? '<button class="primary" data-mcp="' + c + '">' + esc(t('add')) + '</button>' : '') + '</div>').join('')
    + '<div class="grid">' + field('mcpCommand', t('mcpCommand'), s.mcpCommand, t('mcpCommandHint')) + field('graphCommand', t('graphCommand'), s.graphCommand, t('graphCommandHint')) + '</div>'
    + '<h2>' + esc(t('connections')) + '</h2>'
    + '<div class="card"><div class="grow"><b>' + esc(t('graphClients')) + '</b> <span class="muted">' + esc(t('graphClientsHint')) + '</span></div>' + (access && !access.clients.mcp ? '<button data-act="connectMcp">' + esc(t('allowMcp')) + '</button>' : '') + '</div>'
    + (access ? '<table>' + Object.entries(access.clients).map(([name, c]) => '<tr><td>' + esc(name) + '</td><td>' + esc(c.scopes.join(', ')) + '</td><td><button data-revoke="' + esc(name) + '">' + esc(t('revoke')) + '</button></td></tr>').join('')
      + Object.entries(access.requests).filter(([, r]) => r.status === 'pending').map(([id, r]) => '<tr><td>' + esc(t('asks', r.client)) + '</td><td>' + esc(r.scopes.join(', ')) + ' · ' + esc(r.reason) + '</td><td><button class="primary" data-allow="' + esc(id) + '">' + esc(t('allow')) + '</button> <button data-deny="' + esc(id) + '">' + esc(t('deny')) + '</button></td></tr>').join('') + '</table>' : '<p class="muted">' + esc(t('accessUnreadable')) + '</p>')
    + '<div class="card"><span class="dot ' + (S.jira ? 'on' : 'off') + '"></span><div class="grow"><b>Jira</b> <span class="muted">' + esc(t('jiraHint')) + '</span></div><button data-act="jira">' + esc(S.jira ? t('change') : t('connect')) + '</button>' + (S.jira ? '<button data-act="jiraOff">' + esc(t('disconnect')) + '</button>' : '') + '</div>'
    + '<div class="card"><span class="dot ' + (S.github ? 'on' : 'off') + '"></span><div class="grow"><b>GitHub</b> <span class="muted">' + esc(S.github ? t('ghIn') : t('ghOut')) + '</span></div></div>'
    + '<h2>' + esc(t('integrations')) + '</h2><div class="grid">'
    + field('claude.command', t('claudeCommand'), I.claude.command, t('claudeCommandHint'))
    + toggle('codex.enabled', 'Codex', I.codex.enabled, t('useHint')) + field('codex.command', t('codexCommand'), I.codex.command, '')
    + toggle('opencode.enabled', 'OpenCode', I.opencode.enabled, t('useHint')) + field('opencode.command', t('opencodeCommand'), I.opencode.command, '') + field('opencode.configFile', t('opencodeFile'), I.opencode.configFile, t('mcpFileHint'))
    + field('cursor.mcpFile', t('cursorFile'), I.cursor.mcpFile, t('mcpFileHint'))
    + field('github.command', t('ghCommand'), I.github.command, t('ghCommandHint'))
    + field('jira.site', t('jiraSite'), I.jira.site, t('jiraSiteHint')) + field('jira.email', t('jiraEmail'), I.jira.email, t('jiraEmailHint')) + field('jira.criteriaField', t('jiraField'), I.jira.criteriaField, t('jiraFieldHint'))
    + '</div>'
    + '<h2>' + esc(t('whenFails')) + '</h2><div class="grid">'
    + field('watch.callTimeoutMinutes', t('callTimeout'), I.watch.callTimeoutMinutes, t('callTimeoutHint'), 'number')
    + field('checkEveryMinutes', t('checkEvery'), I.checkEveryMinutes, t('checkEveryHint'), 'number')
    + field('retry.attempts', t('tries'), s.retry.attempts, t('triesHint'), 'number')
    + field('retry.baseMs', t('firstWait'), s.retry.baseMs, t('firstWaitHint'), 'number')
    + field('retry.maxMs', t('longestWait'), s.retry.maxMs, t('longestWaitHint'), 'number')
    + '</div>';
}
function drawBuilder() {
  const sec = sectionOf('builder'), team = sec?.items.find((i) => i.key === 'nuclear.builder.team');
  const T0 = S.teams;
  const opts = '<option value="">' + esc(t('teamOnboarding')) + '</option>' + T0.list.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === team?.value ? ' selected' : '') + '>' + esc(x.name) + (x.default ? ' ★' : '') + '</option>').join('');
  return '<div class="hero"><div style="font-family:var(--vscode-editor-font-family,monospace);font-size:11px;letter-spacing:.12em;border:1px solid currentColor;padding:6px 8px">TEAMS</div><div class="grow"><b>' + esc(t('squadTitle')) + '</b><div class="muted">' + esc(T0.missing || t('squadHint')) + '</div></div><button class="primary" data-act="teams">' + esc(t('openSquad')) + '</button></div>'
    + '<div class="sf"><div class="sf-row"><label class="sf-l"><b>team</b><code>nuclear.builder.team</code><div class="sf-d">' + esc(team?.description ?? '') + '</div></label><div class="sf-i"><select data-setting="nuclear.builder.team" data-t="string"' + (T0.missing ? ' disabled' : '') + '>' + opts + '</select></div></div></div>'
    + settingsForm(sec, ['nuclear.builder.team']);
}
function drawSpending() {
  return '<div class="hero"><div style="font-size:28px">💰</div><div class="grow"><b>' + esc(t('spendTitle')) + '</b><div class="muted">' + esc(t('spendHint')) + '</div></div></div>' + settingsForm(sectionOf('spending'));
}
function drawChat() {
  return '<div class="hero"><div style="font-size:28px">💬</div><div class="grow"><b>' + esc(t('chatTitle')) + '</b><div class="muted">' + esc(t('chatHint')) + '</div></div><button data-act="gifKey">' + esc(t('gifKey')) + '</button></div>' + settingsForm(sectionOf('chat'));
}
function drawToolchains() {
  return '<div class="hero"><div style="font-size:28px">🧰</div><div class="grow"><b>' + esc(t('tc.title')) + '</b><div class="muted">' + esc(t('tc.intro')) + '</div></div><button data-tc="tcCheck">↻ ' + esc(t('tc.check')) + '</button></div>'
    + toolchainCards(S.toolchains, false) + settingsForm(sectionOf('toolchains'));
}
function draw() {
  drawNav();
  const sec = sectionOf(section);
  document.getElementById('root').innerHTML = section === 'ai' ? drawAi() : section === 'builder' ? drawBuilder() : section === 'spending' ? drawSpending() : section === 'chat' ? drawChat() : section === 'toolchains' ? drawToolchains()
    : '<h2>' + esc(sec?.title ?? section) + '</h2>' + (sec ? settingsForm(sec) : '');
}
document.addEventListener('change', (e) => {
  const k = e.target.dataset.key; if (!k) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value;
  vscode.postMessage({ type: 'set', key: k, value: v });
});
document.addEventListener('click', (e) => {
  const d = e.target.closest('[data-tc],[data-section],[data-start],[data-mcp],[data-allow],[data-deny],[data-revoke],[data-act],#openSettings'); if (!d) return;
  e.preventDefault();
  if (d.dataset.tc) return vscode.postMessage({ type: d.dataset.tc, id: d.dataset.tcId });
  if (d.dataset.section) { section = d.dataset.section; vscode.setState({ section }); window.scrollTo(0, 0); return S && draw(); }
  if (d.id === 'openSettings') return vscode.postMessage({ type: 'openSettings' });
  if (d.dataset.start) { d.disabled = true; d.textContent = t('starting'); return vscode.postMessage({ type: 'start', service: d.dataset.start }); }
  if (d.dataset.mcp) return vscode.postMessage({ type: 'mcp', client: d.dataset.mcp });
  if (d.dataset.allow) return vscode.postMessage({ type: 'allow', id: d.dataset.allow });
  if (d.dataset.deny) return vscode.postMessage({ type: 'deny', id: d.dataset.deny });
  if (d.dataset.revoke) return vscode.postMessage({ type: 'revoke', client: d.dataset.revoke });
  if (d.dataset.act) return vscode.postMessage({ type: d.dataset.act });
});
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('nav a')) { e.preventDefault(); e.target.click(); } });
window.addEventListener('message', (e) => {
  if (e.data.type === 'state') { S = e.data; draw(); }
  if (e.data.type === 'section' && SECTIONS.includes(e.data.id)) { section = e.data.id; vscode.setState({ section }); if (S) draw(); }
});
vscode.postMessage({ type: 'ready' });
</script></body></html>`;
}
