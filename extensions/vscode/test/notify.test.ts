// The rules of the notifications (src/notify.ts): which kinds pop up for each setting, when a notice is seen, how a
// repeat folds, the badges, and which chat events call the user. node:test, no editor.
import assert from 'node:assert/strict';
import test from 'node:test';
import { add, badges, chatCall, chatKey, chatWhere, Notice, pops, seen, settle, toggle } from '../src/notify';

const notice = (o: Partial<Notice>): Notice => ({ id: 1, tool: 'builder', kind: 'info', title: 't', text: '', level: 'info', at: 0, read: false, ...o });

test('the setting decides what pops up', () => {
  for (const k of ['mention', 'gate', 'failed', 'done', 'info'] as const) assert.equal(pops(k, 'all'), true);
  assert.deepEqual((['mention', 'gate', 'failed', 'done', 'info'] as const).filter((k) => pops(k, 'mentions-and-gates')), ['mention', 'gate']);
  for (const k of ['mention', 'gate', 'failed'] as const) assert.equal(pops(k, 'off'), false);
});

test('a notice is seen while its tool or its place is on screen', () => {
  assert.equal(seen({ tool: 'atlas' }, new Set(['atlas']), new Set()), true);
  assert.equal(seen({ tool: 'atlas', place: 'chat:/p:dm-askia' }, new Set(), new Set(['chat:/p:dm-askia'])), true);
  assert.equal(seen({ tool: 'atlas', place: 'chat:/p:dm-askia' }, new Set(['builder']), new Set(['chat:/p:general'])), false);
});

test('a repeat of an unread key folds into it; a read one or an old one does not', () => {
  const first = notice({ id: 1, key: 'k', text: 'Hi there', at: 1000 });
  const r = add([first], notice({ id: 2, key: 'k', text: '', at: 2000 }));
  assert.equal(r.folded, true);
  assert.equal(r.list.length, 1);
  assert.equal(r.list[0].id, 1, 'the same line of the list');
  assert.equal(r.list[0].text, 'Hi there', 'an empty repeat keeps what was said');
  assert.equal(add([{ ...first, read: true }], notice({ id: 2, key: 'k', at: 2000 })).folded, false);
  assert.equal(add([first], notice({ id: 2, key: 'k', at: 1000 + 200_000 })).list.length, 2);
  assert.equal(add(Array.from({ length: 60 }, (_, i) => notice({ id: i })), notice({ id: 99 })).list.length, 50);
});

test('the badges count the unread notices of each tool', () => {
  assert.deepEqual(badges([notice({ tool: 'atlas' }), notice({ tool: 'atlas' }), notice({ tool: 'builder', read: true }), notice({ tool: 'settings' })]), { atlas: 2, builder: 0, settings: 1 });
});

test('the chat calls the user for direct messages, mentions, questions and answers, never for their own words', () => {
  const known = new Set<string>();
  const msg = (channel: string, m: Record<string, unknown>, said = false) => chatCall({ type: 'message', channel, data: { message: m, ...(said ? { said } : {}) } }, known);
  assert.deepEqual(msg('dm-askia', { id: 'm1', author: 'askia', text: 'Done.' }), { what: 'answered', member: 'askia', channel: 'dm-askia', thread: undefined, message: 'm1', text: 'Done.' });
  assert.equal(msg('dm-askia', { id: 'm1', author: 'askia', text: 'Done (edited).' }), null, 'an edit is the same message');
  assert.equal(msg('dm-askia', { id: 'm2', author: 'you', text: 'hi' }, true), null, 'the user\'s own');
  assert.equal(msg('dm-askia', { id: 'm3', author: 'system', text: 'could not answer' }), null);
  assert.equal(msg('team-a', { id: 'm4', author: 'askia', text: 'plain talk' }), null, 'a channel message not to the user');
  assert.equal(msg('team-a', { id: 'm5', author: 'askia', text: 'what do you think @you?' })?.what, 'mentioned');
  assert.equal(msg('team-a', { id: 'm6', author: 'askia', text: 'accept?', buttons: [{ id: 'spec|s1|accept' }] })?.what, 'asks');
  assert.equal(msg('team-a', { id: 'm7', author: 'askia', text: 'approve?', buttons: [{ id: 'run|r1|a1|approve' }] }), null, 'the Builder tells a run\'s questions');
  assert.equal(msg('team-a', { id: 'm8', author: 'lead', text: 'Run r1 starts', links: { run: 'r1' } }), null, 'a run\'s progress');
  assert.deepEqual(chatCall({ type: 'done', channel: 'team-a', data: { member: 'askia', thread: 'm2' } }, known), { what: 'answered', member: 'askia', channel: 'team-a', thread: 'm2', text: '' });
  assert.equal(chatCall({ type: 'done', channel: 'team-a', data: { member: 'askia', error: 'boom' } }, known), null);
  assert.equal(chatCall({ type: 'ask', channel: 'dm-askia', data: { member: 'askia', question: 'Which table?' } }, known)?.what, 'asks');
  assert.equal(chatCall({ type: 'typing', channel: 'dm-askia', data: { member: 'askia' } }, known), null);
  assert.equal(chatKey('/p', { channel: 'dm-askia', member: 'askia' }), 'chat:/p:dm-askia:askia');
  // a click opens the chat at the message, in its thread
  assert.equal(chatWhere({ channel: 'team-a', message: 'm5', thread: 'm2' }), 'team-a?message=m5&thread=m2');
  assert.equal(chatWhere({ channel: 'dm-askia' }), 'dm-askia');
  assert.equal(chatWhere({}), undefined);
});

test('the automatic update: the cache folder of the command, versions compared by numbers', async () => {
  const { cacheDir, later } = await import('../src/updates');
  assert.equal(cacheDir({ XDG_CACHE_HOME: '/c' }, 'linux', '/h'), '/c/nuclearlang');
  assert.equal(cacheDir({}, 'linux', '/h'), '/h/.cache/nuclearlang');
  assert.ok(later('0.89.0', '0.88.4') && later('v1.0.0', '0.99.9') && !later('0.88.4', '0.88.4') && !later('x', '0.1.0'));
});

test('a notice is done when its run no longer waits, or when the user marks it', () => {
  const list = [notice({ id: 1, key: 'run:a:waits', kind: 'gate' }), notice({ id: 2, key: 'run:b:waits', kind: 'gate' }), notice({ id: 3 })];
  assert.equal(list.some((n) => n.done), false);
  const settled = settle(list, 'run:a:waits');
  assert.deepEqual(settled?.map((n) => !!n.done), [true, false, false]);
  assert.equal(settle(settled ?? [], 'run:a:waits'), null, 'nothing changes twice');
  const marked = toggle(settled ?? [], 3);
  assert.deepEqual(marked.map((n) => !!n.done), [true, false, true]);
  assert.equal(toggle(marked, 3)[2]?.done, false);
  // the run waits again: its new notice is not done, even folded into the one before
  const again = add(settled ?? [], notice({ id: 9, key: 'run:a:waits', kind: 'gate', at: 1 }));
  assert.equal(again.list[0]?.done, false);
});
