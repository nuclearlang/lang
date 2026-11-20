/**
 * A newer release of NuclearLang (ADR-platform-0011: one version for the whole platform): checked at most twice a
 * day against the releases of nuclearlang/lang, compared with this extension's version, and offered on every
 * NuclearLang page as a floating button (and in the status bar). The button runs `nuclear update`, the public
 * installer again, which updates the binaries, the AI services and this extension together.
 */
import * as vscode from 'vscode';
import { l10n } from './i18n';
import { newerVersion, versionFromLatestUrl } from './snapshotCheck';

const LATEST_URL = 'https://github.com/nuclearlang/lang/releases/latest';
const CACHE = 'nuclear.update.latest';
const EVERY_MS = 12 * 60 * 60 * 1000;
const COMMAND = 'nuclear.update';

let available: string | undefined;
let own = '0.0.0';
const views = new Set<vscode.Webview>();
let status: vscode.StatusBarItem | undefined;

/** The command, the status bar item, and the check: the last known latest at once, the release page when it is old. */
export function activateUpdateCheck(context: vscode.ExtensionContext): void {
  own = String(context.extension.packageJSON.version);
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
  status.command = COMMAND;
  context.subscriptions.push(status, vscode.commands.registerCommand(COMMAND, runUpdate));
  const cached = context.globalState.get<{ version: string; at: number }>(CACHE);
  if (cached) set(cached.version);
  if (!cached || Date.now() - cached.at > EVERY_MS || process.env.NUCLEAR_UPDATE_CHECK_NOW) void refresh(context);
  const timer = setInterval(() => void refresh(context), EVERY_MS);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });
}

async function refresh(context: vscode.ExtensionContext): Promise<void> {
  if (process.env.NUCLEAR_NO_UPDATE_CHECK) return;
  try {
    // the redirect of releases/latest names the tag (…/releases/tag/v0.81.0): no API call, no rate limit
    const res = await fetch(LATEST_URL, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const version = versionFromLatestUrl(res.headers.get('location') ?? res.url);
    if (!version) return;
    await context.globalState.update(CACHE, { version, at: Date.now() });
    set(version);
  } catch {
    // offline: the last known version stays
  }
}

function set(latest: string): void {
  available = newerVersion(latest, own) ? latest : undefined;
  if (status) {
    status.text = `$(cloud-download) NuclearLang ${available ?? ''}`;
    status.tooltip = available ? l10n.t('NuclearLang {0} is out (this is {1}): update', available, own) : '';
    status.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    if (available) status.show();
    else status.hide();
  }
  for (const w of views) post(w);
}

function post(w: vscode.Webview): void {
  try {
    void w.postMessage({ type: 'nuclear:update', version: available ?? null, label: available ? l10n.t('Update to {0}', available) : '', title: available ? l10n.t('NuclearLang {0} is out (this is {1}): update', available, own) : '' }).then(undefined, () => views.delete(w));
  } catch {
    views.delete(w);
  }
}

async function runUpdate(): Promise<void> {
  const terminal = vscode.window.createTerminal({ name: 'NuclearLang · update' });
  terminal.show();
  terminal.sendText('nuclear update');
  const reload = l10n.t('Reload Window');
  if ((await vscode.window.showInformationMessage(l10n.t('NuclearLang is updating in the terminal. When it finishes, reload the window to use the new extension.'), reload)) === reload)
    void vscode.commands.executeCommand('workbench.action.reloadWindow');
}

/** A page's HTML with the floating update button: shown when a newer release is known, now or later (the host posts
 * `nuclear:update`, so an open page never re-renders for it). Its click is a command link, allowed for this one
 * command; its script carries the page's own nonce. */
export function withUpdateButton(webview: vscode.Webview, html: string): string {
  const allowed = webview.options.enableCommandUris;
  if (allowed !== true && !(Array.isArray(allowed) && allowed.includes(COMMAND))) {
    webview.options = { ...webview.options, enableCommandUris: [...(Array.isArray(allowed) ? allowed : []), COMMAND] };
  }
  views.add(webview);
  const nonce = /'nonce-([^']+)'/.exec(html)?.[1];
  if (!nonce || !html.includes('</body>')) return html;
  const shown = available ? '' : ' hidden';
  const label = available ? l10n.t('Update to {0}', available) : '';
  const button = `<a id="nuc-update" href="command:${COMMAND}" title="${available ? l10n.t('NuclearLang {0} is out (this is {1}): update', available, own) : ''}"${shown} style="position:fixed;right:18px;bottom:18px;z-index:2147483647;display:flex;align-items:center;gap:8px;padding:9px 16px 9px 12px;border-radius:999px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);font:600 12px var(--vscode-font-family);text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.35),0 0 0 1px var(--vscode-focusBorder);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg><span>${label}</span><b id="nuc-update-x" role="button" tabindex="0" aria-label="${l10n.t('Hide')}" title="${l10n.t('Hide')}" style="margin-left:4px;padding:0 4px;opacity:.7;font-weight:400;">✕</b></a>
<script nonce="${nonce}">document.getElementById('nuc-update-x').addEventListener('click',function(e){e.preventDefault();e.stopPropagation();document.getElementById('nuc-update').hidden=true;});addEventListener('message',function(e){var m=e.data;if(!m||m.type!=='nuclear:update')return;var a=document.getElementById('nuc-update');if(!a)return;a.hidden=!m.version;a.title=m.title;a.querySelector('span').textContent=m.label;});</script>`;
  const at = html.lastIndexOf('</body>');
  return html.slice(0, at) + button + html.slice(at);
}

/** The page is gone: no more messages to it. */
export function forgetWebview(webview: vscode.Webview): void {
  views.delete(webview);
}
