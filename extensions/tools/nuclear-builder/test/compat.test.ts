// Backward compatibility on the editors' side (extensions/docs/06-runbooks/release.md "Backward compatibility"): what
// an earlier version left, kept as it was under the fixtures, read by today's code: the run files of earlier engines
// drawn by the page (the accordion, the log, a step's tree, its title in Spanish), the settings under the ids that
// moved, the saved projects of before 0.63.0 (one list for every folder), and the local models of before
// ADR-platform-0013 (a local chat converted, no page offering them). The engine's side is
// tests/test_compat.nuc.
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import * as vscode from 'vscode';
import { MOVED, migrateSettings } from '../../../vscode/src/migrateSettings';
import { savedInside } from '../../../vscode/src/savedProjects';
import { runOutline, RunLite, specTree, stepTitle, stepTree, teamLog } from '../src/workbench';
import { BUILDER } from '../src/l10n';
import { SetupPanel, html as setupHtml } from '../../../vscode/src/setupPanel';
import { html as settingsHtml } from '../../../vscode/src/settingsPanel';
import { SETUP } from '../../../vscode/src/setupL10n';
import { SETTINGS } from '../../../vscode/src/settingsL10n';
import { chatProvider, DEFAULT_CHAT } from '../src/settings';
import { SQUAD_SCRIPT } from '../src/teams/page';

// the bundle runs from extensions/vscode/out/test; the fixtures are read from the sources
const EXTENSIONS = path.resolve(__dirname, '..', '..', '..');
const RUNS = path.join(EXTENSIONS, 'tools', 'nuclear-builder', 'tests', 'fixtures', 'compat', 'runs');
const EDITOR = path.join(EXTENSIONS, 'vscode', 'test', 'fixtures', 'compat');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const stub = vscode as unknown as { store: Record<string, Record<string, unknown>>; answers: (string | undefined)[]; asked: { message: string; items: string[] }[]; panels: { id: string; webview: { html: string } }[] };

for (const name of ['engine2', 'engine3-no-team', 'engine3-no-keys']) {
  test(`a run file of ${name} is drawn by the page, each step titled in English where it has no key`, () => {
    const run = read(path.join(RUNS, name + '.json')) as RunLite & { stages: { steps: { title: string; key?: string; args?: string[] }[] }[] };
    const outline = runOutline(run);
    assert.equal(outline.total, run.stages.length);
    assert.deepEqual(outline.stations.map((s) => s.id), run.stages.map((s) => s.id));
    assert.ok(outline.stations.every((s) => s.steps.every((x) => typeof x.title === 'string' && x.title.length > 0)));
    assert.ok(teamLog(run).length > 0);
    const T = { ...BUILDER.en, ...BUILDER.es } as Record<string, string>;
    for (const st of run.stages)
      for (const x of st.steps) {
        // the tree of every step opens
        assert.ok(Array.isArray(stepTree(x as never)));
        // an old step has no key: its English title; a key the screens know says it in Spanish
        if (!x.key) assert.equal(stepTitle(x, T), x.title);
      }
    // a run without `specPath` is the flat spec of its id
    const tree = specTree([], [run]);
    assert.equal(tree[0].component, '');
    assert.equal(tree[0].specs[0].path, 'specs/' + run.id);
  });
}

