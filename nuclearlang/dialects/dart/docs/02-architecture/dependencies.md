---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, flutter.md, ../06-runbooks/type-definitions.md, ../03-adr/README.md]
---
# Dependencies of the `dart` dialect

## Inside the tree

| This dialect uses | For | Where |
|---|---|---|
| The compiler | loading, validating and emitting | [the language project](../../../../AGENTS.md) |
| The mobile platform's contract | the kinds, decorators and layout `flutter` implements | `nuclear-synapsis-framework/platforms/mobile/platform.toml` |
| The Dart packages `synapsis` and `synapsis_genkit` | what the generated `flutter` code imports (`package:synapsis/synapsis.dart`, `testing.dart`, `package:synapsis_genkit/...`) | `nuclear-synapsis-framework/platforms/mobile/packages/` |
| The type definitions generator | `defs/` | `../../tools/defs/` (`bin/defs.dart`, `generate.sh`, `flutter_project/`) |
| The host Flutter project | resolves `package:flutter/...` and the pub packages for the generator; holds the code `analyze-flutter.sh` checks | `../../tools/defs/flutter_project/` |

## The target

| Dependency | Version | Use |
|---|---|---|
| Dart | 3 (definitions of `dart@3.13.5`) | the language of the output |
| Flutter SDK | definitions of `flutter@3.47.7` | the `flutter` dialect's target; its CLI creates the app, resolves packages, builds and runs on devices |
| `flutter analyze` with `flutter_lints` | from the SDK | the check of the output: 0 warnings |

## Libraries the `flutter` output is written against (ADR-dart-0001)

Official ecosystem libraries, one per need. What Flutter lacks is in the platform's package `synapsis`.

| Need | Library | Names imported automatically |
|---|---|---|
| Synapsis runtime | `synapsis` | `Http`, `WebSocket`, `Repository`, `Events`, `SessionManager`, `NetworkManager`, `Acl`, `Log`, `FormManager`, `SynapsisForm`, `SynapsisDialog`, `Popups`, `Translations`, `inject`... |
| State | `bloc` + `flutter_bloc` | `Cubit`, `Bloc`, `Emitter`, `BlocProvider`, `BlocBuilder`, `BlocListener`, `BlocConsumer`, `BlocSelector`, `MultiBlocProvider`... |
| Dependency injection | `get_it` | `GetIt` |
| Network | `dio` | `Dio`, `BaseOptions`, `Options`, `Response`, `Interceptor`, `DioException`, `CancelToken`, `FormData`... |
| Routes | `go_router` | `GoRouter`, `GoRoute`, `GoRouterState`... |
| JSON | `json_serializable` (generates the code) + `json_annotation` | `JsonSerializable`, `JsonKey`, `JsonEnum`, `JsonValue`... |
| `Result` | `fpdart` (`Either`, `Right`, `Left`) | from the `dart` dialect's `[auto_imports]` |
| `bigdouble` (ADR-lang-0015) | `decimal` 3.2 (`Decimal`) | from the `dart` dialect's `[auto_imports]`; the app's `pubspec.yaml` must list it (the platforms' step) |
| Connectivity, session | `connectivity_plus`, `flutter_secure_storage` | `Connectivity`, `FlutterSecureStorage`... |
| Local database | `hive_ce`, inside the runtime | |
| Tests | `flutter_test`, `mocktail`, `bloc_test`, `integration_test` | from the dialect's `[auto_imports]` |
| AI (plugin `genkit`) | Genkit Dart (`genkit`, `schemantic`) and a provider package | [flutter.md](flutter.md), Plugins |

## Type definitions

`defs/<package>/<version>/`, generated with the official Dart analyzer (`package:analyzer`), so the API is exact
for the installed versions. They give the automatic imports, the inherited members and the `@override`s of the
SDK's and the packages' classes. Look one up with `nuclear defs show BlocBuilder --dialect flutter`,
`nuclear defs show Repository.send --dialect flutter` or `nuclear defs search Button --dialect flutter`.

| Dialect | `defs` |
|---|---|
| `dart` | `dart@3.13.5`: `dart:core` (implicit: never imported), `dart:async`, `dart:math`, `dart:convert`, `dart:collection`, `dart:io`, `dart:typed_data`, `dart:isolate`, `dart:developer` |
| `flutter` (added to the parent's) | `flutter@3.47.7` (`package:flutter/{widgets,material,cupertino,services,foundation,painting,rendering,gestures,animation,scheduler,semantics,physics}.dart`), `synapsis@0.1.0`, `flutter_bloc@9.1.1` (which brings `bloc@9.2.1`), `get_it@9.3.0`, `dio@5.11.1`, `go_router@18.1.1`, `connectivity_plus@7.3.2`, `flutter_secure_storage@11.2.0`, `json_annotation@4.12.0` |
| `flutter` with the plugin `genkit` | `genkit@1.0.1`, `schemantic@1.0.0`, `synapsis_genkit@0.1.0` |

Which package gives a name: the parent's first, then the order of `defs`, each package before its dependencies,
and inside a package the most basic library (in `flutter`, `widgets` before `material`). A name two packages
export with different declarations goes to the first (`Flow` is `dart:developer`'s, not the widget). A
hand-written `[auto_imports]` or `[functions]` entry wins.

A package a mobile project adds (`dependencies` of its `config.nuc`) gets its definitions generated once into the
shared cache `~/.cache/nuclearlang/defs/dart/` (`$XDG_CACHE_HOME/nuclearlang/defs`), with the version the app
resolved (`pubspec.lock`), and is listed in the project's `build/defs.lock`; the dialect's `defs/` is not touched.
A package the dialect already knows (`dio`, `go_router`...) uses the dialect's. Format and loading rules:
[../../../../docs/07-reference/definitions.md](../../../../docs/07-reference/definitions.md).
