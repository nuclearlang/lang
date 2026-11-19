// Guards and the app's WebSocket (ADR-synapsis-0007, ADR-synapsis-0008): the same test as synapsis-py's
// test_sockets.py. The app's guards check every route and the upgrade; a controller's guards check its routes over
// both transports; a request over the socket answers what HTTP answers; a published event reaches the subscribed.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { Body, Controller, Get, INestApplication, Module, Param, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WebSocket } from 'ws';
import { AppConfig, Connection, NoOrigin, Token, configureApp, guardedBy } from '../src/index.js';
import { publish } from '../src/events.js';
import { WebSocketServer } from '../src/sockets.js';

const TOKEN = { 'X-Token': 's3cret' };

class Config extends AppConfig {
  readonly connections: Connection[] = [new WebSocketServer({ path: 'ws' })];
  override readonly guards = [new NoOrigin(), new Token({ value: 's3cret', header: 'X-Token' })];
}

@Controller('notes')
class NoteController {
  @Get(':id')
  one(@Param('id') id: string): { id: number } {
    return { id: Number(id) };
  }

  @Post()
  async add(@Body() body: { text: string }): Promise<{ text: string }> {
    await publish('notes.added', { text: body.text });
    return { text: body.text };
  }
}

@Controller('admin')
@guardedBy([new Token({ value: 'root' })])
class AdminController {
  @Get()
  info(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({ controllers: [NoteController, AdminController], providers: [{ provide: AppConfig, useValue: new Config() }] })
class NotesModule {}

describe('guards and the WebSocket', () => {
  let app: INestApplication;
  let url = '';

  before(async () => {
    app = configureApp(await NestFactory.create(NotesModule, { logger: false }));
    await app.listen(0, '127.0.0.1');
    url = `127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  after(async () => app.close());

  const status = async (path: string, headers: Record<string, string> = {}) => (await fetch(`http://${url}${path}`, { headers })).status;

  it('the app guards check every route', async () => {
    assert.equal(await status('/notes/1'), 401);
    assert.equal(await status('/notes/1', { ...TOKEN, Origin: 'https://evil.example' }), 403);
    assert.equal(await status('/notes/1', TOKEN), 200);
    assert.equal(await status('/notes/1?token=s3cret'), 401); // never a token in the query
  });

  it('a controller guard adds to the app guards', async () => {
    assert.equal(await status('/admin', TOKEN), 401);
    assert.equal(await status('/admin', { ...TOKEN, Authorization: 'Bearer root' }), 200);
  });

  it('an empty token refuses every request', () => {
    assert.notEqual(new Token({ value: '' }).check({ authorization: 'Bearer ' }), null);
  });

  it('the upgrade passes the app guards', async () => {
    for (const headers of [{}, { ...TOKEN, Origin: 'https://evil.example' }]) {
      const ws = new WebSocket(`ws://${url}/ws`, { headers });
      await new Promise<void>((resolve) => ws.on('error', () => resolve()).on('open', () => assert.fail('opened')));
    }
  });

  it('requests and events over the socket', async () => {
    const ws = new WebSocket(`ws://${url}/ws`, { headers: TOKEN });
    const frames: unknown[] = [];
    const waiting: (() => void)[] = [];
    ws.on('message', (raw) => {
      frames.push(JSON.parse(String(raw)));
      waiting.shift()?.();
    });
    const next = async (n: number) => {
      while (frames.length < n) await new Promise<void>((r) => waiting.push(r));
      return frames.splice(0, n);
    };
    await new Promise((r) => ws.on('open', r));
    ws.send(JSON.stringify({ subscribe: 'notes.added' }));
    ws.send(JSON.stringify({ id: 1, method: 'GET', path: '/notes/7' }));
    assert.deepEqual(await next(1), [{ id: 1, status: 200, body: { id: 7 } }]);
    ws.send(JSON.stringify({ id: 2, method: 'GET', path: '/admin' }));
    assert.equal(((await next(1))[0] as { status: number }).status, 401);
    ws.send(JSON.stringify({ id: 3, method: 'GET', path: '/admin', headers: { Authorization: 'Bearer root' } }));
    assert.deepEqual(await next(1), [{ id: 3, status: 200, body: { ok: true } }]);
    ws.send(JSON.stringify({ id: 4, method: 'POST', path: '/notes', body: { text: 'hi' } }));
    const got = await next(2);
    assert.deepEqual(got.find((f) => (f as { event?: string }).event), { event: 'notes.added', data: { text: 'hi' } });
    assert.deepEqual(got.find((f) => (f as { id?: number }).id === 4), { id: 4, status: 201, body: { text: 'hi' } });
    ws.close();
  });
});

// the test words (ADR-synapsis-0010): the same as synapsis-py's test_app_client_over_http_and_the_socket
describe('appClient', () => {
  it('calls the app over HTTP and over its socket', async () => {
    const { appClient } = await import('../src/testing.js');
    const { useApp } = await import('../src/app.js');
    const app = configureApp(await NestFactory.create(NotesModule, { logger: false }));
    await app.init();
    useApp(app);
    try {
      const client = appClient();
      assert.equal((await client.get('/notes/1')).status, 401);
      assert.equal((await client.get('/notes/1', { headers: { ...TOKEN, Origin: 'https://evil.example' } })).status, 403);
      const answer = await client.get('/notes/1', { headers: TOKEN });
      assert.deepEqual([answer.status, answer.body], [200, { id: 1 }]);
      const refused = await client.socket('/ws');
      assert.ok(refused.isErr);
      assert.equal(refused.error.status, 401);
      assert.equal((await client.socket('/ws', { headers: { ...TOKEN, Origin: 'https://evil.example' } })).error.status, 403);
      const ws = (await client.socket('/ws', { headers: TOKEN })).value;
      await ws.subscribe('notes.added');
      const made = await ws.request('POST', '/notes', { body: { text: 'hi' } });
      assert.equal(made.status, 201);
      const event = await ws.next();
      assert.deepEqual([event?.topic, event?.data], ['notes.added', { text: 'hi' }]);
      assert.equal(await ws.next({ seconds: 0.1 }), null);
      await ws.close();
    } finally {
      await app.close();
      useApp(undefined);
    }
  });
});
