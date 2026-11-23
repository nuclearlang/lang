// The Nuclear Atlas tool (Ctrl+Alt+A): Nuclear Chat mounted as the page (spec 013 T3.3), on the direct message with
// the general agent (`dm-atlas`, `nuclear-builder member --role chat`, the provider of `nuclear.builder.chat`: an
// external agent or provider, Claude Code by default, over the Smart Graph; the local models are on standby,
// ADR-platform-0013). When no agent nor provider can answer on this machine, the page says how to pick one. The conversation is the chat's, kept in the project
// (`.nuclear/chat/`). Atlas informs and runs no task (spec 023): a `/task` there is answered with the tech leads to
// ask. Above the chat, the templates built from the project's map fill the chat's composer.
//
// The work does not belong to the page: the members answer through the service.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { readCard } from '../../../vscode/src/card';
import { lang, langButton, localize, pageI18n, texts, l10n } from '../../../vscode/src/i18n';
import { notices } from '../../../vscode/src/notifications';
import { chat, chatCsp, chatScript, wireChat } from '../../../vscode/src/chatView';
import { AGENT, ChatEvent } from '../../../vscode/src/chatHost';
import { ATLAS } from './l10n';
import { chatRoots, LastChannels, lastChannel, noTaskText, templatesOf, withLast, withoutChannel } from './chat';
import { BuilderProject } from '../../nuclear-builder/src/panel';
import { agentsHere } from '../../nuclear-builder/src/teams/cli';
import { SettingsPanel } from '../../../vscode/src/settingsPanel';

const DM = `dm-${AGENT}`;
/** The window's state: the conversation the page was on in each folder (`LastChannels`). */
const LAST = 'nuclear.atlas.channels';

function mapOf(root: string): string {
  try {
    return fs.readFileSync(path.join(root, '.nuclear', 'map.md'), 'utf8');
  } catch {
    return '';
  }
}

let following = false;
/** Atlas runs no task (spec 023): a `/task` said in its direct message, which the chat answers not (it starts with
 * `/`), is answered here, in its thread, with the tech leads to ask, each a link to their conversation. */
function followChat(context: vscode.ExtensionContext): void {
  if (following) return;
  following = true;
  chat().onEvent((root: string, e: ChatEvent) => {
    // a conversation deleted is not opened again
    if (e.type === 'channels' && typeof e.data.deleted === 'string') void context.workspaceState.update(LAST, withoutChannel(context.workspaceState.get<LastChannels>(LAST, {}), root, e.data.deleted));
    const m = e.data.message as { id?: string; author?: string; text?: string; thread?: string | null } | undefined;
    if (e.type !== 'message' || e.data.said !== true || e.channel !== DM || m?.author !== 'you' || !/^\/task\b/.test(m.text ?? '')) return;
    const reg = chat().registered(root);
    const leads = reg.teams.flatMap((t) => { const id = reg.lead(t); return id ? [{ id, name: chat().nameOf(root, id), team: t }] : []; });
    void chat().post(root, DM, { author: AGENT, text: noTaskText(leads, lang()), thread: m.thread ?? m.id! }).catch(() => undefined);
  });
}

