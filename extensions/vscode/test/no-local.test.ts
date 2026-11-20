// The local models are on standby (ADR-platform-0013): no setting the extension contributes, and nothing of the
// Settings and integrations page, names Ollama, a local model or profile, or the Nuclear Developer. The Smart Graph's
// own settings (its address, its command) stay. Old values of the removed settings: tools/nuclear-builder/test/compat.test.ts.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';
import { html as settingsHtml } from '../src/settingsPanel';
import { SETTINGS } from '../src/settingsL10n';
import { DEFAULT_CHAT } from '../../tools/nuclear-builder/src/settings';

const VSCODE = path.resolve(__dirname, '..', '..');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(VSCODE, f), 'utf8'));
const LOCAL = /ollama|local (model|agent|profile)|modelos? locales?|agentes? locales?|developer|contextTokens|\b(lite|medium|hard)\b|qwen|gemma|memory fit/i;

/** Every id and text a contributed setting shows, its `%key%` read in English and in Spanish. */
function settingTexts(): string[] {
  const en = read('package.nls.json') as Record<string, string>, es = read('package.nls.es.json') as Record<string, string>;
  const pkg = read('package.json') as { contributes: { configuration: { title?: string; properties: Record<string, unknown> }[] } };
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') out.push(v, ...(/^%(.+)%$/.test(v) ? [en[v.slice(1, -1)] ?? '', es[v.slice(1, -1)] ?? ''] : []));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => (out.push(k), walk(x)));
  };
  for (const section of pkg.contributes.configuration) {
    walk(section.title);
    for (const [id, p] of Object.entries(section.properties)) if (!id.startsWith('nuclear.codemetrics.')) (out.push(id), walk(p));
  }
  return out;
}

test('no contributed setting is about Ollama, a local model or the Nuclear Developer', () => {
  const bad = settingTexts().filter((s) => LOCAL.test(s));
  assert.deepEqual(bad, []);
  // the Smart Graph's settings are not the local models'
  assert.ok(settingTexts().includes('nuclear.ai.graphUrl'));
});

test('the Settings and integrations page and its texts name no local model', () => {
  assert.doesNotMatch(settingsHtml({ cspSource: 'vscode-resource:' } as never), LOCAL);
  for (const lang of ['en', 'es'] as const) for (const [k, v] of Object.entries(SETTINGS[lang])) assert.doesNotMatch(String(v), LOCAL, `${lang} ${k}`);
  assert.notEqual(DEFAULT_CHAT.kind, 'local' as never);
});
