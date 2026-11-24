// The editors' side of spec 011 without VS Code (`vscode` is test/vscode-stub.ts): the money's two confirmations, the
// settings that moved to their tool's section, the teams through the `nuclear-builder team` contract (a stub command),
// a run as the factory's process (`nuclear-builder run --events`, a stub command), the workbench (the specs' tree, the
// runs' accordion, the team's log, the chat folded from its events and as a process against a stub command), what the editors still keep in
// TypeScript (the retries, the tools' PATH, the connections, Nuclear Atlas's history, the 3B rule), and the English and
// Spanish texts. The engine's own behaviour is tested in Nuclear (tests/test_factory.nuc).
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { test } from 'node:test';
import * as vscode from 'vscode';
import { asksFor, confirmSpending, mustConfirm, projectForcesConfirm } from '../../../vscode/src/spending';
import { migrateSettings } from '../../../vscode/src/migrateSettings';
import { addMembers, agentsHere, CommandMissing, createTeam, listTeams, removeMember, roleMember, roster, saveTeam, showTeam, suggestMembers, suggestNames, teamScreen, updateMember, vaultSet } from '../src/teams/cli';
import { LineRun, lineJson, localSpecs, newRunId, orphaned, Run, specMarkdown, writeSpec } from '../src/runs';
import { beatOf, beatState, isToolCall, storyOf } from '../src/story';
import { failedStepOf, initials, inline, providerName, retryText, retryUnit, runOutline, stepTitle, specOfPath, specTree, stepTree, teamColor, teamLog, teamWork, whoLabel } from '../src/workbench';
import { factoryDir, logoData, rosterFaces } from '../src/teams/cli';
import { budgetGauge, filterRoster, memberActivity, statLevel, teamSpend } from '../src/teams/hud';
import { differences, draftOf, filterPool, missingRoles, paidMembers, roleCounts, rosterSkills, sameForAll } from '../src/teams/wizard';
import { SQUAD_SCRIPT } from '../src/teams/page';
import { libraryGroups, mdHtml, memberSkills, skillFields, skillMarkdown, skillSlug } from '../src/teams/skills';
import { PAGE_ACTIONS } from '../src/actions';
import { barsSvg, fmtMs, fmtPct, fmtTokens, fmtUsd, linesSvg, splitShare, stackSvg } from '../src/reports/charts';
import { metricsArgs } from '../src/reports/metrics';
import { filterOf } from '../src/reports/host';
import { REPORTS_SCRIPT } from '../src/reports/page';
import { chatProvider } from '../src/settings';
import { backoff, checkConnections, DEFAULT_RETRY, retryAfter, toolEnv, transientStatus } from '../src/support';
import { lastChannel, noTaskText, templatesOf, withLast, withoutChannel } from '../../nuclear-atlas/src/chat';
import * as http from 'node:http';
import { webviewFaceUrl } from '../src/teams/faceUrl';
import { chatChannel } from '../src/teams/cli';
import { assetUrl, initAssets } from '../../../vscode/src/assetsPage';

const stub = vscode as unknown as { store: Record<string, Record<string, unknown>>; answers: (string | undefined)[]; asked: { message: string; detail?: string; items: string[] }[] };
const reset = () => {
  for (const l of Object.values(stub.store)) for (const k of Object.keys(l)) delete l[k];
  stub.answers.length = 0;
  stub.asked.length = 0;
};
const spend = (root?: string) => ({ what: 'The Builder run "Loans"', providers: ['Claude Code (haiku)'], amountUsd: 5, root });

test('asking is the rule; forced asking wins over a user who turned it off', () => {
  assert.equal(mustConfirm({ confirm: true, forceConfirm: false }, false), true);
  assert.equal(mustConfirm({ confirm: false, forceConfirm: false }, false), false);
  assert.equal(mustConfirm({ confirm: false, forceConfirm: true }, false), true);
  assert.equal(mustConfirm({ confirm: false, forceConfirm: false }, true), true);
});

test('money is confirmed twice, the second time with the amount and the providers', async () => {
  reset();
  stub.answers.push('Go on', 'Spend up to 5.00 USD');
  assert.equal(await confirmSpending(spend()), true);
  assert.equal(stub.asked.length, 2);
  assert.match(stub.asked[0].message, /The Builder run "Loans" can spend money with Claude Code \(haiku\)/);
  assert.match(stub.asked[1].message, /5\.00 USD with Claude Code \(haiku\)/);
  // a no to either question stops it
  reset();
  stub.answers.push('Go on', undefined);
  assert.equal(await confirmSpending(spend()), false);
  reset();
  stub.answers.push(undefined);
  assert.equal(await confirmSpending(spend()), false);
  assert.equal(stub.asked.length, 1);
});

test('a user who turned the questions off is not asked, unless they or the project force them', async () => {
  reset();
  stub.store.globalValue['nuclear.spending.confirm'] = false;
  assert.equal(await confirmSpending(spend()), true);
  assert.equal(stub.asked.length, 0);
  stub.store.globalValue['nuclear.spending.forceConfirm'] = true;
  stub.answers.push('Go on', 'Spend up to 5.00 USD');
  assert.equal(await confirmSpending(spend()), true);
  assert.equal(stub.asked.length, 2);
  // the project's .nuclear/builder.json forces them too
  reset();
  stub.store.globalValue['nuclear.spending.confirm'] = false;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nuc-spend-'));
  fs.mkdirSync(path.join(root, '.nuclear'));
  fs.writeFileSync(path.join(root, '.nuclear', 'builder.json'), JSON.stringify({ forceConfirm: true }));
  assert.equal(projectForcesConfirm(root), true);
  stub.answers.push(undefined);
  assert.equal(await confirmSpending(spend(root)), false);
  assert.equal(stub.asked.length, 1);
  fs.writeFileSync(path.join(root, '.nuclear', 'builder.json'), '{ not json');
  assert.equal(projectForcesConfirm(root), false);
});

test('only work paid through an API key is asked; an agent\'s subscription is not, unless the questions are forced (spec 023)', async () => {
  const on = { confirm: true, forceConfirm: false };
  assert.equal(asksFor(['claude-code', 'codex'], on, false), false);
  assert.equal(asksFor(['claude-code', 'anthropic'], on, false), true);
  assert.equal(asksFor(['someone-new'], on, false), true, 'an unknown provider is asked');
  assert.equal(asksFor([], on, false), true);
  assert.equal(asksFor(['claude-code'], { confirm: false, forceConfirm: true }, false), true);
  assert.equal(asksFor(['claude-code'], on, true), true, "the project's forceConfirm");
  assert.equal(asksFor(['openai'], { confirm: false, forceConfirm: false }, false), false);
  reset();
  assert.equal(await confirmSpending({ ...spend(), ids: ['claude-code'] }), true);
  assert.equal(stub.asked.length, 0, 'an agent: no question');
  stub.answers.push('Go on', 'Spend up to 5.00 USD');
  assert.equal(await confirmSpending({ ...spend(), ids: ['openrouter'] }), true);
  assert.equal(stub.asked.length, 2, 'an API: asked twice');
  reset();
  stub.store.globalValue['nuclear.spending.forceConfirm'] = true;
  stub.answers.push(undefined);
  assert.equal(await confirmSpending({ ...spend(), ids: ['claude-code'] }), false);
  assert.equal(stub.asked.length, 1, 'forced: the agent is asked too');
});

test('a setting that moved keeps the user\'s value; a value already set in the new place wins', async () => {
  reset();
  stub.store.globalValue['nuclear.ai.claude.maxBudgetUsd'] = 12;
  stub.store.globalValue['nuclear.ai.claudeModel'] = 'opus';
  stub.store.globalValue['nuclear.ai.resumeInterrupted'] = false;
  stub.store.globalValue['nuclear.builder.resumeInterrupted'] = true;
  await migrateSettings();
  assert.equal(stub.store.globalValue['nuclear.spending.budgetUsd'], 12);
  assert.equal(stub.store.globalValue['nuclear.builder.claudeModel'], 'opus');
  assert.equal('nuclear.ai.claude.maxBudgetUsd' in stub.store.globalValue, false);
  assert.equal(stub.store.globalValue['nuclear.builder.resumeInterrupted'], true);
  assert.equal(stub.store.globalValue['nuclear.ai.resumeInterrupted'], false, 'kept where the user can see it');
});

