// The welcome (spec 011, requirement 14): the first-run onboarding, *Next, Next*, over every setting of the platform,
// each step with its defaults. 1 the AI services of this machine (the profile `remote`: the Smart Graph and the MCP
// server; the local models are on standby, ADR-platform-0013, so no profile is chosen and no model is downloaded),
// 2 what is needed (found by itself once installed, or installed in a terminal), 3 the installation with its progress
// (ADR-installer-0002), 4 the toolchains of the platforms the user builds (toolchainHost.ts: Python included, Flutter
// and Node.js installed by the user or by `nuclear setup`), 5 the providers (the agents found on the PATH, the API keys
// handed to the vault, who works the Builder's chat), 6 the team (the squad screen: the new-team wizard when there is
// none), 7 the spending, 8 the settings of each tool, then a summary. Everything lands in the settings or, for the teams and the
// keys, in what `nuclear-builder` keeps. The set-up of the services is `nuclear-builder setup` (written in Nuclear),
// run as a process: its plan (`--plan --json`) and its steps (`--events`, one JSON line each). It can be run again
// from Settings and integrations. Plain HTML and script, no framework; its texts are setupL10n.ts.
import { execFile } from 'node:child_process';
import * as vscode from 'vscode';
import { builder, builderJson, readMachine } from './aiMachine';
import { toolEnv } from '../../tools/nuclear-builder/src/support';
import { lang, langButton, localize, pageI18n, l10n } from './i18n';
import { SETUP } from './setupL10n';
import { applySetting, FORM_CSS, FORM_JS, settingSections } from './settingsForm';
import { spendingSettings } from './spending';
import { askKey, TeamsHost } from '../../tools/nuclear-builder/src/teams/host';
import { webviewFaceUrl } from '../../tools/nuclear-builder/src/teams/faceUrl';
import { SQUAD } from '../../tools/nuclear-builder/src/teams/l10n';
import { SQUAD_CSS, SQUAD_SCRIPT } from '../../tools/nuclear-builder/src/teams/page';
import { showTeam, vaultList } from '../../tools/nuclear-builder/src/teams/cli';
import { handleToolchain, TC_CSS, TC_JS, TC_TEXTS, toolchainState } from './toolchainHost';

/** What `nuclear-builder setup --plan --json` gives: the page's state (the profiles, the requirements). `localModels`
 * is the switch of ADR-platform-0013: the page offers only the profile `remote` whatever it says (absent, from an
 * older nuclear-builder, is off too). */
interface Plan {
  platform: string;
  profiles: { id: string }[];
  machine: Record<string, string>;
  root: string | null;
  localModels?: boolean;
  requirements: { local?: Requirement[]; remote: Requirement[] };
}

interface Requirement {
  id: string;
  title: string;
  install: Record<string, string | undefined>;
}

/** The agents of the providers a role can be given to, by their command (the settings' when they have one). */
const AGENTS = [
  { id: 'claude-code', name: 'Claude Code', setting: 'nuclear.ai.claude.command', fallback: 'claude' },
  { id: 'codex', name: 'Codex', setting: 'nuclear.ai.codex.command', fallback: 'codex', enable: 'nuclear.ai.codex.enabled' },
  { id: 'gemini-cli', name: 'Gemini CLI', fallback: 'gemini' },
  // Cursor's `agent` is a generic name: its installer's `cursor-agent` is asked, never someone else's `agent`
  { id: 'cursor', name: 'Cursor', fallback: 'cursor-agent' },
  { id: 'grok', name: 'Grok Build', fallback: 'grok' },
  { id: 'opencode', name: 'OpenCode', setting: 'nuclear.ai.opencode.command', fallback: 'opencode', enable: 'nuclear.ai.opencode.enabled' },
];
const API_PROVIDERS = ['anthropic', 'openai', 'google', 'openrouter'];
const DONE = 'nuclear.onboarding.done';
const DECLINED = 'nuclear.ai.setup.declined';

type Message =
  | { type: 'ready' | 'check' | 'settings' | 'providers' | 'summary' | 'finish' }
  | { type: 'install'; id: string }
  | { type: 'open'; url: string }
  | { type: 'go'; profile: string; from: number }
  | { type: 'key'; provider: string }
  | { type: 'setSetting'; key: string; value: unknown }
  | { type: string; [k: string]: unknown };

