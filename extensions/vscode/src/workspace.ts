// The Nuclear workspace (ADR-extensions-0002): one activity bar container where everything of Nuclear meets. A strip of tabs
// (projects on top, tools at the bottom; keyboard first: Ctrl+1..9 and Ctrl+Alt+<letter>) beside a pane that
// depends on the tab: the files of a project (its platform's actions sit in the editor title bar), the endpoints tree of the HTTP Connections tool, the
// open devices. Every tab is a workspace of its own: switching swaps the editor area (the editors of one are
// remembered and closed, those of the other reopened); only the devices stay, like emulators beside the code. A
// welcome page at startup lists the projects and the shortcuts. VS Code's own explorer, search and git are not
// touched: a project opened here is a tab, not a window nor a workspace folder (unless the user adds it).

import * as fs from 'node:fs';
import { savedInside } from './savedProjects';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { Launch, logFile, logSize, reason, RUN_STALL_MS, RunFollower, RunStep } from '../../tools/nuclear-device-manager/src/launch-log';
import { isInstalled } from './card';
import { devices, devicesChanged, PRESETS, revealDevice } from '../../tools/nuclear-device-manager/src/mobile-device';
import { AtlasPanel } from '../../tools/nuclear-atlas/src/panel';
import { chatGifKey, disposeChat, openChatTab } from './chatView';
import { followChatNotices, Notice, notices } from './notifications';
import { chatWhere } from './notify';
import { SettingsPanel } from './settingsPanel';
import { watchConnections } from './connections';
import { BuilderPanel, builderSidebar, resumeOrphans, sidebarChanged } from '../../tools/nuclear-builder/src/panel';
import { inline, runOutline, specOfPath, specTree } from '../../tools/nuclear-builder/src/workbench';
import { findProjects, HttpModel, NodeAction, Project, readProject } from '../../tools/nuclear-http-connections/src/httpConnections';
import { ComponentPanel } from '../../tools/nuclear-http-connections/src/panel';
import { contextFor, registerTreeCommands } from './treeMenu';
import { activateScripts } from './scripts';
import { lang, langButton, localize, onDidChangeLang, pageI18n, texts, l10n } from './i18n';
import { STRIP } from './workspaceL10n';
import { WELCOME as WELCOME_TEXTS } from './welcomeL10n';
import { activateEnvironments } from '../../tools/nuclear-environments/src/panel';

interface Tool {
  id: string;
  label: string;
  /** The word under its icon on the strip (four to six letters). */
  short: string;
  key: string;
  about: string;
  /** What the template page lists as planned; empty for a tool that exists. */
  planned: string[];
  /** The command that opens its own page, for a tool whose page lives outside the workspace. */
  command?: string;
}

/** The tools of the strip, in the chosen language (a function: read when drawn): the AI factory first (the Builder, its
 * company, the chat), then the tools of a running project, then the ones not built yet, the settings last. */
export function tools(): Tool[] {
  return [
    {
      id: 'builder',
      label: 'Nuclear Builder',
      short: 'BUILD',
      key: 'Ctrl+Alt+P',
      about: l10n.t('Spec-driven work as a pipeline (ADR-platform-0003): a spec written here or imported from Jira or GitHub goes through plan, code, tests, security, artifacts and deploy, each station worked by the agent or provider of its member; every step shows who did what.'),
      planned: [],
    },
    {
      id: 'teams',
      label: l10n.t('Your software company'),
      short: l10n.t('TEAMS'),
      key: 'Ctrl+Alt+E',
      about: l10n.t('The teams of the software factory: each one a crew of employees by role (analyst, architect, developer, QA, DevOps), who works each one (an agent or a model of a provider) and its budget; a new team in five steps.'),
      planned: [],
      command: 'nuclear.builder.teams',
    },
    {
      id: 'reports',
      label: l10n.t('Reports'),
      short: l10n.t('REPORTS'),
      key: 'Ctrl+Alt+K',
      about: l10n.t("What the factory spent and made: the bill of tokens and money (local against paid, the budget used) and the reports of its work like a sprint's (throughput, cycle time, burndown, cumulative flow, the gates waiting for you, quality, each member's work), from nuclear-builder metrics."),
      planned: [],
      command: 'nuclear.builder.reports',
    },
    {
      id: 'atlas',
      label: 'Nuclear Atlas',
      short: 'ATLAS',
      key: 'Ctrl+Alt+A',
      about: l10n.t("The general agent over the RAG: a chat about the active project, answered by the agent or provider you pick (nuclear.builder.chat) from its map and the Nuclear Smart Graph, the local knowledge base the agents also read through the MCP; orders with /task run by the project's team, templates from the project, sessions kept in .nuclear/chat."),
      planned: [],
    },
    {
      id: 'http-connections',
      label: 'HTTP Connections',
      short: 'HTTP',
      key: 'Ctrl+Alt+H',
      about: l10n.t('Every endpoint of every project as a tree by platform, project and component; a component is a tab, each endpoint a tab inside it; environments (ADR-synapsis-0006).'),
      planned: [],
    },
    {
      id: 'devices',
      label: l10n.t('Devices'),
      short: l10n.t('DEVICE'),
      key: 'Ctrl+Alt+V',
      about: l10n.t('The Synapsis devices: as many as you want at once, like emulators, each with its own size and identity; they stay beside the code in every workspace.'),
      planned: [],
    },
    {
      id: 'monitor',
      label: 'Nuclear Monitor',
      short: 'MONITOR',
      key: 'Ctrl+Alt+F',
      about: l10n.t("Each Nuclear function's time, calls, connections and memory while the app runs, as an accordion of bars (.nuclear/monitor/report.json)."),
      planned: [],
      command: 'nuclear.monitor.open',
    },
    {
      id: 'environments',
      label: l10n.t('Environments'),
      short: 'ENV',
      key: 'Ctrl+Alt+Y',
      about: l10n.t('The variables of a project by environment (development, staging, production…): what the code reads with env(), each value and where it comes from (.env files, the keyring), required ones without a value, the active environment; every change through nuclear env.'),
      planned: [],
      command: 'nuclear.environments.open',
    },
    {
      id: 'designer',
      label: l10n.t('UI designer'),
      short: 'UI',
      key: 'Ctrl+Alt+D',
      about: l10n.t('Screens and widgets of a mobile or web project drawn and edited visually, written back as Nuclear.'),
      planned: [l10n.t('a canvas of the active screen built from its `.nuc`'), l10n.t('drag of widgets from the platform kinds'), l10n.t('two-way: the code changes, the canvas follows')],
    },
    {
      id: 'docs',
      label: l10n.t('AI documenter'),
      short: 'DOCS',
      key: 'Ctrl+Alt+M',
      about: l10n.t('Documentation of the active project generated from its declarations, contracts and doc comments.'),
      planned: [l10n.t('a page per component with its use cases, repositories and screens'), l10n.t('the API reference from `.nuclear/openapi.json`'), l10n.t('a model explaining each declaration on demand')],
    },
    {
      id: 'settings',
      label: l10n.t('Settings and integrations'),
      short: l10n.t('SETUP'),
      key: 'Ctrl+Alt+S',
      about: l10n.t('Every setting of the AI loop in one page: the Smart Graph and its state, the MCP server in Claude Code, Codex and Cursor, the connections (graph clients, Jira, GitHub), retries.'),
      planned: [],
    },
  ];
}

/** The actions of a project, by platform: each platform has its own (mobile runs on a device and hot reloads,
 * a backend serves and exposes an API, a web app serves in the browser). */
interface Action {
  id: string;
  label: string;
  key: string;
  title: string;
}
const ACTION_KEYS: Record<string, string> = { run: 'Ctrl+Alt+R', debug: 'Ctrl+Alt+G', reload: 'Ctrl+Alt+L', device: 'Ctrl+Alt+V', build: 'Ctrl+Alt+B', test: 'Ctrl+Alt+T', check: 'Ctrl+Alt+C', api: 'Ctrl+Alt+H' };
const action = (id: string, label: string, title: string): Action => ({ id, label, key: ACTION_KEYS[id], title });
const platformActions = (): Record<string, Action[]> => ({
  mobile: [
    action('run', l10n.t('▷ Run'), l10n.t('nuclear build, then the app on the selected Flutter device (no debugger)')),
    action('debug', l10n.t('◉ Debug'), l10n.t('the app with the debugger: breakpoints and steps in the .nuc')),
    action('reload', l10n.t('↻ Reload'), l10n.t('hot reload of the running app (saving a .nuc does it too)')),
    action('device', l10n.t('▭ Device'), l10n.t('run on a Synapsis device inside the editor (the newest one, or a new one)')),
    action('build', l10n.t('⚒ Build'), l10n.t('nuclear build: transpile and prepare the Flutter app')),
    action('test', l10n.t('✓ Test'), 'nuclear test'),
    action('check', l10n.t('☑ Check'), l10n.t('nuclear check: the .nuc files and the architecture rules')),
  ],
  backend: [
    action('run', l10n.t('▷ Serve'), l10n.t('nuclear run: build, then the server (it restarts on every build: saving a .nuc does it)')),
    action('debug', l10n.t('◉ Debug'), l10n.t("the server under the dialect's debugger (debugpy, node): breakpoints and steps in the .nuc")),
    action('test', l10n.t('✓ Test'), 'nuclear test'),
    action('build', l10n.t('⚒ Build'), l10n.t('nuclear build: transpile into build/ (and compile a TypeScript server)')),
    action('check', l10n.t('☑ Check'), l10n.t('nuclear check: the .nuc files and the architecture rules')),
    action('api', '⇄ API', l10n.t('the routes of this backend in the HTTP Connections tool')),
  ],
  web: [
    action('run', l10n.t('▷ Serve'), l10n.t('nuclear run: build, then the dev server (Vite); saving a .nuc updates the page')),
    action('device', l10n.t('▭ Device'), l10n.t('the app in the web device beside the code: desktop, tablet and phone sizes, console, network')),
    action('debug', l10n.t('◉ Debug'), l10n.t('the web device with the debugger attached: breakpoints and steps in the .nuc')),
    action('reload', l10n.t('↻ Reload'), l10n.t('reload the page of the web device')),
    action('build', l10n.t('⚒ Build'), 'nuclear build'),
    action('test', l10n.t('✓ Test'), l10n.t('nuclear test: the tests of the app (vitest)')),
    action('check', l10n.t('☑ Check'), l10n.t('nuclear check: the .nuc files and the architecture rules')),
  ],
});
// what an action runs in the project's terminal; `install` first when the generated app has no packages yet
const TERMINAL_COMMANDS: Record<string, Record<string, string>> = {
  mobile: { build: 'nuclear build', test: 'nuclear test', check: 'nuclear check' },
  backend: { run: 'nuclear run', test: 'nuclear test', build: 'nuclear build', check: 'nuclear check' },
  web: { run: 'nuclear run', build: 'nuclear build', test: 'nuclear test', check: 'nuclear check' },
};

const SAVED = 'nuclear.workspace.projects';
const ACTIVE = 'nuclear.workspace.active';
const LAST_PROJECT = 'nuclear.workspace.lastProject';
const TABS = 'nuclear.workspace.tabs';
const WELCOME = 'nuclear.workspace.welcome';
const CONTAINER = 'workbench.view.extension.nuclear';
const TOOL_PREFIX = 'tool:';
/** A run/debug/device asked for a project that had to join the workspace folders first (user state: the join
 * restarts the extensions or needs a reload, and an untitled multi-root workspace has no workspace state). */
const PENDING = 'nuclear.workspace.pendingAction';
interface PendingAction {
  root: string;
  id: string;
  at: number;
}
const inFolders = (root: string) => vscode.workspace.getWorkspaceFolder(vscode.Uri.file(root)) !== undefined;

/** The dialect badge on a project tab: an icon of the Chernobyl icon theme (Atom Material). */
const DIALECT_ICONS: Record<string, string> = { flutter: 'flutter', react: 'react', fastapi: 'python', nestjs: 'nest', dart: 'dart', python: 'python', typescript: 'typeScript' };

