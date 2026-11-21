// Nuclear Chat in VS Code's pages (spec 013, phase 3): the window's ChatHost (chatHost.ts) made once, with the
// project's registration from the Builder's host file and the settings; what a page needs to mount the embedded chat
// (`out/chat-embed.js`, nuclear-chat/ui) with a bridge over `postMessage`; the chat as a full editor tab (*Open the
// chat*); the GIF service's key (`nuclear-chat gif-key`).
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { builder } from './aiMachine';
import { AgentProvider, CHAT_FIX, chatCommand, ChatEvent, ChatHost, fmt, Frame, HostFile, memberChange, readConnect, registration } from './chatHost';
import { lang, l10n, onDidChangeLang } from './i18n';
import { faceData, factoryDir, updateMember } from '../../tools/nuclear-builder/src/teams/cli';
import { lineJson } from '../../tools/nuclear-builder/src/runs';
import { builderSettings } from '../../tools/nuclear-builder/src/settings';
import { toolEnv } from '../../tools/nuclear-builder/src/support';
import { notices } from './notifications';
import { assetUrl } from './assetsPage';
import { projectForcesConfirm, spendingSettings } from './spending';

export const GIF_SOURCES = ['pack', 'tenor', 'giphy'] as const;
export const chatGifs = (): string => {
  const v = vscode.workspace.getConfiguration('nuclear.chat').get<string>('gifs', 'pack');
  return (GIF_SOURCES as readonly string[]).includes(v) ? v : 'pack';
};

export const CHAT_THEMES = ['auto', 'light', 'dark'] as const;
/** The chat's colors (`nuclear.chat.theme`): the editor's, or always light or dark. */
export const chatTheme = (): string => {
  const v = vscode.workspace.getConfiguration('nuclear.chat').get<string>('theme', 'auto');
  return (CHAT_THEMES as readonly string[]).includes(v) ? v : 'auto';
};

/** The chat's own actions for its host: the theme chosen at the sidebar's foot (kept as the user's setting, which
 * registers every project again), a member changed from their profile (`team member update`: the team's file
 * changes, which registers them again). */
async function onChatAction(c: ChatHost, root: string, e: ChatEvent): Promise<void> {
  if (e.type !== 'action') return;
  if (e.data.action === 'theme') {
    const t = String(e.data.theme);
    if ((CHAT_THEMES as readonly string[]).includes(t) && t !== chatTheme()) await vscode.workspace.getConfiguration('nuclear.chat').update('theme', t, vscode.ConfigurationTarget.Global);
    return;
  }
  if (e.data.action !== 'member') return;
  const who = c.teamMember(root, String(e.data.member));
  if (!who) return;
  try {
    await updateMember(who.team, who.member, memberChange(e.data.changes));
  } catch (x) {
    void vscode.window.showErrorMessage(l10n.t('{0} was not changed: {1}', c.nameOf(root, String(e.data.member)), (x as Error).message));
  }
}

/** The host file of a project (`nuclear-builder chat-host --json`), as the service takes it. Several teams and none
 * chosen: the user is asked once which team the project uses, saved as its own (`line set team=<id>`). */
async function registrationOf(root: string): Promise<Record<string, unknown>> {
  const l = lang();
  const r = await builder(['chat-host', '--json', '--root', root, '--lang', l]);
  let file: HostFile;
  try {
    file = JSON.parse(r.out) as HostFile;
  } catch {
    throw new Error(l10n.t('nuclear-builder chat-host did not answer ({0}): update NuclearLang or run `nuclear-builder setup`', r.out.trim().split('\n').pop() || String(r.code)));
  }
  if (file.chooseTeam?.length) {
    const picked = await vscode.window.showQuickPick(
      file.chooseTeam.map((t) => ({ label: t.name, description: t.id, id: t.id })),
      { title: l10n.t('Which team works on {0}?', path.basename(root)), placeHolder: l10n.t('Saved as the project\'s team (.nuclear/builder.json)'), ignoreFocusOut: true },
    );
    if (!picked) throw new Error(file.error ?? 'no team');
    await lineJson(root, ['line', 'set', `team=${picked.id}`]);
    return registrationOf(root);
  }
  if (file.error) throw new Error(file.error);
  return registration(file, { root, lang: l, gifs: chatGifs(), theme: chatTheme(), agent: builderSettings().chat as AgentProvider, face: (f) => faceData(f), forceConfirm: spendingSettings().forceConfirm || projectForcesConfirm(root) });
}

