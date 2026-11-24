// What every request passes before its route (the platform's reference, §2.7 and §2.8): the same test as
// synapsis-py's test_edge.py. The body's limit and type, how JSON and the parameters are read, the methods and paths
// a route answers, CORS, the headers of an answer, the largest page, and the WebSocket's frames and paths.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { Body, Controller, Get, INestApplication, Module, Param, Post, Query } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IsOptional, IsString } from 'class-validator';
import { WebSocket } from 'ws';
import { AppConfig, BoolPipe, Connection, DoublePipe, IntPipe, IsWhole, RequiredPipe, TextPipe, Token, configureApp } from '../src/index.js';
import { WebSocketServer } from '../src/sockets.js';
import { edge } from '../src/edge.js';
import { createServer } from 'node:http';

class Config extends AppConfig {
  readonly connections: Connection[] = [new WebSocketServer({ path: 'ws' })];
  override readonly origins = ['http://localhost:5173'];
  override readonly maxBodySize = 2048;
}

class Note {
  @IsString()
  text!: string;
  @IsOptional()
  @IsWhole()
  stars?: number;
}

@Controller('notes')
class NoteController {
  @Get()
  list(@Query('page', IntPipe) page: number = 1, @Query('desc', BoolPipe) desc: boolean = false): string {
    return `${page}:${desc}`;
  }

  @Get('find')
  find(@Query('text', RequiredPipe, TextPipe) text: string, @Query('min', DoublePipe) min?: number): string {
    return `${text}:${min ?? '-'}`;
  }

  @Get(':id')
  one(@Param('id', RequiredPipe, IntPipe) id: number): { id: number } {
    return { id };
  }

  @Post()
  add(@Body() note: Note): Note {
    return note;
  }
}

@Module({ controllers: [NoteController], providers: [{ provide: AppConfig, useValue: new Config() }] })
class EdgeModule {}