export function activateWorkspace(context: vscode.ExtensionContext, http: HttpModel): Workspace {
  const ws = new Workspace(context, http);
  // the backend projects' scripts, like npm's: a task per command and the explorer's Nuclear Scripts view
  activateScripts(context, () => ws.projects(), ws.onDidChange.event);
  // the notifications of the agents: a count on each tool's tab, a badge on the strip's icon, Open goes to it
  notices.open = (n) => ws.openNotice(n);
  context.subscriptions.push(notices.onDidChange.event(() => ws.refresh()));
  followChatNotices();
  // the Builder's specs and runs, in the column while the Builder is the open tool (spec 011 requirement 25)
  context.subscriptions.push(sidebarChanged.event(() => ws.builderChanged()));
  // runs a closed or crashed editor left half done: recovered and resumed where they stopped
  setTimeout(() => resumeOrphans(ws.projects().map((p) => p.root)), 3000);
  // Nuclear Chat (spec 013): the chat as a full tab on the last project, a GIF service's key, its one connection
  context.subscriptions.push(
    vscode.commands.registerCommand('nuclear.chat.open', () => {
      const root = context.workspaceState.get<string>(LAST_PROJECT) ?? ws.projects()[0]?.root;
      if (root) openChatTab(context, root);
      else void vscode.window.showWarningMessage(l10n.t('Open a Nuclear project to talk to its team.'));
    }),
    vscode.commands.registerCommand('nuclear.chat.gifKey', () => chatGifKey()),
    { dispose: disposeChat },
  );
  // every external connection, checked now and regularly: a notification when one stops answering
  watchConnections(context);
  registerTreeCommands(context);
  http.extraRoots = () => ws.saved();
  // the Environments page (spec 021): the workspace's projects, the last one first
  activateEnvironments(context, () => ws.projects(), () => context.workspaceState.get<string>(LAST_PROJECT));
  http.refresh();
  ws.refresh();
  // one command per action, so the editor title bar can show the buttons of the active project's platform
  for (const id of ['run', 'debug', 'reload', 'device', 'build', 'test', 'check', 'api']) {
    context.subscriptions.push(vscode.commands.registerCommand(`nuclear.action.${id}`, () => ws.action(id)));
  }
  context.subscriptions.push(vscode.commands.registerCommand('nuclear.action.serve', () => ws.action('run')));
  const cards = vscode.workspace.createFileSystemWatcher('**/.nuclear/project.json');
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('nuclear.workspace', ws, { webviewOptions: { retainContextWhenHidden: true } }),
    cards,
    cards.onDidCreate(() => ws.refresh()),
    cards.onDidDelete(() => ws.refresh()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      ws.refresh();
      // the Dart extension decides at activation whether the workspace has Flutter projects: reload, then continue
      const pending = context.globalState.get<PendingAction>(PENDING);
      if (pending && inFolders(pending.root)) void vscode.commands.executeCommand('workbench.action.reloadWindow');
    }),
    http.onDidChange(() => ws.activeKey() === TOOL_PREFIX + 'http-connections' && ws.refresh()),
    devicesChanged.event(() => ws.activeKey() === TOOL_PREFIX + 'devices' && ws.refresh()),
    vscode.commands.registerCommand('nuclear.workspace.show', () => vscode.commands.executeCommand(CONTAINER)),
    vscode.commands.registerCommand('nuclear.workspace.project', (index?: number) => ws.selectProject(index)),
    vscode.commands.registerCommand('nuclear.workspace.openProject', () => ws.openProject()),
    vscode.commands.registerCommand('nuclear.workspace.tool', (id?: string) => ws.openTool(id)),
    // a member's direct message or a team's channel in Nuclear Atlas (the Builder's and the company screen's clicks)
    vscode.commands.registerCommand('nuclear.atlas.open', (root?: string, channel?: string) => ws.openAtlas(root, channel)),
    vscode.commands.registerCommand('nuclear.workspace.action', (id?: string) => ws.action(id)),
    vscode.commands.registerCommand('nuclear.workspace.welcome', () => WelcomePanel.show(context, ws)),
    vscode.commands.registerCommand('nuclear.workspace.addToVsCode', () => ws.addToVsCode()),
  );
  const pending = context.globalState.get<PendingAction>(PENDING);
  if (pending && Date.now() - pending.at < 300_000 && inFolders(pending.root)) {
    void context.globalState.update(PENDING, undefined);
    void ws.go(pending.root).then(() => ws.action(pending.id));
    return ws;
  }
  // the welcome page at startup, unless the user turned it off or the window restored editors
  if (vscode.workspace.getConfiguration().get<boolean>(WELCOME, false) && vscode.window.tabGroups.all.every((g) => g.tabs.length === 0)) {
    WelcomePanel.show(context, ws);
  }
  return ws;
}

interface SavedTab {
  path: string;
  column: vscode.ViewColumn;
  active: boolean;
}

