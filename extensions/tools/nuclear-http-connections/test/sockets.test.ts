// HTTP Connections' WebSocket side without VS Code (`vscode` is test/vscode-stub.ts): the contract's WebSocket fields
// (ADR-synapsis-0008; absent = HTTP only), read from the shape the backend example writes, the tree's WS badges and pushed events, the manual ws:// urls of an environment, the urls and
// `{{var}}`, the message log and the history (also as the page runs them: from their source), and a real socket
// against an echo server started here.
import * as assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import * as vscode from 'vscode';
import { Api, Contract, HttpModel, TreeNode } from '../src/httpConnections';
import {
  appendLog,
  badSocketUrl,
  eventsOf,
  filterLog,
  guardHeadersOf,
  LogEntry,
  messageProblem,
  prettyMessage,
  pushHistory,
  resolveVars,
  routeMessage,
  SocketConnection,
  socketPathOf,
  socketUrl,
  subscribeMessage,
  transportsOf,
  unsubscribeMessage,
} from '../src/socket';
import { socketPageHtml, socketTab } from '../src/socketPanel';

const api = (extra: Record<string, unknown> = {}): Api => ({ component: 'tasks', path: '/tasks', routes: [], ...extra }) as Api;

// the WebSocket fields of the backend example's contract (examples-backend/tasks_api/.nuclear/contract.json), as written
const TASKS_API = {
  webSocket: '/ws',
  guards: [{ guard: 'noOrigin' }, { guard: 'token', header: 'X-Tasks-Token' }],
  events: { 'tasks.created': { component: 'tasks', fields: ['id', 'title'], payload: '<string, any>' } },
  controllers: {
    TasksController: {
      component: 'tasks',
      guards: [],
      path: 'tasks',
      routes: [
        { error: 'Error', name: 'all', params: [{ in: 'query', name: 'done', optional: true, type: 'boolean' }], path: '', returns: 'Task[]', verb: 'get' },
        { error: 'Error', name: 'create', params: [{ in: 'body', name: 'input', type: 'NewTask' }], path: '', returns: 'Task', verb: 'post' },
      ],
      transports: ['http', 'websocket'],
    },
    ProjectsController: {
      component: 'tasks',
      guards: [{ guard: 'token', header: 'Authorization' }],
      path: 'projects',
      routes: [{ error: 'Error', name: 'one', params: [{ in: 'path', name: 'id', type: 'int' }], path: '{id}', returns: 'Project', verb: 'get' }],
      transports: ['http', 'websocket'],
    },
  },
};
const contractOf = (c: object) => c as unknown as Contract;

test('the contract: transports (absent = HTTP only), the socket path, the events by topic', () => {
  assert.deepEqual([...transportsOf(api())], ['http']);
  assert.deepEqual([...transportsOf(api({ transports: ['http', 'websocket'] }))], ['http', 'websocket']);
  assert.deepEqual([...transportsOf(api({ transports: ['grpc'] }))], ['http']);
  assert.equal(socketPathOf(undefined), undefined);
  assert.equal(socketPathOf(contractOf({ webSocket: null })), undefined);
  assert.equal(socketPathOf(contractOf(TASKS_API)), '/ws');
  assert.deepEqual(eventsOf(contractOf(TASKS_API)), [{ topic: 'tasks.created', component: 'tasks', payload: '<string, any>', fields: ['id', 'title'] }]);
  assert.deepEqual(eventsOf(contractOf({})), []);
});

test("the contract: the token guards' headers, the app's then the controller's; Authorization carries Bearer", () => {
  const c = contractOf(TASKS_API);
  assert.deepEqual(guardHeadersOf(c, TASKS_API.controllers.TasksController as unknown as Api), [['X-Tasks-Token', '{{token}}']]);
  assert.deepEqual(guardHeadersOf(c, TASKS_API.controllers.ProjectsController as unknown as Api), [
    ['X-Tasks-Token', '{{token}}'],
    ['Authorization', 'Bearer {{token}}'],
  ]);
  assert.deepEqual(guardHeadersOf(contractOf({ guards: [{ guard: 'token' }, { guard: 'noOrigin' }] })), [['Authorization', 'Bearer {{token}}']]);
  assert.deepEqual(guardHeadersOf(undefined, api()), []);
});

