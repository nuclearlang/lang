// The settings of a tool's section as a form, drawn from what `package.json` contributes (spec 011, settings by
// component): the same sections, the same descriptions (in the editor's language, from package.nls*.json), the same
// values as VS Code's settings. Settings and integrations and the onboarding draw them with FORM_JS; the host
// checks and writes what the page sends (`applySetting`).
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { autoResolved, lang, l10n } from './i18n';
import { PROVIDERS } from '../../tools/nuclear-builder/src/teams/cli';

export interface SettingItem {
  key: string;
  /** `assignment`: who does a piece of work (`{ kind, provider, model }`, as a role of a team): `nuclear.builder.chat`. */
  type: 'boolean' | 'number' | 'string' | 'assignment';
  description: string;
  value: unknown;
  enum?: string[];
  enumLabels?: string[];
  minimum?: number;
  maximum?: number;
  /** An assignment's choices: the providers of each kind, its kinds' names. */
  choices?: { kind: string; label: string; providers: { id: string; name: string }[] }[];
}

export interface SettingSection {
  id: string;
  title: string;
  items: SettingItem[];
}

interface Contributed {
  id?: string;
  title: string;
  properties: Record<string, { type?: string; description?: string; markdownDescription?: string; enum?: string[]; enumDescriptions?: string[]; minimum?: number; maximum?: number; properties?: Record<string, unknown> }>;
}

let nlsCache: { lang: string; texts: Record<string, string> } | undefined;
function nls(root: string): Record<string, string> {
  const l = lang();
  if (nlsCache?.lang === l) return nlsCache.texts;
  const read = (f: string) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')) as Record<string, string>;
    } catch {
      return {};
    }
  };
  nlsCache = { lang: l, texts: { ...read('package.nls.json'), ...(l === 'es' ? read('package.nls.es.json') : {}) } };
  return nlsCache.texts;
}

