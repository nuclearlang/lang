---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, integrations.md, ../05-standards/testing.md]
---
# Dependencies

## Between the crates

| Crate | Depends on |
|---|---|
| `nuclear-diag` | — |
| `nuclear-syntax` | `nuclear-diag` |
| `nuclear-dialect` | `nuclear-diag`, `nuclear-syntax` |
| `nuclear-transpile` | `nuclear-diag`, `nuclear-syntax`, `nuclear-dialect` |
| `nuclear-lsp` | the four above |

All are members of the tree's one workspace (`../Cargo.toml`: version `0.1.0`, edition 2024, license Apache-2.0).
`tools/spec-check` is a workspace of its own (excluded from the tree's) that uses `nuclear-dialect` and
`nuclear-transpile` by path.

## Who uses this project

| User | Uses | How |
|---|---|---|
| `../tools/cli/` (the `nuclear` command) | the four compiler crates | Rust library; it embeds `docs/07-reference/` and `docs/08-guides/` with `include_str!` |
| `../tools/code_generator/` (the crate `nuclear-codegen`: what `nuclear make` and `nuclear gen` write) | `nuclear-dialect`, `nuclear-syntax`, `nuclear-transpile` | Rust library |
| `../extensions/{vscode,jetbrains,zed}/` | the `nuclear-lsp` binary, `dialects/` | VS Code and JetBrains bundle the binary with every dialect, Zed runs the installed one; they talk to it only through LSP |
| The platforms' checks (`../nuclear-synapsis-framework/platforms/<platform>/checks/`) | `tools/defs/flutter_project/`, `tools/node/`, `tools/python/.venv` | the host project and the installed target libraries |

## External

| Dependency | Version | Used for |
|---|---|---|
| `serde` (derive), `serde_json` | 1 | dialect and definitions data, JSON diagnostics, the LSP messages |
| `toml` | 0.8 | dialect files, `nuclear.toml`, `base/*.toml` |
| Dart `package:analyzer` | the one resolved in `tools/defs/pubspec.lock` | the Dart type definitions generator (`tools/defs/bin/defs.dart`) |
| Flutter SDK | 3.47.8 installed; the definitions are `flutter@3.47.7` | resolving `package:flutter/...` and the pub packages for the generator; `dart run` in `tools/stdlib-check.sh` |
| TypeScript | `^5.9.3` (`tools/node/package.json`) | `tools/defs/typescript/gen.js` reads `.d.ts`; `tsc --strict` in the checks |
| Python packages | pinned in `tools/python/requirements.txt` (pyright 1.1.414 among them) | `tools/defs/python/gen.py` inspects the installed modules; pyright in the checks |

The server uses only `serde_json`: no async runtime, no LSP library.

`tools/node/package.json` and `tools/python/requirements.txt` also hold the libraries of the framework dialects
(NestJS, React, FastAPI, SQLAlchemy, LangChain...): their type definitions are generated from what is installed
there, and the platforms' checks compile against it.

## What the tools expect on the machine

The paths of the development machine (the Flutter SDK, the install, the cache) are in
[`../docs/06-runbooks/machine.md`](../../../docs/06-runbooks/machine.md). What is particular to this project:

- `tools/defs/generate.sh` defaults to a Flutter SDK in `~/development/flutter`: pass `FLUTTER_ROOT=<the SDK>`. To
  regenerate only one package without moving the others to the installed Flutter, run `bin/defs.dart` with the
  version wanted (`FV=3.47.7`, the `pub synapsis` line of `generate.sh`).
- `tools/stdlib-check.sh` takes `tsc` from the PATH or from `tools/node/node_modules/typescript/bin/tsc`
  (`TSC=<path>` for another), Python and pyright from `tools/python/.venv` (`PY=<python>`, `PYRIGHT=<pyright>`),
  `dart` from the PATH or `$FLUTTER_ROOT/bin/dart` (`DART=<path>`).
- The cache of the definitions generated for projects is `nuclear_dialect::defs_cache_dir`
  (`$XDG_CACHE_HOME/nuclearlang/defs`, else `~/.cache/nuclearlang/defs`); an install is
  `nuclear_dialect::install_dir` (`$NUCLEAR_HOME`, else the folder above the binary's `bin/`).
