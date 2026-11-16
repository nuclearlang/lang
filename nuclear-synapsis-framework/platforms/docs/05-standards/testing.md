---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/contract.md, ../02-architecture/overview.md, ../../../docs/02-architecture/rules.md]
---
# Testing a platform

How "the same Nuclear for every dialect of a platform" is kept true. Commands run from the root of the tree; paths
that start with `nuclearlang/`, `nuclear-synapsis-framework/` or `.github/` start there.

## What is tested at each level

| Level | What it covers | Where |
|---|---|---|
| The contract | Every framework dialect loads, names its platform and matches its `platform.toml`; a dialect that names a platform nobody declares, or adds a kind, is refused | `dragonfly_dialects_implement_their_platform` in `nuclearlang/crates/nuclear-dialect/tests/loader.rs` |
| The layout | Every kind of every platform has a `.nuc` path in `[layout]` | `every_platform_kind_has_a_place_in_the_layout`, same file |
| Editor docs | Every word of a dialect has its entry in `docs.toml` | `every_dialect_word_has_editor_docs`, same file |
| Kind packages | A package of a platform extends a dialect of that platform | `kind_packages_extend_a_platform_dialect`, same file |
| Conformance | One example of a platform, built from the same `.nuc` files with every dialect of the platform | `backend_example_builds_with_every_backend_dialect` in `nuclearlang/crates/nuclear-transpile/tests/projects.rs` (`tasks_api` with `nestjs` and `fastapi`) |
| Goldens | Each example's generated output equals `<platform>/examples/expected/<project>/` | `nuclearlang/crates/nuclear-transpile/tests/projects.rs` |
| Generators | A generated resource and its use cases compile with every dialect; a new project compiles with its dialect | `a_generated_resource_compiles_with_every_dialect` (`nuclear-synapsis-framework/cli/src/main.rs`), `every_new_project_compiles_with_its_dialect` (`cli/src/scaffold.rs`) |
| The target's own tools | The generated project passes its analyzer, its test runner and a live run | each platform's `checks/` |

## How to run them

```sh
cargo test -p nuclear-dialect --test loader       # the contracts, the layout, the editor docs, kind packages
cargo test -p nuclear-transpile --test projects   # the examples: goldens and conformance
cargo test -p dragonfly                           # the generators and the new projects
UPDATE_GOLDEN=1 cargo test                        # generated output changed on purpose: regenerate, review the diff

sh nuclear-synapsis-framework/platforms/backend/checks/fastapi-check/check.sh   # pyright --strict, pytest, a live run
sh nuclear-synapsis-framework/platforms/backend/checks/nestjs-check/check.sh    # tsc --strict, node:test, a live run
sh nuclear-synapsis-framework/platforms/web/checks/react-check/check.sh         # tsc --strict, vitest, vite build
nuclear-synapsis-framework/platforms/mobile/checks/analyze-flutter.sh           # flutter analyze of the examples
python3 nuclear-synapsis-framework/platforms/mobile/checks/spec-check-dragonfly.py   # the flutter reference's blocks equal the example
```

What each check needs installed (`nuclearlang/tools/node`, `nuclearlang/tools/python/.venv`, the Flutter SDK) is in
the head of its script and in its platform's documents. CI runs the Rust tests in `.github/workflows/ci.yml`;
`.github/workflows/platform-{mobile,backend,web}.yml` run what each platform checks: its scripts in `checks/`, the
equivalences of its dialects' references and its runtime's own tests.

## Conventions

- **A conformance example is the platform's Nuclear**, with nothing tied to one dialect, so it builds with all of
  them; the test only rewrites `dialect = "..."` in its `config.nuc`.
- **Each dialect's output passes its own strict check:** `tsc --strict`, `pyright --strict`, `flutter analyze`
  with `flutter_lints`, the tests written in Nuclear, and a smoke run.
- **A platform with one dialect** (`mobile`, `web` today) has no conformance test yet: it gets one with its second
  dialect.
- **An example is a golden.** A change in generated output is accepted with `UPDATE_GOLDEN=1 cargo test` and
  reviewed as a diff, never edited by hand.
