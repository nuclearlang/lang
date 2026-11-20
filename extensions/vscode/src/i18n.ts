// The languages of what the extension shows: English (the source and the fallback) and Spanish, chosen by the setting
// `nuclear.language` (language.ts decides; the globe of every page and of the status bar changes it). `package.json`'s
// texts are `package.nls*.json` and follow VS Code's own language (VS Code does not let an extension change them);
// the host's are `l10n.t` here, with `l10n/bundle.l10n.es.json`; each page has one dictionary (`en` and `es`, the same
// keys, checked by the compiler) that the host gives the page in the chosen language. A change re-renders every open
// page (`localize`) without a restart.
import * as vscode from 'vscode';
import ES from '../l10n/bundle.l10n.es.json';
import { forgetWebview, withUpdateButton } from './updateCheck';
import { Lang, LangSetting, LangState, osLocale, resolveLang, translate } from './language';

export type { Lang } from './language';

/** The chosen language now, and why. */
export function langState(): LangState {
  return resolveLang(vscode.workspace.getConfiguration('nuclear').get<string>('language', 'auto'), vscode.env.language, osLocale());
}

/** The language of every text the extension shows. */
export function lang(): Lang {
  return langState().lang;
}

const listeners = new Set<(l: Lang) => void>();
/** Fired when `nuclear.language` changes what is shown. */
export function onDidChangeLang(f: (l: Lang) => void): { dispose(): void } {
  listeners.add(f);
  return { dispose: () => void listeners.delete(f) };
}

/** A host message in the chosen language (`vscode.l10n.t` follows only VS Code's): English is the key. */
export const l10n = { t: (message: string, ...args: (string | number | boolean)[]): string => translate(ES as Record<string, string>, lang(), message, args) };

/** Writes the setting (user level). */
export async function setLanguage(v: unknown): Promise<void> {
  if (v !== 'auto' && v !== 'en' && v !== 'es') return;
  await vscode.workspace.getConfiguration('nuclear').update('language', v, vscode.ConfigurationTarget.Global);
}

/** The status bar's globe, the command `nuclear.chooseLanguage` (an argument `auto|en|es` sets it without asking, for
 * the agents) and the event every page listens to. */
export function registerLanguage(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem('nuclear.language', vscode.StatusBarAlignment.Right, 90);
  item.name = 'Nuclear: language';
  item.command = 'nuclear.chooseLanguage';
  const draw = () => {
    const s = langState();
    item.text = `$(globe) ${s.setting === 'auto' ? 'Auto' : s.lang.toUpperCase()}`;
    item.tooltip = menuTexts().title + ': ' + autoLabel(s);
  };
  draw();
  item.show();
  context.subscriptions.push(
    item,
    vscode.commands.registerCommand('nuclear.chooseLanguage', async (value?: LangSetting) => {
      if (value) return setLanguage(value);
      const s = langState(), L = menuTexts();
      const items = [
        { label: L.auto, value: 'auto' as const, description: autoLabel(resolveLang('auto', vscode.env.language, osLocale())) },
        { label: 'English', value: 'en' as const },
        { label: 'Español', value: 'es' as const },
      ].map((i) => ({ ...i, label: (i.value === s.setting ? '$(check) ' : '') + i.label }));
      const pick = await vscode.window.showQuickPick(items, { title: L.title, placeHolder: L.note });
      if (pick) await setLanguage(pick.value);
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('nuclear.language')) return;
      draw();
      const l = lang();
      for (const f of [...listeners]) f(l);
    }),
  );
}

/** A page's HTML, set now and again whenever the language changes (then `again` gives a page without a `ready` of its
 * own what it showed); its globe's choice is written here. */
export function localize(webview: vscode.Webview, render: () => string, again?: () => void): { dispose(): void } {
  const page = () => withUpdateButton(webview, render());
  webview.html = page();
  const subs = [
    { dispose: () => forgetWebview(webview) },
    onDidChangeLang(() => ((webview.html = page()), again?.())),
    webview.onDidReceiveMessage((m: { type?: string; value?: unknown }) => void (m?.type === 'lang:set' && setLanguage(m.value))),
  ];
  return { dispose: () => subs.forEach((s) => s.dispose()) };
}

/** The language menu's own texts (the pages merge them into their `T`). */
export const LANGUAGE = dictionary({
  en: {
    'lang.title': 'Language',
    'lang.auto': 'Automatic',
    'lang.from.editor': 'from the editor',
    'lang.from.os': 'from the operating system',
    'lang.from.default': 'the default',
    'lang.from.setting': 'chosen',
    'lang.note': "Command titles and setting descriptions follow VS Code's own language.",
  },
  es: {
    'lang.title': 'Idioma',
    'lang.auto': 'Automático',
    'lang.from.editor': 'del editor',
    'lang.from.os': 'del sistema operativo',
    'lang.from.default': 'el predeterminado',
    'lang.from.setting': 'elegido',
    'lang.note': 'Los títulos de los comandos y las descripciones de los ajustes siguen el idioma de VS Code.',
  },
});
const NAMES: Record<Lang, string> = { en: 'English', es: 'Español' };
const menuTexts = () => {
  const T = texts(LANGUAGE);
  return { title: T['lang.title'], auto: T['lang.auto'], note: T['lang.note'], from: T };
};
/** `Español (from the editor)`: what `auto` resolves to, and why. */
const autoLabel = (s: LangState) => `${NAMES[s.lang]} (${menuTexts().from[`lang.from.${s.source}` as keyof typeof LANGUAGE.en]})`;
/** What `auto` resolves to here: `Español (from the editor)`. */
export const autoResolved = (): string => autoLabel(resolveLang('auto', vscode.env.language, osLocale()));