let host: ChatHost | undefined;
/** The window's one connection to Nuclear Chat. */
export function chat(): ChatHost {
  if (!host) {
    host = new ChatHost({ connect: () => readConnect().catch((e: Error) => Promise.reject(new Error(fmt(CHAT_FIX[lang()], e.message)))), registrationOf });
    const own = host;
    host.onEvent((root, e) => void onChatAction(own, root, e));
    // the GIFs, the general agent's provider, the language (the members answer in it): every project registered again
    const again = () => {
      for (const root of roots) void host!.workspace(root, true).catch(() => undefined);
    };
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('nuclear.chat') || e.affectsConfiguration('nuclear.builder.chat') || e.affectsConfiguration('nuclear.language')) again();
    });
    // a team changed (its members, who works them, the default one) or a project's team: the members anew
    const teams = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(factoryDir()), '{settings.json,teams/*.json}'));
    const line = vscode.workspace.createFileSystemWatcher('**/.nuclear/builder.json');
    for (const w of [teams, line]) for (const on of [w.onDidChange, w.onDidCreate, w.onDidDelete]) on(debounced(again));
    watchers.push(teams, line);
  }
  return host;
}
const roots = new Set<string>();
const watchers: vscode.Disposable[] = [];
/** One call after a burst (a team's write is a file, its `.bak` and a rename). */
function debounced(f: () => void): () => void {
  let timer: NodeJS.Timeout | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(f, 500);
  };
}

export function disposeChat(): void {
  for (const w of watchers.splice(0)) w.dispose();
  host?.dispose();
  host = undefined;
}

/** What a page adds to its Content-Security-Policy's `script-src` and `img-src` to mount the chat. */
export const chatCsp = (webview: vscode.Webview) => ({ script: webview.cspSource, img: 'data: https:' });

/** The page's side, inlined after its own script: `nuclearChat(post)` gives `{mount(el, path), frame(f), unmount()}`;
 * the bridge sends each frame with `post({type: 'chatFrame', frame})` and the page passes what its host sends back
 * (`{type: 'chatFrame'}`) to `frame`. */
export function chatScript(webview: vscode.Webview, extension: vscode.Uri): string {
  const embed = assetUrl(webview, extension, 'out/chat-embed.js');
  return `function nuclearChat(post) {
  let on = null, unmount = null, module = null;
  const bridge = { send: (f) => post({ type: 'chatFrame', frame: f }), onMessage: (cb) => { on = cb; } };
  return {
    frame: (f) => on && on(f),
    async mount(el, path) {
      module ??= import(${JSON.stringify(embed)});
      const m = await module;
      if (unmount) unmount();
      unmount = await m.mount(el, { path, bridge });
    },
    unmount() { if (unmount) unmount(); unmount = null; },
  };
}`;
}

/** Wires a page's chat: its frames to the window's connection and back; `where(ws)` is the channel it opens. The
 * page asks with `{type: 'chatOpen'}` and is told `{type: 'chatPath', path}` or `{type: 'chatError', text}`. Gives
 * the handler of the page's messages (true: it was the chat's) and the function that ends it. */
export function wireChat(webview: vscode.Webview, page: string, root: () => string, where: (root: string) => string): { receive(m: { type?: string; frame?: Frame }): boolean; dispose(): void } {
  const c = chat();
  c.attach(page, (frame) => void webview.postMessage({ type: 'chatFrame', frame }));
  return {
    receive(m) {
      if (m.type === 'chatFrame' && m.frame) return void c.fromPage(page, m.frame), true;
      if (m.type !== 'chatOpen') return false;
      const r = root();
      if (!r) return void webview.postMessage({ type: 'chatError', text: l10n.t('Open a Nuclear project to talk to its team.') }), true;
      roots.add(r);
      c.workspace(r).then(
        (ws) => webview.postMessage({ type: 'chatPath', path: `/${ws}/${where(r)}` }),
        (e: Error) => webview.postMessage({ type: 'chatError', text: e.message }),
      );
      return true;
    },
    dispose: () => c.detach(page),
  };
}

