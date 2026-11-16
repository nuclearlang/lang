---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [03-adr/0004-tests-in-nuclear.md, 06-runbooks/runtime-release.md, 07-reference/dragonfly.md]
---
# Testing

## Before a change is done

From the root of the tree, then from this folder:

```sh
cargo test && cargo clippy --all-targets
python3 nuclear-synapsis-framework/platforms/mobile/checks/spec-check-dragonfly.py
(cd packages/dragonfly && flutter pub get && flutter test && flutter analyze)
(cd examples/examples-flutter-dialect/tasks_app && dragonfly build && dragonfly test)
```

The tests every platform shares (the contract, the layout, the editor docs, the generators) and their conventions:
[testing a platform](../../../docs/05-standards/testing.md).

## What each check covers

| Check | Covers | Where |
|---|---|---|
| `cargo test`: goldens of the single-file examples | `flutter_app`, `dart_extension`, `widgets_tour`, `framework_libs`: each `.nuc` against the `.dart` beside it | `nuclearlang/crates/nuclear-transpile/tests/golden.rs` |
| `cargo test`: goldens of the projects | `clean-flutter-project` and `genkit-assistant` against `examples/expected/` | `tests/projects.rs`, `projects_match_expected_output` |
| `cargo test`: the contract of a backend | `tasks_app` built from the contract of `tasks_api`; a change in the backend breaks the client's build with the field's name | `tests/projects.rs`, `a_client_builds_from_the_backend_contract_and_sees_drift` |
| `cargo test`: the reference shows the real output | the Dragonfly blocks of the flutter reference | `tests/projects.rs`, `dragonfly_spec_shows_the_real_output` |
| `checks/spec-check-dragonfly.py` | the same blocks, 27 today, and `--fix` to rewrite them | below |
| `flutter test` in `packages/dragonfly` | the runtime: 64 tests (`dragonfly_test`, `framework_test`, `local_test`, `testing_test`, `ui_test`) | `packages/dragonfly/test/` |
| `flutter analyze` in `packages/dragonfly` | `flutter_lints`, nothing reported | `packages/dragonfly/analysis_options.yaml` |
| `flutter test` in `packages/dragonfly_genkit` | the `genkit` runtime (`remote_test`, `runtime_test`); the CI workflow does not run it | `packages/dragonfly_genkit/test/` |
| `checks/analyze-flutter.sh [file.nuc...]` | every single-file example transpiled and checked with `flutter analyze` (`flutter_lints`, 0 warnings) | below |
| `dragonfly build && dragonfly test` in `tasks_app` | an app built and tested end to end; run by the CI | `examples/examples-flutter-dialect/tasks_app` |
| `dragonfly test` in `clean-flutter-project` | 34 tests; also integration on Linux, `flutter analyze` 0, `flutter build web` and `linux` | `examples/examples-flutter-dialect/clean-flutter-project` |

CI runs the reference's examples, the runtime's tests and analysis, and `tasks_app`:
`.github/workflows/platform-mobile.yml`.

## `checks/spec-check-dragonfly.py`

Keeps the Dragonfly examples of the flutter reference
(`nuclearlang/dialects/dart/docs/07-reference/flutter.md`) equal to the example project. A pair in the reference
is a `nuclear` block, a caption ``Output (`<lib|test|integration_test>/<path>.dart`...)`` and a `dart` block; a
caption ``Generated (`<lib|test>/<path>.dart`)`` goes before a `dart` block alone. The Nuclear block must be the
source `<path>.nuc` of `clean-flutter-project`; the Dart block must be its golden in
`examples/expected/clean-flutter-project/`, without the imports. Without arguments it reports the blocks that
differ and exits 1; `--fix` rewrites them (after `UPDATE_GOLDEN=1 cargo test`).

## `checks/analyze-flutter.sh`

Builds the `nuclear` binary in release, transpiles every `examples/examples-flutter-dialect/*.nuc` (and the files
given as arguments) into `nuclearlang/tools/defs/flutter_project/lib/generated`, and runs `flutter analyze` there.
A file with an `extension`, `mixin` or `data` declaration and no view is built with the `dart` dialect, the others
with `flutter`. It needs the Flutter SDK: `FLUTTER=path/to/flutter/bin/flutter`, default `flutter` in the PATH;
`NUCLEAR_ROOT` names another tree.

## Goldens

A golden changes only with `UPDATE_GOLDEN=1 cargo test`, and its diff is reviewed. `examples/expected/` and the
`.dart` beside a single-file example are never edited by hand.

## The tests of an app

- A project writes its tests in Nuclear: the kinds `tests` and `integration`
  ([ADR-mobile-0004](../03-adr/0004-tests-in-nuclear.md), [kinds.md](../02-architecture/kinds.md)).
- The build generates the standard ones: the JSON of the models, the contracts of the repositories, the guards of
  the routes, a smoke test of the screens, the twins of the local database. In the `flutter` dialect they are one
  file, `test/dragonfly_generated_test.dart`. A field with a converter gets the JSON the converter writes
  (`const Conv().toJson(DateTime(2000))`), or its `sample()` when it has one; an enum field gets its first value.
- The helpers are the runtime's: `package:dragonfly/testing.dart`
  ([dragonfly.md §7](../07-reference/dragonfly.md)) and `package:dragonfly_genkit/testing.dart`
  (`startFakeGenkit`). `DragonflyTest.start` runs an app without network or device: fake http answers, the session
  and the local database in memory.