describe('the edge of every request', () => {
  let app: INestApplication;
  let base = '';

  before(async () => {
    app = configureApp(await NestFactory.create(EdgeModule, { logger: false, bodyParser: false }));
    await app.listen(0, '127.0.0.1');
    base = `127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  after(async () => app.close());

  const call = async (method: string, path: string, body?: string, headers: Record<string, string> = { 'content-type': 'application/json' }) => {
    const r = await fetch(`http://${base}${path}`, { method, headers: body === undefined ? {} : headers, body });
    const text = await r.text();
    const json = (r.headers.get('content-type') ?? '').includes('json');
    return { status: r.status, headers: r.headers, body: (text && json ? JSON.parse(text) : text || null) as unknown };
  };
  const rule = (b: unknown) => (b as { errors: { field: string; rule: string }[] }).errors.map((e) => `${e.field}:${e.rule}`).join(' ');

  it('a body is JSON in UTF-8, as large as the app reads', async () => {
    assert.equal((await call('POST', '/notes', '{"text":"a"}')).status, 201);
    assert.equal((await call('POST', '/notes', '{"text":"a"}', { 'content-type': 'application/vnd.api+json' })).status, 201);
    const big = await call('POST', '/notes', JSON.stringify({ text: 'x'.repeat(3000) }));
    assert.deepEqual([big.status, big.body], [413, { status: 413, message: 'content too large' }]);
    for (const type of ['application/x-www-form-urlencoded', 'text/plain', 'application/json; charset=utf-16']) {
      assert.deepEqual((await call('POST', '/notes', '{"text":"a"}', { 'content-type': type })).body, { status: 415, message: 'unsupported media type' });
    }
    assert.equal(rule((await call('POST', '/notes', '{"text":NaN}')).body), ':json');
    assert.equal(rule((await call('POST', '/notes', '['.repeat(600) + ']'.repeat(600))).body), ':json');
    assert.equal(rule((await call('POST', '/notes', '{"text":"a\\u0000b"}')).body), 'text:invalid');
    assert.equal(rule((await call('POST', '/notes', 'null')).body), ':required');
    assert.equal(rule((await call('POST', '/notes', '[1]')).body), ':type');
    assert.equal(rule((await call('POST', '/notes', `{"text":"a","stars":${'9'.repeat(30)}}`)).body), 'stars:type');
    assert.equal((await call('POST', '/notes', '{"text":"a","stars":9007199254740991}')).status, 201);
  });

  it('a parameter is read by the platform rules', async () => {
    assert.equal((await call('GET', '/notes')).body, '1:false'); // the defaults
    for (const [path, why] of [['/notes/0x1', 'id:type'], ['/notes/1e0', 'id:type'], ['/notes?desc=maybe', 'desc:type'], ['/notes?desc=1', 'desc:type'],
      ['/notes/find', 'text:required'], ['/notes/find?text=a&text=b', 'text:type'], ['/notes/find?text=a&min=NaN', 'min:type'], ['/notes/find?text=a&min=1e400', 'min:type'],
      [`/notes/${'9'.repeat(20)}`, 'id:type'], ['/notes?page=x&desc=y', 'desc:type page:type']]) {
      assert.equal(rule((await call('GET', path!)).body), why, path);
    }
    assert.deepEqual((await call('GET', '/notes/%201')).body, { id: 1 });
    assert.equal((await call('GET', '/notes?desc=true&page=2')).body, '2:true');
  });

  it('a path is matched as written; another method of a path is 405', async () => {
    assert.equal((await call('GET', '/NOTES')).status, 404);
    assert.equal((await call('GET', '/notes/')).status, 404);
    assert.equal((await call('GET', '/%6Eotes')).status, 200);
    assert.equal((await call('GET', '/notes/1%2F2')).status, 404);
    const wrong = await call('DELETE', '/notes');
    assert.deepEqual([wrong.status, wrong.headers.get('allow'), wrong.body], [405, 'GET, HEAD, POST, OPTIONS', { status: 405, message: 'method not allowed' }]);
    const options = await fetch(`http://${base}/notes/1`, { method: 'OPTIONS' });
    assert.deepEqual([options.status, options.headers.get('allow')], [200, 'GET, HEAD, OPTIONS']);
    assert.equal((await fetch(`http://${base}/notes/1`, { method: 'HEAD' })).status, 200);
  });

  it('CORS: only the listed origins; answers do not name the server', async () => {
    const preflight = (origin: string) => fetch(`http://${base}/notes`, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } });
    const ok = await preflight('http://localhost:5173');
    assert.deepEqual([ok.status, ok.headers.get('access-control-allow-origin')], [200, 'http://localhost:5173']);
    const evil = await preflight('https://evil.example');
    assert.deepEqual([evil.status, evil.headers.get('access-control-allow-origin')], [403, null]);
    const r = await fetch(`http://${base}/notes`, { headers: { origin: 'http://localhost:5173' } });
    assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    for (const h of ['x-powered-by', 'server', 'etag']) assert.equal(r.headers.get(h), null, h);
    // out of development, an address of this machine is one more origin: only the listed ones
    assert.equal((await preflight('http://127.0.0.1:49152')).status, 403);
  });

  it('CORS in development: this machine and the registry may call', async () => {
    process.env.NUCLEAR_DEV_ORIGINS = 'http://192.168.1.20:8080,http://127.0.0.1:8001';
    const server = createServer((req, res) => edge(['http://localhost:5173'], true)(req, res, () => res.end('ok')));
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const at = `http://127.0.0.1:${(server.address() as AddressInfo).port}/notes`;
    const preflight = (origin: string) => fetch(at, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'GET' } });
    try {
      for (const origin of ['http://localhost:5173', 'http://127.0.0.1:49152', 'http://localhost:8081', 'http://[::1]:3000', 'http://localhost', 'https://127.0.0.1:8443', 'http://192.168.1.20:8080']) {
        const r = await preflight(origin);
        assert.deepEqual([r.status, r.headers.get('access-control-allow-origin')], [200, origin], origin);
        assert.equal((await fetch(at, { headers: { origin } })).headers.get('access-control-allow-origin'), origin, origin);
      }
      for (const origin of ['https://evil.example', 'http://localhost.evil.example', 'http://127.0.0.1.evil.example:80', 'http://127.0.0.1:80/x', 'null', 'http://192.168.1.21:8080']) {
        assert.equal((await preflight(origin)).status, 403, origin);
        assert.equal((await fetch(at, { headers: { origin } })).headers.get('access-control-allow-origin'), null, origin);
      }
      // never credentials, in any environment
      assert.equal((await preflight('http://127.0.0.1:49152')).headers.get('access-control-allow-credentials'), null);
    } finally {
      delete process.env.NUCLEAR_DEV_ORIGINS;
      server.close();
    }
  });

  const frames = (sent: (string | Buffer)[], path = '/ws') =>
    new Promise<string>((resolve) => {
      const ws = new WebSocket(`ws://${base}${path}`);
      const got: string[] = [];
      ws.on('open', () => sent.forEach((s) => ws.send(s)));
      ws.on('message', (m) => {
        got.push(String((JSON.parse(String(m)) as { status: number }).status));
        if (got.length === sent.length) ws.close();
      });
      ws.on('close', (code) => resolve(`${got.join(' ')}${got.length ? ' ' : ''}closed ${code}`));
      ws.on('unexpected-response', (_, res) => resolve(`refused ${res.statusCode}`));
      ws.on('error', () => undefined);
    });

  it('the WebSocket: a frame is a JSON object, its path the app own, its size the app limit', async () => {
    for (const frame of ['null', '5', '[1]', '"x"', '{"id":1,"headers":"x"}', '{"id":1,"path":5}', '['.repeat(600) + ']'.repeat(600), Buffer.from([0, 1])]) {
      assert.equal(await frames([frame]), 'closed 1003', String(frame));
    }
    assert.equal(await frames(['{"id":1,"path":"' + 'x'.repeat(3000) + '"}']), 'closed 1009');
    assert.equal(await frames(['{"id":1,"path":"7/x"}', '{"id":2,"path":"//evil.example/x"}', '{"id":3,"method":"NOPE","path":"/notes"}']), '404 404 405 closed 1005');
    assert.equal(await frames(['{"id":1,"path":"/notes/1","headers":{"Transfer-Encoding":"chunked","Host":"evil.example"}}']), '200 closed 1005');
    assert.equal(await frames([], '/elsewhere'), 'refused 404');
  });

  it('a guard reads a header once, without its blanks', () => {
    const guard = new Token({ value: 's3cret', header: 'X-Token' });
    assert.equal(guard.check({ 'x-token': '  s3cret  ' }), null);
    assert.notEqual(guard.check({ 'x-token': ['s3cret', 'other'] }), null);
  });
});
