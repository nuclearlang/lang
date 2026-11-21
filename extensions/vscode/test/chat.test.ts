// Nuclear Chat's host (src/chatHost.ts): the relay of the pages' frames, the registration from the Builder's host
// file, a run told as chat posts, and the connection against a fake socket (registered again after a reconnection,
// what was missed read back). node:test, no editor.
import assert from 'node:assert/strict';
import test from 'node:test';
import { askPost, buttonOf, ChatHost, Frame, HOST, HostFile, lineDiff, memberChange, registration, Relay, RUN_TEXTS, RunLike, runPosts, Socket } from '../src/chatHost';
import type { SocketEvents } from '../../tools/nuclear-http-connections/src/socket';

const guard = { header: 'X-Chat-Token', token: 'secret' };

test('the relay keeps each page\'s ids apart, adds the token, and subscribes once per topic', () => {
  const r = new Relay(guard);
  const a = r.fromPage('builder', { id: 1, method: 'GET', path: '/gifs/pack', headers: {} })!;
  const b = r.fromPage('atlas', { id: 1, method: 'GET', path: '/channels/w1', headers: { accept: 'json' } })!;
  assert.notEqual(a.id, b.id);
  assert.deepEqual(b.headers, { accept: 'json', 'X-Chat-Token': 'secret' });
  assert.deepEqual(r.fromService({ id: b.id, status: 200, body: [] }), [['atlas', { id: 1, status: 200, body: [] }]]);
  assert.deepEqual(r.fromService({ id: b.id, status: 200 }), [], 'answered once');
  assert.deepEqual(r.fromPage('builder', { subscribe: 'chat.w1' }), { subscribe: 'chat.w1' });
  assert.equal(r.fromPage('atlas', { subscribe: 'chat.w1' }), null, 'already listened to');
  assert.deepEqual(r.fromService({ event: 'chat.w1', data: { n: 1 } }).map(([p]) => p).sort(), ['atlas', 'builder']);
  assert.equal(r.fromPage('atlas', { unsubscribe: 'chat.w1' }), null, 'builder still listens');
  assert.deepEqual(r.fail('closed'), [['builder', { id: 1, status: 503, body: { detail: 'closed' } }]]);
  assert.deepEqual(r.drop('builder'), [{ unsubscribe: 'chat.w1' }]);
});

const choice = (id: string, kind: string, available = true) => ({ id, label: id, kind, command: ['nuclear-builder', 'member', '--role', 'chat', '--kind', kind, '--provider', id], paid: true, models: [], defaultModel: '', available });
const file: HostFile = {
  host: 'builder',
  members: [
    { id: 'core-qa', name: 'Edgar', role: 'qa', team: 'core', avatar: 'qa-001', face: '/faces/qa-001.svg', temperament: 'nerd', profile: { bio: 'x' }, personality: null, responder: { command: ['nuclear-builder', 'member', '--team', 'core', '--role', 'qa'] }, brain: { agent: 'Claude Code', kind: 'agent', provider: 'claude-code', model: 'opus', paid: true } },
    { id: 'atlas', name: 'Atlas', role: 'chat', team: '', face: null, temperament: null, personality: { gifs: 'never' }, responder: { command: choice('claude-code', 'agent').command, paid: true, choice: 'claude-code', model: '', choices: [choice('claude-code', 'agent'), choice('anthropic', 'api'), choice('codex', 'agent', false)] } },
  ],
  teams: [{ id: 'core', name: 'Core', lead: 'core-qa' }],
  channels: [{ id: 'general', name: 'general' }, { id: 'core', name: 'core', team: 'core' }],
  lang: 'en',
};

test('a host file becomes the registration: faces as pictures, the general agent\'s default from the setting', () => {
  const body = registration(file, { root: '/p', lang: 'es', gifs: 'tenor', agent: { kind: 'api', provider: 'anthropic', model: 'claude-haiku-5-5' }, face: (f) => `data:image/svg+xml;base64,${f.length}` }) as { members: Record<string, unknown>[]; gifs: string; lang: string; root: string };
  assert.equal(body.members[0].face, 'data:image/svg+xml;base64,17');
  assert.equal('temperament' in body.members[0], false);
  assert.deepEqual(body.members[0].personality, {});
  assert.deepEqual(body.members[0].brain, file.members[0].brain);
  const agent = body.members[1] as { id: string; face: string; responder: { choice: string; model: string; choices: unknown[] } };
  assert.equal(agent.id, 'atlas');
  assert.equal(agent.face, '');
  assert.deepEqual([agent.responder.choice, agent.responder.model, agent.responder.choices.length], ['anthropic', 'claude-haiku-5-5', 3]);
  // a setting whose agent is not on this machine: the host file's default (an external agent) stays
  const off = registration(file, { root: '/p', lang: 'en', gifs: 'pack', agent: { kind: 'agent', provider: 'codex' }, face: () => null }) as { members: { responder: { choice: string } }[] };
  assert.equal(off.members[1].responder.choice, 'claude-code');
  assert.deepEqual([body.root, body.lang, body.gifs], ['/p', 'es', 'tenor']);
});

