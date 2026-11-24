// A browser's console as the run log's lines (spec 015 phase 2): what `nuclear monitor --json` reads as requests,
// errors with their stack and output.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appFile, consoleLines, exceptionLines, follow, Requests } from '../src/browser-log';

const origin = 'http://127.0.0.1:5173';

test('a request to a server is one line when it ends; one with no answer is an error; the page\'s files are not', () => {
  const r = new Requests((u) => u.startsWith('http://127.0.0.1:4100/'));
  r.sent({ requestId: '1', type: 'Fetch', request: { method: 'GET', url: 'http://127.0.0.1:8000/films' } }, 1000);
  r.response({ requestId: '1', response: { status: 200 } });
  assert.equal(r.finished({ requestId: '1' }, 1012), 'GET http://127.0.0.1:8000/films 200 12ms');
  r.sent({ requestId: '2', type: 'XHR', request: { method: 'POST', url: 'http://127.0.0.1:8001/films' } }, 1000);
  assert.equal(r.failed({ requestId: '2', errorText: 'net::ERR_CONNECTION_REFUSED' }, 1003), 'ERROR POST http://127.0.0.1:8001/films net::ERR_CONNECTION_REFUSED');
  r.sent({ requestId: '3', type: 'XHR', request: { method: 'GET', url: 'http://127.0.0.1:8000/x' } }, 1000);
  assert.match(r.failed({ requestId: '3', errorText: 'net::ERR_FAILED', corsErrorStatus: { corsError: 'MissingAllowOriginHeader' } }) ?? '', /^ERROR GET http:\/\/127\.0\.0\.1:8000\/x blocked by CORS \(MissingAllowOriginHeader\)$/);
  r.sent({ requestId: '4', type: 'Fetch', request: { method: 'GET', url: 'http://127.0.0.1:8000/y' } });
  assert.equal(r.failed({ requestId: '4', errorText: 'net::ERR_ABORTED', canceled: true }), undefined);
  // the page's own files, the monitor's posts, a preflight: none
  r.sent({ requestId: '5', type: 'Script', request: { method: 'GET', url: `${origin}/src/main.ts` } });
  r.sent({ requestId: '6', type: 'Fetch', request: { method: 'POST', url: 'http://127.0.0.1:4100/t/k' } });
  r.sent({ requestId: '7', type: 'Fetch', request: { method: 'OPTIONS', url: 'http://127.0.0.1:8000/films' } });
  // what a framework fetches of its own: Flutter's fonts and asset manifests
  r.sent({ requestId: '8', type: 'Fetch', request: { method: 'GET', url: 'https://fonts.gstatic.com/s/notosansjp/v53/x.108.woff2' } });
  r.sent({ requestId: '9', type: 'Fetch', request: { method: 'GET', url: `${origin}/assets/FontManifest.json` } });
  r.sent({ requestId: '10', type: 'Fetch', request: { method: 'GET', url: 'https://example.com/font?family=x' } });
  r.response({ requestId: '10', response: { status: 200, mimeType: 'font/woff2' } });
  for (const id of ['5', '6', '7', '8', '9', '10']) assert.equal(r.finished({ requestId: id }), undefined);
});

test('console calls are output, errors carry their stack with the app\'s files', () => {
  assert.equal(appFile(`${origin}/src/components/a.ts?t=17#x`, origin), 'src/components/a.ts');
  assert.equal(appFile('http://cdn.example/x.js', origin), 'http://cdn.example/x.js');
  assert.deepEqual(consoleLines({ type: 'log', args: [{ type: 'string', value: 'films loaded' }, { type: 'number', value: 22 }] }, origin), ['films loaded 22']);
  assert.deepEqual(consoleLines({ type: 'log', args: [{ type: 'string', value: '%cDownload the tools: %s' }, { type: 'string', value: 'font-weight:bold' }, { type: 'string', value: 'here' }] }, origin), ['Download the tools: here']);
  assert.deepEqual(consoleLines({ type: 'warning', args: [{ type: 'string', value: 'slow' }] }, origin), ['warning: slow']);
  const frames = [{ functionName: 'load', url: `${origin}/src/a.ts`, lineNumber: 9, columnNumber: 2 }];
  assert.deepEqual(
    exceptionLines({ exceptionDetails: { text: 'Uncaught (in promise)', exception: { type: 'object', description: 'AppError', preview: { properties: [{ name: 'message', value: 'no people' }] } }, stackTrace: { callFrames: frames } } }, origin),
    ['ERROR Uncaught (in promise) AppError: no people', '    at load (src/a.ts:10:3)'],
  );
  assert.deepEqual(consoleLines({ type: 'error', args: [{ type: 'string', value: 'no films' }], stackTrace: { callFrames: frames } }, origin), ['ERROR no films', '    at load (src/a.ts:10:3)']);
  assert.deepEqual(
    exceptionLines({ exceptionDetails: { text: 'Uncaught', exception: { description: 'TypeError: x is undefined\n    at load (http://127.0.0.1:5173/src/a.ts:10:3)' }, stackTrace: { callFrames: frames } } }, origin),
    ['ERROR Uncaught TypeError: x is undefined', '    at load (src/a.ts:10:3)'],
  );
});

test('following a page writes its lines; the Synapsis device leaves the console to Flutter', () => {
  const handlers = new Map<string, ((p: Record<string, unknown>) => void)[]>();
  const cdp = { on: (m: string, f: (p: Record<string, unknown>) => void) => handlers.set(m, [...(handlers.get(m) ?? []), f]) };
  const written: string[] = [];
  follow(cdp, () => origin, (l) => written.push(...l), { console: false });
  assert.equal(handlers.has('Runtime.consoleAPICalled'), false);
  handlers.get('Network.requestWillBeSent')![0]({ requestId: '1', type: 'XHR', request: { method: 'GET', url: 'http://127.0.0.1:8000/films' } });
  handlers.get('Network.loadingFailed')![0]({ requestId: '1', errorText: 'net::ERR_CONNECTION_REFUSED' });
  assert.deepEqual(written, ['ERROR GET http://127.0.0.1:8000/films net::ERR_CONNECTION_REFUSED']);
  follow(cdp, () => origin, (l) => written.push(...l), { console: true });
  handlers.get('Runtime.consoleAPICalled')![0]({ type: 'log', args: [{ type: 'string', value: 'hi' }] });
  assert.equal(written.at(-1), 'hi');
});
