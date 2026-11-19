// The language of what the extension shows, decided in one place (spec 011, req. 18): the setting `nuclear.language`
// (`auto` | `en` | `es`); `auto` is the editor's display language when it is English or Spanish, else the operating
// system's, else English. No `vscode` import: i18n.ts gives it the editor's values, and the tests drive it.

export type Lang = 'en' | 'es';
export type LangSetting = 'auto' | Lang;
/** Why the language is what it is: the setting chose it, or `auto` took it from the editor, the system, or the default. */
export type LangSource = 'setting' | 'editor' | 'os' | 'default';
export interface LangState {
  setting: LangSetting;
  lang: Lang;
  source: LangSource;
}

/** `en` or `es` when a locale tag is one of them (`es`, `es-419`, `es_ES.UTF-8`…), else undefined. */
export function supported(tag: string | undefined): Lang | undefined {
  const base = (tag ?? '').toLowerCase().split(/[-_.@]/)[0];
  return base === 'en' || base === 'es' ? base : undefined;
}

/** The operating system's locale: the POSIX variables in their order of precedence, else what `Intl` resolves. */
export function osLocale(env: Record<string, string | undefined> = process.env, intl = () => Intl.DateTimeFormat().resolvedOptions().locale): string | undefined {
  const posix = [env.LC_ALL, env.LC_MESSAGES, env.LANG].find((v) => v && v !== 'C' && v !== 'POSIX' && !v.startsWith('C.'));
  return posix ?? intl();
}

/** The language to show, and why. */
export function resolveLang(setting: unknown, editor: string | undefined, os: string | undefined): LangState {
  if (setting === 'en' || setting === 'es') return { setting, lang: setting, source: 'setting' };
  const fromEditor = supported(editor);
  if (fromEditor) return { setting: 'auto', lang: fromEditor, source: 'editor' };
  const fromOs = supported(os);
  if (fromOs) return { setting: 'auto', lang: fromOs, source: 'os' };
  return { setting: 'auto', lang: 'en', source: 'default' };
}

/** A host message in `lang`: English is the key, `es` its Spanish (a missing one shows the English); each argument
 * goes to its `{n}`. */
export function translate(es: Record<string, string>, lang: Lang, message: string, args: readonly unknown[]): string {
  const text = lang === 'es' ? es[message] ?? message : message;
  return text.replace(/\{(\d+)\}/g, (m, i: string) => (+i < args.length ? String(args[+i]) : m));
}
