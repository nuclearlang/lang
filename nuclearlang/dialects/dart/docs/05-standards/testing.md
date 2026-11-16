---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../06-runbooks/type-definitions.md, ../02-architecture/flutter.md, ../../../../tools/spec-check/check.py]
---
# Testing the `dart` dialect

A change to this dialect is done when every check below that it touches is green. Which test of the compiler to
add for a new language rule is the language project's standard ([its AGENTS.md](../../../../AGENTS.md)); running a
whole app (`dragonfly test`, devices, integration tests) is the mobile platform's.

## What each check proves

| Check | Run from | Proves |
|---|---|---|
| `cargo test` | the root of the tree | the goldens: `nuclearlang/examples/spec/base.nuc` → `base.dart`; the mobile platform's `examples-flutter-dialect/` files `flutter_app`, `widgets_tour`, `framework_libs` (with `flutter`) and `dart_extension` (with `dart`); the projects `clean-flutter-project` and `genkit-assistant` against their `examples/expected/`. The dialect files load and validate; every kind, decorator and header word has its `docs.toml` entry (`every_dialect_word_has_editor_docs`); the project blocks of `flutter.md` are the real output (`dragonfly_spec_shows_the_real_output`) |
| `cargo run -q -p nuclear-cli -- dialect check dart` (or `flutter`) | the root | the dialect alone loads without problems |
| `tools/spec-check/check.py dialects/dart/docs/07-reference/dart.md dart dart` | `nuclearlang/` | every Dart block of the reference that follows a Nuclear block is, line by line, in the transpiler's real output. 0 problems |
| `tools/spec-check/check.py dialects/dart/docs/07-reference/flutter.md flutter dart` | `nuclearlang/` | the same for the single-file equivalences of the `flutter` reference. A brief is checked the same way (`dialects/dart/docs/07-reference/brief/<dialect>.md`): its code compiles with the dialect |
| `nuclear-synapsis-framework/platforms/mobile/checks/spec-check-dragonfly.py` | anywhere | the project examples of `flutter.md` (27) are the example project: a Nuclear block captioned ``Output (`lib/<path>.dart`)`` is the source `<path>.nuc` of `clean-flutter-project` and its Dart block is the golden output without the imports; ``Generated (`...`)`` captions a Dart block alone |
| `nuclear-synapsis-framework/platforms/mobile/checks/analyze-flutter.sh [file.nuc...]` | anywhere | every single-file example of `examples-flutter-dialect/`, and the files given, pass `flutter analyze` with `flutter_lints`: 0 warnings |
| `tools/stdlib-check.sh [area...]` | anywhere | each program of `nuclearlang/examples/stdlib/` built with `--dialect dart` runs with `dart run` and prints its `<area>.out`, the same text TypeScript and Python print |

`UPDATE_GOLDEN=1 cargo test -p nuclear-transpile` accepts a changed output: review the diff. Then
`spec-check ... --fix` and `spec-check-dragonfly.py --fix` rewrite the reference's blocks that differ: review them
too.

## What the examples cover

- `widgets_tour.nuc`: a tour of Flutter patterns (routes, async, `ListView.builder`, a form, `GlobalKey`, a getter,
  a mixin, JSON with `as`, `!`); its output passes `flutter analyze` without warnings.
- `framework_libs.nuc`: `Cubit`, `Dio`, `GetIt` and `BlocBuilder` imported only from the type definitions.
- `dart_extension.nuc`: the `dart` dialect's own kinds.

## What the checks need

- `analyze-flutter.sh`: the Flutter SDK (`FLUTTER=<path to flutter/bin/flutter>`; default `flutter` in the PATH).
  It builds the compiler in release, transpiles each example into
  `nuclearlang/tools/defs/flutter_project/lib/generated/` (with `flutter`; with `dart` when the file declares an
  `extension`, `mixin` or `data` and no widget) and runs `flutter pub get --offline` and `flutter analyze` there.
- `stdlib-check.sh`: `dart` in the PATH, or `DART=<dart>`, or `FLUTTER_ROOT=<Flutter SDK>`; it also needs node,
  TypeScript and `nuclearlang/tools/python/.venv` for the other two targets.
- `spec-check-dragonfly.py`: only Python; it reads the golden files, so run it after `cargo test`.

## Rules

- The generated code passes `flutter analyze` without warnings.
- A new equivalence in a reference is written as a Nuclear block followed by its Dart block, so a check covers it.
- A new kind, decorator or header word comes with its `docs.toml` entry in the same change.
- What does not pass yet is listed in [the roadmap](../01-product/roadmap.md).
