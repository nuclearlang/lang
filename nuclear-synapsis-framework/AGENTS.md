# Synapsis — the framework of NuclearLang

Synapsis is to Nuclear what Actix is to Rust: the language comes with its framework, and no other is needed. It
is what a project adds to the base language (kinds, decorators, components, `config.nuc`, plugins and tests),
identical for every dialect of a platform. It has exactly three platforms, `web`, `mobile` and `backend`; a dialect
only changes the language underneath: the Nuclear code of a project never changes when its dialect changes.

Paths in these documents are relative to this folder (`nuclear-synapsis-framework/`); a path that starts with
`nuclearlang/`, `tools/`, `installer/` or `.github/` starts at the root of the tree. The rules of the whole tree
are in [the root `AGENTS.md`](../AGENTS.md).

## Stack

- The framework itself is data and documents: one contract per platform (`platforms/<platform>/platform.toml`,
  TOML) read by the compiler's loader (`nuclearlang/crates/nuclear-dialect`). What `nuclear make` and `nuclear gen`
  write per platform is not here: it is `tools/code_generator/platforms/<platform>/generators.toml`.
- The dialects that implement the platforms are with their language:
  `nuclearlang/dialects/<language>/frameworks/<dialect>/` (`flutter`, `fastapi`, `nestjs`, `react`).
- Runtime packages in the target languages, per platform: Dart (`synapsis`, `synapsis_genkit`), Python
  (`synapsis-py`), TypeScript (`synapsis-nest`, `synapsis-web`).
- The framework's commands (`new`, `make`, `gen`, `run`, `test`, `migrate`, `device`...) are commands of `nuclear`:
  the module `tools/cli/src/framework/` of the crate `nuclear-cli`. This folder holds no Rust.
- `eval/`: Python scripts.

## Commands

From the root of the tree:

```sh
cargo test                                        # everything: the contracts, the examples, the command
cargo clippy --all-targets
cargo test -p nuclear-dialect --test loader       # every framework dialect implements its platform's contract
cargo test -p nuclear-transpile --test projects   # the examples: goldens and the conformance test
cargo test -p nuclear-cli                         # the framework's commands (tools/cli/src/framework/)
cargo test -p nuclear-codegen                     # what `make` and `gen` write (tools/code_generator/)
UPDATE_GOLDEN=1 cargo test                        # generated output changed on purpose: regenerate, review the diff
installer/install.sh --no-vscode                  # the user runs the installed `nuclear`: install after a change
```

The checks of each platform against the target's own tools: `platforms/docs/05-standards/testing.md`.

## Folders

- `platforms/`: what is common to the three platforms ([`platforms/AGENTS.md`](platforms/AGENTS.md)) and one
  folder per platform, each its own project: [`mobile/`](platforms/mobile/AGENTS.md),
  [`backend/`](platforms/backend/AGENTS.md), [`web/`](platforms/web/AGENTS.md).
- Not here: the framework's commands are [`tools/cli/`](../tools/cli/AGENTS.md), what `make` and `gen` write is
  [`tools/code_generator/`](../tools/code_generator/AGENTS.md), the devices are
  [`device-emulators/`](../device-emulators/AGENTS.md).
- `eval/agent-eval/`: the agent evaluation: each task of `tasks.toml` run with Claude Code in a fresh copy of its
  project, then checked (`run.py --mode baseline|agent`).
- `eval/thesis/`: the three measurable claims of NuclearLang tested with numbers (`run.py`, `bench.py`,
  `report.py`); step by step in [`eval/thesis/README.md`](eval/thesis/README.md).
- `docs/`: the documents of the framework (the table below). `docs/08-guides/` is what a user reads; the installer
  ships it and `nuclear help tutorial` prints it.
- `README.md`: the introduction for a user. `CHANGELOG.md`: what changed for a user.

## Rules

1. **A platform is what is written; a dialect is only how it comes out.** Kinds, decorators, folders,
   `config.nuc`, plugins and tests are the platform's, in Nuclear, the same for every dialect of it. Kinds and
   features may differ between platforms, never between the dialects of one platform.
2. **The one exception** is code that uses a dialect's type definitions (`numpy` exists only in Python), or a kind
   package implemented for some dialects: allowed, and it ties that project to those dialects.
3. **A platform names no dialect and no target's library.** Its contract, reference, docs, examples and
   diagnostics hold only Nuclear and Nuclear's own library (`nuclearlang/docs/07-reference/library.md`).
4. **Kinds are data, never compiler code:** TOML, templates, a runtime package and docs. What a template cannot
   express is asked for as a generic capability of the compiler (`nuclearlang/`), for every kind.
5. **A project is only `.nuc`.** Everything generated goes to `build/` and is never edited; no target code is
   written by hand to make a dialect easier.
6. **The command knows no language.** What it runs for a platform comes from the dialect (`[toolchain]`).
7. **Something new of the tree is written with Synapsis** when one of the three platforms fits it (root rule 12).
8. `docs/08-guides/` and each platform's `docs/07-reference/` are checked by tools and shipped in an install:
   they change only with the feature they describe, in the same change.
9. A decision of the user becomes an ADR in `docs/03-adr/`, cited `ADR-synapsis-NNNN`; a feature starts as a spec
   in `docs/04-specs/`; pending work is `docs/01-product/roadmap.md`. What cannot be read from the code or the
   documents is asked, not invented.
10. Done = `cargo test` and `cargo clippy --all-targets` green, the documents of the area updated in the same
    change, the roadmap current.

## Documents (open one only when its line matches the task)

| You need | Read |
|---|---|
| What the framework is for, its users, what it does not do | [docs/00-context/vision.md](docs/00-context/vision.md) |
| A word with two meanings (contract, component, dialect, plugin, kind package) | [docs/00-context/glossary.md](docs/00-context/glossary.md) |
| What the framework must give, per platform | [docs/01-product/prd.md](docs/01-product/prd.md) |
| What is half done, untested, to decide or pending in the framework as a whole | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| The parts (platform, dialect, runtime, command), a project, how `.nuc` becomes a running app | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| To design a kind, a decorator, a platform feature or a dialect: the rules all of them follow | [docs/02-architecture/rules.md](docs/02-architecture/rules.md) |
| Where a kind comes from, kind packages, plugins, N0304–N0306 | [docs/02-architecture/kinds-and-plugins.md](docs/02-architecture/kinds-and-plugins.md) |
| The contract a backend publishes and a client reads: files, flow, N0307, N0116 | [docs/02-architecture/shared-contracts.md](docs/02-architecture/shared-contracts.md) |
| Why a rule of the framework exists | [docs/03-adr/README.md](docs/03-adr/README.md) |
| A change with a plan | [docs/04-specs/README.md](docs/04-specs/README.md) |
| What a platform is, `platform.toml`, what the loader checks, how a platform is tested | [platforms/AGENTS.md](platforms/AGENTS.md) |
| What a user reads: the guide, the tutorial, kinds, generators | [docs/08-guides/README.md](docs/08-guides/README.md) |