test('urls: {{var}} resolved, unknown ones kept; http becomes ws; only ws:// and wss:// open', () => {
  assert.equal(resolveVars('{{baseUrl}}/ws?x={{ nope }}', { baseUrl: 'http://localhost:8000' }), 'http://localhost:8000/ws?x={{ nope }}');
  assert.equal(socketUrl('https://api.x.com/', '/ws'), 'wss://api.x.com/ws');
  assert.equal(socketUrl('{{baseUrl}}', 'ws'), '{{baseUrl}}/ws');
  assert.equal(badSocketUrl('ws://localhost:1/ws'), undefined);
  assert.equal(badSocketUrl('{{baseUrl}}/ws'), 'variable');
  assert.equal(badSocketUrl('ftp://x'), 'scheme');
  assert.equal(badSocketUrl('nope'), 'url');
});

const entry = (dir: LogEntry['dir'], text: string, at = 1): LogEntry => ({ at, dir, text });

test('the log keeps the last messages; the filter by text and direction; JSON pretty; the history', () => {
  let log: LogEntry[] = [];
  for (let i = 0; i < 5; i++) log = appendLog(log, entry(i % 2 ? 'in' : 'out', `{"n":${i}}`, i), 3);
  assert.deepEqual(log.map((e) => e.at), [2, 3, 4]);
  assert.deepEqual(filterLog(log, '', 'in').map((e) => e.at), [3]);
  assert.deepEqual(filterLog(log, '"N":4', 'all').map((e) => e.at), [4]);
  assert.deepEqual(prettyMessage('{"a":[1]}'), { json: true, text: '{\n  "a": [\n    1\n  ]\n}' });
  assert.deepEqual(prettyMessage('42'), { json: false, text: '42' });
  assert.deepEqual(prettyMessage('hello'), { json: false, text: 'hello' });
  assert.deepEqual(pushHistory(['b', 'a'], 'a', 2), ['a', 'b']);
  assert.deepEqual(pushHistory(['b', 'a'], 'c', 2), ['c', 'b']);
  assert.equal(messageProblem('', 'text'), 'empty');
  assert.equal(messageProblem('hi', 'text'), '');
  assert.equal(messageProblem('{"a":1}', 'json'), '');
  assert.notEqual(messageProblem('{a:1}', 'json'), '');
});

test('the page runs the same functions, from their source alone', () => {
  const page = <T>(f: T): T => new Function(`return (${String(f)});`)() as T;
  assert.deepEqual(page(appendLog)([entry('in', 'a')], entry('out', 'b'), 1), [entry('out', 'b')]);
  assert.equal(page(filterLog)([entry('in', 'Hello')], 'hell', 'all').length, 1);
  assert.equal(page(prettyMessage)('[1]').json, true);
  assert.deepEqual(page(pushHistory)(['x'], 'y', 5), ['y', 'x']);
  assert.notEqual(page(messageProblem)('{', 'json'), '');
});

test('the page: its script parses, in English and in Spanish', () => {
  for (const language of ['en', 'es']) {
    (vscode.env as { language: string }).language = language;
    const script = /<script nonce="[^"]+">([\s\S]*)<\/script>/.exec(socketPageHtml())![1];
    assert.doesNotThrow(() => new Function(script), language);
  }
  (vscode.env as { language: string }).language = 'en';
});

test('the frames the contract offers: a request through the app, a subscription and its end', () => {
  assert.deepEqual(JSON.parse(routeMessage('get', '/tasks/{id}')), { id: 1, method: 'GET', path: '/tasks/{id}', headers: {} });
  assert.deepEqual(JSON.parse(routeMessage('post', '/tasks', { title: '' })), { id: 1, method: 'POST', path: '/tasks', headers: {}, body: { title: '' } });
  assert.deepEqual(JSON.parse(subscribeMessage('tasks.created')), { subscribe: 'tasks.created' });
  assert.deepEqual(JSON.parse(unsubscribeMessage('tasks.created')), { unsubscribe: 'tasks.created' });
});

// ---------- the tree, from a project on disk ----------

