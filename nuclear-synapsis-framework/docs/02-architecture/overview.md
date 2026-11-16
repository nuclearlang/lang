---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [rules.md, kinds-and-plugins.md, shared-contracts.md, ../../platforms/docs/02-architecture/overview.md]
---
# Architecture

Paths start at the root of the tree.

## The parts

```
 a project (.nuc only)             config.nuc: dragonfly(platform = "backend", dialect = "fastapi")
        │ written for a
        ▼
 PLATFORM  web · mobile · backend  nuclear-synapsis-framework/platforms/<platform>/platform.toml   (the contract)
        │ implemented by                + its reference, runtime packages, examples, checks
        ▼
 FRAMEWORK DIALECT                 nuclearlang/dialects/<language>/frameworks/<dialect>/           (TOML + templates)
        │ extends a
        ▼
 LANGUAGE DIALECT                  nuclearlang/dialects/<language>/
        │ the transpiler writes
        ▼
 build/  the target project        + the platform's RUNTIME PACKAGE (platforms/<platform>/packages/)
```

| Part | Where | Owner of its documents |
|---|---|---|
| The philosophy, the rules every platform follows, the decisions | `nuclear-synapsis-framework/docs/` | this project |
| What is common to the platforms: the contract file, the shape of a platform folder | `nuclear-synapsis-framework/platforms/docs/` | this project |
| A platform: its contract, reference, runtime packages, examples, checks | `nuclear-synapsis-framework/platforms/{mobile,backend,web}/` | that platform |
| A framework dialect: kinds, decorators, templates, `[toolchain]`, type definitions | `nuclearlang/dialects/<language>/frameworks/<dialect>/` | its language's dialect project |
| The loader and the transpiler that read all of it | `nuclearlang/crates/` | `nuclearlang/` |
| The `dragonfly` command | `nuclear-synapsis-framework/cli/` until it is merged into `tools/cli/` | `tools/cli/` |
| The evaluations | `nuclear-synapsis-framework/eval/` | this project (`AGENTS.md`) |

## A project

A Dragonfly project is a folder of `.nuc` files with `config.nuc` at its root, the only manifest:

```nuclear
dragonfly(platform = "backend", dialect = "fastapi")
app(name = "tasks_api", description = "Tasks and an assistant.", version = "0.1.0")
plugins(sqlite = true, events = true, ollama = true)
```

`dragonfly new -p <platform> -d <dialect> <name>` creates it; without `-d` it gets the platform's
`default_dialect`. The code lives in `components/<c>/` by layer, with `config/`, `shared/` and `test/` beside them;
the place of each kind's file is the platform's `[layout]`. Everything generated goes to `build/` and is never
edited. `nuclear.toml` is for projects of a language dialect without Dragonfly.

What every project looks like, and why, is in [rules.md](rules.md).

## From `.nuc` to a running app

1. The loader (`nuclear-dialect`) loads the project's dialect: the chain language dialect → framework dialect (→
   project dialect), then the platform's contract, then the kind packages of that platform. A dialect that leaves
   its contract is refused (`platforms/docs/02-architecture/contract.md`).
2. The transpiler (`nuclear-transpile::project`) reads `config.nuc`, generates `contracts/<name>/` when the project
   declares contracts ([shared-contracts.md](shared-contracts.md)), checks the architecture rules of the dialect
   (N0301, N0302) and writes the target project into `build/` with the dialect's templates.
3. The `dragonfly` command runs what the dialect's `[toolchain]` declares in the generated project: install, run,
   test, migrate, add a package. It uses `nuclear-transpile::project` and `nuclear-dialect::Loader` as a library
   and knows no language (its mobile path still calls Flutter directly: [rules.md](rules.md), rule 9).
4. The generated code imports the platform's runtime package, which the generated manifest adds by itself; a
   project lists only third-party packages and plugins in `config.nuc`.

## Where the files are found

The loader reads two folders that have the same shape in the source tree and in an install
(`nuclear_dialect::Home`): `dialects/` and `platforms/`. In the tree they are `nuclearlang/dialects/` and
`nuclear-synapsis-framework/platforms/`; in an install, `$NUCLEAR_HOME/dialects` and `$NUCLEAR_HOME/platforms`.
`installer/release/stage.sh` builds an install from this project: each platform's `platform.toml`, its
`docs/07-reference/` and `docs/08-guides/`, its `kinds/` when it has one and every folder of its `packages/`, plus
the framework's `docs/08-guides/` (what `nuclear help tutorial` prints).