export class AtlasPanel {
  private static current: AtlasPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly wire: ReturnType<typeof wireChat>;
  private root = '';
  /** The channel the chat opens on: Atlas's direct message, or the one a notification names. */
  private channel = DM;
  /** The folder's last conversation is opened once its folder is known (a new page, another folder chosen). */
  private restore = true;
  private disposed = false;
  /** A folder that is not one of the projects the chat is opened on (a workspace, the onboarding's folder). */
  private extra: { root: string; name: string } | undefined;
  /** A first message for the composer, sent when the page is ready. */
  private draft = '';
  private ready = false;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly projects: () => BuilderProject[],
  ) {
    this.panel = vscode.window.createWebviewPanel('nuclear.atlas', 'Nuclear Atlas', vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
    this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icons', 'nuc-file.svg');
    const localized = localize(this.panel.webview, () => html(this.panel.webview, context.extensionUri));
    // beside the workspace's column the page shows the open channel only: the column lists them (`AtlasPanel.split`)
    this.wire = wireChat(this.panel.webview, 'atlas', () => this.root, () => this.channel, {
      part: () => (AtlasPanel.split ? 'channel' : undefined),
      onRead: (channel) => {
        if (this.root) void context.workspaceState.update(LAST, withLast(context.workspaceState.get<LastChannels>(LAST, {}), this.root, channel));
        if (channel === this.channel) return;
        this.channel = channel;
        AtlasPanel.moved.fire();
      },
    });
    followChat(context);
    this.panel.onDidDispose(() => {
      this.disposed = true;
      localized.dispose();
      this.wire.dispose();
      AtlasPanel.current = undefined;
      AtlasPanel.moved.fire();
      notices.watch('atlas', false);
    });
    this.panel.onDidChangeViewState((e) => notices.watch('atlas', e.webviewPanel.visible && e.webviewPanel.active));
    this.panel.webview.onDidReceiveMessage((m: { type?: string; root?: string }) => {
      if (this.wire.receive(m)) return;
      if (m.type === 'ready') {
        this.ready = true;
        this.state();
        if (this.draft) void this.panel.webview.postMessage({ type: 'draft', text: this.draft });
        this.draft = '';
      }
      if (m.type === 'settings') SettingsPanel.show(this.context, 'builder');
      if (m.type === 'project' && m.root) ((this.root = m.root), (this.restore = true), this.state());
    });
  }

  /** Atlas's direct message on `root` (a workspace or any folder, not only a project) with `text` in the composer, for
   * the user to read and send: the onboarding's *Do it with me by chat*. */
  static compose(context: vscode.ExtensionContext, projects: () => BuilderProject[], where: { root: string; name: string }, text: string): void {
    const p = AtlasPanel.current ?? (AtlasPanel.current = new AtlasPanel(context, projects));
    const moved = p.ready && (p.root !== where.root || p.channel !== DM);
    p.extra = projects().some((x) => x.root === where.root) ? undefined : where;
    p.root = where.root;
    p.channel = DM;
    p.restore = false;
    p.panel.reveal(vscode.ViewColumn.Active);
    notices.watch('atlas', true);
    p.state();
    if (moved) p.wire.receive({ type: 'chatOpen' });
    // a page not ready yet gets it on its `ready`
    if (p.ready) void p.panel.webview.postMessage({ type: 'draft', text });
    else p.draft = text;
  }

  /** The Nuclear Atlas page, created or revealed, on the active project (or the first one); with `channel` (a
   * notification's: a member's direct message, a team's channel) the chat opens there. */
  static show(context: vscode.ExtensionContext, projects: () => BuilderProject[], active?: string, channel?: string): void {
    const fresh = !AtlasPanel.current;
    const p = AtlasPanel.current ?? (AtlasPanel.current = new AtlasPanel(context, projects));
    if (active && (projects().some((x) => x.root === active) || AtlasPanel.workspace?.()?.root === active)) p.root = active;
    p.panel.reveal(vscode.ViewColumn.Active);
    notices.watch('atlas', true);
    const moved = !!channel && channel !== p.channel;
    if (channel) p.restore = false;
    if (moved) p.channel = channel!;
    p.state();
    // a page already open mounts the chat again on that channel; a new one asks for it when it is ready
    if (moved && !fresh) p.wire.receive({ type: 'chatOpen' });
  }

  /** The workspace's column lists the channels (true while it shows Atlas): the page then mounts only the open one. */
  static split = false;

  static setSplit(on: boolean): void {
    if (AtlasPanel.split === on) return;
    AtlasPanel.split = on;
    const p = AtlasPanel.current;
    if (p?.ready && p.root) p.wire.receive({ type: 'chatOpen' });
  }

  /** The folder and the channel the page is on (the column lists that folder's, that channel marked). */
  static target(): { root: string; channel: string } | undefined {
    const p = AtlasPanel.current;
    return p?.root ? { root: p.root, channel: p.channel } : undefined;
  }

  /** The page's folder or channel changed. */
  static readonly moved = new vscode.EventEmitter<void>();

  /** Where the chat opens when there is no project (the editor's: the open workspace, else the welcome's folder). */
  static fallback: (() => { root: string; name: string } | undefined) | undefined;

  /** The open Nuclear workspace (its folder and name), the chat's first folder; none outside a workspace. */
  static workspace: (() => { root: string; name: string } | undefined) | undefined;

  static close(): void {
    AtlasPanel.current?.panel.dispose();
  }

  private state(): void {
    const own = this.projects();
    const { roots: projects, root } = chatRoots(own, this.extra, AtlasPanel.fallback?.(), this.root, AtlasPanel.workspace?.(), fs.existsSync);
    this.root = root;
    if (this.restore && root) {
      this.restore = false;
      this.channel = lastChannel(this.context.workspaceState.get<LastChannels>(LAST, {}), root, DM);
    }
    AtlasPanel.moved.fire();
    // the prompts to start from are a project's (its map, its components): none on a workspace's or the welcome's folder
    const isProject = own.some((p) => p.root === root);
    const card = this.root ? readCard(this.root) : undefined;
    const map = this.root ? mapOf(this.root) : '';
    if (!this.disposed)
      void this.panel.webview.postMessage({
        type: 'state',
        projects: projects.map((p) => ({ root: p.root, name: p.name })),
        root: this.root,
        templates: isProject ? templatesOf(map, card?.platform ?? '', lang()) : [],
        hasMap: !!map || !isProject,
      });
    // who can answer here (`agents --json`): none available, the page says how to pick one
    void agentsHere().then((list) => !this.disposed && void this.panel.webview.postMessage({ type: 'provider', ready: list.some((a) => a.available) }));
  }
}

