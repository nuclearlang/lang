// The Nuclear Monitor page of VS Code (spec 015): the report of the project as an accordion of bars, refreshed when
// the app writes it; a click on a name opens its `.nuc` at the line.

import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { MonitorView, page, projectOf, readMonitor, TEXTS } from './monitor';
import { lang, onDidChangeLang } from '../../../vscode/src/i18n';
import { withUpdateButton } from '../../../vscode/src/updateCheck';

export class MonitorPanel {
  private static current: MonitorPanel | undefined;
  private view: MonitorView | string = '';

  private constructor(private readonly panel: vscode.WebviewPanel, private folder: string) {
    const relang = onDidChangeLang(() => void this.refresh());
    panel.onDidDispose(() => ((MonitorPanel.current = undefined), relang.dispose()));
    panel.webview.onDidReceiveMessage(async (m: { type: string; path?: string; line?: number }) => {
      if (m.type === 'refresh') return this.refresh();
      if (m.type === 'open' && m.path && typeof this.view !== 'string') {
        const file = vscode.Uri.file(path.join(projectOf(this.view.report), m.path));
        const line = Math.max(0, (m.line ?? 1) - 1);
        await vscode.window.showTextDocument(file, { selection: new vscode.Range(line, 0, line, 0), viewColumn: vscode.ViewColumn.One });
      }
    });
  }

  /** Opens the page for the project of the active `.nuc` (or the first folder of the workspace). */
  static show(): void {
    const active = vscode.window.activeTextEditor?.document.uri;
    const folder = active?.scheme === 'file' ? path.dirname(active.fsPath) : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!folder) {
      void vscode.window.showInformationMessage(texts().empty);
      return;
    }
    if (MonitorPanel.current) {
      MonitorPanel.current.folder = folder;
      MonitorPanel.current.panel.reveal();
    } else {
      const panel = vscode.window.createWebviewPanel('nuclear.monitor', texts().title, vscode.ViewColumn.Beside, { enableScripts: true });
      MonitorPanel.current = new MonitorPanel(panel, folder);
    }
    void MonitorPanel.current.refresh();
  }

  /** A report was written: the open page draws it again. */
  static changed(): void {
    void MonitorPanel.current?.refresh();
  }

  private async refresh(): Promise<void> {
    this.view = await readMonitor(this.folder);
    const nonce = crypto.randomBytes(16).toString('base64');
    this.panel.webview.html = withUpdateButton(this.panel.webview, page(this.view, texts(), nonce, this.panel.webview.cspSource));
  }
}

function texts() {
  return TEXTS[lang()];
}

/** The command `nuclear.monitor.open` and the watcher of the projects' reports. */
export function activateMonitor(context: vscode.ExtensionContext): void {
  const watcher = vscode.workspace.createFileSystemWatcher('**/.nuclear/monitor/report.json');
  // the app writes every two seconds while it runs: one redraw per write is enough
  let timer: NodeJS.Timeout | undefined;
  const later = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(MonitorPanel.changed, 300);
  };
  context.subscriptions.push(
    watcher,
    watcher.onDidChange(later),
    watcher.onDidCreate(later),
    vscode.commands.registerCommand('nuclear.monitor.open', () => MonitorPanel.show()),
  );
}