class Workspace implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private filesWatcher: vscode.Disposable | undefined;
  private readonly icons: Icons;
  readonly onDidChange = new vscode.EventEmitter<void>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly http: HttpModel,
  ) {
    this.icons = new Icons(context);
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('workbench.iconTheme') || e.affectsConfiguration('files.exclude')) {
          this.icons.load();
          this.refresh();
        }
      }),
    );
  }

  // ---------- what is open ----------

  /** The projects of the workspace folders first, then the ones opened here, in the order they were opened. */
  projects(): Project[] {
    const out = findProjects();
    const seen = new Set(out.map((p) => p.root));
    for (const root of this.saved()) {
      if (seen.has(root)) continue;
      const p = projectAt(root);
      if (p) out.push(p);
    }
    return out;
  }

  /** The active tab: a project's root, or `tool:<id>`. */
  activeKey(): string {
    const key = this.context.workspaceState.get<string>(ACTIVE);
    if (key?.startsWith(TOOL_PREFIX)) return tools().some((t) => TOOL_PREFIX + t.id === key) ? key : TOOL_PREFIX + 'http-connections';
    const all = this.projects();
    return all.find((p) => p.root === key)?.root ?? all[0]?.root ?? '';
  }

  /** The active project, or the last one when a tool is active (the one the tools act on). */
  active(): Project | undefined {
    const key = this.activeKey();
    const root = key.startsWith(TOOL_PREFIX) ? this.context.workspaceState.get<string>(LAST_PROJECT) : key;
    const all = this.projects();
    return all.find((p) => p.root === root) ?? all[0];
  }

  /** The projects opened in this folder's workspace (Ctrl+Alt+O), kept per folder: another folder never shows them. */
  saved(): string[] {
    const here = this.context.workspaceState.get<string[]>(SAVED);
    if (here) return here;
    // before 0.63.0 they were kept for every folder: this folder keeps those inside it
    const inside = savedInside(this.context.globalState.get<string[]>(SAVED, []), (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath));
    void this.context.workspaceState.update(SAVED, inside);
    return inside;
  }

  // ---------- switching ----------

  async go(key: string): Promise<void> {
    const previous = this.activeKey();
    if (previous !== key && !(await this.switchTabs(previous, key))) return;
    await this.context.workspaceState.update(ACTIVE, key);
    if (!key.startsWith(TOOL_PREFIX)) await this.context.workspaceState.update(LAST_PROJECT, key);
    this.refresh();
    await vscode.commands.executeCommand(CONTAINER);
  }

  /** Each tab has its own editors: leaving remembers and closes them, entering reopens its own. The devices stay. */
  private async switchTabs(from: string, to: string): Promise<boolean> {
    const isDevice = (t: vscode.Tab) => t.input instanceof vscode.TabInputWebview && t.input.viewType.endsWith('synapsisDevice');
    const open = vscode.window.tabGroups.all.flatMap((g) => g.tabs).filter((t) => !isDevice(t));
    const saved = this.context.workspaceState.get<Record<string, SavedTab[]>>(TABS, {});
    if (from) {
      saved[from] = open
        .filter((t) => t.input instanceof vscode.TabInputText)
        .map((t) => ({ path: (t.input as vscode.TabInputText).uri.fsPath, column: t.group.viewColumn, active: t.isActive && t.group.isActive }));
      await this.context.workspaceState.update(TABS, saved);
      if (from === TOOL_PREFIX + 'http-connections') this.http.reopen = ComponentPanel.openKeys();
    }
    // an unsaved editor is never closed (VS Code would ask to save, as if the window closed): it stays until saved
    const closable = open.filter((t) => !t.isDirty);
    if (closable.length) await vscode.window.tabGroups.close(closable, true);
    // the devices belong to the mobile workspaces and the Devices tool: elsewhere they are parked (their apps go on).
    // Always park before reopening: a device panel left over from the previous workspace collapses into the first
    // column and the reopened code would merge into its group; unpark (below) gives it a fresh group beside the code.
    const mobile = to === TOOL_PREFIX + 'devices' || this.projects().find((p) => p.root === to)?.platform === 'mobile';
    await vscode.commands.executeCommand('nuclear.parkDevices');
    const tool = tools().find((t) => TOOL_PREFIX + t.id === to);
    if (tool) {
      if (tool.id === 'http-connections') ComponentPanel.restore(this.context, this.http, this.http.reopen);
      else if (tool.id === 'devices') await vscode.commands.executeCommand('nuclear.unparkDevices');
      else if (tool.id === 'builder') BuilderPanel.show(this.context, () => this.projects(), this.context.workspaceState.get<string>(LAST_PROJECT));
      else if (tool.id === 'settings') SettingsPanel.show(this.context);
      else if (tool.id === 'atlas') AtlasPanel.show(this.context, () => this.projects(), this.context.workspaceState.get<string>(LAST_PROJECT));
      else if (tool.id === 'environments') await vscode.commands.executeCommand(tool.command!, this.context.workspaceState.get<string>(LAST_PROJECT));
      else if (tool.command) await vscode.commands.executeCommand(tool.command);
      else if (tool.planned.length) ToolPanel.show(this.context, tool);
      return true;
    }
    for (const t of (saved[to] ?? []).sort((a, b) => Number(a.active) - Number(b.active))) {
      try {
        await vscode.window.showTextDocument(vscode.Uri.file(t.path), { viewColumn: t.column, preview: false, preserveFocus: !t.active });
      } catch {
        // the file is gone
      }
    }
    if (mobile) await vscode.commands.executeCommand('nuclear.unparkDevices'); // beside the code just reopened
    return true;
  }

  async selectProject(index?: number): Promise<void> {
    const all = this.projects();
    let p = index !== undefined ? all[index - 1] : undefined;
    if (index === undefined) {
      const pick = await vscode.window.showQuickPick(
        all.map((x, i) => ({ label: `${i < 9 ? `Ctrl+${i + 1}  ` : ''}${x.name}`, description: `${x.platform ?? ''} · ${x.dialect}`, detail: x.root, x })),
        { placeHolder: l10n.t('Project to show') },
      );
      p = pick?.x;
    }
    if (!p) {
      if (index !== undefined) void vscode.window.showInformationMessage(l10n.t('No project {0} in the Nuclear workspace (Ctrl+Alt+O opens one).', index));
      return;
    }
    await this.go(p.root);
  }

  async openProject(): Promise<void> {
    const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: l10n.t('Open as a Nuclear project') });
    const root = picked?.[0]?.fsPath;
    if (!root) return;
    if (!projectAt(root)) {
      void vscode.window.showWarningMessage(l10n.t('{0} is not a Nuclear project (no config.nuc, nuclear.toml or .nuclear/project.json).', path.basename(root)));
      return;
    }
    const saved = this.saved();
    if (!saved.includes(root)) await this.context.workspaceState.update(SAVED, [...saved, root]);
    this.http.refresh();
    await this.go(root);
  }

  async removeProject(root: string): Promise<void> {
    await this.context.workspaceState.update(SAVED, this.saved().filter((r) => r !== root));
    if (this.activeKey() === root) await this.context.workspaceState.update(ACTIVE, undefined);
    this.http.refresh();
    this.refresh();
  }

  /** *Open* on a notification: its tool, on the run's node or the chat's channel it is about. */
  async openNotice(n: Notice): Promise<void> {
    await this.go(TOOL_PREFIX + n.tool);
    if (n.tool === 'builder') {
      BuilderPanel.show(this.context, () => this.projects(), n.root, n.ref);
      if (n.ref && n.stage) BuilderPanel.drive(this.context, () => this.projects(), { op: 'node', id: n.ref, stage: n.stage, step: n.step });
    } else if (n.tool === 'settings') SettingsPanel.show(this.context);
    else AtlasPanel.show(this.context, () => this.projects(), n.root, chatWhere(n));
  }

  /** Nuclear Atlas on a conversation: `dm-<member>` or a team's channel, of `root` (else the last project). */
  async openAtlas(root?: string, channel?: string): Promise<void> {
    await this.go(TOOL_PREFIX + 'atlas');
    AtlasPanel.show(this.context, () => this.projects(), root ?? this.context.workspaceState.get<string>(LAST_PROJECT), channel);
  }

  async openTool(id?: string): Promise<void> {
    let tool = tools().find((t) => t.id === id);
    if (!id) {
      const pick = await vscode.window.showQuickPick(tools().map((t) => ({ label: `${t.key}  ${t.label}`, description: t.about, t })), { placeHolder: l10n.t('Tool to open') });
      tool = pick?.t;
    }
    if (!tool) return;
    await this.go(TOOL_PREFIX + tool.id);
    if (tool.planned.length) ToolPanel.show(this.context, tool);
  }

  // ---------- the actions of a project ----------

  async action(id?: string): Promise<void> {
    const p = this.active();
    if (!p) {
      void vscode.window.showInformationMessage(l10n.t('No project in the Nuclear workspace (Ctrl+Alt+O opens one).'));
      return;
    }
    const actions = platformActions()[p.platform ?? ''] ?? [];
    let a = actions.find((x) => x.id === id);
    if (!id) {
      const pick = await vscode.window.showQuickPick(actions.map((x) => ({ label: `${x.key}  ${x.label}`, description: x.title, x })), { placeHolder: `${p.name} (${p.platform})` });
      a = pick?.x;
    }
    if (!a) {
      if (id) void vscode.window.showInformationMessage(p.platform ? l10n.t('{0} is a {1} project: it has no "{2}" action.', p.name, p.platform, id) : l10n.t('{0} is a plain project: it has no "{1}" action.', p.name, id));
      return;
    }
    if (p.platform === 'mobile' && ['run', 'debug', 'device'].includes(a.id) && !(await this.inWorkspace(p, a.id))) return;
    if (p.platform === 'mobile' && (a.id === 'run' || a.id === 'debug')) return this.pickDevice(p, a.id);
    if (p.platform === 'web' && a.id === 'device') return vscode.commands.executeCommand('nuclear.webDevice.open', p.root);
    if (p.platform === 'web' && a.id === 'debug') return vscode.commands.executeCommand('nuclear.webDevice.debug', p.root);
    if (p.platform === 'web' && a.id === 'reload') return vscode.commands.executeCommand('nuclear.webDevice.reload', p.root);
    if (a.id === 'debug') return vscode.commands.executeCommand('nuclear.debug', p.root);
    if (a.id === 'reload') return vscode.commands.executeCommand('flutter.hotReload');
    if (a.id === 'device') return this.pickDevice(p, 'device');
    if (a.id === 'api') return this.openTool('http-connections');
    let cmd = TERMINAL_COMMANDS[p.platform ?? '']?.[a.id];
    if (!cmd) return;
    // `nuclear run` installs the packages itself (a step of its log); `test` does not
    if (p.platform !== 'mobile' && a.id === 'test' && !isInstalled(p.root)) cmd = `nuclear install && ${cmd}`;
    const name = `${p.name} · ${a.id}`;
    const terminal = vscode.window.terminals.find((t) => t.name === name) ?? vscode.window.createTerminal({ name, cwd: p.root });
    terminal.show(true);
    const offset = logSize(p.root);
    terminal.sendText(cmd);
    if (a.id === 'run') followRun(p.root, p.name, offset, () => void this.action(a!.id));
  }

  /** The Dart extension launches Flutter only for a project inside the workspace folders ("Dart-only workspace"):
   * a project opened as a tab joins them first; the window reloads and `activateWorkspace` continues the action. */
  private async inWorkspace(p: Project, id: string): Promise<boolean> {
    if (inFolders(p.root)) return true;
    await this.context.globalState.update(PENDING, { root: p.root, id, at: Date.now() });
    void vscode.window.showInformationMessage(l10n.t('{0} joins the VS Code workspace folders (the Dart extension runs Flutter only there); the window reloads and the {1} continues.', p.name, id));
    await this.addToVsCode();
    return false;
  }

  /** ▷ Run, ◉ Debug and ▭ Device of a mobile project: the Synapsis devices (shown or hidden) to run on, a new
   * one, any other Flutter device (emulators, phones, Chrome, desktop: Flutter's own picker), or the Devices
   * workspace. */
  private async pickDevice(p: Project, mode: 'run' | 'debug' | 'device'): Promise<void> {
    type Item = vscode.QuickPickItem & { id: string };
    const items: Item[] = [
      ...devices().map((d) => ({ label: `$(device-mobile) ${d.title}`, description: d.status === 'idle' ? l10n.t('free') : d.status === 'hidden' ? l10n.t('running, hidden') : d.status === 'live' ? l10n.t('live · runs again') : l10n.t('starting · runs again'), id: d.id })),
      { label: `$(add) ${l10n.t('New Synapsis device…')}`, description: l10n.t('one more, beside the others'), id: 'new' },
      ...(mode === 'device'
        ? [{ label: `$(layout) ${l10n.t('Devices workspace')}`, description: tools().find((t) => t.id === 'devices')?.key, id: 'tool' }]
        : [{ label: `$(vm) ${l10n.t('Other Flutter device…')}`, description: l10n.t('emulators, phones, Chrome, desktop'), id: 'flutter' }]),
    ];
    const pick = await vscode.window.showQuickPick(items, { placeHolder: mode === 'debug' ? l10n.t('Debug {0} on', p.name) : l10n.t('Run {0} on', p.name) });
    if (!pick) return;
    if (pick.id === 'tool') return this.openTool('devices');
    if (pick.id === 'flutter') {
      await vscode.commands.executeCommand('flutter.selectDevice');
      return vscode.commands.executeCommand(mode === 'debug' ? 'nuclear.debug' : 'nuclear.run', p.root);
    }
    let id: string | undefined = pick.id;
    if (id === 'new') id = (await this.newDevice())?.id;
    if (id) await vscode.commands.executeCommand('nuclear.runOnDevice', id, p.root, mode === 'run');
  }

  /** The mobile project a device runs: the active one, else the only one, else a pick. */
  private async mobileRoot(): Promise<string | undefined> {
    const active = this.active();
    if (active?.platform === 'mobile') return active.root;
    const mobile = this.projects().filter((p) => p.platform === 'mobile');
    if (!mobile.length) {
      void vscode.window.showInformationMessage(l10n.t('No mobile project in the Nuclear workspace: the devices run mobile apps.'));
      return undefined;
    }
    if (mobile.length === 1) return mobile[0].root;
    const pick = await vscode.window.showQuickPick(mobile.map((p) => ({ label: p.name, detail: p.root, root: p.root })), { placeHolder: l10n.t('Mobile project to run on the device') });
    return pick?.root;
  }

  async addToVsCode(): Promise<void> {
    const p = this.active();
    if (!p) return;
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.some((f) => f.uri.fsPath === p.root)) return;
    vscode.workspace.updateWorkspaceFolders(folders.length, 0, { uri: vscode.Uri.file(p.root), name: p.name });
  }

  // ---------- the view ----------

  refresh(): void {
    this.onDidChange.fire();
    const key = this.activeKey();
    const active = key.startsWith(TOOL_PREFIX) ? undefined : this.active();
    // the editor title bar shows the actions of this platform (package.json `editor/title`, `when: nuclear.platform == ...`)
    void vscode.commands.executeCommand('setContext', 'nuclear.platform', active?.platform ?? '');
    if (!this.view) return;
    const unread = notices.unread();
    this.view.badge = unread ? { value: unread, tooltip: unread === 1 ? l10n.t('1 notification of the agents') : l10n.t('{0} notifications of the agents', unread) } : undefined;
    const webview = this.view.webview;
    this.watchFiles(active?.root);
    const tool = tools().find((t) => TOOL_PREFIX + t.id === key);
    const envs = this.http.environments();
    const pane = !tool
      ? { kind: 'files', project: active && { ctx: JSON.stringify(contextFor(active.platform, active.root, active.root, true)), root: active.root, name: active.name, platform: active.platform, dialect: active.dialect, actions: platformActions()[active.platform ?? ''] ?? [] } }
      : tool.id === 'http-connections'
        ? { kind: 'tree', nodes: this.http.tree(), environment: envs.active }
        : tool.id === 'devices'
          ? { kind: 'devices', devices: devices(), project: this.active()?.name }
          : tool.id === 'builder'
            ? { kind: 'builder', sidebar: builderSidebar() }
            : { kind: 'template', tool: { id: tool.id, label: tool.label, about: tool.about, key: tool.key, soon: tool.planned.length > 0 } };
    void webview.postMessage({
      type: 'state',
      projects: this.projects().map((p) => ({
        root: p.root,
        name: p.name,
        platform: p.platform,
        dialect: p.dialect,
        saved: this.saved().includes(p.root),
        platformIcon: p.platform ? this.icons.uri(webview, 'icons', `platform-${p.platform}.svg`) : undefined,
        dialectIcon: DIALECT_ICONS[p.dialect] ? this.icons.uri(webview, 'icon-themes', 'atom', 'files', `${DIALECT_ICONS[p.dialect]}.svg`) : undefined,
      })),
      active: key,
      tools: tools().map((t) => ({ id: t.id, label: t.label, short: t.short, key: t.key, soon: t.planned.length > 0, unread: t.id === 'atlas' || t.id === 'builder' || t.id === 'settings' ? notices.unread(t.id) : 0 })),
      pane,
      // every tool's notices, newest first: the list at the bottom of the column
      notices: notices.all().map((n) => ({ id: n.id, tool: n.tool, title: n.title, text: n.text, level: n.level, at: n.at, read: n.read })),
    });
  }

  /** The Builder's specs or runs changed: the column draws them again while the Builder is the open tool. */
  builderChanged(): void {
    if (this.activeKey() === TOOL_PREFIX + 'builder') void this.view?.webview.postMessage({ type: 'builderSidebar', sidebar: builderSidebar() });
  }

  /** New or deleted files of the active project reach the tree. */
  private watchFiles(root: string | undefined): void {
    this.filesWatcher?.dispose();
    this.filesWatcher = undefined;
    if (!root) return;
    const w = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, '**'), false, true, false);
    // a build writes hundreds of files: the folders that changed reach the tree at most every 200 ms
    const dirs = new Set<string>();
    let timer: NodeJS.Timeout | undefined;
    const changed = (uri: vscode.Uri) => {
      dirs.add(path.dirname(uri.fsPath));
      timer ??= setTimeout(() => {
        timer = undefined;
        void this.view?.webview.postMessage({ type: 'refreshDirs', dirs: [...dirs] });
        dirs.clear();
      }, 200);
    };
    this.filesWatcher = vscode.Disposable.from(w, w.onDidCreate(changed), w.onDidDelete(changed), { dispose: () => clearTimeout(timer) });
  }

  /** The active editor's file is selected in the tree, its folders opened, as the explorer does. */
  private reveal(uri: vscode.Uri | undefined): void {
    const root = this.active()?.root;
    if (!root || !uri || uri.scheme !== 'file') return;
    const rel = path.relative(root, uri.fsPath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return;
    void this.view?.webview.postMessage({ type: 'reveal', parts: rel.split(path.sep) });
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'icons'), vscode.Uri.joinPath(this.context.extensionUri, 'icon-themes')] };
    const localized = localize(view.webview, () => stripHtml(view.webview), () => this.refresh());
    view.onDidDispose(() => {
      this.view = undefined;
      localized.dispose();
      this.watchFiles(undefined);
    });
    this.context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((e) => this.reveal(e?.document.uri)));
    view.webview.onDidReceiveMessage((m: { type: string; op?: string; stage?: string; step?: string; dir?: string; path?: string; root?: string; id?: string; endpoint?: unknown; action?: NodeAction; preset?: string; notice?: number }) => {
      switch (m.type) {
        case 'list':
          if (m.dir) {
            const p = this.active();
            const entries = this.icons.entriesOf(view.webview, m.dir).map((e) => ({ ...e, ctx: p && JSON.stringify(contextFor(p.platform, p.root, path.join(m.dir!, e.name), e.dir)) }));
            void view.webview.postMessage({ type: 'entries', dir: m.dir, entries });
          }
          break;
        case 'open':
          if (m.path) void vscode.commands.executeCommand('vscode.open', vscode.Uri.file(m.path));
          break;
        case 'project':
          if (m.root) void this.go(m.root);
          break;
        case 'remove':
          if (m.root) void this.removeProject(m.root);
          break;
        case 'add':
          void this.openProject();
          break;
        case 'tool':
          if (m.id) void this.openTool(m.id);
          break;
        case 'builder':
          // a click in the Builder's column drives its page
          if (m.op) BuilderPanel.drive(this.context, () => this.projects(), { op: m.op, id: m.id, stage: m.stage, step: m.step });
          break;
        case 'notice': {
          const n = notices.all().find((x) => x.id === m.notice);
          if (n) void this.openNotice(n);
          break;
        }
        case 'action':
          void this.action(m.id);
          break;
        case 'endpoint':
          if (m.endpoint) void vscode.commands.executeCommand('nuclear.httpConnections.open', m.endpoint);
          break;
        case 'nodeAction':
          if (m.action?.type === 'updateContracts') void this.http.updateContracts(m.action.root, m.action.name);
          if (m.action?.type === 'addOpenApi') void this.http.addOpenApi();
          if (m.action?.type === 'open' || m.action?.type === 'addSocket') this.http.runAction(m.action);
          break;
        case 'environment':
          void this.http.selectEnvironment();
          break;
        case 'editEnvironments':
          void this.http.editEnvironments();
          break;
        case 'httpRefresh':
          this.http.refresh();
          break;
        case 'newDevice':
          void this.newDevice();
          break;
        case 'device':
          if (m.id) revealDevice(m.id);
          break;
        case 'closeDevice':
          void vscode.commands.executeCommand('nuclear.closeDevice', m.id);
          break;
        case 'runOnDevice':
          void this.mobileRoot().then(async (root) => {
            const p = root ? this.projects().find((x) => x.root === root) : undefined;
            if (p && (await this.inWorkspace(p, 'device'))) await vscode.commands.executeCommand('nuclear.runOnDevice', m.id, root);
          });
          break;
      }
    });
    this.refresh();
  }

  private async newDevice(): Promise<{ id: string } | undefined> {
    const pick = await vscode.window.showQuickPick(
      PRESETS.map((p) => ({ label: p.name, description: `${p.width}×${p.height} · ${p.os}`, name: p.name })),
      { placeHolder: l10n.t('Device to open (one more panel beside the others)') },
    );
    return pick ? vscode.commands.executeCommand<{ id: string }>('nuclear.openDevice', pick.name) : undefined;
  }
}