test('the registration carries the chat\'s theme and each member\'s card; a profile\'s change keeps only what team member update takes', () => {
  const card = { editable: true, temperament: 'nerd', temperaments: [{ id: 'nerd', name: 'Nerd' }], skills: ['Tests'], instructions: 'Break it' };
  const withCard = { ...file, members: [{ ...file.members[0], member: 'qa', card }, file.members[1]] };
  const body = registration(withCard, { root: '/p', lang: 'en', gifs: 'pack', agent: { kind: 'agent', provider: 'claude-code' }, face: () => null, theme: 'dark' }) as { theme: string; members: Record<string, unknown>[] };
  assert.equal(body.theme, 'dark');
  assert.deepEqual(body.members[0].card, card);
  assert.equal((registration(file, { root: '/p', lang: 'en', gifs: 'pack', agent: { kind: 'agent', provider: 'claude-code' }, face: () => null }) as { theme: string }).theme, 'auto');
  assert.deepEqual(memberChange({ name: 'Edgar', model: 'haiku', gifs: 'often', kind: 'api', provider: 'anthropic', skills: ['x'], instructions: 3 }), { name: 'Edgar', model: 'haiku', gifs: 'often' });
  assert.deepEqual(memberChange(null), {});
});

test('a paid provider the user put in the team is not confirmed again in the chat; one never chosen still is; a forced confirmation always is', () => {
  type R = { members: { id: string; responder: { command: string[]; choices?: { id: string; command: string[] }[] } }[] };
  const body = registration(file, { root: '/p', lang: 'en', gifs: 'pack', agent: { kind: 'agent', provider: 'claude-code' }, face: () => null }) as unknown as R;
  const [qa, atlas] = body.members;
  // the team's member works with Claude Code (paid, chosen in the team): its answers and Atlas's Claude Code go on
  assert.ok(qa.responder.command.includes('--confirm-spending'));
  assert.ok(atlas.responder.command.includes('--confirm-spending'));
  assert.ok(atlas.responder.choices!.find((c) => c.id === 'claude-code')!.command.includes('--confirm-spending'));
  // Anthropic's API was never put in a team: asked twice
  assert.equal(atlas.responder.choices!.find((c) => c.id === 'anthropic')!.command.includes('--confirm-spending'), false);
  const forced = registration(file, { root: '/p', lang: 'en', gifs: 'pack', agent: { kind: 'agent', provider: 'claude-code' }, face: () => null, forceConfirm: true }) as unknown as R;
  assert.ok(forced.members.every((m) => !m.responder.command.includes('--confirm-spending') && (m.responder.choices ?? []).every((c) => !c.command.includes('--confirm-spending'))));
});

test('the chat lists Atlas and each team\'s tech lead only; an agent is never asked about spending, an API is unless chosen; forced asks all', () => {
  type R = { members: { id: string; responder: { command: string[]; choices?: { id: string; command: string[] }[] } }[] };
  const dev = { ...file.members[0], id: 'core-dev', name: 'Ada', role: 'developer', responder: { command: ['nuclear-builder', 'member', '--team', 'core', '--member', 'dev'] }, brain: { agent: 'OpenAI', kind: 'api', provider: 'openai', model: 'gpt', paid: true } };
  const lead = { ...file.members[0], brain: { agent: 'Anthropic', kind: 'api', provider: 'anthropic', model: 'haiku', paid: true } };
  const two: HostFile = { ...file, members: [lead, dev, file.members[1]] };
  const body = registration(two, { root: '/p', lang: 'en', gifs: 'pack', agent: { kind: 'agent', provider: 'claude-code' }, face: () => null }) as unknown as R;
  assert.deepEqual(body.members.map((m) => m.id), ['core-qa', 'atlas'], 'the member who does not lead is not listed');
  const atlas = body.members[1];
  // agents: never asked, even never put in a team (codex) or unavailable
  assert.ok(atlas.responder.command.includes('--confirm-spending'));
  assert.ok(atlas.responder.choices!.find((c) => c.id === 'codex')!.command.includes('--confirm-spending'));
  // APIs: Anthropic was put in the team (the lead's), OpenAI only in a member not listed: still chosen by the user
  assert.ok(body.members[0].responder.command.includes('--confirm-spending'));
  assert.ok(atlas.responder.choices!.find((c) => c.id === 'anthropic')!.command.includes('--confirm-spending'));
  const none = registration({ ...file, members: [{ ...lead, brain: { ...lead.brain, kind: 'agent', provider: 'claude-code' } }, file.members[1]] }, { root: '/p', lang: 'en', gifs: 'pack', agent: { kind: 'agent', provider: 'claude-code' }, face: () => null }) as unknown as R;
  assert.equal(none.members[1].responder.choices!.find((c) => c.id === 'anthropic')!.command.includes('--confirm-spending'), false, 'an API never chosen is asked');
  const forced = registration(two, { root: '/p', lang: 'en', gifs: 'pack', agent: { kind: 'agent', provider: 'claude-code' }, face: () => null, forceConfirm: true }) as unknown as R;
  assert.ok(forced.members.every((m) => !m.responder.command.includes('--confirm-spending') && (m.responder.choices ?? []).every((c) => !c.command.includes('--confirm-spending'))));
});

