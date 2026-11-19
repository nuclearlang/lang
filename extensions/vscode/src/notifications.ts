// The one notification system of the extension: what the local agents did while you were elsewhere (a member answered
// or mentioned you in Nuclear Chat, a Builder run waits for you, passed or failed, a connection stopped answering).
// Every tool adds its notices here; each one is a VS Code notification with *Open* (by `nuclear.notifications`, and
// never while you are looking at that tool or that conversation), a line of the workspace column's list, and a badge
// on the tool's icon of the strip and on the strip's icon in the activity bar. A click on either goes to it. The rules
// are `notify.ts` (no `vscode`, tested).
import * as vscode from 'vscode';
import { l10n } from './i18n';
import { add, badges, chatCall, chatKey, Notice, NoticeTool, NotifySetting, pops, seen } from './notify';
import { chat } from './chatView';

export type { Notice, NoticeTool } from './notify';

const setting = (): NotifySetting => {
  const v = vscode.workspace.getConfiguration('nuclear').get<string>('notifications', 'all');
  return v === 'off' || v === 'mentions-and-gates' ? v : 'all';
};

class Notices {
  private list: Notice[] = [];
  private next = 1;
  /** The tools on screen now (their panel visible and active): what they say is read at once. */
  private readonly watching = new Set<string>();
  /** The places on screen now (`chat:<root>:<channel>`): a notice about one is read at once. */
  private readonly looking = new Set<string>();
  readonly onDidChange = new vscode.EventEmitter<void>();
  /** Opens a notice's place (set by the workspace: the tool, then the run's node or the chat's channel). */
  open: (n: Notice) => void = (n) => void vscode.commands.executeCommand('nuclear.workspace.tool', n.tool);

  all(): readonly Notice[] {
    return this.list;
  }

  unread(tool?: NoticeTool): number {
    return tool ? badges(this.list)[tool] : this.list.filter((n) => !n.read).length;
  }

  /** A panel tells whether it is on screen; when it is, its notices are read. */
  watch(tool: NoticeTool, visible: boolean): void {
    if (visible) this.watching.add(tool);
    else this.watching.delete(tool);
    if (visible) this.read(tool);
  }

  /** A page tells which place it shows (a chat channel), or that it shows it no more. */
  look(place: string, visible: boolean): void {
    if (visible) this.looking.add(place);
    else this.looking.delete(place);
    if (!visible) return;
    let changed = false;
    for (const n of this.list) if (n.place === place && !n.read) changed = n.read = true;
    if (changed) this.onDidChange.fire();
  }

  read(tool: NoticeTool): void {
    let changed = false;
    for (const n of this.list) if (n.tool === tool && !n.read) changed = n.read = true;
    if (changed) this.onDidChange.fire();
  }

  add(n: Omit<Notice, 'id' | 'at' | 'read' | 'kind'> & { kind?: Notice['kind'] }): void {
    const kind = n.kind ?? (n.level === 'error' ? 'failed' : n.level === 'warning' ? 'gate' : 'info');
    const read = seen(n, this.watching, this.looking);
    const r = add(this.list, { ...n, kind, id: this.next++, at: Date.now(), read });
    this.list = r.list;
    this.onDidChange.fire();
    if (read || r.folded || !pops(kind, setting())) return;
    const notice = r.list[0];
    const show = n.level === 'error' ? vscode.window.showErrorMessage : n.level === 'warning' ? vscode.window.showWarningMessage : vscode.window.showInformationMessage;
    const open = l10n.t('Open');
    void show(n.text ? `${n.title}: ${n.text}` : n.title, open).then((pick) => pick === open && this.open(notice));
  }
}

export const notices = new Notices();

let following = false;
/** Nuclear Chat's events of every registered project: what a member says to the user is a notice of Atlas (the chat
 * page), opened on its channel. */
export function followChatNotices(): void {
  if (following) return;
  following = true;
  const known = new Set<string>();
  chat().onEvent((root, e) => {
    const c = chatCall(e, known);
    if (!c) return;
    const name = chat().nameOf(root, c.member);
    const title = c.what === 'asks' ? l10n.t('{0} asks you', name) : c.what === 'mentioned' ? l10n.t('{0} mentioned you', name) : l10n.t('{0} answered you', name);
    const text = c.text.replace(/\s+/g, ' ').slice(0, 140);
    notices.add({ tool: 'atlas', kind: 'mention', title, text, level: c.what === 'asks' ? 'warning' : 'info', root, channel: c.channel, message: c.message, thread: c.thread, place: `chat:${root}:${c.channel}`, key: chatKey(root, c) });
  });
}