/** A project by its folder: the card when it exists, else `config.nuc` / `nuclear.toml` read directly. */
function projectAt(root: string): Project | undefined {
  const fromCard = readProject(root);
  if (fromCard) return fromCard;
  const read = (f: string) => {
    try {
      return fs.readFileSync(path.join(root, f), 'utf8');
    } catch {
      return undefined;
    }
  };
  const config = read('config.nuc');
  const toml = read('nuclear.toml');
  if (config === undefined && toml === undefined) return undefined;
  const take = (text: string | undefined, re: RegExp) => (text ? re.exec(text)?.[1] : undefined);
  return {
    root,
    name: take(config, /app\s*\([^)]*name\s*=\s*"([^"]+)"/) ?? take(toml, /^name\s*=\s*"([^"]+)"/m) ?? path.basename(root),
    platform: take(config, /platform\s*=\s*"([^"]+)"/) ?? null,
    dialect: take(config, /dialect\s*=\s*"([^"]+)"/) ?? take(toml, /^dialect\s*=\s*"([^"]+)"/m) ?? '',
    contracts: [],
  };
}

/**
 * The file tree wears the Chernobyl icon theme (the user's one when it is a Chernobyl variant, else the first), with the
 * same lookup VS Code's explorer does: file name, then the longest extension, then the default; folders by name, open or
 * closed. `files.exclude` (plain `**\/name` patterns) hides entries as in the explorer.
 */
class Icons {
  private theme: IconTheme = { iconDefinitions: {}, folderNames: {}, folderNamesExpanded: {}, fileNames: {}, fileExtensions: {}, folder: '', folderExpanded: '', file: '' };
  private excluded = new Set<string>();

  constructor(private readonly context: vscode.ExtensionContext) {
    this.load();
  }

  load(): void {
    const id = vscode.workspace.getConfiguration('workbench').get<string>('iconTheme');
    const slug = id === 'chernobyl-soft-icons' ? 'chernobyl-soft' : 'chernobyl';
    try {
      this.theme = JSON.parse(fs.readFileSync(path.join(this.context.extensionPath, 'icon-themes', `${slug}-icon-theme.json`), 'utf8')) as IconTheme;
    } catch {
      // the icons are generated by theme/icons.mjs; without them the tree has no icons
    }
    this.excluded = new Set(
      Object.entries(vscode.workspace.getConfiguration('files').get<Record<string, boolean>>('exclude', {}))
        .filter(([pattern, on]) => on && /^(\*\*\/)?[^*?{}[\]/]+$/.test(pattern))
        .map(([pattern]) => pattern.replace(/^\*\*\//, '')),
    );
  }

  uri(webview: vscode.Webview, ...parts: string[]): string {
    return webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, ...parts)).toString();
  }

