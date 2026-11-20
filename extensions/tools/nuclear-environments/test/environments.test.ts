// The Environments page's logic (env.ts) against fixtures of `nuclear env list --json` (spec 021's format) and a
// fake runner: the grid, the badges, the commands (a secret never in the arguments), the failures.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { failureOf, fileOf, filterRows, load, parseList, Runner, setCommand, SHARED, toGrid, unsetCommand, useCommand } from '../src/env';

const LIST = JSON.stringify({
  project: 'tasks_api',
  active: 'development',
  environments: ['development', 'staging', 'production'],
  variables: [
    {
      name: 'DATABASE', declared: true, required: false, default: 'tasks.sqlite', client: false,
      uses: [{ file: 'config/project_config.nuc', line: 5 }],
      values: { development: { value: 'tasks.sqlite', source: '.env' }, staging: { value: 'tasks.sqlite', source: '.env' }, production: { value: '/data/tasks.sqlite', source: '.env.production' } },
    },
    {
      name: 'TASKS_TOKEN', declared: true, required: true, client: false,
      uses: [{ file: 'config/project_config.nuc', line: 6 }],
      values: { development: { secret: true, source: 'keyring' }, production: null },
    },
    { name: 'API_URL', declared: true, required: true, client: true, uses: [{ file: 'src/api.nuc', line: 2 }], values: { development: null } },
    { name: 'OLD_FLAG', declared: false, required: false, client: false, uses: [], values: { development: { value: '1', source: '.env.development.local' } } },
  ],
});

const grid = () => toGrid(parseList(LIST));
const row = (name: string) => grid().rows.find((r) => r.name === name)!;

test('the grid: the shared .env first, then each environment', () => {
  assert.deepEqual(grid().columns, [SHARED, 'development', 'staging', 'production']);
  assert.equal(row('DATABASE').cells[0].value, 'tasks.sqlite');
  assert.equal(row('DATABASE').cells[3].source, '.env.production');
});

test('the badges: required, missing in the active environment, secret, client, unused', () => {
  assert.deepEqual(row('DATABASE').badges, []);
  assert.deepEqual(row('TASKS_TOKEN').badges, ['required', 'secret']);
  assert.deepEqual(row('API_URL').badges, ['required', 'missing', 'client']);
  assert.deepEqual(row('OLD_FLAG').badges, ['unused']);
});

test('a cell: missing when required without a value, the default as placeholder, a secret has no value', () => {
  const token = row('TASKS_TOKEN').cells;
  assert.equal(token[1].secret, true);
  assert.equal(token[1].value, undefined);
  assert.equal(token[3].missing, true);
  assert.equal(token[0].missing, false, 'the shared column is never missing');
  const list = parseList(LIST);
  delete list.variables[0].values.staging;
  const db = toGrid(list).rows[0];
  assert.equal(db.cells[2].placeholder, 'tasks.sqlite');
  assert.equal(db.cells[2].value, undefined);
});

test('environments and variables added on the page appear before any file has them', () => {
  const g = toGrid(parseList(LIST), ['qa'], ['NEW_ONE']);
  assert.deepEqual(g.columns.slice(-1), ['qa']);
  const n = g.rows.find((r) => r.name === 'NEW_ONE')!;
  assert.deepEqual(n.badges, [], 'a new variable is not "unused"');
  assert.equal(n.cells.length, 5);
});

test('filter by name or value, and missing only', () => {
  const rows = grid().rows;
  assert.deepEqual(filterRows(rows, 'tok', false).map((r) => r.name), ['TASKS_TOKEN']);
  assert.deepEqual(filterRows(rows, '/data', false).map((r) => r.name), ['DATABASE']);
  assert.deepEqual(filterRows(rows, '', true).map((r) => r.name), ['API_URL']);
});

test('set: the value as an argument, the environment, local; the shared .env has no --env', () => {
  assert.deepEqual(setCommand({ name: 'DATABASE', value: 'a b', env: 'staging', local: true, secret: false, project: '/p' }).args, ['env', 'set', 'DATABASE', 'a b', '--env', 'staging', '--local', '--project', '/p']);
  assert.deepEqual(setCommand({ name: 'DATABASE', value: 'x', env: SHARED, local: false, secret: false, project: '/p' }).args, ['env', 'set', 'DATABASE', 'x', '--project', '/p']);
});

test('set a secret: the value only on stdin, never in the arguments', () => {
  const c = setCommand({ name: 'TASKS_TOKEN', value: 's3cr3t-value', env: 'production', local: true, secret: true, project: '/p' });
  assert.equal(c.stdin, 's3cr3t-value');
  assert.ok(!c.args.some((a) => a.includes('s3cr3t')));
  assert.deepEqual(c.args, ['env', 'set', 'TASKS_TOKEN', '--secret', '--env', 'production', '--project', '/p']);
});

test('set refuses a name that is not a variable', () => {
  assert.throws(() => setCommand({ name: '--env', value: 'x', env: SHARED, local: false, secret: false, project: '/p' }));
  assert.throws(() => useCommand('-x', '/p'));
});

test('unset: from where the value came; nothing for the process environment', () => {
  assert.deepEqual(unsetCommand({ name: 'A', env: 'development', source: 'keyring', project: '/p' })!.args, ['env', 'unset', 'A', '--secret', '--env', 'development', '--project', '/p']);
  assert.deepEqual(unsetCommand({ name: 'A', env: 'development', source: '.env.development.local', project: '/p' })!.args, ['env', 'unset', 'A', '--env', 'development', '--local', '--project', '/p']);
  assert.deepEqual(unsetCommand({ name: 'A', env: SHARED, source: '.env', project: '/p' })!.args, ['env', 'unset', 'A', '--project', '/p']);
  assert.equal(unsetCommand({ name: 'A', env: 'development', source: 'process', project: '/p' }), undefined);
});

test('use and the files of a column', () => {
  assert.deepEqual(useCommand('staging', '/p').args, ['env', 'use', 'staging', '--project', '/p']);
  assert.equal(fileOf(SHARED, false), '.env');
  assert.equal(fileOf('staging', true), '.env.staging.local');
});

test('failures: no nuclear, a nuclear without env (its usage), the command\'s own error', () => {
  assert.equal(failureOf({ code: 0, stdout: '{}', stderr: '' }), undefined);
  assert.equal(failureOf({ code: -1, stdout: '', stderr: '', error: 'spawn nuclear ENOENT' })!.kind, 'missing');
  assert.equal(failureOf({ code: 2, stdout: '', stderr: 'usage:\n  nuclear help [<topic>]\n  nuclear build' })!.kind, 'outdated');
  assert.equal(failureOf({ code: 2, stdout: '', stderr: 'usage:\n  nuclear env set <NAME> <value>' })!.kind, 'error');
  assert.deepEqual(failureOf({ code: 1, stdout: '', stderr: 'no project here\n' }), { kind: 'error', detail: 'no project here' });
});

test('load with a fake runner: the list command, the grid or the failure', async () => {
  const calls: { args: string[]; cwd: string }[] = [];
  const ok: Runner = async (args, cwd) => (calls.push({ args, cwd }), { code: 0, stdout: LIST, stderr: '' });
  const got = await load(ok, '/p');
  assert.deepEqual(calls[0], { args: ['env', 'list', '--json', '--project', '/p'], cwd: '/p' });
  assert.ok('grid' in got && got.grid.rows.length === 4);
  const bad: Runner = async () => ({ code: 0, stdout: 'not json', stderr: '' });
  const failed = await load(bad, '/p');
  assert.ok('failure' in failed && failed.failure.kind === 'error');
});
