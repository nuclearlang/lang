// The squad screen's own panel (command `nuclear.builder.teams`, the Builder's *Team…*, Settings and integrations).
import * as vscode from 'vscode';
import { lang, localize, pageI18n, l10n } from '../../../../vscode/src/i18n';
import { TeamsHost } from './host';
import { knownRuns } from '../panel';
import { SQUAD } from './l10n';
import { SQUAD_CSS, SQUAD_SCRIPT } from './page';
import { webviewFaceUrl } from './faceUrl';

export class TeamsPanel {
  private static current: TeamsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly host: TeamsHost;

  /** The new-team wizard opens once the page is there (the Builder's *Build a team*). */
  private wizard = false;

  private constructor(context: vscode.ExtensionContext) {
    this.panel = vscode.window.createWebviewPanel('nuclear.teams', l10n.t('Your software company'), vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
    this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icons', 'nuc-file.svg');
    this.host = new TeamsHost((m) => void this.panel.webview.postMessage(m), knownRuns, webviewFaceUrl(this.panel.webview));
    const localized = localize(this.panel.webview, () => squadPage(this.panel.webview));
    this.panel.onDidDispose(() => {
      TeamsPanel.current = undefined;
      localized.dispose();
    });
    this.panel.webview.onDidReceiveMessage((m: { type: string }) => {
      void this.host.handle(m);
      if (m.type === 'team:ready' && this.wizard) this.openWizard();
    });
  }

  /** The company screen; `wizard`: straight to its new-team wizard. */
  static show(context: vscode.ExtensionContext, wizard = false): void {
    const fresh = !TeamsPanel.current;
    const p = TeamsPanel.current ?? (TeamsPanel.current = new TeamsPanel(context));
    p.panel.reveal(vscode.ViewColumn.Active);
    if (!wizard) return;
    // a page just made is not listening yet: its `team:ready` opens the wizard
    if (fresh) p.wizard = true;
    else p.openWizard();
  }

  private openWizard(): void {
    this.wizard = false;
    void this.panel.webview.postMessage({ type: 'squad:wizard' });
  }
}

function squadPage(webview: vscode.Webview): string {
  const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `<!doctype html><html lang="${lang()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src data: ${webview.cspSource}; script-src 'nonce-${nonce}';">
<style>body { margin: 0; padding: 14px; height: 100vh; box-sizing: border-box; background: var(--vscode-editor-background); overflow: auto; } #squad { height: 100%; }${SQUAD_CSS}</style></head><body>
<div id="squad"></div>
<script nonce="${nonce}">${pageI18n(SQUAD)}
${SQUAD_SCRIPT}
Squad.mount(document.getElementById('squad'), (m) => vscode.postMessage(m), { company: true });
window.addEventListener('message', (e) => (e.data?.type === 'squad:wizard' ? Squad.wizard() : Squad.receive(e.data)));</script></body></html>`;
}
