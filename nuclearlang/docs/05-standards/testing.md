---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [coding.md, ../02-architecture/emitter.md, ../../../docs/05-standards/testing.md]
---
# Testing

Read this when you add a test, a golden file changed, or generated code must be checked against the real target.
The levels of the whole platform are in [`../docs/05-standards/testing.md`](../../../docs/05-standards/testing.md).

## The tests

| Test | What it covers |
|---|---|
| `crates/nuclear-syntax/tests/lexer.rs`, `parser.rs` | tokens, indentation, the AST of each construct |
| `crates/nuclear-syntax/tests/fmt.rs` | every `.nuc` under `examples/`, `dialects/`, `packages/`, `kinds/` of the language and of each platform is a fixed point of `nuclear fmt` |
| `crates/nuclear-syntax/src/habits.rs` (unit tests) | the habits scan (N0022) |
| `crates/nuclear-dialect/tests/loader.rs` | dialect validation and type definitions (package order, import priority, full API, errors, project packages); `every_dialect_word_has_editor_docs` |
| `crates/nuclear-diag/src/lib.rs` (`every_code_is_documented`) | every diagnostic code is in `docs/07-reference/diagnostics.md` |
| `crates/nuclear-transpile/tests/golden.rs` | each example `.nuc` against its expected file: `examples/examples-nodejs/chat`, `examples/examples-python/tour`, `examples/spec/base` (to TypeScript and to Dart), and from the platforms' examples `examples-nestjs/users` and `examples-flutter-dialect/{flutter_app,dart_extension,widgets_tour,framework_libs}`; `stdlib_programs_transpile_in_both_targets`: every program of `examples/stdlib/` transpiles in TypeScript, Dart and Python |
| `crates/nuclear-transpile/tests/rules.rs` | one test per language rule |
| `crates/nuclear-transpile/tests/projects.rs` | each `examples/projects/<p>/` against `examples/expected/<p>/`, and the platforms' example projects (`clean-flutter-project`, `genkit-assistant`, `rick_api`, `tasks_api`, `characters`) against their `expected/`; architecture rules, kind by folder, `[project.files]`, duplicate names, contracts, the project map; `synapsis_spec_shows_the_real_output` (the blocks captioned `Output (` / `Generated (` in the `flutter` reference) |
| `crates/nuclear-lsp/tests/server.rs` | the server end to end with the examples (no prefix of any example panics; a project's packages bring their definitions) |

- The tests find the examples in the language's folder and in each platform's
  (`nuclear_dialect::Home::tree().roots()`); a test that cannot find a folder of the tree fails.
- `UPDATE_GOLDEN=1 cargo test` regenerates the expected files (golden examples and projects); the diff is reviewed.
- `widgets_tour.nuc` (flutter) is a tour of Flutter patterns (routes, async, `ListView.builder`, form, `GlobalKey`,
  getter, mixin, JSON with `as`, `!`); its output passes `flutter analyze` without warnings.
- `framework_libs.nuc`: Cubit, Dio, GetIt and BlocBuilder imported only from the type definitions.

## Which test to add

| Change | Test |
|---|---|
| A rule of the language or of the emitter | a test in `rules.rs`; the golden files show the side effects |
| A token, a construct of the grammar | `lexer.rs` / `parser.rs` |
| A dialect validation, a definitions rule | `loader.rs` |
| Something of projects (several files, `[project]`, `config.nuc`) | `projects.rs`, with an example under `examples/projects/` when it needs files |
| A feature of the server | `tests/server.rs` |
| A new diagnostic | its test where it is raised, and its entry in `docs/07-reference/diagnostics.md` |

## Checking against the real target

From `nuclearlang/`:

- **Equivalences of a reference:**
  `tools/spec-check/check.py dialects/<language>/docs/07-reference/<dialect>.md <dialect> <language>` must give 0
  problems; the briefs the same way (`.../07-reference/brief/<dialect>.md`). On the guide when the output changes:
  `tools/spec-check/check.py docs/08-guides/<chapter>.md typescript typescript --fix`.
- **The standard library in the three targets:** `tools/stdlib-check.sh [area...]` builds each program of
  `examples/stdlib/`, checks it (`tsc --strict`, pyright), runs it (node, `dart run`, python) and compares what it
  prints with `<area>.out`. `UPDATE=1` makes the TypeScript output the expected one. It needs node, dart,
  TypeScript and `tools/python/.venv`; the cargo test only checks that the programs transpile.
- **The rules a target could break:** `DIR=examples/semantics tools/stdlib-check.sh` the same way, over the programs
  of `examples/semantics/`: a name that a target's function has, a lambda made in a loop, a default list, a static
  field, `~/` with negatives, a chain after `?.`, a variable of the file a function changes, `==` of two lists or
  maps, a decimal and a missing value printed, named arguments, a function type of types only. Each passed
  `nuclear check` and was wrong in a target once; a fix of that kind adds its case here.
- **TypeScript by hand:** `tools/node/node_modules/.bin/tsc --strict --noEmit --target es2022 --lib es2022,dom x.ts`.
- **Dart and Flutter:** the mobile platform's
  `../nuclear-synapsis-framework/platforms/mobile/checks/analyze-flutter.sh [file.nuc...]` (its host project is
  `tools/defs/flutter_project`; `flutter_lints`, 0 warnings).
- **A platform with a dialect** (the example built, the analyzer in strict mode, its tests, a live run):
  `../nuclear-synapsis-framework/platforms/<platform>/checks/`.
- **Agents:** `../nuclear-synapsis-framework/eval/agent-eval/run.py --mode agent` spends the user's Claude quota:
  ask first.

The base words live in `base/nuclear.toml` (its `source` is `docs/07-reference/nuclear-base.md`) and
`base/docs.toml`; the lexer test and the loader test name those files in their messages. A test that cannot find a
folder of the tree fails; none skips itself.
