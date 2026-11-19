import { AppModule } from '../src/app.module.js';
import { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { appClient, startTestApp, stopTestApp } from 'synapsis-nest/testing';

import assert from 'node:assert/strict';

// The app as its clients see it: over HTTP and over its WebSocket, through the guards (testEnv of config.nuc
// gives the tests their tokens).
export const TOKEN = { 'X-Tasks-Token': 'test-tasks-token' };

describe('Api', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await startTestApp(AppModule);
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  it('the guards: the app\'s token, no web page, a controller\'s own token', async () => {
    const app = appClient();
    assert.ok((await app.get('/tasks')).status === 401);
    assert.ok((await app.get('/tasks', { headers: { 'X-Tasks-Token': 'wrong' } })).status === 401);
    assert.ok((await app.get(
      '/tasks',
      { headers: { 'X-Tasks-Token': 'test-tasks-token', 'Origin': 'https://example.com' } },
    )).status === 403);
    assert.ok((await app.get('/tasks', { headers: TOKEN })).status === 200);
    assert.ok((await app.get('/projects/1', { headers: TOKEN })).status === 401);
    const owner = {
      'X-Tasks-Token': 'test-tasks-token',
      'Authorization': 'Bearer test-owner-token',
    };
    assert.ok((await app.get('/projects/1', { headers: owner })).status === 404);
  });

  it('a request over HTTP answers its status and body', async () => {
    const app = appClient();
    const made = await app.post('/tasks', { body: { 'title': 'buy milk' }, headers: TOKEN });
    assert.ok(made.status === 201);
    assert.ok(made.body['title'] === 'buy milk');
  });

  it('the socket: refused without the token; a request answered; a published event pushed', async () => {
    const app = appClient();
    const refused = await app.socket('/ws');
    assert.ok(refused.error.status === 401);
    const ws = (await app.socket('/ws', { headers: TOKEN })).value;
    await ws.subscribe('tasks.created');
    const made = await ws.request('POST', '/tasks', { body: { 'title': 'call mom' } });
    assert.ok(made.status === 201);
    const event = await ws.next();
    assert.ok(event!.data['title'] === 'call mom');
    await ws.close();
  });
});
