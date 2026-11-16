---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [02-architecture/overview.md, 07-reference/synapsis.md, 06-runbooks/runtime-release.md]
---
# Dependencies

## Inside the tree

| Consumer | Depends on | Notes |
|---|---|---|
| The dialect `flutter` (`nuclearlang/dialects/dart/frameworks/flutter/`) | `platform.toml` | names the platform; refused by the loader when it leaves the contract |
| A generated app (`build/app`) | `packages/synapsis` | the dialect's generated code calls its API |
| An app with the `genkit` plugin | `packages/synapsis_genkit` | added to the app only when the plugin is enabled |
| `packages/synapsis_genkit` | `packages/synapsis` | a path dependency (`../synapsis`) |
| The type definitions `nuclearlang/dialects/dart/defs/{synapsis,synapsis_genkit}/0.1.0/` | the public API of the two packages | written by `nuclearlang/tools/defs/generate.sh`; used by the transpiler and the editor |
| `checks/analyze-flutter.sh` | `nuclearlang/tools/defs/flutter_project` (its host project), the `nuclear` binary | |
| `checks/spec-check-synapsis.py` | `nuclearlang/dialects/dart/docs/07-reference/flutter.md`, `examples/` | |
| The compiler's tests (`nuclear-transpile`, `nuclear-lsp`) | `examples/` | goldens and project tests |
| `examples/examples-flutter-dialect/tasks_app` | the backend example `platforms/backend/examples/examples-backend/tasks_api` | its contract (ADR-synapsis-0006) |
| The `nuclear` CLI | `platform.toml` (`[layout]`) and, through the code generator, `tools/code_generator/platforms/mobile/generators.toml`, the debug text layer of the runtime | the terminal device reads `__synapsisTextLayer` |

## The `synapsis` package

Versions are `packages/synapsis/pubspec.yaml`; what each library is used for, class by class, is
[synapsis.md §1](../07-reference/synapsis.md). The package re-exports nothing of them.

| Use | Libraries |
|---|---|
| State | `bloc`, `flutter_bloc` |
| Http | `dio` |
| Injector | `get_it` |
| Routes | `go_router` |
| Network status | `connectivity_plus` |
| Session and the key of the local database | `flutter_secure_storage` |
| Local database | `hive_ce` |
| Models' JSON | `json_annotation` |
| Translations | `flutter_localizations` (SDK), `path_provider`, `web` |
| `Result` and test helpers (`testing.dart`) | `fpdart` (`Result` is its `Either`), `mocktail`, `flutter_test` (SDK) |

Environment: Dart SDK `^3.12.0`, Flutter `>=3.44.0`. Lints: `flutter_lints`.

## The `synapsis_genkit` package

`synapsis` (path), `genkit ^1.0.1`, `schemantic ^1.0.0`; `publish_to: none`. The provider packages (Firebase AI,
Google AI, Vertex AI, OpenAI, Anthropic) are added to an app by its plugin, not by this package's pubspec.

## What an app gets besides the runtime

The dialect adds these to every generated app; a project never lists them in `config.nuc`
([ADR-mobile-0001](../03-adr/0001-project-manifest-packages-and-assets.md)): `synapsis`, `flutter_bloc`, `fpdart`,
`go_router`, `json_annotation`; to generate code and for tests `build_runner`, `json_serializable`, `mocktail`,
`bloc_test`, `integration_test`; `flutter_native_splash` with a `@splash`. The full list of an app is its
`build/app/pubspec.yaml`. The list itself is the dialect's
([flutter reference §3.1](../../../../../nuclearlang/dialects/dart/docs/07-reference/flutter.md)).

## Why these

| Choice | Decision |
|---|---|
| `json_serializable` + `build_runner` for JSON | [ADR-mobile-0003](../03-adr/0003-json-models-names-and-converters.md) |
| `go_router`, used from views only | [ADR-mobile-0002](../03-adr/0002-screens-routes-dialogs-and-splash.md) |
| `mocktail`, `bloc_test` for tests | [ADR-mobile-0004](../03-adr/0004-tests-in-nuclear.md) |
| `hive_ce` for the local database | [ADR-mobile-0006](../03-adr/0006-local-database.md) |
| `fpdart` for `Result` | ADR-lang-0006 |
| Genkit Dart for AI | ADR-synapsis-0004 |