/** A `nuclear-builder` that keeps teams in a folder, as the contract says (JSON on stdout, errors as {"error"} and 1). */
function fakeBuilder(withTeams: boolean): { dir: string; log: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nuc-builder-'));
  const bin = path.join(dir, 'ai', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const log = path.join(dir, 'calls.log');
  const js = `
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), teams = ${JSON.stringify(path.join(dir, 'teams'))};
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + '\\n');
const out = (v, code = 0) => { process.stdout.write(JSON.stringify(v)); process.exit(code); };
const stdin = () => fs.readFileSync(0, 'utf8');
if (${!withTeams}) { process.stderr.write("usage: nuclear-builder setup ...\\nnuclear-builder: error: argument command: invalid choice: '" + args[0] + "'\\n"); process.exit(2); }
fs.mkdirSync(teams, { recursive: true });
const [what, sub, ...rest] = args;
if (what === 'vault') { if (sub === 'set') { fs.writeFileSync(path.join(teams, '..', 'key-' + rest[0]), stdin()); out({ kept: rest[0] }); } out({ anthropic: false }); }
const file = (id) => path.join(teams, id + '.json');
if (sub === 'list') out(fs.readdirSync(teams).filter((f) => f.endsWith('.json')).map((f) => { const t = JSON.parse(fs.readFileSync(path.join(teams, f))); return { id: t.id, name: t.name, updated: t.updated, default: false }; }));
if (sub === 'show') { if (!fs.existsSync(file(rest[0]))) out({ error: 'no team ' + rest[0] }, 1); out(JSON.parse(fs.readFileSync(file(rest[0])))); }
if (sub === 'save') { const t = JSON.parse(stdin()); if (!t.name) out({ error: 'the team has no name' }, 1); t.id = t.id || t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'); t.updated = 42; fs.writeFileSync(file(t.id), JSON.stringify(t)); out(t); }
if (sub === 'create') { const d = JSON.parse(stdin()); const t = { id: d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: d.name, updated: 1, budgetUsd: d.budgetUsd ?? 5, techLead: null, members: d.members.map((m, i) => ({ id: m.employee ?? m.role + '-' + i, kind: 'agent', provider: 'claude-code', ...m })) }; fs.writeFileSync(file(t.id), JSON.stringify(t)); out(t); }
if (sub === 'member') { const t = JSON.parse(fs.readFileSync(file(rest[1]))); if (rest[0] === 'add') t.members.push(...JSON.parse(stdin()).map((m) => ({ id: m.employee, kind: 'agent', provider: 'claude-code', ...m }))); if (rest[0] === 'remove') t.members = t.members.filter((m) => m.id !== rest[2]); if (rest[0] === 'update') Object.assign(t.members.find((m) => m.id === rest[2]), { kind: rest[4], provider: rest[6] }); fs.writeFileSync(file(t.id), JSON.stringify(t)); out(t); }
if (sub === 'suggest') out({ roles: [{ role: 'developer', candidates: [{ employee: 'dev-001', name: 'Neo', role: 'developer', headline: 'Yes', score: 3, why: [{ term: 'test', in: 'skill', text: 'Testing' }], args: rest }] }] });
if (sub === 'name-suggest') out(['The Unpaid Interns', rest.join(' ')]);
if (sub === 'roster') out({ developer: { role: 'developer', stats: ['speed', 'tests'], employees: [{ id: 'dev-001', name: 'Neo', stats: { speed: 91, tests: 12 } }], skills: ['write-tests'] }, qa: [{ id: 'qa-001', name: 'Bugsy', stats: { edge: 3 } }] });
if (sub === 'screen') out({ teams: [{ id: 'night-shift', name: 'Night shift', updated: 42, default: true }, { id: 'broken', name: 'broken', updated: 0, default: false }], shown: { 'night-shift': { id: 'night-shift', name: 'Night shift', members: [] }, broken: { error: 'not JSON' } }, roster: { qa: [{ id: 'qa-001', name: 'Bugsy', stats: { edge: 3 }, thumb: '/r/qa/roster/faces/thumb/qa-001.webp' }] }, temperaments: [{ id: 'shy' }], vault: null, args: rest });
out({ error: 'usage' }, 1);
`;
  fs.writeFileSync(path.join(bin, 'nuclear-builder.js'), js);
  fs.writeFileSync(path.join(bin, 'nuclear-builder'), `#!/bin/sh\nexec "${process.execPath}" "${path.join(bin, 'nuclear-builder.js')}" "$@"\n`, { mode: 0o755 });
  return { dir, log };
}

test('the teams go through nuclear-builder team: create, members, suggest, save, show, list; its errors are said', { skip: process.platform === 'win32' }, async () => {
  const { dir, log } = fakeBuilder(true);
  process.env.NUCLEAR_INSTALL = dir;
  // the wizard's draft on stdin; members added, updated, let go by their id
  const t = await createTeam({ name: 'Night shift', purpose: 'a shop', members: [{ role: 'developer', employee: 'dev-001' }] });
  assert.equal(roleMember(t, 'developer')?.employee, 'dev-001');
  assert.equal((await addMembers('night-shift', [{ role: 'qa', employee: 'qa-001' }])).members.length, 2);
  assert.equal((await updateMember('night-shift', 'qa-001', { kind: 'agent', provider: 'claude-code', instructions: 'Break it' })).members[1].provider, 'claude-code');
  assert.match(fs.readFileSync(log, 'utf8'), /"--instructions","Break it"/);
  assert.deepEqual((await removeMember('night-shift', 'qa-001')).members.map((m) => m.id), ['dev-001']);
  assert.equal((await suggestMembers('a shop', ['tests', 'payments'], 'es')).roles[0].candidates[0].why[0].term, 'test');
  assert.match(fs.readFileSync(log, 'utf8'), /"suggest","--purpose","a shop","--skills","tests,payments","--lang","es"/);
  assert.equal((await suggestNames('bakery', 'en'))[0], 'The Unpaid Interns');
  // an older nuclear-builder without `agents`: no agent, never an error
  assert.deepEqual(await agentsHere(), []);
  const saved = await saveTeam({ ...t, name: 'Night shift', id: 'night-shift' });
  assert.equal(saved.updated, 42);
  assert.equal((await showTeam('night-shift')).name, 'Night shift');
  assert.deepEqual((await listTeams()).map((x) => x.id), ['night-shift']);
  await assert.rejects(showTeam('nope'), /no team nope/);
  await assert.rejects(saveTeam({ ...t, name: '' }), /the team has no name/);
  // the roster in both shapes: a roster file per role, or its list of employees
  const r = await roster('es');
  assert.deepEqual(r.developer.stats, ['speed', 'tests']);
  assert.equal(r.developer.employees[0].name, 'Neo');
  assert.deepEqual(r.qa.stats, ['edge']);
  assert.deepEqual(r.analyst.employees, []);
  assert.deepEqual(r.developer.skills, ['write-tests']);
  // the company screen in one call: a team that cannot be read is null, the roster read as roster's
  const s = await teamScreen('es');
  assert.match(fs.readFileSync(log, 'utf8'), /"screen","--lang","es","--json"/);
  assert.deepEqual(Object.keys(s.shown), ['night-shift', 'broken']);
  assert.equal(s.shown.broken, null);
  assert.equal(s.shown['night-shift']?.name, 'Night shift');
  assert.deepEqual(s.roster.qa.stats, ['edge']);
  assert.deepEqual(rosterFaces(s.roster, (f) => f ?? null, 'thumb'), { 'qa-001': '/r/qa/roster/faces/thumb/qa-001.webp' });
  assert.deepEqual(s.vault, null);
  // a key goes on stdin, never as an argument
  await vaultSet('anthropic', 'sk-secret');
  assert.equal(fs.readFileSync(path.join(dir, 'key-anthropic'), 'utf8'), 'sk-secret');
  assert.equal(fs.readFileSync(log, 'utf8').includes('sk-secret'), false);
});

test('a nuclear-builder without the team command is told apart from an error', { skip: process.platform === 'win32' }, async () => {
  process.env.NUCLEAR_INSTALL = fakeBuilder(false).dir;
  await assert.rejects(listTeams(), (e) => e instanceof CommandMissing);
});

// ---------- a run as the factory's process ----------

/** A `nuclear-builder` whose `run` keeps the process contract: it writes the run file, asks at a gate (an `ask` line),
 * reads the answer on stdin, and ends passed (0), or waiting (3) when nobody answers; `checks` answers JSON. */
function fakeLine(): { dir: string; root: string; log: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nuc-line-'));
  const root = path.join(dir, 'project');
  fs.mkdirSync(path.join(root, '.nuclear', 'builder', 'runs'), { recursive: true });
  const bin = path.join(dir, 'ai', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const log = path.join(dir, 'calls.log');
  const js = `
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + '\\n');
if (args[0] === 'checks') { process.stdout.write(JSON.stringify(args[2] === 'mark' ? { id: args[3], state: args[4] } : [{ id: 'qa.load', title: 'Load test', station: 'quality', on: true, by: 'user', state: 'pending' }])); process.exit(0); }
const id = args[0] === 'run' && args[1] !== '--resume' ? path.basename(path.dirname(args[1])) : args[args.indexOf('--resume') + 1] || args[1];
const file = path.join(process.cwd(), '.nuclear', 'builder', 'runs', id + '.json');
const ask = { id: 'gate-analysis', kind: 'gate', station: 'analysis', question: 'Approve the Analysis?', documents: ['specs/' + id + '/analysis.md'] };
const save = (status, waiting) => fs.writeFileSync(file, JSON.stringify({ id, root: process.cwd(), project: 'p', platform: 'backend', dialect: 'fastapi', spec: { id, title: 'Count books', useCase: 'feature', description: '', criteria: [], context: [], source: { kind: 'local' }, pieces: [] }, status, created: 1, engine: 3, stages: [{ id: 'analysis', title: 'Analysis', about: '', actors: ['analyst'], role: 'analyst', provider: 'nuclear-developer', status: status === 'passed' ? 'passed' : 'waiting', steps: [] }], waiting }));
save('running', null);
save('waiting', ask);
console.log('not json: a tool printed this');
console.log(JSON.stringify({ type: 'event', step: 'analysis-1', event: { type: 'trace', step: 'read', detail: 'the spec' } }));
console.log(JSON.stringify({ type: 'ask', ...ask }));
let input = '', over = false;
const answered = (line) => {
  if (over) return;
  over = true;
  if (!line) { process.exit(3); }
  fs.appendFileSync(${JSON.stringify(log)}, 'answer ' + line + '\\n');
  save('passed', null);
  console.log(JSON.stringify({ type: 'done', status: 'passed', costUsd: 0 }));
  process.exit(0);
};
// one JSON line per answer, as the engine reads it; stdin closed with none: the run waits
process.stdin.on('data', (d) => { input += d; if (input.includes('\\n')) answered(input.split('\\n')[0].trim()); });
process.stdin.on('end', () => answered(input.trim()));
`;
  fs.writeFileSync(path.join(bin, 'nuclear-builder.js'), js);
  fs.writeFileSync(path.join(bin, 'nuclear-builder'), `#!/bin/sh\nexec "${process.execPath}" "${path.join(bin, 'nuclear-builder.js')}" "$@"\n`, { mode: 0o755 });
  return { dir, root, log };
}

test('a run is a process: its question comes as an ask, the answer goes on stdin, and it ends passed', { skip: process.platform === 'win32' }, async () => {
  const { dir, root, log } = fakeLine();
  const env = { ...toolEnv(), NUCLEAR_INSTALL: dir };
  const spec = { id: newRunId(root, 'Count books', new Date('2026-11-17T10:00:00Z')), title: 'Count books', useCase: 'feature' as const, description: 'Counts the books.', criteria: ['an empty list counts 0'], context: [], source: { kind: 'local' as const }, pieces: [] };
  assert.equal(spec.id, '20261117-count-books');
  const p = new LineRun(root, spec.id, ['run', writeSpec(root, spec), '--team', 'night-shift'], env);
  const asked = await new Promise<{ id: string; kind: string }>((resolve) => p.once('ask', resolve));
  assert.equal(asked.kind, 'gate');
  assert.equal(p.ask?.id, 'gate-analysis');
  assert.ok(p.answer({ answer: 'change', text: 'name the edge cases' }));
  assert.equal(p.answer({ answer: 'yes' }), false, 'nothing is asked any more');
  const done = new Promise((resolve) => p.once('done', resolve));
  assert.equal(await p.exited, 0);
  assert.deepEqual(await done, { type: 'done', status: 'passed', costUsd: 0 });
  const calls = fs.readFileSync(log, 'utf8');
  assert.ok(calls.includes('["run","specs/_global/20261117-count-books/spec.md","--team","night-shift","--events"]'));
  assert.ok(calls.includes('answer {"answer":"change","text":"name the edge cases"}'));
  // the next run of the same title gets its own id
  assert.equal(newRunId(root, 'Count books', new Date('2026-11-17T10:00:00Z')), '20261117-count-books-2');
  // the checks of QA's plan go through the command, in the project
  const checks = await lineJson<{ id: string }[]>(root, ['checks', spec.id, '--json'], env);
  assert.equal(checks[0].id, 'qa.load');
});

test('a run nobody answers ends waiting (exit 3) with its question in the run file', { skip: process.platform === 'win32' }, async () => {
  const { dir, root } = fakeLine();
  const p = new LineRun(root, 'waits', ['run', '--resume', 'waits'], { ...toolEnv(), NUCLEAR_INSTALL: dir });
  await new Promise((resolve) => p.once('ask', resolve));
  p.stop();
  assert.equal(await p.exited, 3);
  const run = JSON.parse(fs.readFileSync(path.join(root, '.nuclear', 'builder', 'runs', 'waits.json'), 'utf8')) as Run;
  assert.equal(run.status, 'waiting');
  assert.equal(run.waiting?.id, 'gate-analysis');
});

test('a spec is written in the shape the engine reads; a run whose process died is orphaned', () => {
  const md = specMarkdown({ id: 'x', title: 'Loans', useCase: 'bug', description: 'It breaks.', criteria: ['a test reproduces it'], context: ['AGENTS.md'], source: { kind: 'github', key: '#12' }, pieces: [{ path: 'src/a.nuc', kind: 'usecase', task: 'fix it', by: 'you' }, { path: 'src/b.nuc', kind: 'usecase', task: 'planned', by: 'planner' }] });
  assert.match(md, /^# Loans\n\n- Use case: bug\n- Source: github #12\n/);
  assert.match(md, /## Acceptance criteria\n\n- \[ \] a test reproduces it\n/);
  assert.match(md, /## Context\n\n- AGENTS\.md\n/);
  assert.match(md, /## Pieces\n\n- `src\/a\.nuc` \(usecase\): fix it\n$/);
  assert.equal(orphaned({ pid: process.pid, host: os.hostname(), beat: Date.now() }), false);
  assert.equal(orphaned({ pid: process.pid, host: os.hostname(), beat: Date.now() - 60_000 }), true);
  assert.equal(orphaned({ pid: 2 ** 22 + 7, host: os.hostname(), beat: Date.now() }), true);
  assert.equal(orphaned(null), true);
});

// ---------- the workbench: the specs' tree, the runs' accordion, the team's log, the chat ----------

/** A run file as the page gets it, with only what the workbench reads. */
const runOf = (id: string, status: string, specPath: string | undefined, stages: { id: string; status: string; role?: string; steps?: { id: string; title: string; status: string; actor: string; started?: number; ended?: number; parallel?: boolean; summary?: string; trace?: { step: string; detail: string; kind?: string }[] }[] }[]) =>
  ({ id, status, created: 1, specPath, spec: { title: id.replace(/-/g, ' '), useCase: 'feature' }, stages: stages.map((s) => ({ title: s.id, steps: [], ...s })) });

test('the specs are a tree by business component and layer; the whole project and the unsorted ones last; a spec only a run names is in it', () => {
  assert.deepEqual(specOfPath('specs/books/domain/loans'), { id: 'loans', component: 'books', layer: 'domain' });
  assert.deepEqual(specOfPath('specs/books/loans/spec.md'), { id: 'loans', component: 'books', layer: null });
  assert.deepEqual(specOfPath('specs/_global/ci'), { id: 'ci', component: '_global', layer: null });
  assert.deepEqual(specOfPath('specs/old-one'), { id: 'old-one', component: '', layer: null });
  const specs = [
    { id: 'ci', title: 'Cache the CI', component: '_global', layer: '', path: 'specs/_global/ci' },
    { id: 'loans', title: 'Loans', component: 'books', layer: 'data', path: 'specs/books/data/loans' },
    { id: 'rate', title: 'Rate a book', component: 'books', layer: 'presentation', path: 'specs/books/presentation/rate' },
    { id: 'search', title: 'Search', component: 'books', layer: '', path: 'specs/books/search' },
    { id: 'old', title: 'Old', component: '', layer: '', path: 'specs/old' },
  ];
  const runs = [runOf('rate', 'running', 'specs/books/presentation/rate', []), runOf('members-list', 'passed', 'specs/accounts/members-list', []), runOf('flat-run', 'failed', undefined, [])];
  const tree = specTree(specs, runs);
  assert.deepEqual(tree.map((g) => g.component), ['accounts', 'books', '_global', '']);
  const books = tree[1];
  assert.deepEqual(books.specs.map((s) => s.id), ['search']);
  assert.deepEqual(books.layers.map((l) => l.layer), ['presentation', 'data']);
  assert.equal(books.layers[0].specs[0].run, 'running');
  assert.equal(tree[0].specs[0].title, 'members list');
  assert.deepEqual(tree[3].specs.map((s) => [s.id, s.run]), [['flat-run', 'failed'], ['old', null]]);
});

test('a run is an accordion of its stations and their steps, and the log tells what each one of the team did, in order', () => {
  const r = runOf('loans', 'running', undefined, [
    { id: 'analysis', status: 'passed', role: 'analyst', steps: [{ id: 'a1', title: 'Read the spec', status: 'passed', actor: 'analyst', started: 10, summary: 'three criteria', trace: [{ step: 'read', detail: 'spec.md' }] }] },
    { id: 'design', status: 'skipped', role: 'architect' },
    { id: 'code', status: 'running', role: 'developer', steps: [{ id: 'c2', title: 'Check', status: 'pending', actor: 'shell' }, { id: 'c1', title: 'Write Loans', status: 'running', actor: 'developer', started: 20, summary: '', trace: [{ step: 'nuclear_check', detail: 'ok', kind: 'tool' }] }] },
    { id: 'quality', status: 'pending', role: 'qa' },
  ]);
  const o = runOutline(r);
  assert.equal(o.done, 2);
  assert.equal(o.total, 4);
  assert.deepEqual(o.now, { stage: 'code', step: 'c1', title: 'Write Loans', actor: 'developer' });
  assert.deepEqual(o.stations.map((s) => [s.id, s.role, s.steps.length]), [['analysis', 'analyst', 1], ['design', 'architect', 0], ['code', 'developer', 2], ['quality', 'qa', 0]]);
  const log = teamLog(r);
  assert.deepEqual(log.map((e) => [e.actor, e.kind, e.text]), [['analyst', 'step', 'Read the spec'], ['analyst', 'trace', 'read'], ['developer', 'step', 'Write Loans'], ['developer', 'tool', 'nuclear_check']]);
  assert.equal(log[0].detail, 'three criteria');
  assert.equal(teamLog(r, 1).length, 1);
});

test('a station\'s checks at the same time: each its own row, all working at once, the log in the order they ended', async () => {
  const r = runOf('loans', 'running', undefined, [
    { id: 'design', status: 'running', role: 'architect', steps: [
      { id: 'design-1', title: 'Architect: Design', status: 'passed', actor: 'architect', started: 10, ended: 20 },
      { id: 'design-2', title: 'Check: one', status: 'passed', actor: 'architect', started: 21, ended: 90, parallel: true },
      { id: 'design-3', title: 'Check: two', status: 'passed', actor: 'architect', started: 22, ended: 40, parallel: true },
      { id: 'design-4', title: 'Check: three', status: 'running', actor: 'architect', started: 23, parallel: true },
      { id: 'design-5', title: 'Check: four', status: 'running', actor: 'architect', started: 24, parallel: true },
    ] },
  ]);
  const o = runOutline(r);
  assert.equal(o.working, 2);
  assert.deepEqual(o.stations[0].steps.map((x) => x.status), ['passed', 'passed', 'passed', 'running', 'running']);
  assert.deepEqual(teamLog(r).map((e) => e.text), ['Architect: Design', 'Check: two', 'Check: one', 'Check: three', 'Check: four']);
  const { BUILDER } = await import('../src/l10n');
  assert.equal((BUILDER.es as Record<string, string>)['prog.together'], '{0} comprobaciones a la vez');
});

test('the page\'s helpers are inlined self-contained: their source alone builds the tree', () => {
  const page = new Function(inline({ specTree, specOfPath, runOutline, teamLog }) + '\nreturn W;')() as { specTree: typeof specTree; runOutline: typeof runOutline };
  const tree = page.specTree([], [runOf('x', 'passed', 'specs/books/domain/x', [])]);
  assert.equal(tree[0].component, 'books');
  assert.equal(tree[0].layers[0].specs[0].id, 'x');
  assert.equal(page.runOutline(runOf('y', 'passed', undefined, [{ id: 'analysis', status: 'passed' }])).done, 1);
});

test('who did a piece of work is one label: employee, role, provider, model; what is not known is left out', () => {
  assert.equal(whoLabel({ name: 'Neo', role: 'Developer', provider: 'claude-code', model: 'haiku' }), 'Neo · Developer · Claude Code · haiku');
  assert.equal(whoLabel({ role: 'Analyst', provider: 'nuclear-developer', model: 'gemma4:e2b' }), 'Analyst · Nuclear Developer · gemma4:e2b');
  assert.equal(whoLabel({ name: 'Shell', provider: 'shell' }), 'Shell');
  assert.equal(providerName('opencode'), 'OpenCode');
  assert.equal(providerName('someone-new'), 'someone-new');
});

test('a failed run is retried from its failed step: the first failure after the station\'s last passed step, as the engine takes it', () => {
  const steps = [{ id: 'code-1', status: 'failed' }, { id: 'code-2', status: 'skipped' }, { id: 'code-3', status: 'passed' }, { id: 'code-4', status: 'failed' }, { id: 'code-5', status: 'failed' }];
  const run = { stages: [{ id: 'tests', status: 'passed', steps: [{ id: 'tests-1', status: 'failed' }] }, { id: 'code', status: 'failed', steps }] };
  // the Developer's code (code-3) passed: the retry starts at the check that failed after it, never at the attempt the station repaired
  assert.equal(failedStepOf(run)?.x.id, 'code-4');
  assert.equal(failedStepOf(run)?.st.id, 'code');
  assert.equal(failedStepOf({ stages: [{ id: 'code', status: 'passed', steps }] }), null);
  // the page has it inlined, with the other functions it computes
  assert.match(inline({ failedStepOf }), /W = \{ failedStepOf: /);
});

test('the main action retries the smallest unit that failed, also while the run waits for its retry; each retry is said in the page\'s language', async () => {
  const steps = [{ id: 'code-1', status: 'passed' }, { id: 'code-2', status: 'failed' }];
  const stages = [{ id: 'code', title: 'Code', status: 'failed', steps }];
  assert.equal(retryUnit({ status: 'failed', stages })?.x.id, 'code-2');
  // every level tried, the engine waits on a `retry` ask: the same unit, the station still failed
  assert.equal(retryUnit({ status: 'waiting', waiting: { kind: 'retry' }, stages })?.x.id, 'code-2');
  // waiting at a gate, or passed: nothing to retry
  assert.equal(retryUnit({ status: 'waiting', waiting: { kind: 'gate' }, stages }), null);
  assert.equal(retryUnit({ status: 'passed', stages: [{ id: 'code', status: 'passed', steps: [{ id: 'code-1', status: 'passed' }] }] }), null);
  const { BUILDER } = await import('../src/l10n');
  const es = { ...BUILDER.en, ...BUILDER.es } as Record<string, string>;
  const en = BUILDER.en as Record<string, string>;
  const entry = { level: 'process', attempt: 2, of: 3, title: 'Developer: Code', key: 'work', args: ['developer', 'code'] };
  assert.equal(retryText(entry, en), 'A call or command of “Developer: Code” again in place (attempt 2 of 3)'.replace('Developer: Code', stepTitle(entry, en)));
  for (const level of ['process', 'node', 'station', 'you']) {
    assert.ok(en['retry.' + level] && es['retry.' + level] !== en['retry.' + level], level);
    assert.doesNotMatch(retryText({ ...entry, level }, es), /\{\d\}/);
  }
  assert.match(retryText({ level: 'you', attempt: 1, of: 0, title: 'lib/b.nuc' }, es), /Reintentaste «lib\/b\.nuc» en su sitio/);
  // the page has them inlined
  assert.match(inline({ retryUnit, retryText }), /W = \{ retryUnit: .*retryText: /);
  // the chat offers the same answers as buttons
  const { askPost, RUN_TEXTS } = await import('../../../vscode/src/chatHost');
  const post = askPost({ id: 'r', spec: { title: 'x' }, stages: [{ id: 'code', title: 'Code', status: 'failed', role: 'developer', steps: [] }] } as never, { id: 'retry-code', kind: 'retry', station: 'code', question: 'q', key: 'retryAsk', args: ['code', 'code-2', 'exit 1'] }, () => 'dev', RUN_TEXTS.es);
  assert.deepEqual(post.buttons?.map((x) => x.id), ['run|r|retry-code|yes', 'run|r|retry-code|no', 'run|r|retry-code|stop']);
  assert.match(post.text, /^La estación Código falló en el paso code-2/);
});

test('a step opens like a debugger: outcome, trace and tool calls in order (a call to its input and output), decisions, files, log', () => {
  const tree = stepTree({ status: 'failed', summary: '2 of 3 tests fail', trace: [{ step: 'read', detail: 'spec.md' }, { step: 'nuclear_check', detail: '{"path":"src"}', kind: 'tool', output: '1 error' }, { step: 'nuclear_build', detail: '', kind: 'tool' }], decisions: [{ what: 'one repository', why: 'one table' }], files: ['tests/loans.nuc', 'tests/loans.nuc'], log: 'a\nb\nc' });
  assert.deepEqual(tree.map((n) => [n.kind, n.title]), [['summary', '2 of 3 tests fail'], ['trace', 'read'], ['tool', 'nuclear_check'], ['tool', 'nuclear_build'], ['decision', 'one repository'], ['file', 'loans.nuc'], ['log', 'log']]);
  assert.deepEqual(tree[2].children.map((c) => [c.title, c.text]), [['input', '{"path":"src"}'], ['output', '1 error']]);
  assert.equal(tree[3].children.length, 0);
  assert.equal(tree[4].text, 'one table');
  assert.equal(tree[5].file, 'tests/loans.nuc');
  assert.equal(tree[5].value, 'tests');
  assert.equal(tree[6].value, '3');
  // a long detail is shown on one line and opens whole; a running step has no outcome yet
  const long = 'x'.repeat(200);
  const t2 = stepTree({ status: 'running', summary: 'so far', trace: [{ step: 'think', detail: long }] });
  assert.equal(t2.length, 1);
  assert.equal(t2[0].value.length, 90);
  assert.equal(t2[0].text, long);
});

test('the company says what each team works on, the runs going on first; a team with no logo has its initials in its colour', () => {
  const run = (id: string, status: string, created: number, team?: string, old?: string) => ({ id, status, created, spec: { title: id }, team: team ? { id: team } : undefined, factory: old ? { team: old } : undefined });
  const runs = [run('a', 'passed', 1, 'night'), run('b', 'running', 2, 'night'), run('c', 'failed', 3, 'day'), run('d', 'failed', 4, undefined, 'night'), run('e', 'passed', 5, 'night')];
  assert.deepEqual(teamWork(runs, 'night').map((w) => w.id), ['b', 'e', 'd']);
  assert.deepEqual(teamWork(runs, 'nobody'), []);
  assert.equal(initials('Night shift'), 'NS');
  assert.equal(initials('backend'), 'BA');
  assert.equal(initials('  '), '?');
  assert.equal(teamColor('night'), teamColor('night'));
  assert.notEqual(teamColor('night'), teamColor('day'));
  const page = new Function(inline({ initials, teamColor, whoLabel, providerName, stepTree }) + '\nreturn W;')() as { whoLabel: typeof whoLabel };
  assert.equal(page.whoLabel({ name: 'Ana', role: 'QA', provider: 'claude-code' }), 'Ana · QA · Claude Code');
});

test('a team\'s logo is read from beside the team as a data url; none, not an image or missing is none', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logo-'));
  fs.writeFileSync(path.join(dir, 'night.logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.writeFileSync(path.join(dir, 'night.logo.txt'), 'no');
  assert.match(logoData({ logo: 'night.logo.svg' }, dir) ?? '', /^data:image\/svg\+xml;base64,/);
  assert.equal(logoData({ logo: 'night.logo.txt' }, dir), null);
  assert.equal(logoData({ logo: 'gone.png' }, dir), null);
  assert.equal(logoData({}, dir), null);
  assert.equal(factoryDir({ NUCLEAR_FACTORY_HOME: '/f' }, 'linux'), '/f');
  assert.equal(factoryDir({ XDG_CONFIG_HOME: '/c' }, 'linux'), path.join('/c', 'nuclearlang', 'factory'));
});

test('the roster\'s faces reach the pages as data urls by employee id; an employee without one keeps the drawn face', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faces-'));
  fs.writeFileSync(path.join(dir, 'dev-001.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"/>');
  const person = (id: string, face?: string) => ({ id, name: id, location: '', age: 1, university: '', profile: '', bio: '', hrNote: '', stats: {}, face });
  const none = { stats: [], employees: [], skills: [] };
  const faces = rosterFaces({ analyst: none, architect: none, qa: none, devops: none, developer: { stats: [], skills: [], employees: [person('dev-001', path.join(dir, 'dev-001.svg')), person('dev-002', path.join(dir, 'gone.svg')), person('dev-003')] } });
  assert.deepEqual(Object.keys(faces), ['dev-001']);
  assert.match(faces['dev-001'], /^data:image\/svg\+xml;base64,/);
});





test('the company screen\'s HUD: a stat\'s level, the budget gauge, the hiring pool\'s filter, a team\'s spending and a member\'s activity', () => {
  assert.deepEqual([90, 80, 79, 50, 49, 25, 24, 0].map(statLevel), ['hi', 'hi', 'mid', 'mid', 'low', 'low', 'crit', 'crit']);
  assert.deepEqual(budgetGauge(1, 5), { pct: 20, level: 'ok' });
  assert.deepEqual(budgetGauge(4, 5), { pct: 80, level: 'warn' });
  assert.deepEqual(budgetGauge(7, 5), { pct: 100, level: 'over' });
  assert.deepEqual(budgetGauge(0, 0), { pct: 0, level: 'ok' });
  assert.deepEqual(budgetGauge(0.1, 0), { pct: 100, level: 'over' });
  const pool = [
    { id: 'a', name: 'Neo', profile: 'Senior developer', location: 'Mount Olympus', university: 'Mars', temperament: 'shy', gender: 'male' },
    { id: 'b', name: 'Ada', profile: 'Tester', location: 'Ohio', university: 'Mars', temperament: 'nerd', gender: 'female' },
    { id: 'c', name: 'Lin', profile: 'Senior tester', location: 'Ohio', university: 'Venus', temperament: 'shy', gender: 'female' },
  ];
  const ids = (l: { id: string }[]) => l.map((p) => p.id);
  assert.deepEqual(ids(filterRoster(pool, '', '', '')), ['a', 'b', 'c']);
  assert.deepEqual(ids(filterRoster(pool, 'senior OHIO', '', '')), ['c']);
  assert.deepEqual(ids(filterRoster(pool, '', 'shy', '')), ['a', 'c']);
  assert.deepEqual(ids(filterRoster(pool, 'mars', '', 'female')), ['b']);
  const run = (id: string, team: string, created: number, costUsd?: number, steps: { title: string; status: string; employee?: string; ended?: number }[] = []) => ({ id, created, costUsd, spec: { title: 'Spec ' + id }, team: { id: team }, stages: [{ title: 'Code', steps }] });
  const runs = [run('r1', 'night', 1, 0.5, [{ title: 'Write the piece', status: 'passed', employee: 'dev-001', ended: 10 }]), run('r2', 'night', 2, 1.25, [{ title: 'Fix it', status: 'failed', employee: 'dev-001', ended: 20 }, { title: 'Other', status: 'passed', employee: 'qa-001', ended: 30 }]), run('r3', 'day', 3, 9)];
  assert.equal(teamSpend(runs, 'night'), 1.25);
  assert.equal(teamSpend(runs, 'nobody'), 0);
  assert.deepEqual(memberActivity(runs, 'night', 'dev-001').map((a) => [a.run, a.step, a.station, a.status]), [['r2', 'Fix it', 'Code', 'failed'], ['r1', 'Write the piece', 'Code', 'passed']]);
  assert.deepEqual(memberActivity(runs, 'night', ''), []);
  // the wizard (ADR-platform-0010): members by role, the roles lacking, the paid ones, the pool, the skills, the draft
  const twenty = Array.from({ length: 20 }, (_, i) => ({ role: 'developer', employee: 'dev-' + i, kind: i < 3 ? 'agent' : 'local', provider: i < 3 ? 'claude-code' : 'nuclear-developer', model: '' }));
  assert.deepEqual(roleCounts([...twenty, { role: 'qa' }]), { analyst: 0, architect: 0, developer: 20, qa: 1, devops: 0 });
  assert.deepEqual(missingRoles([...twenty, { role: 'qa' }]), ['analyst', 'architect', 'devops']);
  assert.equal(paidMembers(twenty).length, 3);
  const all = [{ role: 'developer', name: 'Neo', skills: ['Testing'], temperament: 'shy', gender: 'male' }, { role: 'qa', name: 'Bugsy', headline: 'Breaks things', skills: ['Fuzzing', 'Testing'], gender: 'female' }];
  assert.deepEqual(filterPool(all, { skill: 'testing' }).map((p) => p.name), ['Neo', 'Bugsy']);
  assert.deepEqual(filterPool(all, { role: 'qa' }).map((p) => p.name), ['Bugsy']);
  assert.deepEqual(filterPool(all, { q: 'breaks', gender: 'female' }).map((p) => p.name), ['Bugsy']);
  assert.deepEqual(filterPool(all, { temper: 'shy', skill: 'fuzzing' }), []);
  assert.deepEqual(rosterSkills({ developer: { employees: all.slice(0, 1) }, qa: { employees: all.slice(1) } }), ['Testing', 'Fuzzing']);
  const draft = draftOf({ name: ' Crew ', description: '', purpose: 'p', skills: ['a'], budgetUsd: 3, lead: 1, logoFile: '/x.png', members: [twenty[0], twenty[5], { role: 'qa', kind: 'local', provider: 'nuclear-developer', model: 'gemma4:e2b' }, { role: 'qa', kind: 'api', provider: 'openrouter', model: 'gpt-5-mini' }] });
  // who works a member is always written; an older local one becomes the default agent (ADR-platform-0013)
  assert.deepEqual(draft, { name: 'Crew', description: '', purpose: 'p', skills: ['a'], budgetUsd: 3, techLead: 1, logoFile: '/x.png', members: [{ role: 'developer', employee: 'dev-0', kind: 'agent', provider: 'claude-code' }, { role: 'developer', employee: 'dev-5', kind: 'agent', provider: 'claude-code' }, { role: 'qa', kind: 'agent', provider: 'claude-code' }, { role: 'qa', kind: 'api', provider: 'openrouter', model: 'gpt-5-mini' }] });
  // a member is its profile, not its model: one agent for everyone (or a role), each one's own instructions and skills
  const crew = [{ role: 'developer', kind: 'local', provider: 'nuclear-developer', model: '' }, { role: 'qa', kind: 'local', provider: 'nuclear-developer', model: '' }];
  assert.deepEqual(sameForAll(crew, 'qa', { kind: 'agent', provider: 'claude-code', model: 'haiku' }).map((m) => m.provider), ['nuclear-developer', 'claude-code']);
  assert.deepEqual(sameForAll(crew, '', { kind: 'agent', provider: 'opencode', model: 'x/y' }).map((m) => m.provider), ['opencode', 'opencode']);
  const own = { role: 'qa', employee: 'qa-1', kind: 'local', provider: 'nuclear-developer', model: '', instructions: ' Break it. ', skills: ['review'], extraSkills: [{ name: 'fuzz', text: 'Fuzz.' }, { name: '', text: '' }], temperament: 'grumpy', note: 'Never trusts green.' };
  assert.equal(differences(own), 5);
  assert.equal(differences({ ...own, instructions: '', skills: undefined, extraSkills: [], temperament: '', note: ' ' }), 0);
  assert.deepEqual((draftOf({ name: 'x', description: '', purpose: '', skills: [], budgetUsd: 5, lead: -1, members: [own] }).members as unknown[])[0], { role: 'qa', employee: 'qa-1', kind: 'agent', provider: 'claude-code', instructions: 'Break it.', skills: ['review'], extraSkills: [{ name: 'fuzz', text: 'Fuzz.' }], personality: { temperament: 'grumpy', note: 'Never trusts green.' } });
  // the page's script, with the helpers inlined, is whole JavaScript
  const window: { Squad?: { mount: unknown; receive: unknown } } = {};
  new Function('window', 'T', 't', SQUAD_SCRIPT)(window, {}, (k: string) => k);
  assert.equal(typeof window.Squad?.receive, 'function');
});

test('the model pickers list every model every time and survive repeated choices; the local kind is only OpenCode on Ollama, an older local member said converted', () => {
  // the page's script on a DOM that only keeps its HTML: the events are handed to its listeners as the browser would
  const on: Record<string, (e: unknown) => void> = {};
  const el = { innerHTML: '', addEventListener: (k: string, f: (e: unknown) => void) => (on[k] = f), querySelector: () => null, querySelectorAll: () => [], contains: () => true, insertAdjacentHTML(_: string, h: string) { this.innerHTML += h; } };
  const sent: { type: string; [k: string]: unknown }[] = [];
  const window: { Squad?: { mount(el: unknown, post: (m: unknown) => void, o: unknown): void; receive(m: unknown): boolean } } = {};
  new Function('window', 'T', 't', 'document', 'matchMedia', SQUAD_SCRIPT)(window, {}, (k: string, ...a: unknown[]) => [k, ...a].join(' '), { activeElement: null }, () => ({ matches: true }));
  const squad = window.Squad!;
  squad.mount(el, (m) => sent.push(m as never), { company: false });
  const member = (id: string, role: string, kind: string, provider: string, model: string) => ({ id, role, kind, provider, model, skills: [], extraSkills: [], behaviour: {}, tasks: [] });
  // an older team file: a member still local, and the command's conversion warning
  squad.receive({ type: 'team:state', teams: [{ id: 't', name: 'T' }], team: { id: 't', name: 'T', members: [member('dev', 'developer', 'local', 'nuclear-developer', 'qwen2.5-coder:3b'), member('qa', 'qa', 'agent', 'claude-code', 'opus')] }, roster: {}, warnings: ['member dev was local: now claude-code'] });
  assert.ok(el.innerHTML.includes('member dev was local: now claude-code') && el.innerHTML.includes('sq.converted'));
  // the machine's agents and every provider's models are asked once the member's brain is drawn
  assert.ok(sent.some((m) => m.type === 'team:wizard') && sent.some((m) => m.type === 'team:models'));
  squad.receive({ type: 'team:agents', agents: [{ id: 'claude-code', provider: 'claude-code', kind: 'agent', available: true, models: ['haiku', 'sonnet', 'opus'] }, { id: 'opencode', provider: 'opencode', kind: 'agent', available: true, models: ['openai/gpt-y'] }, { id: 'opencode-local', provider: 'opencode-local', kind: 'local', available: true, models: ['ollama/qwen2.5-coder:3b'] }] });
  squad.receive({ type: 'team:models', models: { memory: { totalGb: 16, availableGb: 8 }, providers: { 'claude-code': { models: ['fable', 'opus', 'sonnet', 'haiku'].map((id) => ({ id, family: id, version: 'latest', alias: true })), free: true }, opencode: { models: [{ id: 'openai/gpt-y' }], free: true }, 'opencode-local': { models: [{ id: 'ollama/qwen2.5-coder:3b', needGb: 3.4, fit: 'fits', installed: true }], free: false } } } });
  const options = () => (el.innerHTML.match(/<option /g) ?? []).length;
  const change = (f: string, value: string) => on.change({ target: { dataset: { f }, value } });
  const click = (ds: Record<string, string>) => on.click({ target: { closest: () => ({ dataset: ds, disabled: false }) } });
  const all = options();
  // the local kind is only OpenCode on Ollama's models, free (no $); OpenCode as an agent lists none of them; the local
  // Nuclear Developer is never offered (ADR-platform-0013)
  assert.ok(el.innerHTML.includes('value="agent|claude-code|fable"') && el.innerHTML.includes('value="local|opencode-local|ollama/qwen2.5-coder:3b"') && el.innerHTML.includes('value="agent|opencode|openai/gpt-y"'));
  assert.ok(!el.innerHTML.includes('value="agent|opencode|ollama/') && !el.innerHTML.includes('value="local|nuclear-developer') && !el.innerHTML.includes('$ OpenCode + Ollama'));
  // every line says what kind of thing it is, every group how it is paid; an alias says it is the latest
  assert.ok(el.innerHTML.includes('Claude Code (sq.kindWord.agent) · fable — sq.model.latest') && el.innerHTML.includes('label="sq.group.agent Claude Code Claude"'));
  // the brain chosen again and again: every model still listed (the converted line goes once a choice is made), each
  // choice saved by its command
  change('brain', 'agent|claude-code|haiku');
  assert.equal(options(), all - 1);
  for (const v of ['agent|claude-code|opus', 'agent|claude-code|sonnet', 'api|openrouter|', 'agent|claude-code|opus']) {
    change('brain', v);
    assert.equal(options(), all - 1, v);
  }
  assert.equal(sent.filter((m) => m.type === 'team:memberUpdate').length, 5);
  // the wizard's step 5: the kinds are agent, local (OpenCode on Ollama) and api; the older local member is given the default agent
  click({ a: 'editMembers' });
  click({ wzgo: '4' });
  assert.ok(el.innerHTML.includes('data-wzkind="0|agent"') && el.innerHTML.includes('data-wzkind="0|local"') && el.innerHTML.includes('data-wzkind="0|api"') && !el.innerHTML.includes('nuclear-developer"') && !el.innerHTML.includes('wzAllLocal'));
  assert.ok(el.innerHTML.includes('<select data-f="wzmodel-1"') && !el.innerHTML.includes('datalist'));
  const step = options();
  for (const v of ['haiku', 'sonnet', 'opus', 'haiku']) {
    change('wzmodel-0', v);
    assert.equal(options(), step, v);
  }
  change('wzmodel-1', '__other__');
  assert.ok(el.innerHTML.includes('data-f="wzmodel-1-other"'));
  on.input({ target: { dataset: { f: 'wzmodel-1-other' }, value: ' claude-opus-5-5 ' } });
});

test('the onboarding is told whether its team step edits a team (saved at once) or makes a new one', () => {
  const on: Record<string, (e: unknown) => void> = {};
  const el = { innerHTML: '', addEventListener: (k: string, f: (e: unknown) => void) => (on[k] = f), querySelector: () => null, querySelectorAll: () => [], contains: () => true, insertAdjacentHTML(_: string, h: string) { this.innerHTML += h; } };
  const window: { Squad?: { mount(el: unknown, post: (m: unknown) => void, o: unknown): void; receive(m: unknown): boolean } } = {};
  new Function('window', 'T', 't', 'document', 'matchMedia', SQUAD_SCRIPT)(window, {}, (k: string, ...a: unknown[]) => [k, ...a].join(' '), { activeElement: null }, () => ({ matches: true }));
  const views: { view: string; team?: string }[] = [];
  window.Squad!.mount(el, () => undefined, { onView: (v: { view: string; team?: string }) => views.push(v) });
  window.Squad!.receive({ type: 'team:state', teams: [{ id: 'nf', name: 'Nuclear Factory' }], team: { id: 'nf', name: 'Nuclear Factory', members: [] }, roster: {} });
  assert.deepEqual(views.at(-1), { view: 'team', team: 'Nuclear Factory' });
  on.click({ target: { closest: () => ({ dataset: { a: 'wizard' }, disabled: false }) } });
  assert.deepEqual(views.at(-1), { view: 'wizard' });
});

test('a built team shows only its members; the roster opens only to add, and closes; a member or a team opens its conversation in Nuclear Atlas', () => {
  const on: Record<string, (e: unknown) => void> = {};
  const el = { innerHTML: '', addEventListener: (k: string, f: (e: unknown) => void) => (on[k] = f), querySelector: () => null, querySelectorAll: () => [], contains: () => true, insertAdjacentHTML(_: string, h: string) { this.innerHTML += h; } };
  const sent: { type: string; [k: string]: unknown }[] = [];
  const window: { Squad?: { mount(el: unknown, post: (m: unknown) => void, o: unknown): void; receive(m: unknown): boolean } } = {};
  new Function('window', 'T', 't', 'document', 'matchMedia', SQUAD_SCRIPT)(window, {}, (k: string, ...a: unknown[]) => [k, ...a].join(' '), { activeElement: null }, () => ({ matches: true }));
  const squad = window.Squad!;
  squad.mount(el, (m) => sent.push(m as never), { company: false });
  const member = (id: string, role: string) => ({ id, role, kind: 'agent', provider: 'claude-code', model: '', skills: [], extraSkills: [], behaviour: {}, tasks: [] });
  const roster = { developer: { employees: [{ id: 'dev-0', name: 'Neo', profile: 'p' }, { id: 'dev-1', name: 'Trin', profile: 'q' }] } };
  squad.receive({ type: 'team:state', teams: [{ id: 'core', name: 'Core' }], team: { id: 'core', name: 'Core', members: [member('m1', 'developer')] }, roster });
  const click = (ds: Record<string, string>) => on.click({ target: { closest: () => ({ dataset: ds, disabled: false }) } });
  // the team, and no catalogue of candidates under it
  assert.ok(el.innerHTML.includes('data-member="m1"') && !el.innerHTML.includes('sq-roster') && !el.innerHTML.includes('ro-grid'));
  // + Add of a role opens the catalogue; Done closes it
  click({ addrole: 'developer' });
  assert.ok(el.innerHTML.includes('sq-roster') && el.innerHTML.includes('data-addemp="dev-1"') && el.innerHTML.includes('data-a="addDone"'));
  click({ a: 'addDone' });
  assert.ok(!el.innerHTML.includes('sq-roster'));
  // the wizard has its own catalogue
  click({ a: 'wizard' });
  click({ wzgo: '3' });
  assert.ok(el.innerHTML.includes('ro-grid'));
  // the conversations: the team's channel, a member's direct message (the host opens Nuclear Atlas on them)
  click({ chatteam: 'core' });
  click({ chatteam: 'core', chatm: 'm1' });
  assert.deepEqual(sent.filter((m) => m.type === 'team:chat').map((m) => [m.team, m.member]), [['core', undefined], ['core', 'm1']]);
  const src = (f: string) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'tools', 'nuclear-builder', 'src', f), 'utf8');
  // a member opens its tech lead's conversation (the chat lists the tech leads, spec 023), the team its channel
  assert.match(src('teams/host.ts'), /'nuclear\.atlas\.open', undefined, chatChannel\(team, member, /);
  assert.equal(PAGE_ACTIONS['team:chat'], 'editor');
});

test('the Builder page has no chat of its own: a member, the team or *Ask* open Nuclear Atlas', async () => {
  const { html } = await import('../src/panel');
  const page = html({ cspSource: 'vscode-resource:', asWebviewUri: (u: { fsPath: string }) => u.fsPath } as never, { fsPath: '/ext' } as never);
  for (const gone of ['id="chat"', 'chatMount', 'chatTab', 'nuclearChat(', "type: 'chatOpen'", 'data-g="chat"']) assert.ok(!page.includes(gone), gone);
  assert.ok(page.includes("type: 'atlas', channel: d.dm") && page.includes("type: 'atlas', channel: d.teamchat") && page.includes("d.act === 'askChat') return vscode.postMessage({ type: 'atlas' })"));
  const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'tools', 'nuclear-builder', 'src', 'panel.ts'), 'utf8');
  assert.match(src, /case 'atlas':[\s\S]{0,300}'nuclear\.atlas\.open', this\.root/);
  assert.equal(PAGE_ACTIONS.atlas, 'editor');
  assert.equal('chatTab' in PAGE_ACTIONS, false);
});

test('a spec is written where its component and layer say, and found there again', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nuc-specs-'));
  const base = { title: 'Loans', useCase: 'feature' as const, description: 'd', criteria: ['c'], context: [], source: { kind: 'local' as const }, pieces: [] };
  assert.equal(writeSpec(root, { ...base, id: 'loans', component: 'books', layer: 'data' }), path.join('specs', 'books', 'data', 'loans', 'spec.md'));
  assert.equal(writeSpec(root, { ...base, id: 'ci', title: 'CI', component: '_global', layer: 'data' }), path.join('specs', '_global', 'ci', 'spec.md'));
  assert.throws(() => writeSpec(root, { ...base, id: 'x', component: '../etc' }), /not a component's name/);
  assert.match(fs.readFileSync(path.join(root, 'specs', 'books', 'data', 'loans', 'spec.md'), 'utf8'), /- Component: books\n- Layer: data\n/);
  assert.deepEqual(localSpecs(root).sort((a, b) => a.id.localeCompare(b.id)), [
    { id: 'ci', title: 'CI', component: '_global', layer: null, path: 'specs/_global/ci' },
    { id: 'loans', title: 'Loans', component: 'books', layer: 'data', path: 'specs/books/data/loans' },
  ]);
  // an id in use anywhere under specs/ is not given again
  assert.equal(newRunId(root, 'Loans', new Date('2026-11-18T10:00:00Z')), '20261118-loans');
  fs.mkdirSync(path.join(root, 'specs', 'books', '20261118-loans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'specs', 'books', '20261118-loans', 'spec.md'), '# Loans\n');
  assert.equal(newRunId(root, 'Loans', new Date('2026-11-18T10:00:00Z')), '20261118-loans-2');
});

test('the chat\'s provider is a setting: one the factory knows, else the default agent (an older local one too)', () => {
  assert.deepEqual(chatProvider(undefined), { kind: 'agent', provider: 'claude-code', model: '' });
  assert.deepEqual(chatProvider({ kind: 'local', provider: 'nuclear-developer', model: 'gemma4:e2b' }), { kind: 'agent', provider: 'claude-code', model: '' });
  assert.deepEqual(chatProvider({ kind: 'api', provider: 'openrouter', model: 'gpt-5-mini' }), { kind: 'api', provider: 'openrouter', model: 'gpt-5-mini' });
  assert.deepEqual(chatProvider({ kind: 'local', provider: 'claude-code' }), { kind: 'agent', provider: 'claude-code', model: '' });
});

// ---------- what the editors keep in TypeScript ----------

test('backoff grows exponentially, is capped and jittered, and honours Retry-After', () => {
  const top = () => 0.999999;
  assert.equal(backoff(1, DEFAULT_RETRY, undefined, top), 1000);
  assert.equal(backoff(3, DEFAULT_RETRY, undefined, top), 4000);
  assert.equal(backoff(10, DEFAULT_RETRY, undefined, top), 30000);
  assert.equal(backoff(3, DEFAULT_RETRY, undefined, () => 0), 0);
  assert.equal(backoff(1, DEFAULT_RETRY, 5000), 5000);
  assert.equal(backoff(1, DEFAULT_RETRY, 120000), 30000);
  assert.equal(retryAfter('2'), 2000);
  assert.equal(retryAfter(new Date(Date.now() + 3000).toUTCString(), Date.now())! > 1000, true);
  assert.equal(retryAfter('soon'), undefined);
  assert.ok(transientStatus(503) && transientStatus(429) && !transientStatus(422) && !transientStatus(404));
});

test('the tools are found even when the editor was started without the shell PATH', () => {
  const env = toolEnv({ PATH: '/usr/bin:/bin' }, '/home/u', 'linux');
  assert.equal(env.PATH, '/usr/bin:/bin:/home/u/.local/bin:/home/u/.cargo/bin:/opt/homebrew/bin:/usr/local/bin');
  assert.match(toolEnv({ PATH: '/usr/bin', PREFIX: '/opt/n' }, '/home/u', 'linux').PATH!, /^\/usr\/bin:\/opt\/n\/bin:/);
  const win = toolEnv({ Path: 'C:\\Windows', LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' }, 'C:\\Users\\u', 'win32');
  assert.ok(win.Path!.startsWith('C:\\Windows;') && win.Path!.includes('nuclearlang') && !('PATH' in win));
});

test('the connections tell the Smart Graph that does not answer and a missing tool; nothing local is checked', async () => {
  const checks = await checkConnections({ graphUrl: 'http://127.0.0.1:9', tools: ['nuclear-missing-tool'], folders: [os.tmpdir()], minFreeMb: 1 });
  assert.deepEqual(checks.filter((c) => !c.ok).map((c) => c.name).sort(), ['Smart Graph', 'nuclear-missing-tool'].sort());
  assert.ok(!checks.some((c) => /Developer|Ollama|^model /.test(c.name)));
});

test('Nuclear Atlas builds templates from the map', () => {
  const map = '## Component `books`\n\n- `x.nuc`\n  - usecase `AllBooks` — all\n';
  assert.ok(templatesOf(map, 'backend').some((t) => t.text.includes('`AllBooks`')));
  assert.ok(templatesOf(map, 'backend', 'es').some((t) => t.label === 'Explicar books'));
  // Atlas informs and routes (spec 023): no template orders work; a task goes to a tech lead
  for (const l of ['en', 'es'] as const) assert.ok(templatesOf(map, 'backend', l).every((t) => !t.text.startsWith('/task')));
  assert.ok(templatesOf(map, 'backend').some((t) => /tech lead/.test(t.text)));
  // a /task said to Atlas is not run: the tech leads to ask, each a link to their conversation
  assert.equal(noTaskText([{ id: 'core-arch', name: 'Ada', team: 'core' }]), 'Atlas does not run tasks: ask a tech lead. #dm-core-arch (Ada, core)');
  assert.match(noTaskText([], 'es'), /^Atlas no ejecuta tareas/);
});

// ---------- English and Spanish ----------
const vscodeDir = path.join(__dirname, '..', '..');
function walk(d: string): string[] {
  return fs.readdirSync(d).flatMap((f) => {
    const p = path.join(d, f);
    return fs.statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}
const sources = (dirs: string[]) => dirs.flatMap((d) => walk(d));
const placeholders = (s: string) => [...s.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort().join();

test('every text of the host has its Spanish, with the same placeholders', () => {
  const es = JSON.parse(fs.readFileSync(path.join(vscodeDir, 'l10n', 'bundle.l10n.es.json'), 'utf8')) as Record<string, string>;
  const tools = path.join(vscodeDir, '..', 'tools');
  const files = sources([path.join(vscodeDir, 'src'), ...fs.readdirSync(tools).map((t) => path.join(tools, t, 'src')).filter((d) => fs.existsSync(d))]);
  const missing: string[] = [];
  for (const f of files) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/l10n\.t\(\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g)) {
      const key = JSON.parse(m[1][0] === "'" ? '"' + m[1].slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"' : m[1]) as string;
      if (!(key in es)) missing.push(`${path.basename(f)}: ${key}`);
      else assert.equal(placeholders(es[key]), placeholders(key), key);
    }
  }
  assert.deepEqual(missing, []);
});

test('the language: the setting, else the editor, else the operating system, else English', async () => {
  const { osLocale, resolveLang, supported } = await import('../../../vscode/src/language');
  assert.deepEqual(resolveLang('es', 'en', 'en_US.UTF-8'), { setting: 'es', lang: 'es', source: 'setting' });
  assert.deepEqual(resolveLang('en', 'es', 'es_ES'), { setting: 'en', lang: 'en', source: 'setting' });
  assert.deepEqual(resolveLang('auto', 'es-419', 'en_US'), { setting: 'auto', lang: 'es', source: 'editor' });
  assert.deepEqual(resolveLang('auto', 'fr', 'es_AR.UTF-8'), { setting: 'auto', lang: 'es', source: 'os' });
  assert.deepEqual(resolveLang('auto', 'de', 'ja-JP'), { setting: 'auto', lang: 'en', source: 'default' });
  assert.deepEqual(resolveLang('nonsense', undefined, undefined), { setting: 'auto', lang: 'en', source: 'default' });
  assert.equal(supported('ES_mx'), 'es');
  assert.equal(supported('english'), undefined);
  // POSIX precedence; C and POSIX are no language, so Intl answers
  assert.equal(osLocale({ LC_ALL: 'es_ES.UTF-8', LANG: 'en_US.UTF-8' }, () => 'de'), 'es_ES.UTF-8');
  assert.equal(osLocale({ LANG: 'C.UTF-8' }, () => 'es-CL'), 'es-CL');
  assert.equal(osLocale({}, () => 'en-GB'), 'en-GB');
});

test('a host message in the chosen language: the Spanish bundle, else the English key', async () => {
  const { translate } = await import('../../../vscode/src/language');
  const { l10n, lang } = await import('../../../vscode/src/i18n');
  const es = { 'Hello {0}': 'Hola {0}' };
  assert.equal(translate(es, 'es', 'Hello {0}', ['Ana']), 'Hola Ana');
  assert.equal(translate(es, 'en', 'Hello {0}', ['Ana']), 'Hello Ana');
  assert.equal(translate(es, 'es', 'Not translated {0} {1}', [1]), 'Not translated 1 {1}');
  // the real bundle, through the setting (the stub's editor is in English)
  const bundle = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'l10n', 'bundle.l10n.es.json'), 'utf8')) as Record<string, string>;
  const key = Object.keys(bundle).find((k) => !k.includes('{'))!;
  stub.store.globalValue['nuclear.language'] = 'es';
  try {
    assert.equal(lang(), 'es');
    assert.equal(l10n.t(key), bundle[key]);
    assert.equal(l10n.t('A message nobody translated'), 'A message nobody translated');
  } finally {
    delete stub.store.globalValue['nuclear.language'];
  }
  assert.equal(lang(), 'en');
  assert.equal(l10n.t(key), key);
});

test('every page dictionary has the Spanish of each English key', async () => {
  const dicts: Record<string, { en: Record<string, string>; es: Record<string, string> }> = {
    ...(await import('../../../vscode/src/welcomeL10n')), ...(await import('../../../vscode/src/setupL10n')), ...(await import('../../../vscode/src/workspaceL10n')),
    ...(await import('../../../vscode/src/settingsL10n')), LANGUAGE: (await import('../../../vscode/src/i18n')).LANGUAGE, ...(await import('../../nuclear-atlas/src/l10n')),
    ...(await import('../src/teams/l10n')), ...(await import('../src/reports/l10n')), ...(await import('../src/l10n')), ...(await import('../../nuclear-device-manager/src/l10n')), ...(await import('../../nuclear-http-connections/src/l10n')),
  } as never;
  const names = Object.keys(dicts).filter((k) => dicts[k]?.en && dicts[k]?.es);
  assert.ok(names.length >= 12, names.join());
  for (const n of names) assert.deepEqual(Object.keys(dicts[n].en).filter((k) => !(k in dicts[n].es)), [], n);
});

// The texts the engine and the set-up compute reach the screens as a kind and its arguments (`key`, `args`): each kind
// they write has its Spanish in the dictionary of the screen that shows it, so a new kind without one fails here.
test('every kind of text the engine, the agents list and the set-up write has its Spanish on the screens', async () => {
  const tool = path.join(__dirname, '..', '..', '..', 'tools', 'nuclear-builder');
  const src = (f: string) => fs.readFileSync(path.join(tool, f), 'utf8');
  const { BUILDER } = await import('../src/l10n');
  const { SQUAD } = await import('../src/teams/l10n');
  const { SETUP } = await import('../../../vscode/src/setupL10n');
  const { RUN_TEXTS, WHY_TEXTS, askText, whyOf } = await import('../../../vscode/src/chatHost');
  const kinds = (text: string, re: RegExp) => [...new Set([...text.matchAll(re)].map((m) => m[1]))];
  // a station's steps: step(st, "<title>", actor, role, "<key>", …), the role given or ""
  const steps = kinds(src('factory.nuc'), /step\(st, [^\n]*?(?:"", |role\.id, role\.id, |"developer", "developer", |"qa", "qa", )"([a-zA-Z]+)"(?:, \[|\))/g);
  // leadFix(st, title, task, "<key>", args)
  steps.push(...kinds(src('factory.nuc'), /, "(leadFix[A-Za-z]+)", \[/g), 'work');
  assert.ok(steps.length >= 18, steps.join());
  const es = BUILDER.es as Record<string, string>;
  assert.deepEqual([...new Set(steps)].filter((k) => !es['step.' + k]), []);
  // the questions of the gates, in the chat and the notifications
  const asks = kinds(src('factory.nuc'), /"key": (?:questions\.isEmpty \? )?"([a-zA-Z]+)"/g).concat(['gateQuestions']);
  assert.deepEqual(asks.filter((k) => !(RUN_TEXTS.es.ask as Record<string, string>)[k]), []);
  // why an agent cannot work here, on the company screen and in the chat's agent picker
  const why = kinds(src('chat_agents.nuc'), /reason\("[^\n]*?", "([a-zA-Z]+)"/g);
  assert.deepEqual(why.sort(), ['noAnswer', 'noKey', 'noLocalModel', 'noPrice', 'notOnPath']);
  assert.deepEqual(why.filter((k) => !(SQUAD.es as Record<string, string>)['sq.why.' + k] || !WHY_TEXTS.es[k]), []);
  // the set-up: a machine's fit, a requirement's state, the steps
  const setup = src('setup.nuc');
  // with the switch off (ADR-platform-0013) only the remote profile's steps and details are shown: the local ones
  // (fits, notRunning, developer, models, developer-service) stay in setup.nuc on standby, untested
  const local = ['developer', 'models', 'developer-service'];
  const details = kinds(setup, /"(notInstalled|noAiServices)"/g);
  const ids = kinds(setup, /Step\("([a-z-]+)", /g).filter((k) => !local.includes(k)).concat(['graphRemote', 'standby']);
  const ses = SETUP.es as Record<string, string>;
  assert.deepEqual([...details.map((k) => 'detail.' + k), ...ids.map((k) => 'setupStep.' + k)].filter((k) => !ses[k]), []);
  assert.ok(details.length === 2 && ids.length >= 8, [details, ids].join(' | '));
  // said in the language, else the engine's English
  const T = { ...BUILDER.en, ...BUILDER.es } as Record<string, string>;
  assert.equal(stepTitle({ title: 'Repair a.nuc', key: 'repair', args: ['a.nuc'] }, T), 'Reparar a.nuc');
  assert.equal(stepTitle({ title: 'Analyst: Analysis', key: 'work', args: ['analyst', 'analysis'] }, T), 'Analista: Análisis');
  assert.equal(stepTitle({ title: 'nuclear check .' }, T), 'nuclear check .');
  assert.equal(stepTitle({ title: 'Old', key: 'unknown' }, T), 'Old');
  assert.equal(askText({ question: 'Approve the Design? Read …', key: 'gate', args: ['design'] }, RUN_TEXTS.es), '¿Apruebas la estación Diseño? Lee sus documentos antes.');
  assert.equal(askText({ question: 'Approve the Design? Read …', key: 'gate', args: ['design'] }, RUN_TEXTS.en), 'Approve the Design? Read …');
  assert.equal(whyOf({ id: 'codex', label: 'Codex', kind: 'agent', command: [], why: '`codex` is not on the PATH', whyKey: 'notOnPath', whyArgs: ['codex'] }, 'es'), 'no instalado: `codex` no está en el PATH');
});

test("every page's header has the language button", () => {
  const read = (f: string) => fs.readFileSync(path.join(process.cwd(), '..', f), 'utf8');
  const pages: Record<string, RegExp> = {
    'tools/nuclear-builder/src/panel.ts': /<header>[\s\S]*?\$\{langButton\(\)\}[\s\S]*?<\/header>/,
    'tools/nuclear-builder/src/teams/page.ts': /co-head[\s\S]*?globe\(\)/,
    'tools/nuclear-atlas/src/panel.ts': /<header>.*\$\{langButton\(\)\}<\/header>/,
    'vscode/src/settingsPanel.ts': /getElementById\('head'\)\.innerHTML = .*langButton\(\)/,
    'vscode/src/setupPanel.ts': /<h1 id="title"><\/h1>\$\{langButton\(\)\}/,
    'tools/nuclear-http-connections/src/panel.ts': /class="bar">.*\$\{langButton\(\)\}/,
    'tools/nuclear-http-connections/src/socketPanel.ts': /class="bar">.*\$\{langButton\(\)\}/,
    'vscode/src/workspace.ts': /class="strip">.*\$\{langButton\(\)\}/,
  };
  for (const [f, header] of Object.entries(pages)) {
    const src = read(f);
    assert.match(src, header, f);
    // the page's script gets the menu (and the webview's API) from pageI18n: it never acquires the API again
    assert.match(src, /pageI18n\(|langButton === 'function'/, f);
    // (the workspace's welcome and template pages have no pageI18n: only its column is checked)
    const scope = f.endsWith('workspace.ts') ? src.slice(src.indexOf('export function stripHtml'), src.indexOf('class WelcomePanel')) : src;
    assert.ok(scope.length > 1000, f);
    assert.doesNotMatch(scope, /acquireVsCodeApi\(\)/, f);
  }
});

test('every text package.json contributes is in package.nls.json and package.nls.es.json', () => {
  const pkg = fs.readFileSync(path.join(vscodeDir, 'package.json'), 'utf8');
  const en = JSON.parse(fs.readFileSync(path.join(vscodeDir, 'package.nls.json'), 'utf8')) as Record<string, string>;
  const es = JSON.parse(fs.readFileSync(path.join(vscodeDir, 'package.nls.es.json'), 'utf8')) as Record<string, string>;
  const used = [...pkg.matchAll(/"%([^%"]+)%"/g)].map((m) => m[1]);
  assert.ok(used.length > 300);
  assert.deepEqual(used.filter((k) => !(k in en) || !(k in es)), []);
  assert.deepEqual(Object.keys(en).filter((k) => !(k in es)), []);
  // no command title is left in English only
  const commands = (JSON.parse(pkg) as { contributes: { commands: { title: string }[] } }).contributes.commands;
  assert.deepEqual(commands.filter((c) => !c.title.startsWith('%')), []);
});

test('the Nuclear workspace keeps the projects opened in a folder to that folder', async () => {
  const { savedInside } = await import('../../../vscode/src/savedProjects');
  const saved = ['/w/app-workspace/backend', '/w/app-workspace/front', '/w/other/api', '/w/app-workspace-2/x'];
  assert.deepEqual(savedInside(saved, ['/w/app-workspace']), ['/w/app-workspace/backend', '/w/app-workspace/front']);
  assert.deepEqual(savedInside(saved, []), []);
});

test('every action of the pages names a command of the inventory (ADR-platform-0009)', () => {
  // npm test runs in extensions/vscode
  const read = (f: string) => fs.readFileSync(path.join(process.cwd(), '..', 'tools', 'nuclear-builder', f), 'utf8');
  const doc = read('docs/02-architecture/actions.md');
  const receive = (src: string) => {
    const at = src.indexOf('private async receive(');
    const body = src.slice(at, src.indexOf('\n  }\n', at));
    return [...body.matchAll(/^ {6}case '([^']+)':/gm)].map((m) => m[1]);
  };
  const messages = [...receive(read('src/panel.ts')), ...receive(read('src/teams/host.ts')), ...receive(read('src/reports/host.ts'))];
  assert.ok(messages.includes('reports:load'));
  assert.ok(messages.length > 30);
  for (const m of messages) {
    const command = PAGE_ACTIONS[m];
    assert.ok(command, `the page's message ${m} names no command (src/actions.ts)`);
    if (command !== 'editor') assert.match(doc, new RegExp('`' + command.replace(/[-]/g, '\\-') + '[ `]'), `${command} is not in actions.md`);
  }
});

// spec 011 requirement 34: the skills' screens — a skill's file drawn safely, the editor's SKILL.md and back, the
// library by kind, and what a member gets with where each comes from (library.nuc's order of precedence)
test('a skill file is drawn as safe HTML: headings, lists, boxes, code; a script stays text', () => {
  const html = mdHtml('---\nname: x\n---\n# Payments\n\n## Steps\n\n1. Use `nuclear gen` **first**\n2. Then\n\n- [ ] checked\n- [x] done\n\n```sh\nnuclear check .\n```\n<script>alert(1)</script>');
  assert.ok(html.startsWith('<h2>Payments</h2><h3>Steps</h3><ol><li>Use <code>nuclear gen</code> <b>first</b></li><li>Then</li></ol>'), html);
  assert.ok(html.includes('<li class="task"><span class="box">☐</span> checked</li>') && html.includes('☑'));
  assert.ok(html.includes('<pre><code>nuclear check .</code></pre>') && html.includes('&lt;script&gt;') && !html.includes('<script>') && !html.includes('name: x'));
});

test('the editor writes a SKILL.md the command reads, and reads one back', () => {
  const md = skillMarkdown({ id: '', name: 'Refunds with Stripe', description: 'Refund safely.\nTwice never.', text: '## Steps\n\n1. Look it up.', title_es: 'Reembolsos', kind: 'domain', tags: ['refunds', 'payments'], from: 'library:payments' });
  assert.equal(md, '---\nname: refunds-with-stripe\ndescription: Refund safely. Twice never.\ntitle: Refunds with Stripe\ntitle_es: Reembolsos\nkind: domain\ntags: [refunds, payments]\nfrom: library:payments\n---\n\n## Steps\n\n1. Look it up.\n');
  const back = skillFields(md);
  assert.deepEqual([back.id, back.name, back.kind, back.tags, back.from, back.text], ['refunds-with-stripe', 'Refunds with Stripe', 'domain', ['refunds', 'payments'], 'library:payments', '## Steps\n\n1. Look it up.']);
  assert.equal(skillSlug('  Bank accounts & transfers! '), 'bank-accounts-transfers');
});

test('the library is grouped by kind and searched by its words and tags', () => {
  const lib = [{ id: 'tdd', title: 'TDD', kind: 'practice', tags: ['tests'] }, { id: 'payments', title: 'Payments', kind: 'domain', tags: ['refunds'] }, { id: 'synapsis-web', title: 'Synapsis web', kind: 'technology', tags: ['react'] }];
  assert.deepEqual(libraryGroups(lib, '').map((g) => [g.kind, g.skills.map((s) => s.id)]), [['domain', ['payments']], ['technology', ['synapsis-web']], ['practice', ['tdd']]]);
  assert.deepEqual(libraryGroups(lib, 'refunds').map((g) => g.skills[0].id), ['payments']);
  assert.deepEqual(libraryGroups(lib, 'nothing'), []);
});

test("Nuclear's base skills are never offered to choose, and every member lists them as the base's", () => {
  const lib = [{ id: 'payments', title: 'Payments', kind: 'domain' }, { id: 'clean-code', title: 'Clean code', kind: 'practice', base: true }];
  assert.deepEqual(libraryGroups(lib, '').map((g) => g.skills.map((s) => s.id)), [['payments']]);
  assert.deepEqual(libraryGroups(lib, 'clean'), []);
  // a team of before 0.87 that lists the base skill: once, as the base's
  const rows = memberSkills({ skills: ['clean-code', 'payments'] }, {}, lib, [], []);
  assert.deepEqual(rows.map((r) => [r.id, r.via, r.inherited]), [['payments', 'team', true], ['clean-code', 'base', true]]);
  const fresh = memberSkills({ skills: ['payments'] }, {}, lib, [], []);
  assert.deepEqual(fresh.map((r) => [r.id, r.via, r.inherited]), [['payments', 'team', true], ['clean-code', 'base', true]]);
});

test('a member lists its own skills first, then its library ones, then what it inherits, each override marked', () => {
  const lib = [{ id: 'payments', title: 'Payments' }, { id: 'tdd', title: 'TDD' }, { id: 'i18n', title: 'I18n' }];
  const team = { skills: ['payments', 'i18n'], ownSkills: [{ id: 'payments', name: 'Our payments', description: '' }, { id: 'style', name: 'House style', description: '' }] };
  const member = { skills: ['write-tests', 'tdd'], ownSkills: [{ id: 'style', name: 'My style', description: '' }], agent: 'backend' };
  const rows = memberSkills(team, member, lib, [{ id: 'backend', skills: ['i18n'] }], ['write-tests']);
  assert.deepEqual(rows.map((r) => [r.id, r.from, r.via, r.inherited, r.overrides]), [
    ['style', 'member', 'member', false, ['team']],
    ['tdd', 'library', 'member', false, []],
    ['i18n', 'library', 'agent', false, []],
    ['payments', 'team', 'team', true, ['library']],
  ]);
});

// ---------- spec 017: the Reports page ----------

test('the reports read numbers as people do, and a count not reported stays a dash', () => {
  assert.equal(fmtTokens(950), '950');
  assert.equal(fmtTokens(12_345), '12.3k');
  assert.equal(fmtTokens(4_100_000), '4.1M');
  assert.equal(fmtTokens(null), '—');
  assert.equal(fmtUsd(1.5), '$1.50');
  assert.equal(fmtUsd(0.0042), '$0.0042');
  assert.equal(fmtUsd(0), '$0.00');
  assert.equal(fmtMs(45_000), '45 s');
  assert.equal(fmtMs(12 * 60_000), '12 min');
  assert.equal(fmtMs(3.5 * 3_600_000), '3.5 h');
  assert.equal(fmtPct(0.5), '50%');
  assert.equal(fmtPct(null), '—');
  assert.deepEqual(splitShare(3, 1), { a: 75, b: 25 });
  assert.deepEqual(splitShare(0, 0), { a: 0, b: 0 });
});

test('the charts are inline SVG: a bar per point, parts stacked, a line per series; a label is text, never markup', () => {
  const bars = barsSvg([{ label: '<b>x</b>', value: 2 }, { label: 'y', value: 4 }], 'var(--hud)');
  assert.equal((bars.match(/<rect /g) ?? []).length, 2);
  assert.ok(bars.startsWith('<svg') && bars.includes('&lt;b&gt;x&lt;/b&gt;') && !bars.includes('<b>'));
  assert.equal(barsSvg([], 'red'), '');
  const stack = stackSvg([{ label: 'd1', parts: [1, 2] }, { label: 'd2', parts: [0, 3] }], ['a', 'b'], ['in', 'out']);
  assert.equal((stack.match(/<rect /g) ?? []).length, 3);
  const lines = linesSvg(['d1', 'd2', 'd3'], [{ name: 'left', values: [3, 2, 0], color: 'c' }, { name: 'done', values: [0, 1, 3], color: 'd' }]);
  assert.equal((lines.match(/<path d="M/g) ?? []).length, 3);
  assert.equal((lines.match(/<circle /g) ?? []).length, 6);
});

test('the page asks the command only what it takes: the filter kept to its options', () => {
  assert.deepEqual(metricsArgs({ team: 'red', from: '2026-11-01', by: 'week', view: 'people' }), ['metrics', '--team', 'red', '--from', '2026-11-01', '--by', 'week', '--view', 'people', '--json']);
  assert.deepEqual(filterOf({ project: ' app ', from: 'yesterday', to: '2026-11-19', by: 'month', view: 'velocity', member: '' }), { project: 'app', team: undefined, member: undefined, from: undefined, to: '2026-11-19', by: 'day', view: undefined });
});

test('the Reports page draws the bill and every view, and asks again when a filter changes', () => {
  const on: Record<string, (e: unknown) => void> = {};
  const el = { innerHTML: '', addEventListener: (k: string, f: (e: unknown) => void) => (on[k] = f) };
  const sent: { type: string; [k: string]: unknown }[] = [];
  const window: { Reports?: { mount(el: unknown, post: (m: unknown) => void): void; receive(m: unknown): boolean } } = {};
  new Function('window', 'T', 't', 'langButton', REPORTS_SCRIPT)(window, {}, (k: string, ...a: unknown[]) => [k, ...a].join(' '), () => '');
  const page = window.Reports!;
  page.mount(el, (m) => sent.push(m as never));
  assert.equal(sent[0].type, 'reports:ready');
  const total = { inTokens: 1000, outTokens: 500, costUsd: 0.75, ms: 10, calls: 3, notReported: 1 };
  const data = {
    filter: {}, lines: 3, runs: 1,
    bill: { total, local: { ...total, costUsd: 0, inTokens: 100, outTokens: 50 }, paid: { ...total, inTokens: 900, outTokens: 450 }, byPeriod: [{ period: '2026-11-16', ...total }], byModel: [{ provider: 'claude-code', model: 'haiku', ...total }], byTeam: [], byMember: [], byProject: [{ project: 'app', root: '/p/app', ...total }], budget: { runs: 1, spentUsd: 0.75, budgetUsd: 5, used: 0.15 }, runs: [] },
    throughput: { delivered: 1, periods: [{ period: '2026-11-16', delivered: 1 }], velocity: [{ team: 'red', delivered: 1, perPeriod: 1 }] },
    cycle: { specs: [], delivered: { count: 1, median: 60_000 }, stations: [] },
    burndown: { scope: 1, delivered: 1, periods: [{ period: '2026-11-16', scope: 1, delivered: 1, remaining: 0 }] },
    flow: { columns: ['pending', 'delivered'], periods: [{ period: '2026-11-16', counts: { pending: 0, delivered: 1 } }] },
    waiting: { open: [{ run: 'a', project: 'app', gate: 'gate-analysis', station: 'analysis', ms: 60_000 }], answered: { count: 0 }, byStation: [] },
    quality: { stations: [{ station: 'code', steps: 2, passed: 1, failed: 1, retried: 1, firstTryRate: 1 }] },
    people: { members: [{ team: 'red', member: 'dev', role: 'developer', steps: 2, answers: 0, added: 60, removed: 2, passed: 1, failed: 1, passRate: 0.5, ...total }], byResult: ['red-dev'] },
    indicators: { delivered: 1, costPerDeliveredUsd: 0.75, tokensPerUsefulLine: 142.5, usefulLines: 20, localTokenShare: 0.1, localUsd: 0, paidUsd: 0.75, retriesPerStation: { code: 1 } },
  };
  assert.ok(page.receive({ type: 'reports:data', data }));
  assert.ok(el.innerHTML.includes('rp.bill') && el.innerHTML.includes('$0.75') && el.innerHTML.includes('<svg') && el.innerHTML.includes('rp.notReported 1'));
  for (const view of ['throughput', 'cycle', 'burndown', 'flow', 'waiting', 'quality', 'people', 'indicators']) {
    on.click({ target: { closest: () => ({ dataset: { tab: view } }) } });
    assert.ok(el.innerHTML.includes('aria-selected="true" class="sel">rp.tab.' + view), view);
  }
  assert.ok(el.innerHTML.includes('rp.ind.costPerSpec'));
  // the projects the reports named are offered by the filter; a change asks again
  assert.ok(el.innerHTML.includes('value="/p/app"'));
  on.change({ target: { dataset: { f: 'team' }, value: 'red' } });
  assert.deepEqual(sent.at(-1), { type: 'reports:load', filter: { project: '', team: 'red', member: '', from: '', to: '', by: 'day' } });
  page.receive({ type: 'reports:filter', team: 'red', member: 'dev' });
  assert.equal((sent.at(-1)!.filter as { member: string }).member, 'dev');
  assert.ok(page.receive({ type: 'reports:error', text: 'boom' }) && el.innerHTML.includes('rp.error boom'));
  assert.equal(page.receive({ type: 'team:state' }), false);
});

test("a member's numbers from the ledger are in their panel's Summary, and its Reports opens the page filtered to them", () => {
  const on: Record<string, (e: unknown) => void> = {};
  const el = { innerHTML: '', addEventListener: (k: string, f: (e: unknown) => void) => (on[k] = f), querySelector: () => null, querySelectorAll: () => [], contains: () => true, insertAdjacentHTML(_: string, h: string) { this.innerHTML += h; } };
  const sent: { type: string; [k: string]: unknown }[] = [];
  const window: { Squad?: { mount(el: unknown, post: (m: unknown) => void, o: unknown): void; receive(m: unknown): boolean } } = {};
  new Function('window', 'T', 't', 'document', 'matchMedia', SQUAD_SCRIPT)(window, {}, (k: string, ...a: unknown[]) => [k, ...a].join(' '), { activeElement: null }, () => ({ matches: true }));
  const squad = window.Squad!;
  squad.mount(el, (m) => sent.push(m as never), { company: false });
  squad.receive({ type: 'team:state', teams: [{ id: 't', name: 'T' }], team: { id: 't', name: 'T', members: [{ id: 'dev', role: 'developer', kind: 'local', provider: 'nuclear-developer', model: '', skills: [], extraSkills: [], behaviour: {}, tasks: [] }] }, roster: {} });
  assert.ok(!el.innerHTML.includes('sq.mp.numbers'));
  squad.receive({ type: 'team:numbers', team: 't', numbers: { dev: { steps: 4, answers: 2, added: 60, removed: 3, passed: 3, failed: 1, inTokens: 12000, outTokens: 3000, costUsd: 0 } } });
  assert.ok(el.innerHTML.includes('sq.mp.numbers') && el.innerHTML.includes('sq.mp.numbersText 4 2 60 3 3 1 15.0k $0.00'), el.innerHTML.slice(0, 200));
  // another team's numbers are not this one's
  squad.receive({ type: 'team:numbers', team: 'other', numbers: {} });
  assert.ok(el.innerHTML.includes('sq.mp.numbersText'));
  on.click({ target: { closest: () => ({ dataset: { a: 'reports' }, disabled: false }) } });
  assert.deepEqual(sent.at(-1), { type: 'team:reports', team: 't', member: 'dev' });
});

test('a face shown on a page that named no roots keeps the extension readable (0.84.0: Atlas and the diagram broke)', () => {
  const webview = { options: {} as { localResourceRoots?: { fsPath: string }[] }, asWebviewUri: (u: { fsPath: string }) => ({ toString: () => u.fsPath }) };
  const url = webviewFaceUrl(webview as never);
  assert.equal(url('/roles/qa/roster/faces/qa-001.webp'), '/roles/qa/roster/faces/qa-001.webp');
  const roots = (webview.options.localResourceRoots ?? []).map((r) => r.fsPath);
  assert.ok(roots.includes('/ext'), `the extension's folder stays readable: ${roots.join(', ')}`);
  assert.ok(roots.includes('/roles/qa/roster/faces'));
  // a page that named its own roots keeps them, the faces' folder added once
  const own = { options: { localResourceRoots: [{ fsPath: '/ext/icons' }] }, asWebviewUri: webview.asWebviewUri };
  const u2 = webviewFaceUrl(own as never);
  u2('/f/a.webp'); u2('/f/b.webp');
  assert.deepEqual(own.options.localResourceRoots.map((r) => r.fsPath), ['/ext/icons', '/f']);
});

test('a click on a member opens the tech lead\'s conversation, a lead its own, the team its channel (spec 023: the chat lists the tech leads)', () => {
  const t = { techLead: 'arch', members: [{ id: 'arch', role: 'architect' }, { id: 'dev', role: 'developer' }] as never };
  assert.equal(chatChannel('core', 'dev', t), 'dm-core-arch');
  assert.equal(chatChannel('core', 'arch', t), 'dm-core-arch');
  assert.equal(chatChannel('core', '', t), 'core');
  // no lead named: the first Architect; the team not known: its channel
  assert.equal(chatChannel('core', 'dev', { techLead: null, members: t.members }), 'dm-core-arch');
  assert.equal(chatChannel('core', 'dev', undefined), 'core');
});

test("the wizard's draft carries the team's brain, method and instructions; a member that inherits names no model", () => {
  const base = { name: 'T', description: '', purpose: '', skills: [], budgetUsd: 5, lead: 0 };
  const members = [{ role: 'architect', kind: 'agent', provider: 'codex', model: '', inherits: true }, { role: 'qa', kind: 'api', provider: 'openai', model: 'gpt', inherits: false }];
  const d = draftOf({ ...base, members, brain: { kind: 'agent', provider: 'claude-code', model: 'opus' }, method: ' Kanban ', instructions: 'Small commits.' }) as { brain: unknown; method: string; instructions: string; members: Record<string, unknown>[] };
  assert.deepEqual(d.brain, { kind: 'agent', provider: 'claude-code', model: 'opus' });
  assert.deepEqual([d.method, d.instructions], ['Kanban', 'Small commits.']);
  assert.equal('provider' in d.members[0], false);
  assert.deepEqual([d.members[1].kind, d.members[1].provider, d.members[1].model], ['api', 'openai', 'gpt']);
  // no brain: every member as before, nothing new in the draft (Scrum, no instructions)
  const old = draftOf({ ...base, members }) as Record<string, unknown> & { members: Record<string, unknown>[] };
  assert.equal(old.members[0].provider, 'codex');
  assert.ok(!('brain' in old) && !('method' in old) && !('instructions' in old));
});

test("the team view sets the model for the whole team, each member says whether it inherits it, and a member can take it back", () => {
  const on: Record<string, (e: unknown) => void> = {};
  const el = { innerHTML: '', addEventListener: (k: string, f: (e: unknown) => void) => (on[k] = f), querySelector: () => null, querySelectorAll: () => [], contains: () => true, insertAdjacentHTML(_: string, h: string) { this.innerHTML += h; } };
  const sent: { type: string; [k: string]: unknown }[] = [];
  const window: { Squad?: { mount(el: unknown, post: (m: unknown) => void, o: unknown): void; receive(m: unknown): boolean } } = {};
  new Function('window', 'T', 't', 'document', 'matchMedia', SQUAD_SCRIPT)(window, {}, (k: string, ...a: unknown[]) => [k, ...a].join(' '), { activeElement: null }, () => ({ matches: true }));
  const squad = window.Squad!;
  squad.mount(el, (m) => sent.push(m as never), { company: false });
  const member = (id: string, role: string, x: Record<string, unknown>) => ({ id, role, skills: [], extraSkills: [], behaviour: {}, tasks: [], ...x });
  const team = { id: 't', name: 'T', techLead: 'arch', brain: { kind: 'agent', provider: 'claude-code', model: 'opus' }, method: '', methodText: 'Scrum. The backlog…', instructions: 'Be brief.', members: [member('arch', 'architect', { kind: 'api', provider: 'openai', model: 'gpt', inheritsBrain: false }), member('dev', 'developer', { kind: 'agent', provider: 'claude-code', model: 'opus', inheritsBrain: true })] };
  squad.receive({ type: 'team:state', teams: [{ id: 't', name: 'T' }], team, roster: {} });
  assert.ok(el.innerHTML.includes('sq.way.title') && el.innerHTML.includes('sq.way.brainOn 1 2'), 'the team view says how many inherit');
  assert.ok(el.innerHTML.includes('Scrum. The backlog…') && el.innerHTML.includes('Be brief.'));
  assert.ok(el.innerHTML.includes('sq.way.teamModel') && el.innerHTML.includes('sq.way.ownModel'));
  // none: each member keeps its own
  on.click({ target: { closest: () => ({ dataset: { tbkind: 'none' }, disabled: false }) } });
  assert.deepEqual(sent.at(-1), { type: 'team:update', id: 't', change: { noBrain: true } });
  squad.receive({ type: 'team:state', teams: [{ id: 't', name: 'T' }], team, roster: {} });
  // the lead's own brain back to the team's
  on.change({ target: { dataset: { f: 'brain' }, value: '__team__' } });
  assert.deepEqual(sent.at(-1), { type: 'team:memberUpdate', id: 't', member: 'arch', change: { teamBrain: true } });
  // a member who does not lead: its Talk asks the tech lead
  on.click({ target: { closest: () => ({ dataset: { member: 'dev' }, disabled: false }) } });
  assert.ok(el.innerHTML.includes('sq.chatLead'));
});

test('a bundled file missing in the extension is served from the kept copy, the extension\'s folder kept in the roots', () => {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'nuc-store-')), ext = fs.mkdtempSync(path.join(os.tmpdir(), 'nuc-ext-'));
  initAssets({ globalStorageUri: { fsPath: storage }, extension: { packageJSON: { version: '1.2.3' } } } as never);
  fs.mkdirSync(path.join(ext, 'out')); fs.writeFileSync(path.join(ext, 'out', 'builder-flow.js'), '');
  const cache = path.join(storage, 'assets', '1.2.3');
  fs.mkdirSync(path.join(cache, 'out'), { recursive: true }); fs.writeFileSync(path.join(cache, 'out', 'chat-embed.js'), '');
  const webview = { options: {} as { localResourceRoots?: { fsPath: string }[] }, asWebviewUri: (u: { fsPath: string }) => ({ toString: () => u.fsPath }) };
  // bundled: the extension's own, the roots untouched
  assert.equal(assetUrl(webview as never, { fsPath: ext } as never, 'out/builder-flow.js'), `${ext}/out/builder-flow.js`);
  assert.equal(webview.options.localResourceRoots, undefined);
  // missing in the extension: the kept copy, its folder added beside the default roots (the extension's folder)
  assert.equal(assetUrl(webview as never, { fsPath: ext } as never, 'out/chat-embed.js'), path.join(cache, 'out', 'chat-embed.js'));
  assert.deepEqual(webview.options.localResourceRoots!.map((r) => r.fsPath), ['/ext', cache]);
  assetUrl(webview as never, { fsPath: ext } as never, 'out/chat-embed.js');
  assert.equal(webview.options.localResourceRoots!.length, 2, 'added once');
});

// The run told to a product owner (spec 024 requirement 5): five business steps from the stations, each with its state
// and what it produced; an older engine's or a custom station is building; the tool calls are technical details.
test('the diagram\'s first level tells the run as five business steps with what each produced', () => {
  const st = (id: string, status: string, steps: object[] = []) => ({ id, title: id, about: '', actors: [], status, steps });
  const run = {
    spec: { criteria: ['lists characters', 'filters by status', 'opens one'] },
    stages: [
      st('analysis', 'passed'),
      st('design', 'passed', [{ id: 'd', status: 'passed', decisions: [{ what: 'SQLite', why: 'local' }, { what: 'REST', why: 'dashboard' }] }]),
      st('tests', 'passed', [{ id: 't', status: 'passed', files: ['test/a.nuc'] }]),
      st('code', 'running', [{ id: 'c', status: 'running', file: 'components/a.nuc', files: ['components/a.nuc', 'components/b.nuc'] }]),
      st('quality', 'pending', [{ id: 'q1', status: 'passed' }, { id: 'q2', status: 'pending' }]),
      st('delivery', 'pending'),
    ],
  } as unknown as Run;
  const s = storyOf(run);
  assert.deepEqual(s.map((b) => [b.id, b.state]), [['understand', 'done'], ['design', 'done'], ['build', 'working'], ['check', 'waiting'], ['deliver', 'waiting']]);
  assert.deepEqual(s.map((b) => [b.made.key.split('.').pop(), ...b.made.args]), [['criteria', 3], ['decisions', 2], ['files', 3], ['checks', 1, 2], ['pr']]);
  assert.deepEqual(s[2].stations.map((x) => x.id), ['tests', 'code']);
  // a question to the user and a failure win over the rest; every station skipped is not needed
  assert.equal(beatState([{ status: 'passed' }, { status: 'waiting' }] as never), 'needsYou');
  assert.equal(beatState([{ status: 'waiting' }, { status: 'failed' }] as never), 'failed');
  assert.equal(beatState([{ status: 'skipped' }] as never), 'skipped');
  assert.equal(beatState([]), 'waiting');
  assert.equal(beatOf('coder'), 'build');
  assert.equal(isToolCall({ kind: 'tool' }), true);
  assert.equal(isToolCall({}), false);
});

test('Nuclear Atlas opens again on the conversation it was on in each folder, never on one deleted', () => {
  let saved = withLast({}, '/w/pokemon', 'home');
  saved = withLast(saved, '/w/shop', 'dm-shop-arch');
  assert.equal(lastChannel(saved, '/w/pokemon', 'dm-atlas'), 'home');
  assert.equal(lastChannel(saved, '/w/new', 'dm-atlas'), 'dm-atlas', 'a folder never opened: Atlas');
  saved = withLast(saved, '/w/pokemon', 'general');
  assert.equal(lastChannel(saved, '/w/pokemon', 'dm-atlas'), 'general', 'the last one wins');
  assert.equal(withoutChannel(saved, '/w/pokemon', 'home'), saved, 'another conversation deleted: kept');
  saved = withoutChannel(saved, '/w/pokemon', 'general');
  assert.equal(lastChannel(saved, '/w/pokemon', 'dm-atlas'), 'dm-atlas');
  assert.equal(lastChannel(saved, '/w/shop', 'dm-atlas'), 'dm-shop-arch');
});

test('a run is drawn as its simple progress: the stations in a line, what waits for the user, and the spec it works on', async () => {
  const { html } = await import('../src/panel');
  // the extension's own folder: its page files are there (a missing one would be fetched from the release)
  const page = html({ cspSource: 'vscode-resource:', asWebviewUri: (u: { fsPath: string }) => u.fsPath } as never, { fsPath: path.join(__dirname, '..', '..') } as never);
  const scripts = [...page.matchAll(/<script nonce="[^"]*">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  for (const code of scripts) assert.doesNotThrow(() => new vm.Script(code), 'the page script parses');
  const all = scripts.join('\n');
  const body = all.slice(all.indexOf('function progress(r) {'), all.indexOf('\nfunction head(r) {'));
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const T: Record<string, string> = { 'station.analysis': 'Análisis', 'station.design': 'Diseño' };
  const t = (k: string, ...a: string[]) => k + (a.length ? ':' + a.join(',') : '');
  const progress = new Function('esc', 'av', 'nameOf', 'T', 't', 'W', 'failedStep', 'live', body + '; return progress;')(esc, () => '<i></i>', (a: string) => 'name-' + a, T, t, { stepTitle: (x: { title: string }) => x.title }, () => null, () => false) as (r: unknown) => string;
  const run = { id: 'r', status: 'waiting', specPath: 'specs/_global/r', spec: { title: 'PokeAPI', description: 'Calls PokeAPI', criteria: ['200 on each route', '404 when missing'] }, waiting: { question: 'Approve the Analysis?' },
    stages: [{ id: 'analysis', title: 'Analysis', role: 'analyst', status: 'waiting', steps: [{ title: 'Analyst: Analysis', status: 'passed', actor: 'analyst', summary: 'analysis.md' }] }, { id: 'design', title: 'Design', role: 'architect', status: 'pending', steps: [] }] };
  const out = progress(run);
  assert.ok(out.includes('class="pst st-waiting"') && out.includes('Análisis') && out.includes('name-analyst') && out.includes('class="pst st-pending"'), out);
  assert.ok(out.includes('Approve the Analysis?') && out.includes('data-act="showAsk"'), 'what waits for the user, with its button');
  assert.ok(out.includes('PokeAPI') && out.includes('<li>200 on each route</li>') && out.includes('specs/_global/r/spec.md'), 'the spec it works on');
});