function project(contract: Partial<Contract> & Record<string, unknown>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nuc-ws-'));
  fs.mkdirSync(path.join(root, 'api', '.nuclear'), { recursive: true });
  fs.writeFileSync(path.join(root, 'api', '.nuclear', 'project.json'), JSON.stringify({ name: 'tasks_api', platform: 'backend', dialect: 'fastapi', toolchain: { url: 'http://localhost:8000' } }));
  fs.writeFileSync(path.join(root, 'api', '.nuclear', 'contract.json'), JSON.stringify({ app: 'tasks_api', version: '1.0.0', platform: 'backend', dialect: 'fastapi', models: {}, repositories: {}, ...contract }));
  return root;
}
function modelAt(root: string): HttpModel {
  (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [{ uri: { fsPath: root } }];
  const model = new HttpModel({ appendLine() {}, show() {} } as never, path.join(root, 'storage'));
  model.refresh();
  return model;
}
const find = (nodes: TreeNode[], pred: (n: TreeNode) => boolean): TreeNode[] => nodes.flatMap((n) => [...(pred(n) ? [n] : []), ...find(n.children ?? [], pred)]);
const route = (verb: string, p: string, extra: Record<string, unknown> = {}) => ({ name: verb, verb, path: p, params: [], returns: 'Task', ...extra });

test('the tree: an old contract shows HTTP only; the WebSocket routes carry the badge, the events show under their component', () => {
  const old = modelAt(project({ controllers: { TasksController: { component: 'tasks', path: '/tasks', routes: [route('get', '')] } } as never }));
  assert.equal(find(old.tree(), (n) => !!n.badge || n.endpoint?.kind === 'event').length, 0);

  const model = modelAt(project(TASKS_API as never));
  const eps = find(model.tree(), (n) => !!n.endpoint);
  const all = eps.find((n) => n.endpoint!.path === '/tasks' && n.endpoint!.verb === 'get')!;
  assert.equal(all.endpoint!.protocol, undefined, 'served over both: the row opens HTTP');
  assert.equal(all.badge?.label, 'WS');
  assert.deepEqual(all.badge?.action, { type: 'open', endpoint: { ...all.endpoint, protocol: 'websocket' } });
  const event = eps.find((n) => n.endpoint!.kind === 'event')!;
  assert.equal(event.endpoint!.path, 'tasks.created');
  assert.equal(event.endpoint!.component, 'tasks');
  assert.equal(event.desc, '<string, any> { id, title }');
  const tasks = find(model.tree(), (n) => n.label === 'tasks' && !!n.children)[0];
  assert.ok(tasks.children!.some((n) => n.endpoint?.kind === 'event'), 'under the component that publishes it');

  // the tab the event opens: the backend's url with the socket's path, the app's token header, subscribe / unsubscribe
  const tab = socketTab(event.endpoint!, { tasks_api: 'http://localhost:8000' }, {});
  assert.equal(tab.url, 'ws://localhost:8000/ws');
  assert.deepEqual(tab.headers, [['X-Tasks-Token', '{{token}}']]);
  assert.deepEqual(tab.templates.map((t) => JSON.parse(t.text)), [{ subscribe: 'tasks.created' }, { unsubscribe: 'tasks.created' }]);
  assert.deepEqual(socketTab(event.endpoint!, {}, { 'x-tasks-token': '{{token}}' }).headers, [], 'the environment already sends it');
  // a route of a controller with its own token guard: both headers
  const one = eps.find((n) => n.endpoint!.path === '/projects/{id}')!;
  const onTab = socketTab({ ...one.endpoint!, protocol: 'websocket' }, {}, {});
  assert.equal(onTab.url, '{{baseUrl}}/ws');
  assert.deepEqual(onTab.headers, [['X-Tasks-Token', '{{token}}'], ['Authorization', 'Bearer {{token}}']]);
  assert.deepEqual(JSON.parse(onTab.templates[0].text), { id: 1, method: 'GET', path: '/projects/{id}', headers: {} });
});

test('the tree: the ws:// urls of the environment, for servers that are not Nuclear', () => {
  const root = project({});
  fs.mkdirSync(path.join(root, '.nuclear'), { recursive: true });
  fs.writeFileSync(path.join(root, '.nuclear', 'http.json'), JSON.stringify({ active: 'local', environments: { local: { vars: {}, sockets: ['wss://echo.example.com/ws'] } } }));
  const sockets = modelAt(root).tree().find((n) => n.id === 'sockets')!;
  assert.equal(sockets.button?.action.type, 'addSocket');
  const e = sockets.children![0].endpoint!;
  assert.equal(e.kind, 'socket');
  assert.equal(e.protocol, 'websocket');
  assert.equal(socketTab(e, {}, {}).url, 'wss://echo.example.com/ws');
});

// ---------- a real socket ----------

/** A WebSocket echo server (RFC 6455, text frames only): it echoes, pushes `{"event":"hello"}` on open, and records the handshake's headers. */
function echoServer(): Promise<{ url: string; headers: http.IncomingHttpHeaders[]; push(text: string): void; stop(): Promise<void> }> {
  const headers: http.IncomingHttpHeaders[] = [];
  const peers = new Set<Socket>();
  const frame = (text: string) => {
    const data = Buffer.from(text);
    const head = data.length < 126 ? Buffer.from([0x81, data.length]) : Buffer.from([0x81, 126, data.length >> 8, data.length & 255]);
    return Buffer.concat([head, data]);
  };
  const server = http.createServer();
  server.on('upgrade', (req, socket: Socket) => {
    headers.push(req.headers);
    if (req.headers['x-app-token'] !== 'secret') return socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n');
    const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    peers.add(socket);
    socket.on('close', () => peers.delete(socket));
    socket.write(frame('{"event":"hello"}'));
    let buf = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 6) {
        const op = buf[0] & 15;
        let len = buf[1] & 127;
        let at = 2;
        if (len === 126) (len = buf.readUInt16BE(2)), (at = 4);
        if (buf.length < at + 4 + len) return;
        const mask = buf.subarray(at, at + 4);
        const data = Buffer.from(buf.subarray(at + 4, at + 4 + len).map((b, i) => b ^ mask[i % 4]));
        buf = buf.subarray(at + 4 + len);
        if (op === 8) return socket.end(Buffer.from([0x88, 0]));
        if (op === 1) socket.write(frame(data.toString()));
      }
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`,
        headers,
        push: (text) => peers.forEach((p) => p.write(frame(text))),
        stop: () => new Promise((done) => { peers.forEach((p) => p.destroy()); server.close(() => done()); }),
      }),
    ),
  );
}

test('a real socket: the guard header is sent, no Origin; what is pushed and what is echoed arrive; close is seen', { skip: !(globalThis as { WebSocket?: unknown }).WebSocket && 'this Node has no WebSocket' }, async () => {
  const server = await echoServer();
  try {
    const got: string[] = [];
    let opened!: () => void, closed!: (code: number) => void;
    const open = new Promise<void>((r) => (opened = r));
    const close = new Promise<number>((r) => (closed = r));
    const errors: string[] = [];
    const socket = new SocketConnection({ open: () => opened(), message: (t) => got.push(t), close: (c) => closed(c), error: (m) => errors.push(m) });
    socket.connect(server.url, { 'x-app-token': 'secret' });
    await open;
    assert.equal(socket.open, true);
    assert.equal(server.headers[0]['x-app-token'], 'secret');
    assert.equal(server.headers[0].origin, undefined, 'a guard refuses an Origin: the host sends none');
    assert.equal(socket.send(routeMessage('get', '/tasks')), true);
    server.push('{"event":"taskCreated","data":{"id":1}}');
    const deadline = Date.now() + 3000;
    while (got.length < 3 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
    assert.equal(got[0], '{"event":"hello"}');
    assert.ok(got.includes('{"event":"taskCreated","data":{"id":1}}'));
    assert.deepEqual(JSON.parse(got.find((g) => g.includes('method'))!), { id: 1, method: 'GET', path: '/tasks', headers: {} });
    socket.close();
    assert.equal(socket.open, false);
    assert.equal(socket.send('late'), false);
    await close;
    assert.deepEqual(errors, []);

    // without the token the server refuses the handshake: an error and a close, never an open
    let refusedOpen = false;
    const refused = new Promise<void>((r) => new SocketConnection({ open: () => (refusedOpen = true), message() {}, close: () => r(), error: () => undefined }).connect(server.url, {}));
    await refused;
    assert.equal(refusedOpen, false);
  } finally {
    await server.stop();
  }
});