  private icon(webview: vscode.Webview, id: string | undefined): string | undefined {
    const def = id ? this.theme.iconDefinitions[id] : undefined;
    return def ? this.uri(webview, 'icon-themes', ...def.iconPath.replace(/^\.\//, '').split('/')) : undefined;
  }

  entriesOf(webview: vscode.Webview, dir: string): Entry[] {
    const t = this.theme;
    try {
      return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.name !== '.git' && !this.excluded.has(e.name))
        .map((e) => {
          const lower = e.name.toLowerCase();
          if (e.isDirectory()) {
            return { name: e.name, dir: true, icon: this.icon(webview, t.folderNames[lower] ?? t.folder), iconOpen: this.icon(webview, t.folderNamesExpanded[lower] ?? t.folderExpanded) };
          }
          let id = t.fileNames[lower];
          const parts = lower.split('.');
          for (let i = 1; id === undefined && i < parts.length; i++) id = t.fileExtensions[parts.slice(i).join('.')];
          return { name: e.name, dir: false, icon: this.icon(webview, id ?? t.file) };
        })
        .sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    } catch {
      return [];
    }
  }
}

interface IconTheme {
  iconDefinitions: Record<string, { iconPath: string }>;
  folderNames: Record<string, string>;
  folderNamesExpanded: Record<string, string>;
  fileNames: Record<string, string>;
  fileExtensions: Record<string, string>;
  folder: string;
  folderExpanded: string;
  file: string;
}

interface Entry {
  name: string;
  dir: boolean;
  icon?: string;
  iconOpen?: string;
}

// ---------------------------------------------------------------- the strip and the pane

/** The glyphs of the endpoints tree and the devices (16 px, stroke = currentColor), like VS Code's codicons. */
const GLYPHS: Record<string, string> = {
  backend: '<rect x="2" y="3" width="12" height="4" rx="1"/><rect x="2" y="9" width="12" height="4" rx="1"/><path d="M4.5 5h.01M4.5 11h.01" stroke-width="2"/>',
  mobile: '<rect x="4.5" y="1.5" width="7" height="13" rx="1.5"/><path d="M7 12.5h2"/>',
  web: '<circle cx="8" cy="8" r="6"/><ellipse cx="8" cy="8" rx="2.5" ry="6"/><path d="M2 8h12"/>',
  project: '<path d="M2 5l6-3 6 3v6l-6 3-6-3zM2 5l6 3 6-3M8 8v6"/>',
  component: '<path d="M6 2C4 2 4 3 4 4v2c0 1-1 2-2 2 1 0 2 1 2 2v2c0 1 0 2 2 2M10 2c2 0 2 1 2 2v2c0 1 1 2 2 2-1 0-2 1-2 2v2c0 1 0 2-2 2"/>',
  get: '<path d="M8 3v10M4 9l4 4 4-4"/>',
  post: '<path d="M8 13V3M4 7l4-4 4 4"/>',
  put: '<path d="M3 13l1-4 7-7 3 3-7 7z"/>',
  patch: '<path d="M3 13l1-4 7-7 3 3-7 7zM9 4l3 3"/>',
  delete: '<path d="M3 4h10M6 4V2h4v2M5 4l1 10h4l1-10"/>',
  law: '<path d="M4 2h6l3 3v9H4zM10 2v3h3M6 8h4M6 11h4"/>',
  check: '<path d="M3 8l3 3 7-7"/>',
  warning: '<path d="M8 2l6 12H2zM8 7v3M8 12v.5"/>',
  book: '<path d="M3 3h4a2 2 0 012 2v9a1 1 0 00-1-1H3zM13 3H9a2 2 0 00-2 2v9a1 1 0 011-1h5z"/>',
  cloud: '<path d="M5 13a3 3 0 010-6 4 4 0 017.7 1A2.5 2.5 0 0112 13z"/>',
  tag: '<path d="M2 2h6l6 6-6 6-6-6zM5 5h.5"/>',
  info: '<circle cx="8" cy="8" r="6.5"/><path d="M8 7v4M8 5v.5"/>',
  device: '<rect x="4" y="1.5" width="8" height="13" rx="1.5"/><path d="M7 12.5h2"/>',
};

/** The tools' icons on the strip (24 px grid, a 1.6 line, round joins: the HUD's line), one meaning each. */
const TOOL_ICONS: Record<string, string> = {
  // a factory whose line carries the pieces from station to station
  builder: '<path d="M3 20.5V11l5 3v-3l5 3v-3l5 3V3.5h3v17z"/><path d="M6.5 17.5h1.5M11.25 17.5h1.5M16 17.5h1.5"/>',
  // three people: the company's crews
  teams: '<circle cx="12" cy="8" r="3.2"/><path d="M6.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="5.5" cy="10" r="2.2"/><path d="M1.8 18a3.8 3.8 0 0 1 5-3.5"/><circle cx="18.5" cy="10" r="2.2"/><path d="M22.2 18a3.8 3.8 0 0 0-5-3.5"/>',
  // a bar chart with a coin: what the factory made and what it cost
  reports: '<path d="M3 20.5h18M5.5 20.5v-6M10 20.5V9.5M14.5 20.5v-4"/><circle cx="17.5" cy="7" r="3.5"/><path d="M17.5 5.3v3.4"/>',
  // a chat bubble with the agent's spark
  atlas: '<path d="M4.5 4h15A1.5 1.5 0 0 1 21 5.5v10a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h-1A1.5 1.5 0 0 1 3 15.5v-10A1.5 1.5 0 0 1 4.5 4z"/><path d="M12 6.8l1.1 2.8 2.8 1.1-2.8 1.1-1.1 2.8-1.1-2.8-2.8-1.1 2.8-1.1z"/>',
  // a plug, its signal both ways (REST and WebSockets)
  'http-connections': '<path d="M9.5 3v4M14.5 3v4M7 7h10v3.5a5 5 0 0 1-10 0zM12 15.5V21"/><path d="M19.6 4.2a5 5 0 0 1 0 6.6M4.4 4.2a5 5 0 0 0 0 6.6"/>',
  // a phone
  devices: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.2"/><path d="M10.5 18.5h3M11 5.5h2"/>',
  // a gauge with its needle
  monitor: '<path d="M3.5 17.5a8.5 8.5 0 1 1 17 0"/><path d="M12 9.5V11M6.6 11.6l1 1M17.4 11.6l-1 1M12 17.5l3.5-4.5"/><circle cx="12" cy="17.5" r="1.4"/><path d="M3.5 21h17"/>',
  // three layers, one per environment, the top one lit: the active environment
  environments: '<path d="M12 3 3 7.5 12 12l9-4.5z"/><path d="M3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5"/><circle cx="12" cy="7.5" r="1.2"/>',
  // a pen's nib
  designer: '<path d="M12 2.5l5.5 7-2.8 8H9.3l-2.8-8z"/><path d="M12 2.5v8"/><circle cx="12" cy="11.8" r="1.4"/><path d="M8.5 21h7"/>',
  // a page with its lines
  docs: '<path d="M14 2.5H6.5A1.5 1.5 0 0 0 5 4v16a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20V7.5z"/><path d="M14 2.5v5h5M8.5 12.5h7M8.5 16.5h4.5"/>',
  // a gear
  settings: '<path d="M18.8 9.34L21.32 10.15L21.32 13.85L18.8 14.66L18.69 14.93L19.9 17.28L17.28 19.9L14.93 18.69L14.66 18.8L13.85 21.32L10.15 21.32L9.34 18.8L9.07 18.69L6.72 19.9L4.1 17.28L5.31 14.93L5.2 14.66L2.68 13.85L2.68 10.15L5.2 9.34L5.31 9.07L4.1 6.72L6.72 4.1L9.07 5.31L9.34 5.2L10.15 2.68L13.85 2.68L14.66 5.2L14.93 5.31L17.28 4.1L19.9 6.72L18.69 9.07Z"/><circle cx="12" cy="12" r="3.2"/>',
};

export function stripHtml(webview: vscode.Webview): string {
  const nonce = Math.random().toString(36).slice(2);
  return /* html */ `<!DOCTYPE html>
<html lang="${lang()}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<style>
  html, body { height: 100%; margin: 0; }
  .strip .nuc-lang { margin: 0 auto 6px; padding: 3px 0; width: 32px; flex-direction: column; gap: 1px; font-size: 9px; border: none; opacity: .7; } .strip .nuc-lang:hover { opacity: 1; }
  body { display: flex; height: 100vh; font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground); overflow: hidden; }
  .strip { width: 42px; flex: none; display: flex; flex-direction: column; background: var(--vscode-sideBarSectionHeader-background); border-right: 1px solid var(--vscode-sideBarSectionHeader-border, transparent); overflow: hidden auto; }
  .tools { margin-top: auto; padding-bottom: 6px; flex: none; }
  .tab { position: relative; width: 32px; height: 32px; margin: 5px auto 0; border-radius: 5px; display: grid; place-items: center; font-size: 10px; font-weight: 600; cursor: pointer; opacity: .7; user-select: none; letter-spacing: .02em; }
  .tab:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
  .section { margin: 14px 8px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; opacity: .7; }
  .notice { margin: 2px 6px; padding: 5px 8px; border-radius: 4px; cursor: pointer; border-left: 3px solid transparent; display: flex; flex-direction: column; gap: 1px; }
  .notice:hover { background: var(--vscode-list-hoverBackground); } .notice small { opacity: .7; }
  .notice.unread { border-left-color: var(--vscode-activityBarBadge-background); } .notice.error b { color: var(--vscode-errorForeground); }
  .tab .badge { position: absolute; top: -3px; right: -3px; min-width: 14px; height: 14px; padding: 0 3px; box-sizing: border-box; border-radius: 7px; font-size: 9px; line-height: 14px; text-align: center; color: var(--vscode-activityBarBadge-foreground); background: var(--vscode-activityBarBadge-background); opacity: 1; }
  .tab.on { opacity: 1; background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground)); box-shadow: inset 2px 0 0 var(--vscode-focusBorder); }
  .tab .n { position: absolute; left: 2px; top: 1px; font-size: 8px; opacity: .6; font-weight: 400; }
  .tab img.pi { width: 20px; height: 20px; }
  .tab img.di { position: absolute; right: -3px; bottom: -3px; width: 14px; height: 14px; border-radius: 3px; background: var(--vscode-sideBar-background); padding: 1px; }
  .tab svg.g { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
  /* the tools: an icon in its colour over a word, a HUD frame when open */
  .tool { --tc: var(--vscode-foreground); position: relative; width: 38px; height: 40px; margin: 3px auto 0; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; cursor: pointer; user-select: none; color: var(--tc); outline: none; }
  .tool svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; opacity: .8; transition: opacity .12s, filter .12s; }
  .tool .w { font: 600 7.5px/1 var(--vscode-editor-font-family, monospace); letter-spacing: .06em; color: var(--vscode-foreground); opacity: .55; max-width: 38px; overflow: hidden; text-overflow: clip; white-space: nowrap; }
  .tool:hover { background: color-mix(in srgb, var(--tc) 10%, transparent); } .tool:hover svg { opacity: 1; } .tool:hover .w { opacity: .85; }
  .tool:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
  .tool.on { background: color-mix(in srgb, var(--tc) 16%, transparent); } .tool.on svg { opacity: 1; filter: drop-shadow(0 0 3px color-mix(in srgb, var(--tc) 70%, transparent)); } .tool.on .w { opacity: 1; color: var(--tc); }
  .tool.on::before, .tool.on::after { content: ''; position: absolute; width: 6px; height: 6px; border: 1.5px solid var(--tc); pointer-events: none; }
  .tool.on::before { left: 0; top: 0; border-right: none; border-bottom: none; } .tool.on::after { right: 0; bottom: 0; border-left: none; border-top: none; }
  .tool .bar { position: absolute; left: -2px; top: 8px; bottom: 8px; width: 2px; border-radius: 1px; background: var(--tc); box-shadow: 0 0 6px var(--tc); opacity: 0; } .tool.on .bar { opacity: 1; }
  .tool.soon svg { opacity: .45; stroke-dasharray: 2.2 1.8; } .tool.soon .w { opacity: .4; }
  .tool .badge { position: absolute; top: 0; right: 0; min-width: 13px; height: 13px; padding: 0 3px; box-sizing: border-box; border-radius: 2px; font: 700 8.5px/11px var(--vscode-editor-font-family, monospace); text-align: center; color: var(--tc); background: var(--vscode-sideBar-background, #000); border: 1px solid var(--tc); box-shadow: 0 0 5px color-mix(in srgb, var(--tc) 75%, transparent); animation: ping 1.6s ease-out 2; }
  @keyframes ping { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--tc) 80%, transparent); } 100% { box-shadow: 0 0 0 6px transparent; } }
  @media (prefers-reduced-motion: reduce) { .tool .badge { animation: none; } }
  .t-builder { --tc: var(--vscode-nuclearHttpConnections-put, var(--vscode-charts-yellow, #cca700)); }
  .t-teams { --tc: var(--vscode-nuclearHttpConnections-component, var(--vscode-charts-purple, #b180d7)); }
  .t-reports { --tc: var(--vscode-nuclearHttpConnections-put, var(--vscode-charts-yellow, #cca700)); }
  .t-atlas { --tc: var(--vscode-nuclearHttpConnections-post, var(--vscode-charts-green, #89d185)); }
  .t-http-connections { --tc: var(--vscode-nuclearHttpConnections-get, var(--vscode-charts-blue, #75beff)); }
  .t-devices { --tc: var(--vscode-nuclearHttpConnections-platform, var(--vscode-charts-green, #89d185)); }
  .t-monitor { --tc: var(--vscode-nuclearHttpConnections-delete, var(--vscode-charts-red, #f14c4c)); }
  .t-environments { --tc: var(--vscode-nuclearHttpConnections-component, var(--vscode-charts-purple, #b180d7)); }
  .t-designer { --tc: var(--vscode-nuclearHttpConnections-patch, var(--vscode-charts-orange, #d18616)); }
  .t-docs { --tc: var(--vscode-nuclearHttpConnections-project, var(--vscode-charts-yellow, #cca700)); }
  .t-settings { --tc: var(--vscode-foreground); }
  .tip { position: fixed; z-index: 3; left: 46px; padding: 6px 9px; border-radius: 4px; font-size: 12px; line-height: 1.35; max-width: 220px; background: var(--vscode-editorHoverWidget-background, var(--vscode-notifications-background)); color: var(--vscode-editorHoverWidget-foreground, var(--vscode-foreground)); border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-widget-border, #8886)); border-left: 2px solid var(--tc); box-shadow: 0 2px 8px rgba(0,0,0,.35); pointer-events: none; opacity: 0; transition: opacity .1s; }
  .tip.on { opacity: 1; } .tip b { display: block; } .tip kbd { font-family: var(--vscode-editor-font-family); font-size: 11px; opacity: .8; } .tip small { display: block; opacity: .7; margin-top: 2px; }
  .tab.add { opacity: .5; font-size: 16px; font-weight: 300; border: 1px dashed currentColor; }
  .tab.add:hover { opacity: 1; }
  .col { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .pane { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
  .notes { flex: none; max-height: 38%; overflow: auto; border-top: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-widget-border, #8884)); padding-bottom: 4px; } .notes .section { margin-top: 8px; }
  .notice.unread { border-left-color: var(--tc, var(--vscode-activityBarBadge-background)); }
  .head { padding: 6px 10px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; opacity: .75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: none; }
  .head b { font-weight: 600; }
  .actions { display: flex; flex-wrap: wrap; gap: 4px; padding: 2px 8px 6px; flex: none; }
  .actions button { font-family: inherit; font-size: 11px; padding: 2px 7px; border-radius: 3px; border: 1px solid var(--vscode-button-border, transparent); background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; }
  .actions button:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .actions button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .acc { flex: none; border-top: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-widget-border, #8884)); }
  .acc-h { display: flex; align-items: center; gap: 2px; width: 100%; height: 22px; padding: 0 4px; border: none; background: var(--vscode-sideBarSectionHeader-background, transparent); color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground)); font: 700 11px var(--vscode-font-family); text-transform: uppercase; cursor: pointer; text-align: left; }
  .acc-h .c { width: 16px; height: 16px; display: flex; transition: transform .1s ease; } .acc-h .c svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.3; }
  .acc.open .acc-h .c { transform: rotate(90deg); } .acc-b { display: none; padding-bottom: 4px; } .acc.open .acc-b { display: block; }
  .acc-b .row { padding-left: 20px; gap: 6px; } .acc-b .row .k { width: 14px; text-align: center; opacity: .8; }
  .envbar { display: flex; align-items: center; gap: 6px; padding: 2px 10px 6px; font-size: 11px; opacity: .85; flex: none; }
  .envbar a { color: var(--vscode-textLink-foreground); cursor: pointer; }
  .tree { flex: 1; overflow: auto; }
  .row { display: flex; align-items: center; gap: 3px; height: 22px; line-height: 22px; white-space: nowrap; cursor: pointer; padding-right: 6px; }
  .row:hover { background: var(--vscode-list-hoverBackground); }
  .row.sel { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground)); }
  .row .c { width: 14px; flex: none; text-align: center; font-size: 10px; opacity: .7; transition: transform .1s; }
  .row.open .c { transform: rotate(90deg); }
  .row img.i { width: 16px; height: 16px; flex: none; margin-right: 2px; }
  .row svg.g { width: 16px; height: 16px; flex: none; margin-right: 3px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
  .row .name { overflow: hidden; text-overflow: ellipsis; }
  .row .desc { opacity: .55; font-size: 11px; margin-left: 4px; overflow: hidden; text-overflow: ellipsis; }
  .row .btn { margin-left: auto; font-size: 11px; padding: 0 6px; border-radius: 3px; opacity: 0; background: var(--vscode-toolbar-hoverBackground); }
  .row:hover .btn { opacity: 1; }
  .row.dir .name { font-weight: 500; }
  .row.nuc .name { color: var(--vscode-nuclearHttpConnections-project); }
  /* the files of a project: VS Code's explorer (twistie, indent guides on hover, selection and focus of a list) */
  .tree.files { outline: none; }
  .tree.files .row { position: relative; gap: 0; padding-right: 8px; }
  .tree.files .row .c { width: 16px; height: 22px; display: flex; align-items: center; justify-content: center; opacity: 1; transition: transform .1s ease; }
  .tree.files .row .c svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; opacity: .85; }
  .tree.files .row.open .c { transform: rotate(90deg); }
  .tree.files .row img.i { margin: 0 6px 0 0; }
  .tree.files .guide { position: absolute; top: 0; bottom: 0; width: 0; border-left: 1px solid var(--vscode-tree-indentGuidesStroke, #585858); opacity: 0; transition: opacity .1s; pointer-events: none; }
  .tree.files:hover .guide, .tree.files:focus .guide { opacity: .7; }
  .tree.files .row.sel { background: var(--vscode-list-inactiveSelectionBackground); color: var(--vscode-list-inactiveSelectionForeground, var(--vscode-foreground)); }
  .tree.files:focus .row.sel { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground)); }
  .tree.files:focus .row.focus { outline: 1px solid var(--vscode-list-focusOutline, var(--vscode-focusBorder)); outline-offset: -1px; }
  .c-platform { color: var(--vscode-nuclearHttpConnections-platform); } .c-project { color: var(--vscode-nuclearHttpConnections-project); } .c-component { color: var(--vscode-nuclearHttpConnections-component); }
  .c-get { color: var(--vscode-nuclearHttpConnections-get); } .c-post { color: var(--vscode-nuclearHttpConnections-post); } .c-put { color: var(--vscode-nuclearHttpConnections-put); } .c-patch { color: var(--vscode-nuclearHttpConnections-patch); } .c-delete { color: var(--vscode-nuclearHttpConnections-delete); }
  .row.ep .name { font-family: var(--vscode-editor-font-family); font-size: 12px; }
  .row.ep .verb { font-weight: 700; font-size: 11px; width: 44px; flex: none; }
  .c-ws, .c-event { color: var(--vscode-nuclearHttpConnections-component); } .row .pbadge { flex: none; margin-left: 6px; padding: 0 4px; border-radius: 3px; font-size: 9px; font-weight: 700; line-height: 14px; letter-spacing: .03em; color: var(--vscode-nuclearHttpConnections-component); border: 1px solid currentColor; opacity: .85; } .row .pbadge.act { cursor: pointer; } .row .pbadge.act:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; margin: 0 6px 0 4px; background: var(--vscode-disabledForeground); }
  .dot.live { background: var(--vscode-testing-iconPassed); } .dot.starting { background: var(--vscode-nuclearHttpConnections-put); } .dot.hidden { background: var(--vscode-nuclearHttpConnections-platform); opacity: .6; }
  .empty { padding: 12px 10px; opacity: .7; line-height: 1.5; }
  .empty a { color: var(--vscode-textLink-foreground); cursor: pointer; }
  /* the Builder's column: the specs' tree and the runs' accordion */
  .tree.builder { padding-bottom: 8px; }
  .tree.builder .section { display: flex; align-items: center; gap: 6px; }
  .tree.builder .count { font-size: 10px; padding: 0 5px; border-radius: 8px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); letter-spacing: 0; }
  .tree.builder .row { outline: none; } .tree.builder .row:focus { outline: 1px solid var(--vscode-list-focusOutline, var(--vscode-focusBorder)); outline-offset: -1px; }
  .tree.builder .row .desc { margin-left: auto; font-variant-numeric: tabular-nums; }
  .tree.builder .row.grp .name { font-weight: 600; }
  .tree.builder .row.run .name { font-weight: 500; }
  .tree.builder .sub { font-size: 11px; opacity: .6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: -3px 6px 3px 0; }
  .tree.builder .sub.live { opacity: .85; color: var(--vscode-charts-yellow, #d29922); }
  .bd { width: 7px; height: 7px; border-radius: 50%; flex: none; margin: 0 7px 0 2px; background: var(--vscode-disabledForeground, #8b949e); opacity: .5; }
  .bd.st-passed { background: var(--vscode-testing-iconPassed, #3fb950); opacity: 1; } .bd.st-failed { background: var(--vscode-testing-iconFailed, #f85149); opacity: 1; }
  .bd.st-running, .bd.st-waiting { background: var(--vscode-charts-yellow, #d29922); opacity: 1; animation: bpulse 1.2s infinite; } .bd.st-skipped { background: transparent; border: 1px solid var(--vscode-disabledForeground, #8b949e); box-sizing: border-box; }
  @keyframes bpulse { 50% { opacity: .35; } }
  @media (prefers-reduced-motion: reduce) { .bd { animation: none !important; } }
  .toast { position: fixed; left: 48px; bottom: 10px; max-width: calc(100% - 60px); padding: 6px 10px; border-radius: 4px; font-size: 12px; background: var(--vscode-notifications-background); color: var(--vscode-notifications-foreground); border: 1px solid var(--vscode-notifications-border, var(--vscode-widget-border, transparent)); box-shadow: 0 2px 8px rgba(0,0,0,.3); opacity: 0; transition: opacity .15s; pointer-events: none; z-index: 2; }
  .toast.on { opacity: 1; }
  .toast kbd { font-family: var(--vscode-editor-font-family); font-weight: 600; }
</style>
</head>
<body>
  <div class="strip"><div id="projects"></div><div class="tools" id="tools"></div>${langButton()}</div>
  <div class="col"><div class="pane" id="pane"></div><div class="notes" id="notes" role="log" hidden></div></div>
  <div class="toast" id="toast"></div>
  <div class="tip" id="tip" role="tooltip"></div>
<script nonce="${nonce}">
  ${pageI18n(STRIP)}
  ${inline({ specTree, specOfPath, runOutline })}
  const GLYPHS = ${JSON.stringify(GLYPHS)};
  const TOOL_ICONS = ${JSON.stringify(TOOL_ICONS)};
  const $ = (id) => document.getElementById(id);
  let state = { projects: [], active: '', tools: [], pane: { kind: 'files' } };
  const loaded = {};          // dir -> entries
  const expanded = new Set(); // absolute paths of open folders
  const collapsed = new Set(); // tree node ids the user closed (nodes start open)
  let selected = '';
  let toastTimer;
  const el = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text !== undefined) d.textContent = text; return d; };

  function toast(key, what) {
    const box = $('toast');
    box.innerHTML = '<kbd></kbd> ';
    box.firstChild.textContent = key;
    box.appendChild(document.createTextNode(t('withoutMouse', what)));
    box.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('on'), 2600);
  }
  function initials(name) {
    const parts = name.replace(/[_-]+/g, ' ').trim().split(/\\s+/);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
  }
  function tab(text, title, on) {
    const d = el('div', 'tab' + (on ? ' on' : ''), text);
    d.title = title;
    return d;
  }
  function glyph(name, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('class', 'g ' + (cls || ''));
    s.innerHTML = GLYPHS[name] || GLYPHS.info;
    return s;
  }

  // ---------- the strip ----------
  function renderStrip() {
    const ps = $('projects');
    ps.innerHTML = '';
    state.projects.forEach((p, i) => {
      const key = i < 9 ? 'Ctrl+' + (i + 1) : '';
      const tb = tab(p.platformIcon ? '' : initials(p.name), p.name + ' · ' + (p.platform || '') + ' ' + p.dialect + (key ? '  (' + key + ')' : '') + (p.saved ? '\\n' + t('removeHint') : ''), p.root === state.active);
      if (p.platformIcon) { const pi = el('img', 'pi'); pi.src = p.platformIcon; tb.appendChild(pi); }
      if (p.dialectIcon) { const di = el('img', 'di'); di.src = p.dialectIcon; tb.appendChild(di); }
      if (key) tb.appendChild(el('span', 'n', String(i + 1)));
      tb.addEventListener('click', () => { vscode.postMessage({ type: 'project', root: p.root }); if (key) toast(key, t('opens', p.name)); });
      if (p.saved) tb.addEventListener('contextmenu', (ev) => { ev.preventDefault(); vscode.postMessage({ type: 'remove', root: p.root }); });
      ps.appendChild(tb);
    });
    const add = tab('+', t('openTab'), false);
    add.classList.add('add');
    add.addEventListener('click', () => { vscode.postMessage({ type: 'add' }); toast('Ctrl+Alt+O', t('opensAProject')); });
    ps.appendChild(add);
    const ts = $('tools');
    ts.innerHTML = '';
    for (const tool of state.tools) {
      const on = state.active === 'tool:' + tool.id;
      const tb = el('div', 'tool t-' + tool.id + (on ? ' on' : '') + (tool.soon ? ' soon' : ''));
      tb.tabIndex = 0; tb.setAttribute('role', 'button'); tb.setAttribute('aria-pressed', String(on));
      tb.setAttribute('aria-label', tool.label + ' (' + tool.key + ')' + (tool.unread ? ', ' + t('newCount', tool.unread) : ''));
      tb.appendChild(el('span', 'bar'));
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = TOOL_ICONS[tool.id] || '';
      tb.appendChild(s);
      tb.appendChild(el('span', 'w', tool.short));
      if (tool.unread) tb.appendChild(el('span', 'badge', tool.unread > 9 ? '9+' : String(tool.unread)));
      const open = () => { vscode.postMessage({ type: 'tool', id: tool.id }); toast(tool.key, t('opens', tool.label)); };
      tb.addEventListener('click', open);
      tb.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      const show = () => tip(tb, tool);
      tb.addEventListener('mouseenter', show); tb.addEventListener('focus', show);
      tb.addEventListener('mouseleave', hideTip); tb.addEventListener('blur', hideTip);
      ts.appendChild(tb);
    }
  }
  // the tool's name, its key and its state beside the strip (the strip shows only a word)
  function tip(tb, tool) {
    const box = $('tip');
    box.innerHTML = '';
    box.className = 'tip t-' + tool.id;
    box.appendChild(el('b', '', tool.label));
    box.appendChild(el('kbd', '', tool.key));
    if (tool.soon) box.appendChild(el('small', '', t('notBuilt')));
    if (tool.unread) box.appendChild(el('small', '', t('newCount', tool.unread)));
    const r = tb.getBoundingClientRect();
    box.classList.add('on');
    box.style.top = Math.max(4, Math.min(r.top + r.height / 2 - box.offsetHeight / 2, innerHeight - box.offsetHeight - 4)) + 'px';
  }
  function hideTip() { $('tip').classList.remove('on'); }

  // ---------- the pane ----------
  function renderPane() {
    const pane = $('pane');
    pane.innerHTML = '';
    const p = state.pane;
    if (p.kind === 'files') renderFiles(pane, p);
    else if (p.kind === 'tree') renderHttp(pane, p);
    else if (p.kind === 'devices') renderDevices(pane, p);
    else if (p.kind === 'builder') renderBuilder(pane, p);
    else renderTemplate(pane, p);
    noticesOf($('notes'), state.notices);
  }
  function head(pane, name, rest) {
    const h = el('div', 'head');
    h.appendChild(el('b', '', name));
    if (rest) h.appendChild(document.createTextNode(' · ' + rest));
    pane.appendChild(h);
  }

  // the files of the active project, and below them its platform's actions as a collapsed accordion like VS Code's
  // npm scripts, apart from the tree (ADR-extensions-0002 rule 6: the actions live in the editor title bar, never
  // inside the file tree; the accordion is for an editor that hides the title bar's, as Cursor does)
  let actionsOpen = false;
  function renderFiles(pane, p) {
    if (!p.project) {
      head(pane, t('workspace'));
      const e = el('div', 'empty');
      e.innerHTML = t('noProject');
      pane.appendChild(e);
      $('addLink').addEventListener('click', () => vscode.postMessage({ type: 'add' }));
      return;
    }
    head(pane, p.project.name, (p.project.platform || '') + ' ' + p.project.dialect);
    const tree = el('div', 'tree files'); tree.id = 'tree'; tree.tabIndex = 0; tree.dataset.vscodeContext = p.project.ctx;
    tree.addEventListener('keydown', treeKey);
    pane.appendChild(tree);
    renderTree();
    if (p.project.actions.length) {
      const acc = el('div', 'acc' + (actionsOpen ? ' open' : ''));
      const h = el('button', 'acc-h'); h.setAttribute('aria-expanded', String(actionsOpen));
      h.innerHTML = '<span class="c"><svg viewBox="0 0 16 16"><path d="M6 3.5 10.5 8 6 12.5"/></svg></span>';
      h.appendChild(document.createTextNode(t('actions')));
      h.addEventListener('click', () => { actionsOpen = !actionsOpen; acc.classList.toggle('open', actionsOpen); h.setAttribute('aria-expanded', String(actionsOpen)); });
      acc.appendChild(h);
      const list = el('div', 'acc-b');
      for (const a of p.project.actions) {
        const r = el('div', 'row'); r.tabIndex = 0; r.setAttribute('role', 'button');
        r.title = a.title + (a.key ? ' (' + a.key + ')' : '');
        r.appendChild(el('span', 'k', a.key || ''));
        r.appendChild(el('span', '', a.label));
        r.addEventListener('click', () => vscode.postMessage({ type: 'action', id: a.id }));
        r.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.click(); } });
        list.appendChild(r);
      }
      acc.appendChild(list);
      pane.appendChild(acc);
    }
  }
  // shortcut: the explorer's default indent (8 px) and guides on hover, not the user's workbench.tree.* settings
  const INDENT = 8;
  const CHEVRON = '<svg viewBox="0 0 16 16"><path d="M6 3.5 10.5 8 6 12.5"/></svg>';
  let shown = [];   // the rows on screen, in order: what the keyboard walks
  let focused = ''; // the row the keyboard is on
  function need(dir) { if (!(dir in loaded)) { loaded[dir] = null; vscode.postMessage({ type: 'list', dir }); } }
  function rows(dir, depth, out) {
    const entries = loaded[dir];
    if (!entries) { need(dir); return; }
    for (const e of entries) {
      const full = dir.replace(/[\\\\/]$/, '') + '/' + e.name;
      out.push({ full, name: e.name, dir: e.dir, ctx: e.ctx, depth, icon: e.dir && expanded.has(full) ? e.iconOpen : e.icon });
      if (e.dir && expanded.has(full)) rows(full, depth + 1, out);
    }
  }
  function renderTree(scroll) {
    const tree = $('tree');
    if (!tree || state.pane.kind !== 'files' || !state.pane.project) return;
    const list = [];
    rows(state.pane.project.root, 0, list);
    shown = list;
    // the row the keyboard is on, never rewritten while folders load (a reveal waits for them)
    const on = here(focused) ? focused : here(selected) ? selected : (list[0] ? list[0].full : '');
    const frag = document.createDocumentFragment();
    for (const r of list) {
      const d = el('div', 'row' + (r.dir ? ' dir' : '') + (expanded.has(r.full) ? ' open' : '') + (r.full === selected ? ' sel' : '') + (r.full === on ? ' focus' : '') + (r.name.endsWith('.nuc') ? ' nuc' : ''));
      d.style.paddingLeft = (8 + r.depth * INDENT) + 'px';
      for (let k = 0; k < r.depth; k++) { const g = el('span', 'guide'); g.style.left = (16 + k * INDENT) + 'px'; d.appendChild(g); }
      const c = el('span', 'c'); if (r.dir) c.innerHTML = CHEVRON; d.appendChild(c);
      if (r.icon) { const i = el('img', 'i'); i.src = r.icon; d.appendChild(i); }
      d.appendChild(el('span', 'name', r.name));
      d.title = r.full;
      if (r.ctx) d.dataset.vscodeContext = r.ctx;
      d.addEventListener('click', () => { focused = r.full; activate(r); });
      frag.appendChild(d);
    }
    tree.replaceChildren(frag);
    if (scroll) { const f = tree.querySelector('.row.focus'); if (f) f.scrollIntoView({ block: 'nearest' }); }
  }
  /** A click, Enter or Space: a folder opens or closes, a file opens in the editor. */
  function activate(r) {
    selected = r.full;
    if (r.dir) { expanded.has(r.full) ? expanded.delete(r.full) : expanded.add(r.full); }
    else vscode.postMessage({ type: 'open', path: r.full });
    renderTree();
  }
  const here = (full) => shown.some((r) => r.full === full);
  function treeKey(e) {
    const at = here(focused) ? focused : here(selected) ? selected : (shown[0] ? shown[0].full : '');
    const i = shown.findIndex((r) => r.full === at), r = shown[i];
    const go = (j) => { const t = shown[Math.max(0, Math.min(shown.length - 1, j))]; if (t) { focused = t.full; renderTree(true); } };
    switch (e.key) {
      case 'ArrowDown': go(i + 1); break;
      case 'ArrowUp': go(i - 1); break;
      case 'Home': go(0); break;
      case 'End': go(shown.length - 1); break;
      case 'ArrowRight': if (r && r.dir) { if (!expanded.has(r.full)) { expanded.add(r.full); renderTree(true); } else go(i + 1); } break;
      case 'ArrowLeft':
        if (r && r.dir && expanded.has(r.full)) { expanded.delete(r.full); renderTree(true); }
        else if (r) { const up = shown.slice(0, i).reverse().find((x) => x.depth < r.depth); if (up) { focused = up.full; renderTree(true); } }
        break;
      case 'Enter': case ' ': if (r) activate(r); break;
      default: return;
    }
    e.preventDefault();
  }
  /** The active editor's file: its folders open, the file selected, as the explorer does. */
  function reveal(parts) {
    if (!state.pane.project) return;
    let dir = state.pane.project.root.replace(/[\\\\/]$/, '');
    for (const part of parts.slice(0, -1)) { dir += '/' + part; expanded.add(dir); }
    selected = focused = dir + '/' + parts[parts.length - 1];
    renderTree(true);
  }

  // the endpoints tree of the HTTP Connections tool
  function renderHttp(pane, p) {
    head(pane, 'HTTP', t('everyProject'));
    const bar = el('div', 'envbar');
    bar.appendChild(document.createTextNode(t('env') + ' '));
    bar.appendChild(el('b', '', p.environment));
    for (const [label, type, title] of [[t('change'), 'environment', t('changeTitle')], [t('edit'), 'editEnvironments', t('editTitle')], ['↻', 'httpRefresh', t('refresh')]]) {
      bar.appendChild(document.createTextNode(' · '));
      const a = el('a', '', label); a.title = title; a.addEventListener('click', () => vscode.postMessage({ type })); bar.appendChild(a);
    }
    pane.appendChild(bar);
    const tree = el('div', 'tree');
    pane.appendChild(tree);
    if (!p.nodes.length) tree.appendChild(el('div', 'empty', t('noHttp')));
    const walk = (nodes, depth) => {
      for (const n of nodes) {
        const kids = n.children && n.children.length ? n.children : null;
        const open = kids && !collapsed.has(n.id);
        const d = el('div', 'row' + (n.endpoint ? ' ep' : '') + (open ? ' open' : '') + (n.id === selected ? ' sel' : ''));
        d.style.paddingLeft = (6 + depth * 12) + 'px';
        d.appendChild(el('span', 'c', kids ? '▶' : ''));
        if (n.endpoint) {
          d.appendChild(el('span', 'verb c-' + n.icon, n.endpoint.verb.toUpperCase()));
          d.appendChild(el('span', 'name', n.endpoint.path));
        } else {
          d.appendChild(glyph(n.icon, n.color ? 'c-' + n.color : ''));
          d.appendChild(el('span', 'name', n.label));
        }
        if (n.badge) { const b = el('span', 'pbadge' + (n.badge.action ? ' act' : ''), n.badge.label); b.title = n.badge.title; if (n.badge.action) b.addEventListener('click', (ev) => { ev.stopPropagation(); vscode.postMessage({ type: 'nodeAction', action: n.badge.action }); }); d.appendChild(b); }
        if (n.desc) d.appendChild(el('span', 'desc', n.desc));
        if (n.button) { const b = el('span', 'btn', n.button.label); b.title = n.button.title; b.addEventListener('click', (ev) => { ev.stopPropagation(); vscode.postMessage({ type: 'nodeAction', action: n.button.action }); }); d.appendChild(b); }
        d.title = n.tooltip || n.label;
        d.addEventListener('click', () => {
          selected = n.id;
          if (n.endpoint) vscode.postMessage({ type: 'endpoint', endpoint: n.endpoint });
          else if (kids) { collapsed.has(n.id) ? collapsed.delete(n.id) : collapsed.add(n.id); }
          renderPane();
        });
        tree.appendChild(d);
        if (open) walk(kids, depth + 1);
      }
    };
    walk(p.nodes, 0);
  }

  // the devices
  function renderDevices(pane, p) {
    head(pane, t('devices'), p.project ? t('runs', p.project) : '');
    const bar = el('div', 'actions');
    const add = el('button', 'primary', t('newDevice'));
    add.title = t('newDeviceTitle');
    add.addEventListener('click', () => vscode.postMessage({ type: 'newDevice' }));
    bar.appendChild(add);
    pane.appendChild(bar);
    const tree = el('div', 'tree');
    pane.appendChild(tree);
    if (!p.devices.length) tree.appendChild(el('div', 'empty', t('noDevices')));
    for (const d of p.devices) {
      const r = el('div', 'row');
      r.style.paddingLeft = '6px';
      r.appendChild(glyph('device', 'c-platform'));
      r.appendChild(el('span', 'name', d.title));
      r.appendChild(el('span', 'dot ' + d.status));
      r.appendChild(el('span', 'desc', ({ idle: t('stIdle'), starting: t('stStarting'), live: t('stLive'), hidden: t('stHidden') })[d.status] || d.status));
      const run = el('span', 'btn', t('run')); run.title = t('runTitle') + (p.project ? ' (' + p.project + ')' : '');
      run.addEventListener('click', (ev) => { ev.stopPropagation(); vscode.postMessage({ type: 'runOnDevice', id: d.id }); });
      r.appendChild(run);
      const close = el('span', 'btn', '✕'); close.title = t('closeTitle');
      close.addEventListener('click', (ev) => { ev.stopPropagation(); vscode.postMessage({ type: 'closeDevice', id: d.id }); });
      r.appendChild(close);
      r.title = d.status === 'hidden' ? t('showAgain') : t('show');
      r.addEventListener('click', () => vscode.postMessage({ type: 'device', id: d.id }));
      tree.appendChild(r);
    }
  }

  // the Builder's specs by component and layer and its runs as an accordion (its page is the diagram, the chat, the node)
  const bClosed = new Set();  // tree groups the user closed (they start open)
  const bRuns = {};           // run id -> open (a run going on, or the one picked, starts open)
  function renderBuilder(pane, p) {
    const sb = p.sidebar;
    head(pane, 'Nuclear Builder', sb.project);
    const bar = el('div', 'actions');
    const add = el('button', 'primary', t('bNew')); add.title = t('bNewTitle');
    add.addEventListener('click', () => vscode.postMessage({ type: 'builder', op: 'new' }));
    bar.appendChild(add);
    pane.appendChild(bar);
    const tree = el('div', 'tree builder'); tree.id = 'btree';
    pane.appendChild(tree);
    drawBuilder(sb);
  }
  function brow(depth, cls, twisty, parts, title, onClick) {
    const d = el('div', 'row ' + cls);
    d.style.paddingLeft = (6 + depth * 12) + 'px';
    d.tabIndex = 0;
    d.appendChild(el('span', 'c', twisty));
    for (const x of parts) d.appendChild(x);
    if (title) d.title = title;
    d.addEventListener('click', onClick);
    return d;
  }
  const bdot = (s) => el('span', 'bd st-' + (s || 'none'));
  function drawBuilder(sb) {
    const tree = $('btree'); if (!tree) return;
    const top = tree.scrollTop;
    tree.innerHTML = '';
    if (!sb.root) { tree.appendChild(el('div', 'empty', t('bOpening'))); return; }
    const pk = sb.picked || {};
    const section = (text, n) => { const s = el('div', 'section', text); if (n) s.appendChild(el('span', 'count', String(n))); tree.appendChild(s); };
    // the specs
    const groups = W.specTree(sb.specs, sb.runs);
    section(t('bSpecs'));
    if (!groups.length) tree.appendChild(el('div', 'empty', t('bNoSpecs')));
    const group = (key, label, n, depth, kids) => {
      const open = !bClosed.has(key);
      tree.appendChild(brow(depth, 'grp' + (open ? ' open' : ''), '▶', [el('span', 'name', label), el('span', 'desc', String(n))], '', () => { bClosed.has(key) ? bClosed.delete(key) : bClosed.add(key); drawBuilder(sb); }));
      if (open) kids();
    };
    const spec = (x, depth) => tree.appendChild(brow(depth, 'spec' + (pk.spec === x.id ? ' sel' : ''), '', [bdot(x.run), el('span', 'name', x.title)], x.path + '/spec.md', () => vscode.postMessage({ type: 'builder', op: 'spec', id: x.id })));
    for (const g of groups) {
      const label = g.component === '_global' ? t('bWhole') : g.component || t('bUnsorted');
      group('c:' + g.component, label, g.specs.length + g.layers.reduce((n, l) => n + l.specs.length, 0), 0, () => {
        for (const x of g.specs) spec(x, 1);
        for (const l of g.layers) group('c:' + g.component + '/' + l.layer, t('bLayer.' + l.layer), l.specs.length, 1, () => l.specs.forEach((x) => spec(x, 2)));
      });
    }
    // the runs
    const runs = [...sb.runs].sort((a, b) => (sb.running.includes(b.id) ? 1 : 0) - (sb.running.includes(a.id) ? 1 : 0) || b.created - a.created);
    section(t('bRuns'), runs.length);
    if (!runs.length) tree.appendChild(el('div', 'empty', t('bNoRuns')));
    for (const r of runs) {
      const o = W.runOutline(r), live = sb.running.includes(r.id), picked = pk.run === r.id;
      if (!(r.id in bRuns) && (live || picked)) bRuns[r.id] = true;
      const open = !!bRuns[r.id];
      const sub = o.now ? o.now.title : (t('bStatus.' + r.status) || r.status) + ' · ' + new Date(r.created).toLocaleDateString(LANG);
      const name = el('span', 'name', r.spec.title);
      const row = brow(0, 'run' + (open ? ' open' : '') + (picked && !pk.stage ? ' sel' : '') + (live ? ' live' : ''), '▶', [bdot(r.status), name, el('span', 'desc', o.done + '/' + o.total)], sub, () => { bRuns[r.id] = !open || !picked; vscode.postMessage({ type: 'builder', op: 'run', id: r.id }); drawBuilder(sb); });
      tree.appendChild(row);
      tree.appendChild(el('div', 'sub' + (live ? ' live' : ''), sub)).style.paddingLeft = '38px';
      if (!open) continue;
      for (const st of o.stations) {
        const ended = st.steps.filter((x) => x.status === 'passed' || x.status === 'skipped').length;
        const here = picked && pk.stage === st.id;
        tree.appendChild(brow(1, 'stn' + (here && !pk.step ? ' sel' : ''), '', [bdot(st.status), el('span', 'name', st.title), el('span', 'desc', st.steps.length ? ended + '/' + st.steps.length : '')], '', () => vscode.postMessage({ type: 'builder', op: 'node', id: r.id, stage: st.id })));
        if (st.status === 'running' || st.status === 'waiting' || st.status === 'failed' || here)
          for (const x of st.steps) tree.appendChild(brow(2, 'stp' + (here && pk.step === x.id ? ' sel' : ''), '', [bdot(x.status), el('span', 'name', x.title)], x.title, () => vscode.postMessage({ type: 'builder', op: 'node', id: r.id, stage: st.id, step: x.id })));
      }
    }
    tree.scrollTop = top;
  }
  function noticesOf(box, list) {
    box.innerHTML = '';
    box.hidden = !list || !list.length;
    if (box.hidden) return;
    // what the agents did while you were elsewhere, from every tool: newest first, a click goes there
    box.appendChild(el('div', 'section', t('notifications')));
    for (const n of list) {
      const row = el('div', 'notice t-' + n.tool + (n.read ? '' : ' unread') + ' ' + n.level);
      row.tabIndex = 0; row.setAttribute('role', 'button');
      row.appendChild(el('b', '', n.title));
      row.appendChild(el('small', '', (n.text ? n.text + ' · ' : '') + new Date(n.at).toLocaleTimeString()));
      const go = () => vscode.postMessage({ type: 'notice', notice: n.id });
      row.addEventListener('click', go);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      box.appendChild(row);
    }
  }

  function renderTemplate(pane, p) {
    head(pane, p.tool.label, p.tool.soon ? t('template') : '');
    const e = el('div', 'empty');
    e.appendChild(document.createTextNode(p.tool.about + ' '));
    const a = el('a', '', t('openIt')); a.addEventListener('click', () => vscode.postMessage({ type: 'tool', id: p.tool.id }));
    e.appendChild(a); e.appendChild(document.createTextNode(' (' + p.tool.key + ').'));
    pane.appendChild(e);
  }

  window.addEventListener('message', (ev) => {
    const m = ev.data;
    if (m.type === 'state') { state = m; renderStrip(); renderPane(); }
    if (m.type === 'entries') { loaded[m.dir] = m.entries; renderTree(); }
    if (m.type === 'refreshDirs') { let any = false; for (const d of m.dirs) if (d in loaded) { delete loaded[d]; any = true; } if (any) renderTree(); }
    if (m.type === 'reveal') reveal(m.parts);
    if (m.type === 'builderSidebar' && state.pane.kind === 'builder') { state.pane.sidebar = m.sidebar; drawBuilder(m.sidebar); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('#btree .row')) { e.preventDefault(); e.target.click(); }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.closest?.('#btree .row')) { e.preventDefault(); const all = [...document.querySelectorAll('#btree .row')], i = all.indexOf(e.target); all[i + (e.key === 'ArrowDown' ? 1 : -1)]?.focus(); }
  });
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------- welcome and tool pages

const shortcuts = (w: Record<keyof typeof WELCOME_TEXTS.en, string>): [string, string][] => [
  ['Ctrl+Alt+N', w.scWorkspace],
  ['Ctrl+1 … Ctrl+9', w.scTabs],
  ['Ctrl+Alt+O', w.scOpen],
  ...tools().map((t): [string, string] => [t.key, t.label]),
  ['Ctrl+Alt+R / G / L', w.scRun],
  ['Ctrl+Alt+B / T / C', w.scBuild],
  ['Ctrl+Alt+W', w.scPage],
];

function page(webview: vscode.Webview, title: string, body: string, nonce: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="${lang()}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); max-width: 820px; margin: 0 auto; padding: 32px 24px 48px; line-height: 1.5; }
  h1 { font-weight: 600; font-size: 26px; margin: 0 0 4px; display: flex; align-items: center; gap: 14px; }
  h1 img { width: 44px; height: 44px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; opacity: .7; margin: 28px 0 8px; }
  .lead { font-size: 15px; opacity: .9; margin: 0 0 6px; }
  .muted { opacity: .7; font-size: 12px; }
  kbd { font-family: var(--vscode-editor-font-family); font-size: 12px; padding: 1px 6px; border-radius: 3px; background: var(--vscode-keybindingLabel-background); color: var(--vscode-keybindingLabel-foreground); border: 1px solid var(--vscode-keybindingLabel-border); border-bottom-color: var(--vscode-keybindingLabel-bottomBorder); white-space: nowrap; }
  table { border-collapse: collapse; } td { padding: 3px 14px 3px 0; vertical-align: top; }
  .project { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 6px; cursor: pointer; border: 1px solid var(--vscode-widget-border, transparent); margin-bottom: 6px; }
  .project:hover { background: var(--vscode-list-hoverBackground); }
  .project.on { box-shadow: inset 3px 0 0 var(--vscode-focusBorder); }
  .project .name { font-weight: 600; } .project .path { opacity: .6; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .project .grow { flex: 1; min-width: 0; }
  button { font-family: inherit; font-size: 13px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 3px; padding: 6px 14px; cursor: pointer; }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  ul { padding-left: 20px; } li { margin: 2px 0; }
  code { font-family: var(--vscode-editor-font-family); font-size: 12px; }
  .template { border: 1px dashed var(--vscode-widget-border, #888); border-radius: 6px; padding: 14px 18px; margin-top: 18px; }
  label { display: flex; gap: 8px; align-items: center; cursor: pointer; }
</style>
<title>${title}</title>
</head>
<body>${body}</body>
</html>`;
}

class WelcomePanel {
  private static current: WelcomePanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly listener: vscode.Disposable;

