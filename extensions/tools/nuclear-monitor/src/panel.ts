// The Nuclear Monitor page of VS Code (spec 015): what the workspace's selected project is doing, live: the console of
// its last run (requests, errors with their stack, its output, read by `nuclear monitor --json` from the run log) and,
// measured, each function's time. When the project is not running the page starts it, always visibly: the terminal
// `<project> · monitor` (backend, web) or a device (mobile).

import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { explainPlace, lineKeys, measurable, MonitorView, nuclear, page, PageContext, parts, projectAt, projectInfo, readMonitor, TEXTS } from './monitor';
import { lang, onDidChangeLang } from '../../../vscode/src/i18n';

type App = { root: string; name: string; platform: string | null };

export class MonitorPanel {
  private static current: MonitorPanel | undefined;
  /** The workspace's apps and its selected one, and how to run a mobile app (set by the Nuclear workspace). */
  static projects: (() => App[]) | undefined;
  static selected: (() => string | undefined) | undefined;
  static select: ((root: string) => void) | undefined;
  static runMobile: ((root: string) => Thenable<unknown> | void) | undefined;
  /** The projects started by the page in this window: each one once on its own, after that only by its button. */
  private static started = new Set<string>();

  private view: MonitorView | string | undefined;
  private ctx: PageContext | undefined;
  private drawn = '';
  private timer: NodeJS.Timeout;

  private constructor(private readonly panel: vscode.WebviewPanel, private root: string | undefined) {
    const relang = onDidChangeLang(() => ((this.drawn = ''), void this.refresh()));
    // the run log changes outside the watcher's folders too, and a server can die silently: read it while visible
    this.timer = setInterval(() => panel.visible && void this.refresh(), 2000);
    panel.onDidDispose(() => ((MonitorPanel.current = undefined), relang.dispose(), clearInterval(this.timer)));
    panel.webview.onDidReceiveMessage((m: { type: string; path?: string; line?: number; k?: string; on?: boolean; root?: string }) => this.message(m));
  }