/** The team's channel of a project's registration (its first team), else `general`. */
export function teamChannel(root: string): string {
  const r = chat().registered(root);
  return r.channels.find((c) => c !== 'general') ?? 'general';
}

interface ChatTab {
  panel: vscode.WebviewPanel;
  root: string;
  channel?: string;
  wire: ReturnType<typeof wireChat>;
}
let tab: ChatTab | undefined;
/** *Open the chat*: the chat as a full editor tab, on the project's team channel (or `channel`). */
export function openChatTab(context: vscode.ExtensionContext, root: string, channel?: string): void {
  if (tab) {
    Object.assign(tab, { root, channel });
    tab.panel.reveal();
    tab.wire.receive({ type: 'chatOpen' });
    return;
  }
  const panel = vscode.window.createWebviewPanel('nuclear.chat', 'Nuclear Chat', vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
  const t: ChatTab = { panel, root, channel } as ChatTab;
  t.wire = wireChat(panel.webview, 'tab', () => t.root, (r) => t.channel ?? teamChannel(r));
  tab = t;
  panel.webview.onDidReceiveMessage((m: { type?: string; frame?: Frame }) => t.wire.receive(m));
  // the language changed: the workspace is registered again in it (chat()), and the page mounts it anew
  const relang = onDidChangeLang(() => t.wire.receive({ type: 'chatOpen' }));
  // the channel on screen: what a member says there is seen, not notified
  let looked = '';
  const look = (on: boolean) => {
    if (looked) notices.look(looked, false);
    looked = on ? `chat:${t.root}:${t.channel ?? teamChannel(t.root)}` : '';
    if (looked) notices.look(looked, true);
  };
  panel.onDidChangeViewState((e) => look(e.webviewPanel.visible));
  look(true);
  panel.onDidDispose(() => (look(false), t.wire.dispose(), relang.dispose(), (tab = undefined)));
  const nonce = Math.random().toString(36).slice(2);
  const csp = chatCsp(panel.webview);
  panel.webview.html = `<!DOCTYPE html><html lang="${lang()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src ${csp.img}; script-src 'nonce-${nonce}' ${csp.script};">
<style>html, body { height: 100%; margin: 0; } #chat { height: 100vh; } .err { padding: 24px; color: var(--vscode-errorForeground); font: 13px var(--vscode-font-family); white-space: pre-wrap; }</style></head>
<body><div id="chat"></div><script nonce="${nonce}">
const vscode = acquireVsCodeApi();
${chatScript(panel.webview, context.extensionUri)}
const page = nuclearChat((m) => vscode.postMessage(m));
addEventListener('message', (e) => {
  const m = e.data;
  if (m.type === 'chatFrame') page.frame(m.frame);
  if (m.type === 'chatPath') page.mount(document.getElementById('chat'), m.path);
  if (m.type === 'chatError') document.getElementById('chat').innerHTML = '<div class="err"></div>', document.querySelector('.err').textContent = m.text;
});
vscode.postMessage({ type: 'chatOpen' });
</script></body></html>`;
}

/** *Nuclear Chat: Keep a GIF Service's Key*: the key asked hidden and given to `nuclear-chat gif-key` on its stdin
 * (never a command line argument, a setting or a file). */
export async function chatGifKey(): Promise<void> {
  const service = await vscode.window.showQuickPick(['tenor', 'giphy'], { title: l10n.t('The GIF service whose key to keep') });
  if (!service) return;
  const key = await vscode.window.showInputBox({ title: l10n.t('The {0} API key (kept in the system keyring)', service), password: true, ignoreFocusOut: true });
  if (!key) return;
  const code = await new Promise<number>((resolve) => {
    const p = spawn(chatCommand(), ['gif-key', service], { env: toolEnv(), shell: process.platform === 'win32' });
    p.on('error', () => resolve(127));
    p.on('close', (c) => resolve(c ?? 1));
    p.stdin.on('error', () => undefined);
    p.stdin.end(key);
  });
  if (code === 0) void vscode.window.showInformationMessage(l10n.t('The {0} key is in the system keyring. Choose {0} in the setting nuclear.chat.gifs to search it.', service));
  else void vscode.window.showErrorMessage(l10n.t('nuclear-chat gif-key {0} failed (exit code {1}): run `nuclear-builder setup`, then try again.', service, code));
}