const run = (status: string, stages: [string, string][]): RunLike => ({ id: 'loans', status, spec: { title: 'Loans' }, costUsd: 0.25, stages: stages.map(([id, s]) => ({ id, title: id[0].toUpperCase() + id.slice(1), status: s, role: id === 'analysis' ? 'analyst' : 'qa', steps: [{ summary: `${id} said`, status: s, costUsd: 0.1 }] })) });
const member = (role?: string) => (role ? `core-${role}` : 'system');

test('a run is told in its thread: started by the lead, each station by its member, a failure with its moment', () => {
  const T = RUN_TEXTS.en;
  const start = runPosts(undefined, run('running', [['analysis', 'running']]), member, T, 'core-architect');
  assert.deepEqual(start, [{ author: 'core-architect', text: 'Started run:loans: **Loans**', links: { run: 'loans' } }]);
  const a = run('running', [['analysis', 'running'], ['quality', 'pending']]);
  const b = run('running', [['analysis', 'passed'], ['quality', 'running']]);
  assert.deepEqual(runPosts(a, b, member, T, 'lead'), [{ author: 'core-analyst', text: '**Analysis** passed: analysis said', costUsd: 0.1 }]);
  assert.deepEqual(runPosts(b, b, member, T, 'lead'), [], 'nothing changed');
  const c = run('failed', [['analysis', 'passed'], ['quality', 'failed']]);
  assert.deepEqual(runPosts(b, c, member, T, 'lead'), [{ author: 'core-qa', text: '**Quality** failed: quality said', moment: 'failure', costUsd: 0.1 }, { author: 'lead', text: 'The run failed: quality said' }]);
  const d = run('passed', [['analysis', 'passed'], ['quality', 'passed']]);
  assert.equal(runPosts(b, d, member, RUN_TEXTS.es, 'lead').at(-1)!.text, 'Pasaron todas las estaciones (USD 0.250).');
  assert.equal(runPosts(b, d, member, T, 'lead').at(-1)!.moment, 'success');
});

test('a run\'s question has its answers as buttons that read back; spending has none (confirmed in the editor)', () => {
  const r = run('waiting', [['analysis', 'waiting']]);
  const gate = askPost(r, { id: 'gate-analysis', kind: 'gate', question: 'Approve the analysis?', station: 'analysis' }, member, RUN_TEXTS.en);
  assert.equal(gate.author, 'core-analyst');
  assert.deepEqual(gate.buttons!.map((b) => b.id), ['run|loans|gate-analysis|approve', 'run|loans|gate-analysis|change', 'run|loans|gate-analysis|stop']);
  assert.deepEqual(buttonOf(gate.buttons![1].id), { kind: 'run', run: 'loans', ask: 'gate-analysis', answer: 'change' });
  assert.equal(askPost(r, { id: 'qa', kind: 'checks', question: 'QA plan?' }, member, RUN_TEXTS.en).author, 'core-qa');
  const money = askPost(r, { id: 'spending-1', kind: 'spending', question: 'Spend?' }, member, RUN_TEXTS.en);
  assert.deepEqual([money.author, money.buttons], ['system', []]);
  assert.deepEqual(buttonOf('spec|loans|accept'), { kind: 'spec', spec: 'loans', answer: 'accept' });
  // a team offered to the folder's channel, and the offer to make one
  assert.deepEqual(buttonOf('team|assign|night-shift'), { kind: 'team', team: 'night-shift' });
  assert.deepEqual(buttonOf('team|create'), { kind: 'team', team: '' });
  assert.equal(buttonOf('team|assign|'), null);
  assert.equal(buttonOf('spec|loans|burn'), null);
});

