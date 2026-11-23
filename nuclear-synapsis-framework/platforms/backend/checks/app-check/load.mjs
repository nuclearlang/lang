// The load of app-check: a fixed number of requests over a fixed number of kept-alive connections, each connection
// sending its next request when the last one answered. Prints one JSON line: the requests, the errors (no answer, or
// a status that is not 2xx), the seconds, the requests per second and the latency percentiles in milliseconds.
//
//   node load.mjs <url> <method> <body|-> <connections> <requests>
//
// In the url and the body, `{n}` is the number of the request (from <first>, the 6th argument, default 1) and `{c}`
// that number folded into 1..100: a write gets a value of its own, a transaction a customer of its own.
import http from 'node:http';

const [url, method, body, connectionsText, requestsText, firstText] = process.argv.slice(2);
const connections = Number(connectionsText);
const requests = Number(requestsText);
const first = Number(firstText ?? 1);
const agent = new http.Agent({ keepAlive: true, maxSockets: connections });
const fill = (text, n) => text.replaceAll('{n}', String(n)).replaceAll('{c}', String((n % 100) + 1));

let next = 0;
let errors = 0;
const statuses = {};
const times = [];

function one(n) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const sent = body === '-' ? undefined : fill(body, n);
    const done = (status) => {
      times.push(Number(process.hrtime.bigint() - started) / 1e6);
      statuses[status] = (statuses[status] ?? 0) + 1;
      if (!(status >= 200 && status < 300)) errors++;
      resolve();
    };
    const req = http.request(fill(url, n), { method, agent, headers: sent === undefined ? {} : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(sent) } }, (res) => {
      res.resume();
      res.on('end', () => done(res.statusCode));
    });
    req.setTimeout(120000, () => req.destroy(new Error('timeout')));
    req.on('error', () => done(0));
    req.end(sent);
  });
}

async function connection() {
  while (next < requests) await one(first + next++);
}

const started = process.hrtime.bigint();
await Promise.all(Array.from({ length: connections }, connection));
const seconds = Number(process.hrtime.bigint() - started) / 1e9;
agent.destroy();
times.sort((a, b) => a - b);
const at = (p) => Number(times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))].toFixed(2));
console.log(JSON.stringify({ requests, connections, errors, statuses, seconds: Number(seconds.toFixed(3)), rps: Math.round(requests / seconds), p50: at(50), p95: at(95), p99: at(99), max: at(100) }));
