// Spanish for every text the extension shows (spec 011, languages): the descriptions of package.json
// (package.nls.json against package.nls.es.json), every message of the host (an `l10n.t('…')` literal of src/ and of
// ../tools/*/src against l10n/bundle.l10n.es.json) and every page's dictionary (its `es` has every key of its `en`).
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';
import { LANGUAGE } from '../src/i18n';
import { WELCOME } from '../src/welcomeL10n';
import { SETTINGS } from '../src/settingsL10n';
import { SETUP } from '../src/setupL10n';
import { STRIP } from '../src/workspaceL10n';
import { TC_TEXTS } from '../src/toolchainHost';
import { RUN_TEXTS, WHY_TEXTS } from '../src/chatHost';
import { ATLAS } from '../../tools/nuclear-atlas/src/l10n';
import { TEMPLATES } from '../../tools/nuclear-atlas/src/chat';
import { BUILDER } from '../../tools/nuclear-builder/src/l10n';
import { SQUAD } from '../../tools/nuclear-builder/src/teams/l10n';
import { REPORTS } from '../../tools/nuclear-builder/src/reports/l10n';
import { MOBILE_DEVICE, WEB_DEVICE } from '../../tools/nuclear-device-manager/src/l10n';
import { ENV } from '../../tools/nuclear-environments/src/l10n';
import { HTTP, WS } from '../../tools/nuclear-http-connections/src/l10n';
import { TEXTS as MONITOR } from '../../tools/nuclear-monitor/src/monitor';

// the bundle runs from extensions/vscode/out/test; the sources are read where they are
const VSCODE = path.resolve(__dirname, '..', '..');
const EXTENSIONS = path.dirname(VSCODE);
const json = (f: string) => JSON.parse(fs.readFileSync(path.join(VSCODE, f), 'utf8')) as Record<string, string>;
const sources = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));
const ALL = [path.join(VSCODE, 'src'), ...fs.readdirSync(path.join(EXTENSIONS, 'tools')).map((t) => path.join(EXTENSIONS, 'tools', t, 'src')).filter((d) => fs.existsSync(d))].flatMap(sources);
const rel = (f: string) => path.relative(EXTENSIONS, f);

/** A quoted literal of the source as the string it is. */
const unquote = (lit: string) => JSON.parse('"' + lit.slice(1, -1).replace(/\\'/g, "'").replace(/(?<!\\)"/g, '\\"') + '"') as string;
const LITERAL = String.raw`('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")`;

test('every description of package.json has its Spanish (package.nls.es.json)', () => {
  const en = json('package.nls.json'), es = json('package.nls.es.json');
  const missing = Object.keys(en).filter((k) => !es[k]?.trim());
  assert.deepEqual(missing, [], 'keys without Spanish');
  assert.deepEqual(Object.keys(es).filter((k) => !(k in en)), [], 'Spanish keys that no longer exist');
  // every text package.json contributes is a key, never English written in place (the themes' names excepted)
  const pkg = fs.readFileSync(path.join(VSCODE, 'package.json'), 'utf8');
  for (const m of pkg.matchAll(/"%([^%"]+)%"/g)) assert.ok(m[1] in en, `package.json names %${m[1]}% and package.nls.json has no such key`);
});

test("every l10n.t('…') of the host has its Spanish (l10n/bundle.l10n.es.json)", () => {
  const es = json('l10n/bundle.l10n.es.json');
  const missing: string[] = [];
  let seen = 0;
  for (const file of ALL) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(new RegExp(String.raw`\bl10n\.t\(\s*` + LITERAL, 'g'))) {
      seen++;
      if (!es[unquote(m[1])]) missing.push(`${rel(file)}: ${unquote(m[1])}`);
    }
    // a backend script's detail is given to l10n.t by scripts.ts
    if (file.endsWith('backendScripts.ts'))
      for (const m of src.matchAll(new RegExp(String.raw`detail:\s*` + LITERAL, 'g'))) if (!es[unquote(m[1])]) missing.push(`${rel(file)}: ${unquote(m[1])}`);
  }
  assert.ok(seen > 200, `only ${seen} l10n.t literals found: the scan is broken`);
  assert.deepEqual(missing, []);
});

/** Every key of `en` (nested objects included) has a non-empty Spanish, unless the English is empty too. */
function missingIn(en: unknown, es: unknown, at = ''): string[] {
  if (typeof en === 'string') return en === '' || (typeof es === 'string' && es.trim()) ? [] : [at];
  if (Array.isArray(en)) return Array.isArray(es) && es.length === en.length ? [] : [at];
  if (en && typeof en === 'object') {
    const e = (es ?? {}) as Record<string, unknown>;
    return Object.entries(en as Record<string, unknown>).flatMap(([k, v]) => missingIn(v, e[k], at ? `${at}.${k}` : k));
  }
  return [];
}

const DICTIONARIES: Record<string, { en: unknown; es: unknown }> = {
  LANGUAGE, WELCOME, SETTINGS, SETUP, STRIP, TC_TEXTS, RUN_TEXTS, WHY_TEXTS, ATLAS, TEMPLATES, BUILDER, SQUAD, REPORTS, MOBILE_DEVICE, WEB_DEVICE, ENV, HTTP, WS, MONITOR,
};

test("every page's dictionary has every key in Spanish", () => {
  for (const [name, d] of Object.entries(DICTIONARIES)) {
    assert.deepEqual(missingIn(d.en, d.es), [], `${name}: keys without Spanish`);
    assert.deepEqual(Object.keys(d.es as object).filter((k) => !(k in (d.en as object))), [], `${name}: Spanish keys that English does not have`);
  }
});

test('no dictionary of a page is left out of this test', () => {
  // a file with a dictionary (`dictionary({` or an `es: {` beside an `en: {`) is one of those imported above
  const known = ['i18n.ts', 'welcomeL10n.ts', 'settingsL10n.ts', 'setupL10n.ts', 'workspaceL10n.ts', 'toolchainHost.ts', 'chatHost.ts', 'nuclear-atlas/src/l10n.ts', 'nuclear-atlas/src/chat.ts', 'nuclear-builder/src/l10n.ts', 'nuclear-builder/src/teams/l10n.ts', 'nuclear-builder/src/reports/l10n.ts', 'nuclear-device-manager/src/l10n.ts', 'nuclear-environments/src/l10n.ts', 'nuclear-http-connections/src/l10n.ts', 'nuclear-monitor/src/monitor.ts'];
  const withDictionary = ALL.filter((f) => /\bdictionary\(\{|^\s*es: \{|[{,]\s*es: \{/m.test(fs.readFileSync(f, 'utf8')));
  const unknown = withDictionary.filter((f) => !known.some((k) => f.endsWith(path.sep + k.split('/').join(path.sep))));
  assert.deepEqual(unknown.map(rel), [], 'add these dictionaries to DICTIONARIES above');
});