  /** Opens the page on `root` (the workspace's tool gives its selected project), else the active `.nuc`'s project,
   * else the workspace's selected one. Never a workspace's own folder. */
  static show(root?: string): void {
    const active = vscode.window.activeTextEditor?.document.uri;
    root ??= (active?.scheme === 'file' ? projectAt(path.dirname(active.fsPath)) : undefined) ?? MonitorPanel.selected?.();
    root ??= (vscode.workspace.workspaceFolders ?? []).map((f) => projectAt(f.uri.fsPath)).find((r) => r);
    if (MonitorPanel.current) {
      MonitorPanel.current.root = root;
      MonitorPanel.current.panel.reveal();
    } else {
      const panel = vscode.window.createWebviewPanel('nuclear.monitor', texts().title, vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
      MonitorPanel.current = new MonitorPanel(panel, root);
    }
    void MonitorPanel.current.refresh(true);
  }

  /** The run log or the report changed: the open page draws it again. */
  static changed(): void {
    void MonitorPanel.current?.refresh();
  }

  private async refresh(first = false): Promise<void> {
    const root = this.root;
    const apps = MonitorPanel.projects?.() ?? [];
    this.ctx = root ? { ...(apps.find((a) => a.root === root) ?? projectInfo(root)), projects: apps.length ? apps : [projectInfo(root)] } : undefined;
    this.view = root ? await readMonitor(root) : undefined;
    if (root !== this.root) return; // switched meanwhile
    const key = `${root}|${lang()}`;
    if (this.drawn !== key) {
      this.drawn = key;
      const nonce = crypto.randomBytes(16).toString('base64');
      this.panel.webview.html = page(this.view, this.ctx, texts(), nonce, this.panel.webview.cspSource);
    } else void this.panel.webview.postMessage({ type: 'draw', parts: parts(this.view, this.ctx, texts()) });
    // opened on a project that is not running: started once, visibly (a failed one waits for Try again)
    const c = typeof this.view === 'object' ? this.view.console : undefined;
    if (first && root && c && (c.state === 'none' || c.state === 'stopped') && !MonitorPanel.started.has(root) && this.ctx?.platform !== 'mobile') {
      await this.run();
    }
  }

  private async message(m: { type: string; path?: string; line?: number; k?: string; on?: boolean; root?: string }): Promise<void> {
    const root = this.root;
    if (m.type === 'refresh') return this.refresh();
    if (m.type === 'run') return this.run();
    if (m.type === 'project' && m.root) {
      this.root = m.root;
      MonitorPanel.select?.(m.root);
      return this.refresh(true);
    }
    if (!root) return;
    if (m.type === 'measure') {
      await nuclear(root, ['monitor', m.on ? '--on' : '--off', '--project', root]);
      // a running server reloads on its build: measured (or no longer) from now on
      if (typeof this.view === 'object' && this.view.console?.state === 'running' && this.ctx?.platform === 'backend') await nuclear(root, ['build']);
      return this.refresh();
    }
    if (m.type === 'open' && m.path) return open(path.join(root, m.path), m.line ?? 1);
    if (m.type === 'explain' && m.k && typeof this.view === 'object' && this.view.console) {
      const lines = this.view.console.lines;
      const line = lines[lineKeys(lines).indexOf(m.k)];
      const place = line && (await explainPlace(root, line));
      if (place) return open(place.file, place.line);
      void vscode.window.showInformationMessage(texts().noPlace);
    }
  }

  /** Runs the project and watches it: a running one is only shown; else the terminal `<project> · monitor` (measured
   * when its platform can be), or a device for a mobile app. */
  private async run(): Promise<void> {
    const root = this.root;
    const ctx = this.ctx;
    if (!root || !ctx) return;
    MonitorPanel.started.add(root);
    const name = `${ctx.name} · monitor`;
    const state = typeof this.view === 'object' ? this.view.console?.state : undefined;
    const terminal = vscode.window.terminals.find((t) => t.name === name || t.name === `${ctx.name} · run`);
    if (state === 'running' || state === 'starting') {
      terminal?.show(true);
      return;
    }
    if (ctx.platform === 'mobile') {
      if (MonitorPanel.runMobile) await MonitorPanel.runMobile(root);
      else await vscode.commands.executeCommand('nuclear.run', root);
      return;
    }
    const t = vscode.window.terminals.find((x) => x.name === name) ?? vscode.window.createTerminal({ name, cwd: root });
    t.show(true);
    // `nuclear run` installs the packages itself when the app has none yet
    t.sendText(measurable(ctx.platform) ? 'nuclear monitor --on && nuclear run' : 'nuclear run');
    setTimeout(() => void this.refresh(), 800);
  }
}

async function open(file: string, line: number): Promise<void> {
  const at = Math.max(0, line - 1);
  await vscode.window.showTextDocument(vscode.Uri.file(file), { selection: new vscode.Range(at, 0, at, 0), viewColumn: vscode.ViewColumn.Beside });
}

function texts() {
  return TEXTS[lang()];
}

/** The command `nuclear.monitor.open [root]` and the watcher of the projects' run logs and reports. */
export function activateMonitor(context: vscode.ExtensionContext): void {
  const watchers = ['**/.nuclear/monitor/report.json', '**/.nuclear/logs/run.log'].map((g) => vscode.workspace.createFileSystemWatcher(g));
  // the app writes every two seconds, a server a line per request: one redraw per burst is enough
  let timer: NodeJS.Timeout | undefined;
  const later = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(MonitorPanel.changed, 300);
  };
  context.subscriptions.push(
    ...watchers,
    ...watchers.flatMap((w) => [w.onDidChange(later), w.onDidCreate(later)]),
    vscode.commands.registerCommand('nuclear.monitor.open', (root?: unknown) => MonitorPanel.show(typeof root === 'string' ? root : undefined)),
  );
}
