---
name: i18n
description: Translate and localize a Synapsis app with the platform's Translations: dictionaries per component and locale, keys with arguments, language switching, locale formats, plurals and right-to-left. Use when an app needs more than one language or per-locale dates, numbers and money.
title: Translations and localization
title_es: Traducciones y localización
description_es: Traducir y localizar una app Synapsis con las Translations de la plataforma: diccionarios por componente e idioma, claves con argumentos, cambio de idioma, formatos, plurales y derecha a izquierda. Úsalo cuando una app necesita varios idiomas o fechas, números y dinero por locale.
kind: domain
tags: [i18n, translations, localization, l10n, locale, languages, plurals, rtl]
---
# Translations and localization

## When to use

A second language, a language picker, dates, numbers and prices that follow the user's locale, an Arabic or
Hebrew version.

## What the platform has

- **Mobile** (`nuclear help flutter`, §6.16; example: `nuclear help example/clean-flutter-project`):
  `Translations(locales = ["en", "es"], fallback = "en")` in the `globals` of `appConfig`. Texts are JSON
  dictionaries, **one per component and per locale**, in `assets/i18n/<locale>/<component>.json` (`shared.json`
  for the whole app). A key is `<file>.<path inside the file>`: `"session.login.title".tr()`, with arguments
  `"session.login.hi".tr({ "name": auth.name })` for `"Hi {name}"`. The language is the stored one, else the
  device's, else `fallback`; `~Translations.use("es")` changes it, remembers it and rebuilds the app keeping its
  state. `main.nuc` passes `Translations.locale`, `Translations.supportedLocales` and `Translations.delegates` to
  the app widget. A missing key falls back to `fallback`, then Synapsis's own texts, then shows the key.
  `remote = RemoteDictionaries(url = ...)` updates texts without a release (versioned `manifest.json`, downloaded
  in the background, used only when complete).
- **Web**: translations are **not in this version** (the web platform's roadmap); they will come with the mobile
  platform's words. Until then keep texts in one place per component and do not invent a mechanism.
- **Backend**: no translations word. Answer stable error codes and let the client translate them, or keep
  server-rendered texts (emails) in templates per locale chosen from the user's profile.
- **Not yet**: plurals in `tr` (an idea in the mobile roadmap), a warning for a missing key.

## Steps

1. **No literal user-facing text in views.** Every text on screen is a key: `Text("orders.list.empty".tr())`.
   Name keys by meaning and place (`orders.checkout.pay_button`), not by the English words.
2. **One dictionary per component**: `assets/i18n/en/orders.json`, `assets/i18n/es/orders.json`, same keys in
   both; deleting the component deletes its texts. Shared words in `shared.json`.
3. **Arguments, never concatenation**: `"Hi {name}"` with `tr({ "name": ... })`; word order changes between
   languages, so `"Hi " + name` breaks.
4. **Plurals** until the platform has them: separate keys chosen in code (`orders.count.zero`, `.one`, `.other`)
   and pass the number as an argument. Remember some languages have more forms (Arabic six, Polish three): keep
   the choice in one helper so it can move to the platform's word later.
5. **Locale formats**: dates, times, numbers and money are formatted with the locale (`Translations.locale`), never
   by hand: `1,234.50` vs `1.234,50`, day/month order, 24 h clocks, the currency symbol's side. Store dates in UTC
   and amounts as minor units; format only at display.
6. **Right to left**: with an RTL locale the toolkit mirrors the layout when its delegates and the locale are
   passed (`main.nuc` above). Use start/end paddings and alignments instead of left/right; mirror directional
   icons (back arrows), not logos or media controls; test a screen in Arabic.
7. **Text expansion**: German and Finnish are ~30 % longer; leave room, allow wrapping, test with long strings.
8. **The language picker** lists each language in its own name ("Español", "English") and calls
   `~Translations.use(code)`; save the choice in the user's profile too (`user-profiles`) so emails match.
9. **Check the dictionaries**: a test (or a script in the project's checks) compares the key sets of every locale
   and fails on a missing key; review translations with a native speaker.

## The platform's tools

- `Translations(...)` in `appConfig` `globals`; `.tr()`; `~Translations.use(...)`; `~Translations.refresh()`.
- `nuclear new <name> -p mobile` gives the project layout with `assets/`; `nuclear make component <component>` for a
  new dictionary owner.
- `nuclear help example/clean-flutter-project` shows translations used in screens and forms.
- `nuclear run`, `nuclear device` to see each locale; `nuclear test` for the key checks.

## Pitfalls

- Concatenated sentences and text inside images.
- `count == 1 ? "item" : "items"`: wrong in most languages.
- Hard-coded date formats (`dd/MM/yyyy`) and decimal separators.
- Left/right paddings that do not mirror in RTL.
- Keys renamed in one locale only; the fallback hiding a missing translation in development.
- Translating backend error messages on the server with the server's locale instead of the user's.

## Checklist

- [ ] No user-facing literal text in views; every text is a key in the component's dictionary.
- [ ] Every locale has the same keys (a check fails on a missing one).
- [ ] Arguments are named placeholders; no concatenated sentences.
- [ ] Dates, numbers and money are formatted with the current locale.
- [ ] One screen is checked in an RTL locale and with long translations.
- [ ] `nuclear check .` reports 0 errors and `nuclear test` is green.
