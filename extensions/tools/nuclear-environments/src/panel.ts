// The Environments page of VS Code (spec 021): one panel, the project chosen on the page; every change is a
// `nuclear env` command (env.ts builds it), then the list is read again. The page never writes a file; it opens one
// only when asked. Redrawn when a `.env*` file or a contract changes.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { localize, texts } from '../../../vscode/src/i18n';
import { ENV } from './l10n';
import { Command, Failure, failureOf, fileOf, Grid, load, nuclearRunner, Runner, SHARED, setCommand, unsetCommand, useCommand } from './env';
import { envPageHtml } from './page';

export interface EnvProject {
  root: string;
  name: string;
  platform: string | null;
}

type Message =
  | { type: 'ready' | 'refresh' | 'update' | 'dismiss' }
  | { type: 'project'; root: string }
  | { type: 'use'; env: string }
  | { type: 'set'; name: string; env: string; value: string; secret: boolean }
  | { type: 'unset'; name: string; env: string; source: string }
  | { type: 'addEnv' | 'addVar'; name: string }
  | { type: 'local'; on: boolean }
  | { type: 'openFile'; env: string }
  | { type: 'openUse'; file: string; line: number };

export class EnvironmentsPanel {
  private static current: EnvironmentsPanel | undefined;
  private project = '';
  private grid?: Grid;
  private failure?: Failure;
  private error?: string;
  private note?: string;
  private loading = true;
  private busy = false;
  private local = false;
  /** Added on the page, not in a file yet (by project). */
  private readonly pendingEnvs = new Map<string, string[]>();
  private readonly pendingVars = new Map<string, string[]>();

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly projects: () => EnvProject[],
    private readonly run: Runner,
  ) {
    const localized = localize(panel.webview, envPageHtml, () => this.post());
    panel.onDidDispose(() => ((EnvironmentsPanel.current = undefined), localized.dispose()));
    panel.webview.onDidReceiveMessage((m: Message) => void this.receive(m));
  }

  /** Opens (or reveals) the page on `root`, else the last project shown, else the first of the workspace. */
  static show(context: vscode.ExtensionContext, projects: () => EnvProject[], root?: string, run: Runner = nuclearRunner): void {
    let p = EnvironmentsPanel.current;
    if (p) p.panel.reveal();
    else {
      const panel = vscode.window.createWebviewPanel('nuclear.environments', 'Environments', vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
      panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icons', 'nuc-file.svg');
      p = EnvironmentsPanel.current = new EnvironmentsPanel(panel, projects, run);
    }
    const all = projects();
    const pick = (root && all.find((x) => x.root === root)?.root) || (all.some((x) => x.root === p!.project) ? p.project : all[0]?.root) || '';
    if (pick !== p.project || !p.grid) void p.open(pick);
  }

  /** A `.env*` file or a contract changed under `file`: the page of its project reads the list again. */
  static changed(file: string): void {
    const p = EnvironmentsPanel.current;
    if (p?.project && (file === p.project || file.startsWith(p.project + path.sep)) && !p.busy) void p.refresh();
  }

  private async open(root: string): Promise<void> {
    this.project = root;
    this.grid = undefined;
    this.failure = undefined;
    this.error = undefined;
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    if (!this.project) {
      this.loading = false;
      return this.post();
    }
    this.loading = true;
    this.post();
    const got = await load(this.run, this.project, this.pendingEnvs.get(this.project), this.pendingVars.get(this.project));
    this.loading = false;
    if ('grid' in got) {
      this.grid = got.grid;
      this.failure = undefined;
      this.forgetWritten(got.grid);
    } else {
      this.grid = undefined;
      this.failure = got.failure;
    }
    this.post();
  }

  /** A pending environment or variable a file now has is no longer pending. */
  private forgetWritten(g: Grid): void {
    const envs = this.pendingEnvs.get(this.project) ?? [];
    const vars = this.pendingVars.get(this.project) ?? [];
    this.pendingEnvs.set(this.project, envs.filter((e) => !g.rows.some((r) => r.cells.some((c) => c.env === e && c.source))));
    this.pendingVars.set(this.project, vars.filter((v) => !g.rows.some((r) => r.name === v && r.cells.some((c) => c.source))));
  }

  private post(): void {
    void this.panel.webview.postMessage({
      type: 'state',
      state: {
        projects: this.projects().map((p) => ({ root: p.root, name: p.name, platform: p.platform })),
        project: this.project,
        grid: this.grid,
        failure: this.failure,
        error: this.error,
        note: this.note,
        loading: this.loading,
        busy: this.busy,
        local: this.local,
        pendingEnvs: this.pendingEnvs.get(this.project) ?? [],
        pendingVars: this.pendingVars.get(this.project) ?? [],
      },
    });
  }

  /** Runs one `nuclear env` command, then reads the list again; its error stays on the page until dismissed. */
  private async exec(build: () => Command | undefined): Promise<void> {
    let cmd: Command | undefined;
    try {
      cmd = build();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return this.post();
    }
    if (!cmd) return;
    this.busy = true;
    this.error = this.note = undefined;
    this.post();
    const r = await this.run(cmd.args, this.project, cmd.stdin);
    this.busy = false;
    const failure = failureOf(r);
    if (failure?.kind === 'error') this.error = failure.detail;
    else if (failure) this.failure = failure;
    // what a command says on success (a secret written to .local without a keyring) is shown, never dropped
    this.note = failure ? undefined : r.stderr.trim() || undefined;
    await this.refresh();
  }

  private async receive(m: Message): Promise<void> {
    const project = this.project;
    switch (m.type) {
      case 'ready':
        return this.post();
      case 'refresh':
        return this.refresh();
      case 'update':
        return void vscode.commands.executeCommand('nuclear.update');
      case 'dismiss':
        this.error = this.note = undefined;
        return this.post();
      case 'project':
        return this.open(m.root);
      case 'local':
        this.local = m.on;
        return this.post();
      case 'use':
        return this.exec(() => useCommand(m.env, project));
      case 'set':
        return this.exec(() => setCommand({ name: m.name, value: m.value, env: m.env, local: this.local, secret: m.secret, project }));
      case 'unset':
        return this.exec(() => unsetCommand({ name: m.name, env: m.env, source: m.source, project }));
      case 'addEnv':
      case 'addVar': {
        const map = m.type === 'addEnv' ? this.pendingEnvs : this.pendingVars;
        map.set(project, [...new Set([...(map.get(project) ?? []), m.name])]);
        return this.refresh();
      }
      case 'openFile': {
        const file = path.join(project, fileOf(m.env === SHARED ? SHARED : m.env, this.local));
        if (!fs.existsSync(file)) {
          this.note = texts(ENV).fileMissing.replace('{0}', path.basename(file));
          return this.post();
        }
        await vscode.window.showTextDocument(vscode.Uri.file(file), { viewColumn: vscode.ViewColumn.Beside, preview: false });
        return;
      }
      case 'openUse': {
        const line = Math.max(0, m.line - 1);
        const file = path.isAbsolute(m.file) ? m.file : path.join(project, m.file);
        await vscode.window.showTextDocument(vscode.Uri.file(file), { selection: new vscode.Range(line, 0, line, 0), viewColumn: vscode.ViewColumn.Beside });
        return;
      }
    }
  }
}

/** The command `nuclear.environments.open` (an optional project root) and the watchers of `.env*` files and contracts. */
export function activateEnvironments(context: vscode.ExtensionContext, projects: () => EnvProject[], lastProject: () => string | undefined): void {
  const watchers = ['**/.env*', '**/.nuclear/contract.json', '**/.nuclear/env'].map((g) => vscode.workspace.createFileSystemWatcher(g));
  let timer: NodeJS.Timeout | undefined;
  const later = (uri: vscode.Uri) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => EnvironmentsPanel.changed(uri.fsPath), 250);
  };
  for (const w of watchers) context.subscriptions.push(w, w.onDidChange(later), w.onDidCreate(later), w.onDidDelete(later));
  context.subscriptions.push(
    vscode.commands.registerCommand('nuclear.environments.open', (root?: string) => EnvironmentsPanel.show(context, projects, typeof root === 'string' ? root : lastProject())),
  );
}