  private constructor(private readonly context: vscode.ExtensionContext, private readonly ws: Workspace) {
    this.panel = vscode.window.createWebviewPanel('nuclear.welcome', l10n.t('Nuclear workspace'), vscode.ViewColumn.One, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'icons')],
    });
    this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icons', 'nuc-file.svg');
    this.listener = ws.onDidChange.event(() => this.render());
    const relang = onDidChangeLang(() => this.render());
    this.panel.onDidDispose(() => {
      WelcomePanel.current = undefined;
      this.listener.dispose();
      relang.dispose();
    });
    this.panel.webview.onDidReceiveMessage((m: { type: string; root?: string; on?: boolean }) => {
      if (m.type === 'project' && m.root) void ws.go(m.root);
      if (m.type === 'open') void ws.openProject();
      if (m.type === 'startup') void vscode.workspace.getConfiguration().update(WELCOME, m.on, vscode.ConfigurationTarget.Global);
    });
    this.render();
  }

  static show(context: vscode.ExtensionContext, ws: Workspace): void {
    if (!WelcomePanel.current) WelcomePanel.current = new WelcomePanel(context, ws);
    else WelcomePanel.current.panel.reveal();
  }

  private render(): void {
    const nonce = Math.random().toString(36).slice(2);
    const w = texts(WELCOME_TEXTS);
    const logo = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'icons', 'icon.svg'));
    const active = this.ws.activeKey();
    const projects = this.ws.projects();
    const list = projects.length
      ? projects
          .map(
            (p, i) => `<div class="project${p.root === active ? ' on' : ''}" data-root="${esc(p.root)}">
  ${i < 9 ? `<kbd>Ctrl+${i + 1}</kbd>` : '<kbd> </kbd>'}
  <div class="grow"><div class="name">${esc(p.name)} <span class="muted">${esc(p.platform ?? '')} · ${esc(p.dialect)}</span></div><div class="path">${esc(p.root)}</div></div>
</div>`,
          )
          .join('')
      : `<p class="muted">${w.noProjects}</p>`;
    const body = `
<h1><img src="${logo}" alt=""> ${w.title}</h1>
<p class="lead">${w.lead}</p>
<p>${w.intro}</p>
<h2>${w.projects}</h2>
${list}
<p><button id="open">${w.openTab}</button> <span class="muted">Ctrl+Alt+O</span></p>
<h2>${w.keyboard}</h2>
<table>${shortcuts(w).map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${esc(d)}</td></tr>`).join('')}</table>
<p class="muted">${w.keyboardNote}</p>
<h2>${w.tools}</h2>
<table>${tools().map((t) => `<tr><td><kbd>${t.key}</kbd></td><td><b>${esc(t.label)}</b>${t.planned.length ? ` <span class="muted">${w.templateTag}</span>` : ''}<br><span class="muted">${esc(t.about)}</span></td></tr>`).join('')}</table>
<h2>${w.startup}</h2>
<label><input type="checkbox" id="startup" ${vscode.workspace.getConfiguration().get<boolean>(WELCOME, false) ? 'checked' : ''}> ${w.startupLabel}</label>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  document.querySelectorAll('.project').forEach((p) => p.addEventListener('click', () => vscode.postMessage({ type: 'project', root: p.dataset.root })));
  document.getElementById('open').addEventListener('click', () => vscode.postMessage({ type: 'open' }));
  document.getElementById('startup').addEventListener('change', (ev) => vscode.postMessage({ type: 'startup', on: ev.target.checked }));