/** The sections of the tools, with their values now (the code metrics' stay in VS Code's own settings). */
export function settingSections(context: vscode.ExtensionContext): SettingSection[] {
  const texts = nls(context.extensionPath);
  const say = (s: string | undefined) => (s ?? '').replace(/^%(.+)%$/, (_, k: string) => texts[k] ?? k).replace(/`/g, '');
  const contributed = (context.extension.packageJSON as { contributes: { configuration: Contributed[] } }).contributes.configuration;
  const c = vscode.workspace.getConfiguration();
  return contributed
    .filter((s) => s.id && s.id !== 'codemetrics')
    .map((s) => ({
      id: s.id!,
      title: say(s.title),
      items: Object.entries(s.properties)
        .filter(([, p]) => p.type === 'boolean' || p.type === 'number' || p.type === 'string' || isAssignment(p))
        .map(([key, p]) => ({
          key,
          type: isAssignment(p) ? ('assignment' as const) : (p.type as SettingItem['type']),
          ...(isAssignment(p) ? { choices: CHOICES() } : {}),
          description: say(p.description ?? p.markdownDescription),
          value: c.get(key),
          enum: p.enum,
          // the language's Automatic says what it resolves to here
          enumLabels: p.enumDescriptions?.map((d, k) => say(d) + (key === 'nuclear.language' && p.enum?.[k] === 'auto' ? ' → ' + autoResolved() : '')),
          minimum: p.minimum,
          maximum: p.maximum,
        })),
    }));
}

const isAssignment = (p: { type?: string; properties?: Record<string, unknown> }) => p.type === 'object' && !!p.properties?.kind && !!p.properties?.provider;
const NAMES: Record<string, string> = { 'nuclear-developer': 'Nuclear Developer', 'claude-code': 'Claude Code', codex: 'Codex', 'gemini-cli': 'Gemini CLI', opencode: 'OpenCode', anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', openrouter: 'OpenRouter' };
const CHOICES = () => (Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).map((kind) => ({
  kind,
  label: kind === 'local' ? l10n.t('The local agents (free)') : kind === 'agent' ? l10n.t("A provider's agent (its own login)") : l10n.t("A provider's model through an API (a key in the vault)"),
  providers: PROVIDERS[kind].map((id) => ({ id, name: NAMES[id] ?? id })),
}));

/** An assignment the page sent: a kind, one of its providers, a model's name; nothing else. */
function validAssignment(v: unknown): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const x = v as Record<string, unknown>;
  const kind = x.kind as keyof typeof PROVIDERS;
  return Object.keys(x).every((k) => ['kind', 'provider', 'model'].includes(k)) && kind in PROVIDERS && (PROVIDERS[kind] as readonly string[]).includes(String(x.provider))
    && (x.model === undefined || (typeof x.model === 'string' && x.model.length <= 200));
}

/** Writes a setting the page sent (user level), once it is checked against its section: the page is a trust boundary. */
export async function applySetting(context: vscode.ExtensionContext, key: string, value: unknown): Promise<void> {
  const item = settingSections(context).flatMap((s) => s.items).find((i) => i.key === key);
  if (!item) throw new Error(`not a setting of the tools: ${key}`);
  const ok = item.type === 'boolean' ? typeof value === 'boolean'
    : item.type === 'assignment' ? validAssignment(value)
    : item.type === 'number' ? typeof value === 'number' && Number.isFinite(value) && (item.minimum === undefined || value >= item.minimum) && (item.maximum === undefined || value <= item.maximum)
    : typeof value === 'string' && (!item.enum || item.enum.includes(value));
  if (!ok) throw new Error(l10n.t('{0} is not a valid value of {1}', JSON.stringify(value), key));
  await vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Global);
}

/** The page's side: `settingsForm(section, skip)` draws a section's settings as rows (the change posts
 * `{ type: 'setSetting', key, value }`). Needs the page's `esc`. */
export const FORM_JS = String.raw`
function settingsForm(section, skip) {
  const row = (i) => {
    const name = i.key.split('.').slice(2).join('.') || i.key;
    const label = '<label class="sf-l"><b>' + esc(name) + '</b><code>' + esc(i.key) + '</code><div class="sf-d">' + esc(i.description) + '</div></label>';
    const input = i.type === 'assignment' ? assignmentInput(i)
      : i.type === 'boolean' ? '<label class="sf-sw"><input type="checkbox" data-setting="' + esc(i.key) + '" data-t="boolean"' + (i.value ? ' checked' : '') + ' aria-label="' + esc(i.key) + '"><span></span></label>'
      : i.enum ? '<select data-setting="' + esc(i.key) + '" data-t="string">' + i.enum.map((v, k) => '<option value="' + esc(v) + '"' + (v === i.value ? ' selected' : '') + '>' + esc(v) + (i.enumLabels?.[k] ? ' · ' + esc(i.enumLabels[k]) : '') + '</option>').join('') + '</select>'
      : '<input data-setting="' + esc(i.key) + '" data-t="' + i.type + '" type="' + (i.type === 'number' ? 'number' : 'text') + '"' + (i.minimum !== undefined ? ' min="' + i.minimum + '"' : '') + (i.maximum !== undefined ? ' max="' + i.maximum + '"' : '') + ' value="' + esc(i.value ?? '') + '">';
    return '<div class="sf-row">' + label + '<div class="sf-i">' + input + '</div></div>';
  };
  return '<div class="sf">' + section.items.filter((i) => !(skip || []).includes(i.key)).map(row).join('') + '</div>';
}
/** Who does a piece of work: the provider (by kind) and its model, posted together. */
function assignmentInput(i) {
  const v = i.value || {};
  return '<span class="sf-as" data-assign="' + esc(i.key) + '"><select data-as="who" aria-label="' + esc(i.key) + '">' + (i.choices || []).map((c) => '<optgroup label="' + esc(c.label) + '">' + c.providers.map((p) => '<option value="' + esc(c.kind + ':' + p.id) + '"' + (v.kind === c.kind && v.provider === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</optgroup>').join('') + '</select>'
    + '<input data-as="model" type="text" placeholder="model" value="' + esc(v.model || '') + '" aria-label="' + esc(i.key + '.model') + '"></span>';
}
document.addEventListener('change', (e) => {
  const as = e.target.closest && e.target.closest('[data-assign]');
  if (as) {
    const [kind, provider] = as.querySelector('[data-as=who]').value.split(':');
    return vscode.postMessage({ type: 'setSetting', key: as.dataset.assign, value: { kind, provider, model: as.querySelector('[data-as=model]').value.trim() } });
  }
  const k = e.target.dataset?.setting; if (!k) return;
  const ty = e.target.dataset.t;
  const value = ty === 'boolean' ? e.target.checked : ty === 'number' ? Number(e.target.value) : e.target.value;
  if (ty === 'number' && (e.target.value === '' || !Number.isFinite(value))) return;
  vscode.postMessage({ type: 'setSetting', key: k, value });
});
`;

export const FORM_CSS = `
.sf { display: grid; gap: 2px; }
.sf-row { display: grid; grid-template-columns: 1fr 220px; gap: 16px; align-items: center; padding: 9px 4px; border-bottom: 1px solid var(--vscode-panel-border, #8883); }
.sf-l b { font-weight: 600; } .sf-l code { margin-left: 8px; font-size: 11px; opacity: .55; } .sf-d { font-size: 12px; opacity: .75; margin-top: 2px; }
.sf-as { display: grid; grid-template-columns: 1fr 110px; gap: 6px; width: 100%; }
.sf-i { justify-self: end; width: 100%; display: flex; justify-content: flex-end; } .sf-i input:not([type=checkbox]), .sf-i select { width: 100%; }
.sf-sw { position: relative; width: 36px; height: 20px; } .sf-sw input { opacity: 0; width: 0; height: 0; position: absolute; }
.sf-sw span { position: absolute; inset: 0; border-radius: 10px; background: #8885; cursor: pointer; transition: background .2s; }
.sf-sw span::after { content: ''; position: absolute; left: 2px; top: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .2s; }
.sf-sw input:checked + span { background: var(--vscode-button-background, #4f6bed); } .sf-sw input:checked + span::after { transform: translateX(16px); }
.sf-sw input:focus-visible + span { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
`;