export function html(webview: vscode.Webview, extension: vscode.Uri): string {
  const nonce = Math.random().toString(36).slice(2);
  const csp = chatCsp(webview);
  return `<!doctype html><html lang="${lang()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${csp.img}; script-src 'nonce-${nonce}' ${csp.script};">
<style>
  body { margin: 0; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  .app { display: flex; flex-direction: column; height: 100vh; }
  header { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); flex-wrap: wrap; }
  header b { font-size: 13px; }
  select, button { font: inherit; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; }
  .templates { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }
  .templates button { border-radius: 12px; font-size: 12px; padding: 2px 10px; cursor: pointer; }
  .templates button:hover { border-color: var(--vscode-focusBorder); }
  .hint { opacity: .7; font-size: 12px; }
  #chat { flex: 1; min-height: 0; }
  .msg { padding: 16px 24px; opacity: .8; white-space: pre-wrap; } .msg.err { color: var(--vscode-errorForeground); opacity: 1; }
  .noprov { padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); color: var(--vscode-editorWarning-foreground); } .noprov a { color: var(--vscode-textLink-foreground); cursor: pointer; }
</style></head><body><div class="app">
<header><b>Nuclear Atlas</b><select id="project" title="${texts(ATLAS).project}"></select><div class="templates" id="templates"></div><span class="hint" id="hint"></span>${langButton()}</header>
<div class="noprov" id="noprov" hidden></div>
<div id="chat"><div class="msg">${texts(ATLAS).loading}</div></div>
</div>
<script nonce="${nonce}">
${pageI18n(ATLAS)}
${chatScript(webview, extension)}
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const page = nuclearChat((m) => vscode.postMessage(m));
let S = { projects: [], root: '', templates: [], hasMap: true }, mounted = null, draft = '';
/** The onboarding's first message: into the composer once the chat has drawn it. */
function offerDraft(tries = 20) {
  if (!draft) return;
  if ($('#chat').shadowRoot?.querySelector('textarea')) return compose(draft), (draft = '');
  if (tries > 0) setTimeout(() => offerDraft(tries - 1), 150);
}
/** A template into the chat's composer (its textarea, inside the chat's shadow root), the "…" selected to fill. */
function compose(text) {
  const box = $('#chat').shadowRoot?.querySelector('textarea');
  if (!box) return;
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, text);
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.focus();
  const at = text.indexOf('…');
  if (at >= 0) box.setSelectionRange(at, at + 1);
}
function show(text, error) { page.unmount(); mounted = null; $('#chat').innerHTML = '<div class="msg' + (error ? ' err' : '') + '"></div>'; $('#chat .msg').textContent = text; }
addEventListener('message', (e) => {
  const m = e.data;
  if (m.type === 'chatFrame') return page.frame(m.frame);
  if (m.type === 'chatPath') return page.mount($('#chat'), m.path).then(() => offerDraft(), (x) => show(String(x), true));
  if (m.type === 'draft') return (draft = m.text), offerDraft();
  if (m.type === 'chatError') return show(m.text, true);
  if (m.type === 'provider') { $('#noprov').hidden = m.ready; $('#noprov').innerHTML = esc(t('noProvider')) + ' <a data-settings="1" tabindex="0">' + esc(t('pickProvider')) + '</a>'; return; }
  if (m.type !== 'state') return;
  S = m;
  $('#project').innerHTML = S.projects.map((p) => '<option value="' + esc(p.root) + '"' + (p.root === S.root ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
  $('#templates').innerHTML = S.templates.map((x, i) => '<button type="button" data-tpl="' + i + '" title="' + esc(x.text) + '">' + esc(x.label) + '</button>').join('');
  $('#hint').innerHTML = S.root ? (S.hasMap ? esc(t('role')) : t('noMap')) : esc(t('noProject'));
  if (!S.root) return show(t('noProject'));
  if (mounted !== S.root) { mounted = S.root; vscode.postMessage({ type: 'chatOpen' }); }
});
document.addEventListener('click', (e) => { if (e.target.closest('[data-settings]')) return vscode.postMessage({ type: 'settings' }); const b = e.target.closest('[data-tpl]'); if (b) compose(S.templates[+b.dataset.tpl].text); });
$('#project').addEventListener('change', (e) => vscode.postMessage({ type: 'project', root: e.target.value }));
vscode.postMessage({ type: 'ready' });
</script></body></html>`;
}