test('every setting of an earlier version under a moved id reaches its new id at its level, none lost', async () => {
  for (const l of Object.values(stub.store)) for (const k of Object.keys(l)) delete l[k];
  const before = read(path.join(EDITOR, 'settings-0.57.json')) as Record<string, Record<string, unknown>>;
  for (const [level, values] of Object.entries(before)) Object.assign(stub.store[level], values);
  // the fixture holds every id that moved, and one removed since (Atlas's former meter): ignored, never moved
  assert.deepEqual(Object.keys(before.globalValue).sort(), [...Object.keys(MOVED), 'nuclear.ai.contextTokens'].sort());
  // one folder open: its own level too
  (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [{ uri: { fsPath: '/home/someone/app' } }];
  await migrateSettings();
  (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = undefined;
  for (const [level, values] of Object.entries(before))
    for (const [from, value] of Object.entries(values)) {
      if (!(from in MOVED)) {
        assert.equal(stub.store[level][from], value, `${level} ${from} left as it was`);
        continue;
      }
      assert.equal(stub.store[level][MOVED[from]], value, `${level} ${from}`);
      assert.equal(from in stub.store[level], false, `${level} ${from} removed`);
    }
});

test('the projects saved for every folder before 0.63.0 go to the folder they are in', () => {
  const saved = read(path.join(EDITOR, 'global-state-0.62.json'))['nuclear.workspace.projects'] as string[];
  assert.deepEqual(savedInside(saved, ['/home/someone/work/shop-workspace']), ['/home/someone/work/shop-workspace/backend', '/home/someone/work/shop-workspace/app']);
  assert.deepEqual(savedInside(saved, ['/home/someone/work/other']), ['/home/someone/work/other/api']);
  assert.deepEqual(savedInside(saved, ['/home/someone/nothing']), []);
});

test('the welcome of an earlier version: offered while never finished, opened from the offer, never asked again once declined or done', async () => {
  const states = read(path.join(EDITOR, 'global-state-onboarding.json')) as Record<string, Record<string, unknown>>;
  for (const [version, state] of Object.entries(states)) {
    stub.asked.length = 0;
    stub.panels.length = 0;
    const kept = { ...state };
    const context = { globalState: { get: (k: string) => kept[k], update: async (k: string, v: unknown) => void (kept[k] = v) }, subscriptions: [] as unknown[], extensionUri: { fsPath: '/ext' } };
    stub.answers.push('Start');
    await SetupPanel.offer(context as never);
    const offered = !state['nuclear.onboarding.done'] && !state['nuclear.ai.setup.declined'];
    assert.equal(stub.asked.length, offered ? 1 : 0, version);
    if (!offered) {
      stub.answers.length = 0;
      continue;
    }
    // the offer's *Start* opens the welcome at its first step (a page kept by an earlier version is held to today's)
    assert.equal(stub.panels.length, 1, version);
    const page = stub.panels[0].webview.html;
    assert.ok(page.includes("const PAGES = ['machine'") && page.includes('Math.min(PAGES.length - 1'), version);
  }
});

test('the local models of an earlier version (ADR-platform-0013): a local chat goes to the default external agent, told once; the old local settings are ignored', async () => {
  for (const l of Object.values(stub.store)) for (const k of Object.keys(l)) delete l[k];
  const before = read(path.join(EDITOR, 'settings-0.82-local.json')) as Record<string, Record<string, unknown>>;
  for (const [level, values] of Object.entries(before)) Object.assign(stub.store[level], values);
  stub.asked.length = 0;
  (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [{ uri: { fsPath: '/home/someone/app' } }];
  const converted = await migrateSettings();
  (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = undefined;
  assert.deepEqual(converted, ['globalValue', 'workspaceFolderValue']);
  assert.equal('nuclear.builder.chat' in stub.store.globalValue, false);
  assert.equal('nuclear.builder.chat' in stub.store.workspaceFolderValue, false);
  // an external choice is the user's: kept
  assert.deepEqual(stub.store.workspaceValue['nuclear.builder.chat'], before.workspaceValue['nuclear.builder.chat']);
  assert.equal(stub.asked.length, 1);
  assert.match(stub.asked[0].message, /on standby/);
  // read as the default external agent even before the migration ran
  assert.deepEqual(chatProvider(before.globalValue['nuclear.builder.chat']), DEFAULT_CHAT);
  assert.notEqual(DEFAULT_CHAT.kind, 'local' as never);
  // the settings that only served the local models are no longer declared
  const pkg = read(path.join(EXTENSIONS, 'vscode', 'package.json')) as { contributes: { configuration: { properties: Record<string, { default?: { kind?: string }; properties?: { kind?: { enum?: string[] } } }> }[] } };
  const props = Object.assign({}, ...pkg.contributes.configuration.map((c) => c.properties));
  for (const k of ['nuclear.ai.developerUrl', 'nuclear.ai.ollamaUrl', 'nuclear.ai.models.coder', 'nuclear.ai.models.assistant', 'nuclear.ai.watch.stallSeconds', 'nuclear.ai.contextTokens', 'nuclear.atlas.contextTokens']) assert.equal(k in props, false, k);
  assert.equal(props['nuclear.builder.chat'].default?.kind, 'agent');
  assert.equal(props['nuclear.builder.chat'].properties?.kind?.enum?.includes('local'), false);
});

test('no page of the editor offers a local model, a profile to choose, Ollama or the Nuclear Developer (ADR-platform-0013)', () => {
  const web = { cspSource: 'vscode-resource:' } as never;
  // the squad screen mounted in the welcome, with its texts, is the Builder's (editors.test.ts holds its local kind to
  // OpenCode on Ollama's models); it still names the Nuclear Developer of an older member, only to say it was converted
  const welcome = setupHtml(web).replace(SQUAD_SCRIPT, '').replace(/"sq\.[^"]+":"(?:[^"\\]|\\.)*",?/g, '');
  for (const [name, page] of [['the welcome', welcome], ['Settings and integrations', settingsHtml(web)]] as const) {
    for (const word of [/ollama/i, /Nuclear Developer/, /data-profile/, /data-local/, /data-pull/, /'lite'|'medium'|'hard'/, /nuclear-developer/, /localModels/, /3B/])
      assert.doesNotMatch(page, word, `${name}: ${word}`);
  }
  assert.match(setupHtml(web), /const PAGES = \['machine', 'requirements', 'install'/);
  // the texts of the welcome and of the settings say nothing of local models either
  for (const dict of [SETUP, SETTINGS]) for (const lang of ['en', 'es'] as const) for (const [k, v] of Object.entries(dict[lang])) assert.doesNotMatch(String(v), /Ollama|Nuclear Developer|3B|agentes? locales?|local agents?/i, `${lang} ${k}`);
});

test('every step of the remote set-up, and standby first on an older installation, has its title in English and Spanish', () => {
  const ids = ['standby', 'graph', 'clients', 'graph-model', 'graph-service', 'knowledge', 'chat-service'];
  for (const lang of ['en', 'es'] as const) for (const id of ids) assert.ok((SETUP[lang] as Record<string, string>)['setupStep.' + id], `${lang} ${id}`);
  assert.equal(SETUP.en['setupStep.standby'], 'Removing the local models (on standby)');
  assert.equal(SETUP.es['setupStep.standby'], 'Quitando los modelos locales (en standby)');
  // the page's own stepTitle, run as the page runs it
  const page = setupHtml({ cspSource: 'vscode-resource:' } as never);
  const code = page.slice(page.indexOf('function stepTitle('), page.indexOf('function providersPage('));
  const fmt = (s: string, a: string[]) => s.replace(/\{(\d+)\}/g, (_, i) => a[+i] ?? '');
  for (const lang of ['en', 'es'] as const) {
    const T = SETUP[lang] as Record<string, string>;
    const said = (prefix: string, key: string, args: string[], english: string) => (key && T[prefix + key] ? fmt(T[prefix + key], args) : english);
    const stepTitle = new Function('said', code + '; return stepTitle;')(said) as (run: { ids: string[]; models: string }, i: number, english: string) => string;
    const run = { ids, models: '' };
    const titles = ids.map((id, i) => stepTitle(run, i, id === 'graph-model' ? "Download the Smart Graph's model (EmbeddingGemma, 0.3 GB)" : 'english ' + id));
    assert.deepEqual(titles, ids.map((id) => fmt(T['setupStep.' + id], id === 'graph-model' ? ['EmbeddingGemma, 0.3 GB'] : [])), lang);
  }
});