</script>`;
    this.panel.webview.html = page(this.panel.webview, w.title, body, nonce);
  }
}

/** A tool that is not built yet: its page says what it will do, full screen, with its shortcut. */
class ToolPanel {
  private static open = new Map<string, vscode.WebviewPanel>();

  static show(context: vscode.ExtensionContext, tool: Tool): void {
    const existing = ToolPanel.open.get(tool.id);
    if (existing) {
      existing.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(`nuclear.tool.${tool.id}`, tool.label, vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icons', 'nuc-file.svg');
    ToolPanel.open.set(tool.id, panel);
    panel.webview.onDidReceiveMessage((m: { type: string }) => {
      if (m.type === 'settings') void vscode.commands.executeCommand('workbench.action.openSettings', '@ext:nuclearlang.nuclearlang');
    });
    const localized = localize(panel.webview, () => ToolPanel.html(panel.webview, tools().find((t) => t.id === tool.id) ?? tool));
    panel.onDidDispose(() => (ToolPanel.open.delete(tool.id), localized.dispose()));
  }

  private static html(webview: vscode.Webview, tool: Tool): string {
    const nonce = Math.random().toString(36).slice(2);
    const w = texts(WELCOME_TEXTS);
    const body = `
<h1>${esc(tool.label)}</h1>
<p class="lead">${esc(tool.about)}</p>
<p class="muted">${w.toolShortcut.replace('{0}', tool.key)}</p>
<div class="template">
  <p>${w.toolTemplate}</p>
  <ul>${tool.planned.map((p) => `<li>${esc(p).replace(/`([^`]+)`/g, '<code>$1</code>')}</li>`).join('')}</ul>
  ${tool.id === 'settings' ? `<p><button id="settings">${w.openSettings}</button></p>` : ''}
</div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  document.getElementById('settings')?.addEventListener('click', () => vscode.postMessage({ type: 'settings' }));
</script>`;
    return page(webview, tool.label, body, nonce);
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** ▷ Serve in the terminal, followed through the lines `nuclear run` appends to the project's log: a progress
 * notification with its steps until the server answers; a failure or a stall shows why, Show the log and Try again. */
function followRun(root: string, name: string, offset: number, again: () => void): void {
  const steps: Record<RunStep, string> = {
    build: l10n.t('Building the project'),
    install: l10n.t('Installing the packages'),
    serve: l10n.t('Starting the server'),
    live: l10n.t('Ready'),
  };
  void vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `${name} · ▷` }, (progress) =>
    new Promise<void>((done) => {
      let finished = false;
      const end = () => {
        if (finished) return;
        finished = true;
        clearInterval(timer);
        done();
      };
      const fail = async (why: string, lines: string[]) => {
        end();
        const log = l10n.t('Show the log');
        const retry = l10n.t('Try again');
        const detail = lines.length ? `\n${lines.join('\n')}` : '';
        const choice = await vscode.window.showErrorMessage(l10n.t('{0} did not start: {1}', name, why) + detail, log, retry);
        if (choice === log) void vscode.window.showTextDocument(vscode.Uri.file(logFile(root)!), { preview: true });
        if (choice === retry) again();
      };
      const launch: Launch<RunStep> = new Launch<RunStep>(
        undefined,
        (l) => progress.report({ message: steps[l.step] }),
        (l) => void fail(l10n.t('it got stuck: {0}', steps[l.step]), reason(l.output)),
        RUN_STALL_MS,
      );
      const follower = new RunFollower(root, launch, (why) => void fail(why, reason(launch.output)), offset);
      let servedAt = 0;
      progress.report({ message: steps.build });
      let asking = false;
      const timer = setInterval(() => {
        follower.poll();
        if (launch.done && !finished && launch.step !== 'live') return; // fail() runs
        if (launch.step === 'live') return end();
        // the server's address answers: ready
        if (launch.step === 'serve' && follower.url && !asking) {
          asking = true;
          fetch(follower.url, { signal: AbortSignal.timeout(2000) })
            .then(() => {
              launch.to('live');
              void vscode.window.showInformationMessage(l10n.t('{0} is ready at {1}', name, follower.url!));
              end();
            })
            .catch(() => undefined)
            .finally(() => (asking = false));
        }
        // a server without an address to ask: running once it has been up a few seconds; its own lines are in the terminal
        if (launch.step === 'serve' && !follower.url) {
          servedAt ||= Date.now();
          if (Date.now() - servedAt > 4000) (launch.to('live'), end());
        }
      }, 700);
    }),
  );
}
