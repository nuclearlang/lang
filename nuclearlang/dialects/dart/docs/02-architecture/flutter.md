---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../07-reference/flutter.md, ../03-adr/0001-flutter-dialect-as-a-framework.md, flutter-kinds.md, overview.md, dependencies.md]
---
# The `flutter` dialect: the mobile platform written in Dart

`frameworks/flutter/` (`extends = "dart"`, `platform = "mobile"`). The platform (its kinds, decorators, folders,
`config.nuc`, plugins and tests, in Nuclear) is
[the mobile platform's](../../../../../nuclear-synapsis-framework/platforms/mobile/AGENTS.md); its contract is
`nuclear-synapsis-framework/platforms/mobile/platform.toml`. This dialect holds only how each of those is written:
kinds and decorators that transpile Nuclear to Dart and add behaviour (a `repository` with `@get` writes the http
call, the mapping and the cache). The generated app uses the platform's Dart package `synapsis`
(`nuclear-synapsis-framework/platforms/mobile/packages/synapsis`) for what Flutter lacks. Normative rules and
equivalences: [../07-reference/flutter.md](../07-reference/flutter.md). What each kind generates:
[flutter-kinds.md](flutter-kinds.md). Decision: ADR-dart-0001.

## What it changes of `dart`

- `defs`: the Flutter SDK, the runtime and the libraries it relies on, added to `dart`'s
  ([dependencies.md](dependencies.md)). Their names are imported automatically, their classes can be extended
  (`Counter: Cubit<int>`) and their inherited members are used without declaring them (`emit`, `state`).
- `replaces`: in Synapsis, `WebSocket` is the connection of the project config, not the `dart:io` class; the
  Genkit names the package `synapsis_genkit` re-exports (`Tool`, `Message`, `Genkit`, `Part`...) are imported
  from it, once.
- `[types] Page = "PageOf"`: Nuclear's `Page<T>` (a page of a local query or of a backend's paged answer) is the
  runtime's `PageOf<T>`, because Flutter's widgets library has its own `Page` (the Navigator's).
- `[library.string] tr`: a member the platform adds to a base type, `"characters.list.title".tr()`.
- `[imports]`: `use material`, `cupertino`, `widgets`, `services`, `foundation`, `animation`, `gestures`,
  `painting`, `rendering` → `package:flutter/<name>.dart`.
- `[auto_imports]` and `[names] written`: the extension methods imported when the code writes them (`goTo`,
  `pushTo`, `goBack` of `BuildContext`, `tr` of `String`), the runtime's test helpers
  (`package:synapsis/testing.dart`) and the names of `flutter_test`, `mocktail`, `bloc_test` and
  `integration_test`.
- `[decorators]`: `consumed` (read by the templates, not written as Dart annotations); `void = ["state"]` (a
  method with `@state` returns nothing to its caller: its value becomes a state); `provide`
  (`"screen.providers" = "context.read<{{name}}>()"`: with `@screen(providers = [Manager])`, `Manager.load()` is
  that screen's manager); `args` (the arguments of each decorator; a wrong one is N0217).
- `[call_site.Log]`: every `Log.d/i/s/w/e(...)` also receives `at`, the breadcrumb
  `component › kind › Class.method · path.nuc:line`. A constant: it costs nothing at run time.
- `[docs]`: the API reference URL of a Flutter name, for the editor's hover.

## Project files

A folder with `main.nuc` (the project `marker`: there is no `nuclear.toml`); `nuclear build .` writes `build/app`
(`output`). `[project] sources = "lib"`; `assets = ["assets"]` (the translation dictionaries
`assets/i18n/<locale>/<component>.json` are copied to the app); `test/` and `integration_test/` stay outside
`lib/`.

| File | Template | Holds |
|---|---|---|
| `lib/synapsis.g.dart` | `synapsis_g.tpl` | `startSynapsis`, `synapsisConfig`, `registerSynapsis`, `buildRouter`, `appRouter` (every screen with `@screen`) |
| `lib/synapsis_genkit.g.dart` | `genkit_g.tpl` | `startGenkit`, with the plugin `genkit` |
| `test/synapsis_generated_test.dart` | `generated_tests.tpl` | the tests every app gets without writing them |
| `flutter_native_splash.yaml` | `native_splash.tpl` | the native splash configuration, only if a screen has `@splash`; the CLI runs `flutter_native_splash:create` with it |

`config.nuc` is the project's pubspec written in Nuclear. It is not transpiled: the `nuclear` command reads it to
write the app's `pubspec.yaml` (with the packages Synapsis adds on its own) and to load the type definitions of the
`dependencies` packages. Sections: `synapsis`, `app`, `environment`, `dependencies`, `devDependencies`, `plugins`,
`contracts`. Only third-party packages the framework does not use can be written: the ones in `defs` and the
`reserved` list (`fpdart`, `build_runner`, `json_serializable`, `mocktail`, `bloc_test`, `integration_test`,
`flutter_native_splash`, `flutter_test`, `flutter_lints`, `cupertino_icons`) are N0303.

Kind by folder (`[project.kinds]`): `components/*/domain/models`, `contracts/*/models` and `shared/models` →
`model`; `components/*/presentation/*/state_models` and `.../presentation/state_models` → `statemodel`;
`components/*/presentation/*/forms` and `.../presentation/forms` → `form`; `test` → `tests`; `integration_test` →
`integration`.

## Plugins

The optional parts; the CLI adds their packages to the app only when `config.nuc` enables them.

| Plugin | Packages | Gives |
|---|---|---|
| `genkit` | `genkit ^1.0.1`, `schemantic ^1.0.0`, `synapsis_genkit` (local); definitions `genkit@1.0.1`, `schemantic@1.0.0`, `synapsis_genkit@0.1.0` | the kinds `tools`, `flow`, `chat`, `remote`, `knowledge` |
| `firebaseAI` (needs `genkit`) | `genkit_firebase_ai ^0.4.0`, `firebase_core ^4.0.0` | `FirebaseAI(model = ...)`: Gemini through Firebase AI Logic; the app needs Firebase configured (`flutterfire configure`) |
| `googleAI` (needs `genkit`) | `genkit_google_genai ^1.0.1` | `GoogleAI(model = ..., embedder = ...)` with `GEMINI_API_KEY` |
| `vertexAI` (needs `genkit`) | `genkit_vertexai ^1.0.1` | `VertexAI(model = ..., projectId = ..., location = ...)` |
| `openAI` (needs `genkit`) | `genkit_openai ^1.0.1` | `OpenAI(model = ...)`, or an OpenAI-compatible server such as a local Ollama (`baseUrl`, `apiKey`) |
| `anthropic` (needs `genkit`) | `genkit_anthropic ^1.0.1` | `Anthropic(model = ...)` with `ANTHROPIC_API_KEY` |

## Toolchain

The SDK, packages, builds and devices are handled by the Flutter CLI: the `nuclear` command calls `flutter`
inside the generated app. The dialect's `[toolchain]` holds only the editor's side of a mobile project (its VS Code
workspace, written by `nuclear build`): the Dart and Flutter extensions run the app of `build/app`, and saving a
`.nuc` transpiles it and hot reloads (task `nuclear: watch`).

- `installed = ".dart_tool"`; `extensions = ["Dart-Code.flutter", "Dart-Code.dart-code"]`.
- `[toolchain.settings]`: `dart.previewHotReloadOnSaveWatcher = true`, `dart.flutterHotReloadOnSave = "all"`,
  `task.allowAutomaticTasks = "on"`.
- `[[toolchain.launch]]`: three launches of `lib/main.dart` (debug, profile, release), each after the task
  `nuclear: build`.

## Architecture rules

`[architecture]`, scope `components` (N0301, N0302): a use case is called only by its `appcomponent`; a service by
use cases and aggregates; an aggregate by use cases; a repository by use cases and aggregates. Another component
sees only the `appcomponent`, models, converters, events, global components, guards and the screens (`@screen`:
navigation goes from one component to another). `tests` and `integration` may use everything.
`[architecture.names]`: `BuildContext`, `GoRouter`, `GoRouterState` and `appRouter` only in `stateless` and
`stateful`: navigation is 100% in the views, because only a widget has a context and a router.
