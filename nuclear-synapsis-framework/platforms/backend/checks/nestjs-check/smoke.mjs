// End-to-end check of a built nestjs project (examples/examples-backend/tasks_api): the REST CRUD over SQLite in
// memory, validation, the errors of a Result, the guards, and the same routes and the events over the app's
// WebSocket (ADR-synapsis-0007, ADR-synapsis-0008). The same run as fastapi-check/smoke_tasks.py.
// Run: node smoke.mjs <build folder>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.SYNAPSIS_DATABASE = 'memory';
process.env.TASKS_TOKEN = 'tasks-secret';
process.env.OWNER_TOKEN = 'owner-secret';
const TOKEN = { 'x-tasks-token': 'tasks-secret' };
const build = path.resolve(process.argv[2]);
const { AppModule } = await import(pathToFileURL(path.join(build, 'dist/src/app.module.js')).href);
const { createApp } = await import(pathToFileURL(path.join(build, 'node_modules/synapsis-nest/dist/index.js')).href);
const { WebSocket } = await import(pathToFileURL(path.join(build, 'node_modules/ws/wrapper.mjs')).href);
const app = await createApp(AppModule);
await app.listen(0);
const base = await app.getUrl();
const call = async (method, url, body) => {
  const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...TOKEN }, body: body && JSON.stringify(body) });
  return [r.status, await r.json()];
};
try {
  let [status, task] = await call('POST', '/tasks', { title: 'Buy milk', priority: 1 });
  assert.equal(status, 201);
  assert.equal(task.title, 'Buy milk');
  assert.equal(task.done, false);
  assert.equal((await call('POST', '/tasks', { title: 'Buy milk' }))[0], 409);
  const [bad, why] = await call('POST', '/tasks', { title: '', priority: 7 });
  assert.equal(bad, 400);
  assert.equal(why.message.length, 2);
  [status, task] = await call('PATCH', `/tasks/${task.id}`, { done: true });
  assert.equal(status, 200);
  assert.equal(task.done, true);
  assert.deepEqual((await call('GET', '/tasks?done=false'))[1], []);
  assert.equal((await call('GET', '/tasks/99'))[0], 404);
  assert.deepEqual((await call('DELETE', `/tasks/${task.id}`))[1], { id: task.id });
  assert.equal((await call('DELETE', `/tasks/${task.id}`))[0], 404);
  // the guards: the app's token, no web page, and the controller's own token on top
  const code = async (url, headers) => (await fetch(base + url, { headers })).status;
  assert.equal(await code('/tasks', {}), 401);
  assert.equal(await code('/tasks', { ...TOKEN, origin: 'https://example.com' }), 403);
  assert.equal(await code('/projects/1', TOKEN), 401);
  assert.equal(await code('/projects/1', { ...TOKEN, authorization: 'Bearer owner-secret' }), 404);
  // the WebSocket: the upgrade is guarded, a request answers what HTTP answers, a published event is pushed
  const ws = base.replace(/^http/, 'ws') + '/ws';
  await new Promise((resolve) => new WebSocket(ws).on('error', resolve).on('open', () => assert.fail('opened without a token')));
  const socket = new WebSocket(ws, { headers: TOKEN });
  const frames = [];
  const waiting = [];
  socket.on('message', (raw) => {
    frames.push(JSON.parse(String(raw)));
    waiting.shift()?.();
  });
  const next = async (n) => {
    while (frames.length < n) await new Promise((r) => waiting.push(r));
    return frames.splice(0, n);
  };
  await new Promise((r) => socket.on('open', r));
  socket.send(JSON.stringify({ subscribe: 'tasks.created' }));
  socket.send(JSON.stringify({ id: 1, method: 'POST', path: '/tasks', body: { title: 'Call mom' } }));
  const got = await next(2);
  const answer = got.find((f) => f.id === 1);
  assert.equal(answer.status, 201);
  assert.deepEqual(got.find((f) => f.event), { event: 'tasks.created', data: { id: answer.body.id, title: 'Call mom' } });
  socket.send(JSON.stringify({ id: 2, method: 'GET', path: '/tasks/99' }));
  assert.equal((await next(1))[0].status, 404);
  socket.close();
  console.log('smoke: REST CRUD, validation, Result errors, guards and the WebSocket ok');
} finally {
  await app.close();
}