/** A page's dictionary: the Spanish must have every key of the English, and no other. */
export function dictionary<K extends string>(d: { en: Record<K, string>; es: Record<K, string> }): { en: Record<K, string>; es: Record<K, string> } {
  return d;
}

/** The texts of a page in `l`. */
export function texts<K extends string>(d: { en: Record<K, string>; es: Record<K, string> }, l: Lang = lang()): Record<K, string> {
  return l === 'es' ? { ...d.en, ...d.es } : d.en;
}

const GLOBE = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13M8 1.5c2 2 2.8 4.2 2.8 6.5S10 12.5 8 14.5M8 1.5C6 3.5 5.2 5.7 5.2 8S6 12.5 8 14.5"/></svg>';
/** The globe of a page's header (its menu is wired by `pageI18n`). */
export function langButton(l: Lang = lang()): string {
  const title = texts(LANGUAGE, l)['lang.title'];
  return `<button type="button" class="nuc-lang" data-nuc-lang title="${title}" aria-label="${title}" aria-haspopup="menu">${GLOBE}<span>${l.toUpperCase()}</span></button>`;
}

const LANG_CSS = `.nuc-lang { margin-left: auto; flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 4px; cursor: pointer; font: inherit; font-size: 12px; color: var(--vscode-foreground); background: transparent; border: 1px solid var(--vscode-panel-border, #8885); }
.nuc-lang:hover { background: var(--vscode-toolbar-hoverBackground, #8883); } .nuc-lang:focus-visible { outline: 1px solid var(--vscode-focusBorder); }
.nuc-lang-menu { position: fixed; z-index: 1000; min-width: 230px; max-width: 300px; padding: 4px; border-radius: 6px; background: var(--vscode-menu-background, var(--vscode-editorWidget-background, #252526)); color: var(--vscode-menu-foreground, var(--vscode-foreground)); border: 1px solid var(--vscode-menu-border, var(--vscode-widget-border, #8886)); box-shadow: 0 4px 16px #0006; font-size: 13px; }
.nuc-lang-menu button { display: grid; grid-template-columns: 16px 1fr; gap: 6px; width: 100%; text-align: left; padding: 6px 8px; border: none; border-radius: 4px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.nuc-lang-menu button:hover, .nuc-lang-menu button:focus-visible { background: var(--vscode-menu-selectionBackground, var(--vscode-list-activeSelectionBackground, #04395e)); color: var(--vscode-menu-selectionForeground, inherit); outline: none; }
.nuc-lang-menu small { display: block; opacity: .7; } .nuc-lang-menu .note { padding: 6px 8px 4px; margin-top: 4px; border-top: 1px solid var(--vscode-menu-separatorBackground, #8884); font-size: 11px; opacity: .7; }`;

/** The page's side: `LANG`, `T` (its texts), `t(key, ...args)` (each argument at its `{n}`), `vscode` (the webview's
 * API: a page never acquires it again), `langButton()` and the globe's menu. Inlined at the top of a page's script (a
 * key it lacks shows the key, so a missing text is seen, never hidden). */
export function pageI18n(...dicts: { en: Record<string, string>; es: Record<string, string> }[]): string {
  const s = langState();
  const auto = resolveLang('auto', vscode.env.language, osLocale());
  const all = Object.assign({}, ...[...dicts, LANGUAGE].map((d) => texts(d, s.lang)));
  const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
  return `const LANG = '${s.lang}'; const T = ${json(all)};
const t = (k, ...a) => String(T[k] ?? k).replace(/\\{(\\d+)\\}/g, (_, i) => String(a[+i] ?? ''));
const vscode = acquireVsCodeApi();
const langButton = () => ${json(langButton(s.lang))};
(() => {
  const S = ${json({ setting: s.setting, auto: `${NAMES[auto.lang]} · ${all[`lang.from.${auto.source}`]}` })};
  const style = document.createElement('style'); style.textContent = ${json(LANG_CSS)}; document.head.appendChild(style);
  const h = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let menu = null, opener = null;
  const close = () => { if (!menu) return; menu.remove(); menu = null; opener?.focus(); };
  const item = (v, label, sub) => '<button type="button" role="menuitemradio" aria-checked="' + (S.setting === v) + '" data-nuc-lang-pick="' + v + '"><span>' + (S.setting === v ? '✓' : '') + '</span><span>' + h(label) + (sub ? '<small>' + h(sub) + '</small>' : '') + '</span></button>';
  const open = (b) => {
    opener = b;
    menu = document.createElement('div'); menu.className = 'nuc-lang-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', T['lang.title']);
    menu.innerHTML = item('auto', T['lang.auto'], S.auto) + item('en', 'English') + item('es', 'Español') + '<div class="note">' + h(T['lang.note']) + '</div>';
    document.body.appendChild(menu);
    const r = b.getBoundingClientRect(), w = menu.offsetWidth;
    menu.style.top = Math.round(r.bottom + 4) + 'px';
    menu.style.left = Math.round(Math.max(8, Math.min(r.right - w, innerWidth - w - 8))) + 'px';
    menu.querySelector('[aria-checked=true]')?.focus();
  };
  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target : null;
    const pick = el?.closest('[data-nuc-lang-pick]');
    if (pick) { e.stopPropagation(); const v = pick.dataset.nucLangPick; close(); if (v !== S.setting) vscode.postMessage({ type: 'lang:set', value: v }); return; }
    const b = el?.closest('[data-nuc-lang]');
    if (b) { e.stopPropagation(); return menu ? close() : open(b); }
    if (menu && !el?.closest('.nuc-lang-menu')) close();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!menu) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const all = [...menu.querySelectorAll('button')], i = all.indexOf(document.activeElement);
      all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length].focus(); e.preventDefault();
    }
  }, true);
})();`;
}