/** Whether a command is on the PATH (it runs, whatever `--version` answers), and its version line. */
function found(cmd: string): Promise<{ found: boolean; version: string }> {
  return new Promise((resolve) => execFile(cmd, ['--version'], { timeout: 8000, env: toolEnv() }, (e, out) => resolve({ found: (e as NodeJS.ErrnoException | null)?.code !== 'ENOENT', version: e ? '' : String(out).trim().split(/\r?\n/)[0].slice(0, 80) })));
}

export class SetupPanel {
  private static current: SetupPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly teams: TeamsHost;
  private plan: Plan | undefined;
  private running = false;

  private constructor(private readonly context: vscode.ExtensionContext) {
    this.panel = vscode.window.createWebviewPanel('nuclear.setup', l10n.t('Welcome to NuclearLang'), vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
    this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icons', 'nuc-file.svg');
    this.teams = new TeamsHost((m) => this.post(m), undefined, webviewFaceUrl(this.panel.webview));
    const localized = localize(this.panel.webview, () => html(this.panel.webview));
    this.panel.onDidDispose(() => {
      SetupPanel.current = undefined;
      localized.dispose();
    });
    this.panel.webview.onDidReceiveMessage((m: Message) => void this.receive(m).catch((e) => void vscode.window.showErrorMessage(l10n.t('Nuclear set-up: {0}', e instanceof Error ? e.message : String(e)))));
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('nuclear') && SetupPanel.current === this && (this.post({ type: 'sections', sections: settingSections(this.context) }), e.affectsConfiguration('nuclear.toolchains') && void this.toolchains())));
  }

  static show(context: vscode.ExtensionContext): void {
    (SetupPanel.current ?? (SetupPanel.current = new SetupPanel(context))).panel.reveal(vscode.ViewColumn.Active);
  }

  /** Once, when the extension starts and the welcome was never finished: the offer, never the page by itself. */
  static async offer(context: vscode.ExtensionContext): Promise<void> {
    if (context.globalState.get(DONE) || context.globalState.get(DECLINED)) return;
    const start = l10n.t('Start'), later = l10n.t('Later'), never = l10n.t("Don't ask again");
    const pick = await vscode.window.showInformationMessage(
      readMachine().NUCLEAR_AI_MODE
        ? l10n.t('NuclearLang: the welcome has new steps (the providers, the team, the spending, the settings of each tool). Walk through them? Every step has its default.')
        : l10n.t('Welcome to NuclearLang: set it up step by step? The welcome sets up the Smart Graph and the MCP server for your agents, proposes a default for every setting, and you choose.'),
      start, later, never,
    );
    if (pick === start) SetupPanel.show(context);
    if (pick === never) await context.globalState.update(DECLINED, true);
  }

  private post(m: unknown): void {
    void this.panel.webview.postMessage(m);
  }

  private async state(): Promise<void> {
    const plan = await builderJson<Plan>(['--plan', '--json', '--lang', lang()]);
    if (!plan) {
      this.post({ type: 'missing', text: l10n.t('The set-up comes with the AI services, and they are not installed: run the NuclearLang installer again (without --no-ai). The other steps of the welcome still work.') });
      return;
    }
    // only the profile `remote` and its requirements, whatever an older set-up still lists
    this.plan = { ...plan, profiles: plan.profiles.filter((p) => p.id === 'remote'), requirements: { remote: plan.requirements.remote } };
    this.post({ type: 'state', ...this.plan });
  }

  private async receive(m: Message): Promise<void> {
    if (await this.teams.handle(m as { type: string })) return;
    if (await handleToolchain(m as { type: string }, () => void this.toolchains())) return;
    switch (m.type) {
      case 'ready':
        this.post({ type: 'sections', sections: settingSections(this.context) });
        return this.state();
      case 'check':
        return this.state();
      case 'settings':
        await vscode.commands.executeCommand('nuclear.workspace.tool', 'settings');
        return;
      case 'open':
        await vscode.env.openExternal(vscode.Uri.parse(String((m as { url: string }).url)));
        return;
      case 'install': {
        // in a terminal the user sees: an installer may ask for a password, and its output is theirs to read
        const r = this.plan?.requirements.remote.find((x) => x.id === (m as { id: string }).id);
        const command = r?.install[process.platform];
        if (!r || !command) return;
        const t = vscode.window.createTerminal({ name: l10n.t('Install {0}', r.title), env: toolEnv() as Record<string, string> });
        t.show();
        t.sendText(command);
        return;
      }
      case 'go':
        return this.install('remote', Number((m as { from: number }).from));
      case 'providers':
        return this.providers();
      case 'key': {
        const provider = String((m as { provider: string }).provider);
        if (!API_PROVIDERS.includes(provider)) return;
        try {
          await askKey(provider);
        } catch (e) {
          void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
        }
        return this.providers();
      }
      case 'setSetting':
        return applySetting(this.context, String((m as { key: string }).key), (m as { value: unknown }).value);
      case 'toolchains':
        return this.toolchains();
      case 'summary':
        return this.summary();
      case 'finish':
        await this.context.globalState.update(DONE, true);
        this.panel.dispose();
        return;
    }
  }

  /** The agents on this machine and the keys in the vault. */
  private async providers(): Promise<void> {
    const c = vscode.workspace.getConfiguration();
    const agents = await Promise.all(AGENTS.map(async (a) => ({ id: a.id, name: a.name, command: a.setting ? c.get<string>(a.setting, a.fallback) : a.fallback, enable: a.enable ?? null, enabled: a.enable ? c.get<boolean>(a.enable, false) : null, ...(await found(a.setting ? c.get<string>(a.setting, a.fallback) : a.fallback)) })));
    const vault = await vaultList().then((v) => ({ keys: v, missing: '' }), (e: unknown) => ({ keys: null, missing: e instanceof Error ? e.message : String(e) }));
    this.post({ type: 'providers', agents, api: API_PROVIDERS, vault });
  }

  private async toolchains(): Promise<void> {
    this.post({ type: 'toolchains', ...(await toolchainState()) });
  }

  private async summary(): Promise<void> {
    const id = this.teams.current();
    const team = id ? await showTeam(id).catch(() => null) : null;
    const vault = await vaultList().catch(() => null);
    this.post({ type: 'summary', machine: readMachine(), team: team ? { name: team.name, members: team.members } : null, vault, spending: spendingSettings() });
  }

  /** The steps of a profile, from `from` on: each JSON line the set-up prints is a message of the page as it is. */
  private async install(id: string, from: number): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await builder(['setup', '--events', '--profile', id, '--from', String(from)], (line) => {
        try {
          this.post(JSON.parse(line));
        } catch {
          // a line that is not an event (a warning of Python): not the page's
        }
      });
    } finally {
      this.running = false;
    }
  }
}