test('a spec draft is shown as the lines taken away and added, with their context', () => {
  const a = ['# Loans', '', 'a', 'b', 'c', 'd', 'e', 'f', 'g'].join('\n');
  const b = ['# Loans', '', 'a', 'B', 'c', 'd', 'e', 'f', 'g', 'h'].join('\n');
  assert.equal(lineDiff(a, b), '```diff\n…\n  \n  a\n- b\n+ B\n  c\n  d\n…\n  f\n  g\n+ h\n```');
});

/** A socket that the test opens, answers and closes. */
class FakeSocket implements Socket {
  open = false;
  sent: Frame[] = [];
  headers: Record<string, string> = {};
  constructor(readonly on: SocketEvents) {}
  connect(_url: string, headers: Record<string, string>): void {
    this.headers = headers;
    setImmediate(() => ((this.open = true), this.on.open()));
  }
  send(text: string): boolean {
    if (!this.open) return false;
    const f = JSON.parse(text) as Frame;
    this.sent.push(f);
    // the service: a workspace registered, the events after `since`
    if (f.path === '/workspaces') setImmediate(() => this.on.message(JSON.stringify({ id: f.id, status: 200, body: { id: 'w1' } })));
    if (typeof f.path === 'string' && f.path.startsWith('/events/w1?since=')) setImmediate(() => this.on.message(JSON.stringify({ id: f.id, status: 200, body: [{ n: 8, workspace: 'w1', type: 'message', channel: 'core', data: {} }] })));
    return true;
  }
  close(): void {
    this.open = false;
  }
}
const tick = () => new Promise((r) => setTimeout(r, 5));

test('the connection registers a project, relays a page, and after a reconnection registers again and reads what was missed', async () => {
  const sockets: FakeSocket[] = [];
  let registrations = 0;
  const host = new ChatHost({ connect: async () => ({ url: 'http://127.0.0.1:7880', ...guard }), socket: (on) => (sockets.push(new FakeSocket(on)), sockets.at(-1)!), registrationOf: async () => (registrations++, { root: '/p' }) });
  const page: Frame[] = [];
  host.attach('builder', (f) => page.push(f));
  assert.equal(await host.workspace('/p'), 'w1');
  assert.deepEqual(sockets[0].headers, { 'X-Chat-Token': 'secret' });
  assert.ok(sockets[0].sent.some((f) => f.subscribe === 'chat.w1'), 'the host listens to its workspace');
  const seen: string[] = [];
  host.onEvent((root, e) => seen.push(`${root} ${e.type} ${e.n}`));
  await host.fromPage('builder', { subscribe: 'chat.w1' });
  await host.fromPage('builder', { id: 1, method: 'GET', path: '/channels/w1', headers: {} });
  const req = sockets[0].sent.at(-1)!;
  assert.equal((req.headers as Record<string, string>)['X-Chat-Token'], 'secret');
  sockets[0].on.message(JSON.stringify({ id: req.id, status: 200, body: ['general'] }));
  sockets[0].on.message(JSON.stringify({ event: 'chat.w1', data: { n: 7, workspace: 'w1', type: 'typing', channel: 'core', data: {} } }));
  assert.deepEqual(page.map((f) => f.id ?? (f.data as { n: number }).n), [1, 7]);
  // the service restarts: the socket closes, the host opens another, registers again, the page gets event 8
  sockets[0].open = false;
  sockets[0].on.close(1006, '');
  await new Promise((r) => setTimeout(r, 1100));
  await tick();
  assert.equal(sockets.length, 2);
  assert.equal(registrations, 1, 'the host file is not read again; its body is registered again');
  assert.ok(sockets[1].sent.filter((f) => f.path === '/workspaces').length === 1);
  assert.ok(sockets[1].sent.some((f) => f.path === '/events/w1?since=7'));
  assert.equal((page.at(-1)!.data as { n: number }).n, 8);
  assert.deepEqual(seen, ['/p typing 7', '/p message 8']);
  host.dispose();
});

test('a page\'s request when the service cannot be reached is answered 503 with how to fix it', async () => {
  const host = new ChatHost({ connect: async () => Promise.reject(new Error('Nuclear Chat does not answer: run nuclear-builder setup')), registrationOf: async () => ({}) });
  const got: Frame[] = [];
  host.attach('atlas', (f) => got.push(f));
  await host.fromPage('atlas', { id: 4, method: 'GET', path: '/gifs/pack', headers: {} });
  assert.deepEqual(got, [{ id: 4, status: 503, body: { detail: 'Nuclear Chat does not answer: run nuclear-builder setup' } }]);
  await assert.rejects(host.workspace('/p'), /nuclear-builder setup/);
  assert.equal(HOST, '#host');
  host.dispose();
});
