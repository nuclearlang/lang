// The Reports page's own panel (command `nuclear.builder.reports`, the strip's tool `reports`, Ctrl+Alt+K).
import * as vscode from 'vscode';
import { lang, localize, pageI18n, l10n } from '../../../../vscode/src/i18n';
import { ReportsHost } from './host';
import { REPORTS } from './l10n';
import { REPORTS_CSS, REPORTS_SCRIPT } from './page';

export class ReportsPanel {
  private static current: ReportsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  /** A filter asked before the page was there (the member panel's *Reports*): given once it is ready. */
  private pending: { team?: string; member?: string } | undefined;

  private constructor(context: vscode.ExtensionContext) {
    this.panel = vscode.window.createWebviewPanel('nuclear.reports', l10n.t('Reports of the factory'), vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
    this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icons', 'nuc-file.svg');
    const host = new ReportsHost((m) => void this.panel.webview.postMessage(m));
    const localized = localize(this.panel.webview, () => reportsPage(this.panel.webview));
    this.panel.onDidDispose(() => {
      ReportsPanel.current = undefined;
      localized.dispose();
    });
    this.panel.webview.onDidReceiveMessage((m: { type: string }) => {
      void host.handle(m);
      if (m.type === 'reports:ready' && this.pending) this.filter(this.pending);
    });
  }

  /** The reports, opened (or brought to the front); `filter`: a team's or a member's. */
  static show(context: vscode.ExtensionContext, filter?: { team?: string; member?: string }): void {
    const fresh = !ReportsPanel.current;
    const p = ReportsPanel.current ?? (ReportsPanel.current = new ReportsPanel(context));
    p.panel.reveal(vscode.ViewColumn.Active);
    if (!filter) return;
    // a page just made is not listening yet: its `reports:ready` asks for it
    if (fresh) p.pending = filter;
    else p.filter(filter);
  }

  private filter(f: { team?: string; member?: string }): void {
    this.pending = undefined;
    void this.panel.webview.postMessage({ type: 'reports:filter', team: f.team ?? '', member: f.member ?? '' });
  }
}

function reportsPage(webview: vscode.Webview): string {
  const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `<!doctype html><html lang="${lang()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src data: ${webview.cspSource}; script-src 'nonce-${nonce}';">
<style>body { margin: 0; padding: 14px; min-height: 100vh; box-sizing: border-box; background: var(--vscode-editor-background); overflow: auto; }${REPORTS_CSS}</style></head><body>
<div id="reports"></div>
<script nonce="${nonce}">${pageI18n(REPORTS)}
${REPORTS_SCRIPT}
Reports.mount(document.getElementById('reports'), (m) => vscode.postMessage(m));
window.addEventListener('message', (e) => Reports.receive(e.data));</script></body></html>`;
}