export function html(webview: vscode.Webview): string {
  const nonce = Math.random().toString(36).slice(2);
  return `<!doctype html><html lang="${lang()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src data: ${webview.cspSource}; script-src 'nonce-${nonce}';">
<style>
  body { margin: 0; padding: 16px 28px 40px; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  .narrow { max-width: 880px; } .wide { max-width: none; }
  h1 { font-size: 21px; margin: 4px 0 2px; } h2 { font-size: 15px; margin: 22px 0 6px; } h3.sec { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; opacity: .8; margin: 22px 0 4px; }
  .muted { opacity: .7; }
  .steps { display: flex; flex-wrap: wrap; gap: 4px; margin: 14px 0 6px; counter-reset: s; }
  .steps a { display: flex; align-items: center; gap: 6px; padding: 5px 10px 5px 6px; border-radius: 999px; font-size: 12px; cursor: pointer; opacity: .6; border: 1px solid transparent; color: inherit; text-decoration: none; }
  .steps a i { font-style: normal; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; background: var(--vscode-badge-background, #8884); color: var(--vscode-badge-foreground, inherit); }
  .steps a.done { opacity: .9; } .steps a.done i { background: var(--vscode-testing-iconPassed, #3fb950); color: #fff; }
  .steps a.now { opacity: 1; font-weight: 600; border-color: var(--vscode-focusBorder); } .steps a.now i { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .bar { height: 3px; border-radius: 2px; background: var(--vscode-panel-border); overflow: hidden; margin-bottom: 8px; } .bar i { display: block; height: 100%; background: var(--vscode-button-background); transition: width .4s; }
  button, select, input { font: inherit; } button { cursor: pointer; color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); border: none; border-radius: 4px; padding: 5px 14px; }
  select, input:not([type=checkbox]) { color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; padding: 4px 8px; box-sizing: border-box; }
  button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); } button:disabled { opacity: .5; cursor: default; }
  .card { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 12px 16px; margin: 8px 0; cursor: pointer; transition: border-color .15s; }
  .card.on { border-color: var(--vscode-focusBorder); outline: 1px solid var(--vscode-focusBorder); } .card.plain { cursor: default; }
  .card h3 { margin: 0 0 4px; font-size: 14px; } .card ul { margin: 6px 0 0; padding-left: 0; list-style: none; } .card li { margin: 2px 0; }
  .badge { font-size: 11px; padding: 1px 7px; border-radius: 8px; border: 1px solid var(--vscode-panel-border); margin-left: 6px; font-weight: normal; }
  .badge.best { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; }
  .warn { color: var(--vscode-editorWarning-foreground); } .bad { color: var(--vscode-errorForeground); } .ok { color: var(--vscode-testing-iconPassed, #3fb950); }
  .row { display: flex; gap: 12px; align-items: center; } .grow { flex: 1; } .nav { display: flex; gap: 8px; margin-top: 18px; position: sticky; bottom: 0; padding: 10px 0; background: var(--vscode-editor-background); }
  code { font-family: var(--vscode-editor-font-family); font-size: 12px; } a { color: var(--vscode-textLink-foreground); cursor: pointer; }
  .line { font-family: var(--vscode-editor-font-family); font-size: 12px; opacity: .75; word-break: break-all; }
  .sum { display: grid; grid-template-columns: 190px 1fr auto; gap: 10px 16px; align-items: center; border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 14px 16px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .sum b { font-weight: 600; } #squadHost { height: calc(100vh - 230px); min-height: 640px; }
  ${FORM_CSS}
  ${SQUAD_CSS}
  ${TC_CSS}
</style></head><body>
<div id="frame" class="narrow">
<div class="head"><h1 id="title"></h1>${langButton()}</div>
<div class="muted" id="intro"></div>
<div class="steps" id="steps"></div><div class="bar"><i id="progress"></i></div>
<div id="root"></div>
<div id="squadHost" style="display:none"></div>
<div class="nav" id="nav"></div>
</div>
<script nonce="${nonce}">
${pageI18n(SETUP, SQUAD, TC_TEXTS)}
// a text the set-up computed, in the page's language: its kind's text (prefix + key), else its English (an older
// set-up); the remote profile's graph step installs only the MCP server (it has no models)
const said = (prefix, key, args, english) => key && T[prefix + key] ? t(prefix + key, ...(args ?? [])) : english;
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
${FORM_JS}
${SQUAD_SCRIPT}
${TC_JS}
const PAGES = ['machine', 'requirements', 'install', 'toolchains', 'providers', 'team', 'spending', 'tools', 'summary'];
const at = (id) => PAGES.indexOf(id);
// the step shown survives a re-render (a change of language)
let S = null, missing = '', page = Math.max(0, Math.min(PAGES.length - 1, Math.floor(Number(vscode.getState()?.page)) || 0)), run = null, timer = null, sections = [], prov = null, summary = null, squad = false, tc = null, later = {};
// the local models are on standby (ADR-platform-0013): the one profile is remote, the Smart Graph and the MCP server
const chosen = () => S.profiles.find((p) => p.id === 'remote');
const needs = () => S.requirements.remote;
const sectionOf = (id) => sections.find((s) => s.id === id);
document.getElementById('title').textContent = t('title');
document.getElementById('intro').textContent = t('intro');

function profileCard(p) {
  return '<div class="card plain"><h3>' + esc(p.title) + '</h3><div>' + esc(p.summary) + '</div>'
    + '<ul>' + p.works.map((w) => '<li><span class="ok">✓</span> ' + esc(w) + '</li>').join('') + p.limits.map((l) => '<li><span class="warn">✗</span> ' + esc(l) + '</li>').join('') + '</ul></div>';
}
const navBtns = (back, next, nextLabel, nextDisabled) => (back !== null ? '<button data-go="' + back + '">' + esc(t('back')) + '</button>' : '') + '<div class="grow"></div>' + (page < PAGES.length - 1 ? '<button data-skip="1">' + esc(t('skipAll')) + '</button>' : '') + (next !== null ? '<button class="primary" data-go="' + next + '"' + (nextDisabled ? ' disabled' : '') + '>' + esc(nextLabel || t('next')) + '</button>' : '');

function machinePages() {
  if (!S) return { out: missing ? '<h2>' + esc(t('step.machine')) + '</h2><div class="warn">' + esc(missing) + '</div>' : '<div class="muted">' + esc(t('reading')) + '</div>', nav: navBtns(null, missing ? at('toolchains') : null) };
  const p = chosen();
  if (page === 0) {
    const was = S.machine.NUCLEAR_AI_PROFILE ? '<div class="muted">' + esc(t('setUpNow', S.machine.NUCLEAR_AI_PROFILE)) + '</div>' : '';
    return { out: '<h2>' + esc(t('step.machine')) + '</h2><div class="muted">' + esc(t('servicesHint')) + '</div>' + (p ? profileCard(p) : '') + was, nav: navBtns(null, 1) };
  }
  if (page === 1) {
    const all = needs();
    return { out: '<h2>' + esc(t('step.requirements')) + '</h2><div class="muted">' + esc(t('checkedEvery')) + '</div>'
      + all.map((r) => '<div class="card plain"><div class="row"><span class="' + (r.found ? 'ok' : 'bad') + '">' + (r.found ? '✓' : '✗') + '</span><div class="grow"><b>' + esc(r.title) + '</b> <span class="muted">' + esc(r.why) + '</span><div class="line">' + esc(said('detail.', r.detailKey, [], r.detail)) + '</div>'
        + (!r.found && r.note && r.note[S.platform] ? '<div class="muted">' + esc(r.note[S.platform]) + '</div>' : '') + '</div>'
        + (r.found ? '' : (r.install[S.platform] && r.detailKey !== 'notRunning' && !r.detail.startsWith('installed, not running') ? '<button class="primary" data-install="' + r.id + '" title="' + esc(r.install[S.platform]) + '">' + esc(t('installForMe')) + '</button>' : '') + '<button data-open="' + esc(r.url) + '">' + esc(t('installMyself')) + '</button>')
        + '</div></div>').join(''), nav: navBtns(0, 2, null, !all.every((r) => r.found)) };
  }
  const already = S.machine.NUCLEAR_AI_PROFILE === p.id;
  if (!run) return { out: '<h2>' + esc(t('readyInstall')) + '</h2>' + profileCard(p) + (already ? '<div class="ok">' + esc(t('alreadyInstalled')) + '</div>' : ''),
    nav: '<button data-go="1">' + esc(t('back')) + '</button><div class="grow"></div>' + (already ? '<button data-go="3">' + esc(t('keepInstalled')) + '</button>' : '<button data-go="3">' + esc(t('installLater')) + '</button>') + '<button class="primary" data-run="0">' + esc(t('install')) + '</button>' };
  const mark = { running: '…', done: '✓', failed: '✗' };
  return { out: '<h2>' + esc(run.done ? t('done') : run.failed !== null ? t('stepFailed') : t('installing')) + '</h2>'
    + run.titles.map((x, i) => { const st = run.status[i]; return '<div class="card plain"><div class="row"><span class="' + (st === 'done' ? 'ok' : st === 'failed' ? 'bad' : '') + '">' + (mark[st] || '·') + '</span><div class="grow"><b>' + esc(stepTitle(run, i, x)) + '</b><div class="line ' + (st === 'failed' ? 'bad' : '') + '">' + esc(run.line[i] || '') + '</div></div>' + (st === 'failed' ? '<button class="primary" data-run="' + i + '">' + esc(t('tryAgain')) + '</button>' : '') + '</div></div>'; }).join('')
    + (run.done ? '<div>' + esc(t('installedRemote')) + '</div>' : ''), nav: navBtns(1, run.done ? 3 : null) };
}
/** A step's title in the page's language: the graph's step installs only the MCP server on an older set-up whose
 * remote profile had no graph's model; the graph model's step says the model and size its English title names. */
function stepTitle(run, i, english) {
  const id = run.ids[i];
  if (id === 'graph' && !run.ids.includes('graph-model')) return said('setupStep.', 'graphRemote', [], english);
  if (id === 'graph-model') return said('setupStep.', id, [(/\\(([^)]*)\\)\\s*$/.exec(english) || [])[1] || run.models], english);
  return said('setupStep.', id, [run.models], english);
}
function providersPage() {
  if (!prov) return { out: '<h2>' + esc(t('step.providers')) + '</h2><div class="muted">' + esc(t('lookingProviders')) + '</div>', nav: navBtns(at('toolchains'), at('team')) };
  const agents = prov.agents.map((a) => '<div class="card plain"><div class="row"><span class="' + (a.found ? 'ok' : 'muted') + '">' + (a.found ? '✓' : '○') + '</span><div class="grow"><b>' + esc(a.name) + '</b> <code>' + esc(a.command) + '</code><div class="muted">' + esc(a.found ? (a.version || t('found')) : t('notFound')) + '</div></div>'
    + (a.enable && a.found ? '<label class="sf-sw" title="' + esc(t('useIt')) + '"><input type="checkbox" data-setting="' + esc(a.enable) + '" data-t="boolean"' + (a.enabled ? ' checked' : '') + ' aria-label="' + esc(t('useIt') + ' ' + a.name) + '"><span></span></label>' : '') + '</div></div>').join('');
  const keys = prov.vault.keys === null ? '<div class="warn">' + esc(t('vaultMissing', prov.vault.missing)) + '</div>'
    : prov.api.map((p) => '<div class="card plain"><div class="row"><span class="' + (prov.vault.keys[p] ? 'ok' : 'muted') + '">' + (prov.vault.keys[p] ? '✓' : '○') + '</span><div class="grow"><b>' + esc(t('api.' + p)) + '</b><div class="muted">' + esc(prov.vault.keys[p] ? t('keyKept') : t('noKey')) + '</div></div><button' + (prov.vault.keys[p] ? '' : ' class="primary"') + ' data-key="' + p + '">' + esc(prov.vault.keys[p] ? t('changeKey') : t('setKey')) + '</button></div></div>').join('');
  return { out: '<h2>' + esc(t('step.providers')) + '</h2><div class="muted">' + esc(t('providersIntro')) + '</div><h3 class="sec">' + esc(t('agentsHere')) + '</h3><div class="muted">' + esc(t('agentsHint')) + '</div>' + agents
    + '<h3 class="sec">' + esc(t('apiKeys')) + '</h3><div class="muted">' + esc(t('apiKeysHint')) + '</div>' + keys + '<div class="row" style="margin-top:8px"><button data-recheck="1">↻ ' + esc(t('checkAgain')) + '</button></div>'
    + (chatItem() ? '<h3 class="sec">' + esc(t('chatWho')) + '</h3><div class="muted">' + esc(t('chatWhoHint')) + '</div>' + settingsForm({ items: [chatItem()] }) : ''), nav: navBtns(at('toolchains'), at('team')) };
}
/** Who works the Builder's chat (nuclear.builder.chat), chosen with the providers just found. */
function chatItem() {
  return sectionOf('builder')?.items.find((i) => i.key === 'nuclear.builder.chat');
}
function toolsPage() {
  const ids = ['builder', 'chat', 'atlas', 'http', 'devices', 'language'];
  return { out: '<h2>' + esc(t('step.tools')) + '</h2><div class="muted">' + esc(t('toolsIntro')) + '</div>' + ids.map((id) => sectionOf(id) ? '<h3 class="sec">' + esc(sectionOf(id).title) + '</h3>' + settingsForm(sectionOf(id), ['nuclear.builder.team', 'nuclear.builder.chat', 'nuclear.language']) : '').join(''), nav: navBtns(at('spending'), at('summary')) };
}
/** The toolchains of the platforms the user builds: found where, or installed by them, by NuclearLang, or later. */
function toolchainsPage() {
  const head = '<h2>' + esc(t('step.toolchains')) + '</h2><div class="muted">' + esc(t('tc.intro')) + '</div>';
  if (!tc) return { out: head + '<div class="muted">…</div>', nav: navBtns(at('install'), at('providers')) };
  return { out: head + '<h3 class="sec">' + esc(t('tc.platforms')) + '</h3><div class="muted">' + esc(t('tc.platformsHint')) + '</div>' + platformChecks(tc)
    + '<h3 class="sec">' + esc(t('tc.title')) + '</h3>' + toolchainCards(tc, true, later) + '<div class="row" style="margin-top:8px"><button data-tc="tcCheck">↻ ' + esc(t('checkAgain')) + '</button></div>', nav: navBtns(at('install'), at('providers')) };
}
function tcSummary() {
  if (!tc) return '…';
  const want = tcPlatforms(tc);
  const list = TC.filter((x) => x.platforms.some((p) => want.includes(p)));
  if (!list.length) return esc(t('tc.none'));
  return esc(want.map((p) => t('tc.p.' + p)).join(', ')) + '<div class="muted">' + list.map((x) => { const s = tc.statuses.find((y) => y.id === x.id) || { id: x.id, where: 'missing' }; return esc(x.name + ': ' + (s.where === 'missing' && later[x.id] ? t('tc.later') : tcWhere(s))); }).join(' · ') + '</div>';
}
function summaryPage() {
  if (!summary) return { out: '<h2>' + esc(t('step.summary')) + '</h2><div class="muted">…</div>', nav: navBtns(at('tools'), null) };
  const m = summary.machine, sp = summary.spending, keys = summary.vault ? Object.entries(summary.vault).filter(([, v]) => v).map(([k]) => t('api.' + k)) : [];
  const PN = { 'claude-code': 'Claude Code', codex: 'Codex', 'gemini-cli': 'Gemini CLI', cursor: 'Cursor', grok: 'Grok Build', opencode: 'OpenCode', anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', openrouter: 'OpenRouter' };
  // the members by role: how many, and who works the first (the one a station takes)
  const byRole = {}; for (const x of summary.team?.members ?? []) (byRole[x.role] ??= []).push(x);
  const roles = Object.entries(byRole).map(([r, xs]) => t('sq.role.' + r) + (xs.length > 1 ? ' ×' + xs.length : '') + ': ' + (PN[xs[0].provider] ?? xs[0].provider) + (xs[0].model ? ' · ' + xs[0].model : '')).join(' · ');
  const row = (label, value, go) => '<b>' + esc(label) + '</b><div>' + value + '</div><a data-go="' + go + '">' + esc(t('change')) + '</a>';
  return { out: '<h2>' + esc(t('step.summary')) + '</h2><div class="muted" style="margin-bottom:10px">' + esc(t('summaryIntro')) + '</div><div class="sum">'
    + row(t('sumMachine'), esc(m.NUCLEAR_AI_PROFILE ? t('sumProfile', m.NUCLEAR_AI_PROFILE) : t('sumNotInstalled')), at('machine'))
    + row(t('sumToolchains'), tcSummary(), at('toolchains'))
    + row(t('sumProviders'), esc((prov ? prov.agents.filter((a) => a.found).map((a) => a.name).join(', ') : '') || t('sumNone')) + (keys.length ? '<div class="muted">' + esc(t('sumKeys', keys.join(', '))) + '</div>' : ''), at('providers'))
    + row(t('sumTeam'), summary.team ? '<b>' + esc(summary.team.name) + '</b><div class="muted">' + esc(roles) + '</div>' : esc(t('sumNoTeam')), at('team'))
    + row(t('sumSpending'), esc(t('sumBudget', sp.budgetUsd > 0 ? sp.budgetUsd.toFixed(2) + ' USD' : t('noLimit'))) + ' · ' + esc(sp.forceConfirm ? t('sumForced') : sp.confirm ? t('sumTwice') : t('sumNoAsk')), at('spending'))
    + row(t('sumTools'), esc(t('sumToolsText')), at('tools'))
    + '</div>', nav: '<button data-go="' + at('tools') + '">' + esc(t('back')) + '</button><div class="grow"></div><button data-settings="1">' + esc(t('openSettings')) + '</button><button class="primary" data-finish="1">' + esc(t('finish')) + '</button>' };
}
function draw() {
  document.getElementById('steps').innerHTML = PAGES.map((id, i) => '<a data-go="' + i + '" class="' + (i === page ? 'now' : i < page ? 'done' : '') + '" tabindex="0"><i>' + (i < page ? '✓' : i + 1) + '</i>' + esc(t('step.' + id)) + '</a>').join('');
  document.getElementById('progress').style.width = Math.round((page / (PAGES.length - 1)) * 100) + '%';
  const id = PAGES[page];
  document.getElementById('frame').className = id === 'team' ? 'wide' : 'narrow';
  const v = page <= at('install') ? machinePages() : id === 'providers' ? providersPage() : id === 'team' ? { out: '<h2>' + esc(t('step.team')) + '</h2><div class="muted" style="margin-bottom:10px">' + esc(t('teamIntro')) + '</div>', nav: navBtns(at('providers'), at('spending')) }
    : id === 'spending' ? { out: '<h2>' + esc(t('step.spending')) + '</h2><div class="muted">' + esc(t('spendingIntro')) + '</div>' + (sectionOf('spending') ? settingsForm(sectionOf('spending')) : ''), nav: navBtns(at('team'), at('tools')) }
    : id === 'toolchains' ? toolchainsPage() : id === 'tools' ? toolsPage() : summaryPage();
  // the first step asks the language first (nuclear.language); the tools' step leaves it out
  const language = sectionOf('language')?.items.find((i) => i.key === 'nuclear.language');
  if (page === 0 && language) v.out = '<h3 class="sec">' + esc(t('lang.title')) + '</h3>' + settingsForm({ items: [language] }) + v.out;
  document.getElementById('root').innerHTML = v.out;
  document.getElementById('nav').innerHTML = v.nav;
  const host = document.getElementById('squadHost');
  host.style.display = id === 'team' ? '' : 'none';
  if (id === 'team' && !squad) { squad = true; Squad.mount(host, (m) => vscode.postMessage(m)); }
  clearInterval(timer);
  if (page === at('requirements')) timer = setInterval(() => vscode.postMessage({ type: 'check' }), 3000);
}
function goTo(n) {
  page = Math.max(0, Math.min(PAGES.length - 1, n));
  vscode.setState({ page });
  if (PAGES[page] === 'providers' && !prov) vscode.postMessage({ type: 'providers' });
  if (PAGES[page] === 'toolchains' && !tc) vscode.postMessage({ type: 'toolchains' });
  if (PAGES[page] === 'summary') { summary = null; vscode.postMessage({ type: 'summary' }); if (!prov) vscode.postMessage({ type: 'providers' }); vscode.postMessage({ type: 'toolchains' }); }
  window.scrollTo(0, 0);
  draw();
}
document.addEventListener('click', (e) => {
  const tcb = e.target.closest('[data-tc]');
  if (tcb) { if (tcb.dataset.tc === 'tcLater') { later[tcb.dataset.tcId] = true; return draw(); } return vscode.postMessage({ type: tcb.dataset.tc, id: tcb.dataset.tcId }); }
  const d = e.target.closest('[data-go],[data-install],[data-open],[data-run],[data-settings],[data-key],[data-recheck],[data-skip],[data-finish]'); if (!d || d.disabled || document.getElementById('squadHost').contains(d)) return;
  if (d.dataset.go) return goTo(Number(d.dataset.go));
  if (d.dataset.install) return vscode.postMessage({ type: 'install', id: d.dataset.install });
  else if (d.dataset.open) return vscode.postMessage({ type: 'open', url: d.dataset.open });
  else if (d.dataset.settings) return vscode.postMessage({ type: 'settings' });
  else if (d.dataset.key) return vscode.postMessage({ type: 'key', provider: d.dataset.key });
  else if (d.dataset.recheck) { prov = null; draw(); return vscode.postMessage({ type: 'providers' }); }
  else if (d.dataset.skip) return goTo(PAGES.length - 1);
  else if (d.dataset.finish) return vscode.postMessage({ type: 'finish' });
  else if (d.dataset.run) { vscode.postMessage({ type: 'go', profile: 'remote', from: Number(d.dataset.run) }); return; }
  draw();
});
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.card[tabindex],.steps a')) { e.preventDefault(); e.target.click(); } });
window.addEventListener('message', (e) => {
  const m = e.data;
  if (Squad.receive(m)) return;
  if (m.type === 'state') {
    const first = !S; S = m; missing = '';
    if (first || page === at('requirements')) draw();
  } else if (m.type === 'sections') { sections = m.sections; if (page === 0 || PAGES[page] === 'spending' || PAGES[page] === 'tools' || PAGES[page] === 'providers') draw(); }
  else if (m.type === 'providers') { prov = m; if (PAGES[page] === 'providers' || PAGES[page] === 'summary') draw(); }
  else if (m.type === 'toolchains') { tc = m; if (PAGES[page] === 'toolchains' || PAGES[page] === 'summary') draw(); }
  else if (m.type === 'summary') { summary = m; if (PAGES[page] === 'summary') draw(); }
  else if (m.type === 'steps') {
    run = run && m.from ? { ...run, failed: null } : { titles: m.titles, ids: m.ids ?? [], models: m.models ?? '', status: [], line: [], failed: null, done: false };
    draw();
  } else if (m.type === 'step') {
    run.status[m.index] = m.status; if (m.line || m.status === 'failed') run.line[m.index] = m.line; if (m.status === 'failed') run.failed = m.index;
    draw();
  } else if (m.type === 'done') { run.done = true; draw(); }
  else if (m.type === 'missing') { missing = m.text; draw(); }
  else if (m.type === 'failed') { document.getElementById('root').innerHTML = '<div class="bad">' + esc(m.text || m.line) + '</div>'; }
});
draw();
vscode.postMessage({ type: 'ready' });
if (page) goTo(page);
</script></body></html>`;
}
