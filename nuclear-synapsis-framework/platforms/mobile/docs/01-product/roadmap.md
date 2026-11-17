---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [03-adr/README.md, 02-architecture/runtime.md, 02-architecture/local-database.md, 05-standards/testing.md]
---
# Roadmap

The pending work of the mobile platform and its runtime packages. A done item is deleted. What is pending in how
the `flutter` dialect writes code is in the roadmap of the
[`dart` dialect project](../../../../../nuclearlang/dialects/dart/AGENTS.md), which also tracks the `material_ui`
deprecation that turns `flutter analyze` of `packages/synapsis` red with the newest Flutter stable. What is to
design with the user for Synapsis as a whole (logs, TDD, the linter, what is mandatory in `main.nuc`) is in the
[framework's roadmap](../../../../docs/01-product/roadmap.md).

## Untested

Done; each needs a manual test.

- A real phone; macOS.
- Rules of [ADR-mobile-0007](../03-adr/0007-accepted-rules-of-events-guards-forms-and-state.md) and
  [ADR-mobile-0002](../03-adr/0002-screens-routes-dialogs-and-splash.md) on a device: an event published from a real
  workmanager task (tested only with `Isolate.run`), screen transitions as seen on screen, the back button of a
  nested route on Android.
- The local database ([ADR-mobile-0006](../03-adr/0006-local-database.md)) on a real device and on web: the AES key
  in the secure storage, the hive files in the app's support folder, IndexedDB and WebCrypto on web, data surviving
  a restart, `LocalDatabase(encrypted = false)` writing plain boxes, Linux without libsecret. Only in-memory boxes
  ran.
- Genkit (ADR-synapsis-0004): Firebase AI, Google AI, Vertex AI, OpenAI's and Anthropic's real services (no keys); the
  chat screen on a device. FirebaseAI needs `flutterfire configure` in the app (not automated by the CLI).

## Pending

- **Genkit:** interrupts (tool confirmations), middleware (retry), the Developer UI from `nuclear run`, the
  generators `nuclear g chat|flow|tools`, a persistent `Knowledge` (today in memory), multimodal parts (images)
  in chats.
- **The packages:** publish `synapsis` on pub.dev; then `nuclear new` uses the published version. The
  `repository` field of both pubspecs names `github.com/nuclearlang/lang/...`.
  TODO(human): which `repository` URL do the pubspecs take now that the packages live in the one `nuclear`
  repository? And is the package's license MIT (its README and [synapsis.md](../07-reference/synapsis.md)) or
  Apache-2.0 (its `LICENSE` file)?
- `WebSocket` uses `dart:io`: it does not work on web.
- A splash's `onLoad` has no timeout.
- **Ideas:** `@changed("field")` in forms, plurals in messages and translations, a warning for a missing
  translation key, `nuclear g form`.
- **Limits of the local database** ([ADR-mobile-0006](../03-adr/0006-local-database.md)):
  - a GET under `saveLocal` whose model has no `@primary` fails at run time (a compile-time diagnostic would need
    the emitter to check `fields_decor` against a rule of the dialect);
  - `local = false` cannot opt a method out of `saveLocal` (templates compare no values);
  - no `isNull` operator (the word is the `flutter_test` matcher in the dialect's auto-imports: a `[functions]`
    shortcut is refused by `N0204`; a plain `null` in `where` does it);
  - `Page<T>` answers are not saved;
  - `@column` options (`length`, `unique`, `index`) have no meaning in a document store;
  - a `LocalTable` keeps its box in memory (hive);
  - switching `encrypted` after the first run needs the tables cleared.
