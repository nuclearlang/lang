# The command line tool

`nuclear`: what a person, an AI agent, an editor and the MCP server run. One binary with two sets of commands
(ADR-cli-0003): the compiler's (build, check, fix, fmt, the embedded documentation, the specs for agents, type
definitions, contracts, dialects, kind packages, the agent files of a project) and the framework's, for a Synapsis
project of any platform (new, make / g, gen, run, test, install, migrate, add, remove, device, terminal-device,
watch, code, analyze, clean, repair, explain, pub, flutter, doctor, setup, credits).

## Stack

- Rust, crate `nuclear-cli` in `tools/cli/` (binary `nuclear`): the language crates of `nuclearlang/crates/`,
  `nuclear-codegen` ([the code generator](../code_generator/AGENTS.md)), `nuclear-devices`
  ([the devices](../../device-emulators/AGENTS.md)), `serde_json`, `crossterm`, `tungstenite`, `png`, `base64`.
- A member of the one Cargo workspace at the tree's root; `rustfmt.toml` max_width 120.

## Commands

```sh
cargo test -p nuclear-cli -p nuclear-codegen -p nuclear-devices && cargo clippy --all-targets
cargo run -q -p nuclear-cli -- build <file.nuc> --dialect flutter [-o out.dart]
cargo run -q -p nuclear-cli -- check <file.nuc|folder> [--dialect <d>] --json
cargo run -q -p nuclear-cli -- spec --brief --dialect flutter     # the short sheet an agent reads
installer/install.sh --no-vscode      # the user runs ~/.local/bin/nuclear: install after a change
nuclear help                          # every command (the framework's under "projects of the framework"), topic, dialect
nuclear doctor
nuclear new shop_app && cd shop_app && nuclear code
```

`cargo install` puts binaries in `~/.cargo/bin`, which is not on the user's PATH: always `installer/install.sh`.

## Folders

- `src/main.rs`: the binary: the compiler's commands (the `USAGE` text, the embedded `TOPICS`); a command line
  `framework::claims` takes goes to `framework::main`.
- `src/agent.rs`: `nuclear agent init` and `nuclear agent hook`.
- `src/framework/`: the framework's commands (`mod.rs`, with `claims` and its own `USAGE`; `assets.rs`,
  `dependencies.rs`, `doctor.rs`, `explain.rs`, `landing.rs`, `packages.rs`, `setup.rs`, `vscode.rs`, `watch.rs`)
  ([code map](docs/02-architecture/overview.md)).
- `agent-files/project/`: what `agent init` writes into a project (`AGENTS.md` section, the Cursor rule).
- `agent-files/skills/nuclear/`: the `nuclear` skill the installer copies into the agents' folders.
- `tests/build.rs`: `nuclear build` and `nuclear fix` through the binary.
- `docs/`: this project's documents (the table below).

## Rules

1. **The parser and the compiler are a library.** Both sets of commands use `nuclear-transpile::project`,
   `nuclear-dialect::Loader` and `nuclear-diag`; a missing compiler feature is built in `nuclearlang/crates/`.
2. **Nothing here names a port, a framework command or a package manager.** How a generated project is installed,
   run, tested, migrated and given packages is the dialect's `[toolchain]` (ADR-cli-0001). The mobile path is the
   exception still to remove ([roadmap](docs/01-product/roadmap.md)).
3. **A Synapsis project has only `.nuc` files**; the CLI writes only into `build/` (the generated project and
   `build/<name>.code-workspace`) and `.nuclear/`. A generator never overwrites a file.
4. **A word is the compiler's or the framework's by `framework::claims`** (ADR-cli-0003): `build` and `check` with a
   path are the compiler's; without one (or `build apk|web|...`) the framework's; `agent init` inside a project of
   the framework is the framework's. A new framework command is added to `OWN` there.
5. **A new command or behaviour** updates, in the same change: the `USAGE` text of `main.rs` or of
   `framework/mod.rs`, the CLI section of `nuclearlang/dialects/dart/docs/07-reference/flutter.md` (§11; §3.1 for
   `config.nuc`), the tutorial `nuclear-synapsis-framework/docs/08-guides/tutorial.md`, these documents, the
   skeletons of the code generator when it creates files, the skill and `agent-files/` when an agent should use
   it, and an ADR when it is a decision.
6. **Colors, logos and the animation only in a terminal**; `NO_COLOR` is respected; `check --json` through a pipe
   stays clean.
7. **When a dialect or a platform changes** (`@screen`, kinds, events), update the skeletons and test `new` +
   `make` + `check` + `analyze` + `test`.
8. **`agent-files/` is embedded in the binary** (`include_str!`) and the documentation topics too
   (`nuclearlang/docs/07-reference/`, `08-guides/`): a file renamed there breaks the build here.
9. Done = `cargo test` + `cargo clippy --all-targets` green and `installer/install.sh --no-vscode`.

## Documents

| Read | When |
|---|---|
| [docs/01-product/roadmap.md](docs/01-product/roadmap.md) | You look for what is half done, untested or pending in the CLI |
| [docs/02-architecture/overview.md](docs/02-architecture/overview.md) | You need the shape: the one binary and `framework::claims`, the code map of `framework/`, how a project and its platform are found, backend and web projects, kind packages, plugins, known limits |
| [docs/02-architecture/nuclear-command.md](docs/02-architecture/nuclear-command.md) | You change a command of the compiler's, its help topics, `spec` / `--brief`, or where it looks for dialects and definitions |
| [docs/02-architecture/agent-support.md](docs/02-architecture/agent-support.md) | You change `agent init`, the hook, the skill or `agent-files/` |
| [docs/02-architecture/build.md](docs/02-architecture/build.md) | You change `nuclear build` / `run` / `test` / `watch` / `repair` / `explain` of a mobile app, the markers in `.dart_tool`, or the VS Code workspace |
| [docs/02-architecture/packages.md](docs/02-architecture/packages.md) | You change `config.nuc` handling, `nuclear add` / `remove`, generated type definitions or assets |
| [docs/02-architecture/landing.md](docs/02-architecture/landing.md) | You change the landing page, the animation, the header, the help or the colors of the output |
| [docs/03-adr/README.md](docs/03-adr/README.md) | You need why a command has its shape, why there is one command, or why agents are supported the way they are |
| [docs/04-specs/README.md](docs/04-specs/README.md) | You continue the agent support plan |

Elsewhere:

- What a user reads about the commands: `nuclear help` and the CLI section of
  [the flutter reference](../../nuclearlang/dialects/dart/docs/07-reference/flutter.md) (§11).
- `new`, `make` and `gen`: [the code generator](../code_generator/AGENTS.md). `device` and `terminal-device`:
  [the devices](../../device-emulators/AGENTS.md). Installing: [the installer](../../installer/AGENTS.md).
- The format of a dialect (`[toolchain]`, `[project.manifest]`) and of a project:
  `nuclearlang/docs/07-reference/dialects.md`, `projects.md`.
