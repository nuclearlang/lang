// The rules of the notifications, with no `vscode` import (the tests drive them): which kinds pop up for each value
// of `nuclear.notifications`, when a notice is already seen, how a repeat folds into the one before, the badges of
// the strip, and which chat events are addressed to the user. `notifications.ts` shows them in VS Code.

export type NoticeTool = 'atlas' | 'builder' | 'settings';
/** `mention`: a member addressed you (a direct message, `@you`, an answer, a question with buttons); `gate`: work
 * waits for you; `failed` / `done`: work ended; `info`: anything else. */
export type NoticeKind = 'mention' | 'gate' | 'failed' | 'done' | 'info';
export type NotifySetting = 'all' | 'mentions-and-gates' | 'off';

export interface Notice {
  id: number;
  tool: NoticeTool;
  kind: NoticeKind;
  title: string;
  text: string;
  level: 'info' | 'warning' | 'error';
  at: number;
  read: boolean;
  /** Where a click goes: the project, a run (`ref`) and its node (`stage`, `step`), or a chat channel. */
  root?: string;
  ref?: string;
  stage?: string;
  step?: string;
  channel?: string;
  /** The chat's message it is about and the thread it is in: a click opens the chat at it. */
  message?: string;
  thread?: string;
  /** The place on screen that makes it seen (`chat:<root>:<channel>`). */
  place?: string;
  /** Notices with the same key fold into one while unread (a member's message, then its answer's end). */
  key?: string;
}

/** Whether a kind pops up as a VS Code notification; the list and the badges record every notice anyway. */
export function pops(kind: NoticeKind, setting: NotifySetting): boolean {
  if (setting === 'off') return false;
  return setting === 'all' || kind === 'mention' || kind === 'gate';
}

/** A notice is seen as it arrives when its tool or its place is on screen. */
export const seen = (n: Pick<Notice, 'tool' | 'place'>, watching: ReadonlySet<string>, looking: ReadonlySet<string>): boolean =>
  watching.has(n.tool) || (!!n.place && looking.has(n.place));

/** How long an unread notice takes a repeat of its key into itself instead of a new one. */
export const FOLD_MS = 120_000;

/** The list with a new notice first (at most 50). A repeat of an unread notice's key replaces it: `folded` says the
 * user was already told. */
export function add(list: readonly Notice[], n: Notice): { list: Notice[]; folded: boolean } {
  const was = n.key ? list.find((x) => x.key === n.key && !x.read && n.at - x.at < FOLD_MS) : undefined;
  const rest = was ? list.filter((x) => x !== was) : list;
  return { list: [{ ...n, id: was?.id ?? n.id, text: n.text || (was?.text ?? ''), message: n.message ?? was?.message, thread: n.thread ?? was?.thread }, ...rest].slice(0, 50), folded: !!was };
}

/** The unread count of each tool: its badge on the strip. */
export function badges(list: readonly Notice[]): Record<NoticeTool, number> {
  const out: Record<NoticeTool, number> = { atlas: 0, builder: 0, settings: 0 };
  for (const n of list) if (!n.read) out[n.tool]++;
  return out;
}

// ---------- the chat ----------

/** A chat event as the service sends it (`ChatEvent`). */
export interface ChatEventLike {
  type: string;
  channel: string;
  data: Record<string, unknown>;
}

/** A chat event addressed to the user: `answered` (a member's answer ended, or a member wrote in a direct message),
 * `asks` (a member's question: an `ask`, or a message with buttons), `mentioned` (`@you`). */
export interface ChatCall {
  what: 'answered' | 'asks' | 'mentioned';
  member: string;
  channel: string;
  thread?: string;
  /** The message that called (a message event's), to open the chat at it. */
  message?: string;
  text: string;
}

interface Msg {
  id?: string;
  author?: string;
  text?: string;
  thread?: string | null;
  buttons?: { id?: string }[];
  links?: Record<string, unknown>;
}

/** Whether a chat event calls the user, and how. `known` holds the messages already met (an edit or a reaction is
 * the same message again): the function adds to it. The user's own messages, the chat's (`system`), a run's
 * progress and a run's question (the Builder tells those itself) never call. */
export function chatCall(e: ChatEventLike, known: Set<string>): ChatCall | null {
  const thread = typeof e.data.thread === 'string' ? e.data.thread : undefined;
  const member = String(e.data.member ?? '');
  if (e.type === 'done') return member && member !== 'you' && !e.data.error ? { what: 'answered', member, channel: e.channel, thread, text: '' } : null;
  if (e.type === 'ask') return member ? { what: 'asks', member, channel: e.channel, thread, text: String(e.data.question ?? '') } : null;
  if (e.type !== 'message') return null;
  const m = e.data.message as Msg | undefined;
  if (!m?.id || known.has(m.id)) return null;
  known.add(m.id);
  if (!m.author || m.author === 'you' || m.author === 'system' || e.data.said === true) return null;
  if (m.links?.run || m.buttons?.some((b) => b.id?.startsWith('run|'))) return null;
  const at = { member: m.author, channel: e.channel, thread: m.thread ?? undefined, message: m.id, text: m.text ?? '' };
  if (m.buttons?.length) return { what: 'asks', ...at };
  if (/(^|\s)@you\b/i.test(m.text ?? '')) return { what: 'mentioned', ...at };
  if (e.channel.startsWith('dm-')) return { what: 'answered', ...at };
  return null;
}

/** Where the chat opens for a notice: its channel, at its message (`?message=`) and in its thread (`&thread=`). */
export function chatWhere(n: Pick<Notice, 'channel' | 'message' | 'thread'>): string | undefined {
  if (!n.channel) return undefined;
  const q = new URLSearchParams();
  if (n.message) q.set('message', n.message);
  if (n.thread) q.set('thread', n.thread);
  const query = q.toString();
  return query ? `${n.channel}?${query}` : n.channel;
}

/** The key that folds a member's message and the end of its answer into one notice. */
export const chatKey = (root: string, c: Pick<ChatCall, 'channel' | 'member'>) => `chat:${root}:${c.channel}:${c.member}`;
