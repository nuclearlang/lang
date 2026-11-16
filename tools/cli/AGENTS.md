# The command line tools

What a person, an AI agent, an editor and the MCP server run: today two binaries. `nuclear` is the transpiler's
command line (build, check, fix, fmt, the embedded documentation, the specs for agents, type definitions, contracts,
dialects, kind packages, the agent files of a project). `dragonfly` is the framework's (new projects, build, run,
test, migrations, packages, devices, the editor workspace, `make` and `gen`).

## Stack

- `nuclear`: Rust, crate `nuclear-cli` in `tools/cli/` (`serde_json`; the language crates of `nuclearlang/crates/`).
- `dragonfly`: Rust, crate `dragonfly` in `nuclear-synapsis-framework/cli/` (also `crossterm`, `tungstenite`,
  `png`, `base64` for the devices). It moves into this crate (spec 008, T2.2).
- Both are members of the one Cargo workspace at the tree's root; `rustfmt.toml` max_width 120.

## Commands

```sh
cargo test -p nuclear-cli -p dragonfly && cargo clippy --all-targets
cargo run -q -p nuclear-cli -- build <file.nuc> --dialect flutter [-o out.dart]
cargo run -q -p nuclear-cli -- check <file.nuc|folder> [--dialect <d>] --json
cargo run -q -p nuclear-cli -- spec --brief --dialect flutter     # the short sheet an agent reads
installer/install.sh --no-vscode      # the user runs ~/.local/bin/{nuclear,dragonfly}: install after a change
nuclear help                          # every command, every documentation topic, every dialect
dragonfly help                        # every command of the framework
dragonfly doctor
dragonfly new shop_app && cd shop_app && dragonfly code
```

`cargo install` puts binaries in `~/.cargo/bin`, which is not on the user's PATH: always `installer/install.sh`.

## Folders

- `src/main.rs`: the `nuclear` binary (the `USAGE` text, the embedded `TOPICS`, every command).
- `src/agent.rs`: `nuclear agent init` and `nuclear agent hook`.
- `agent-files/project/`: what `agent init` writes into a project (`AGENTS.md` section, the Cursor rule).
- `agent-files/skills/nuclear/`: the `nuclear` skill the installer copies into the agents' folders.
- `tests/build.rs`: `nuclear build` and `nuclear fix` through the binary.
- `nuclear-synapsis-framework/cli/src/`: the `dragonfly` binary, until T2.2
  ([code map](docs/02-architecture/overview.md)).
- `docs/`: this project's documents (the table below).

## Rules

1. **The parser and the compiler are a library.** Both binaries use `nuclear-transpile::project`,
   `nuclear-dialect::Loader` and `nuclear-diag`; a missing compiler feature is built in `nuclearlang/crates/`.
2. **Nothing here names a port, a framework command or a package manager.** How a generated project is installed,
   run, tested, migrated and given packages is the dialect's `[toolchain]` (ADR-cli-0001). The mobile path is the
   exception still to remove ([roadmap](docs/01-product/roadmap.md)).
3. **A Dragonfly project has only `.nuc` files**; the CLI writes only into `build/` (the generated project and
   `build/<name>.code-workspace`) and `.nuclear/`. A generator never overwrites a file.
4. **A new command or behaviour** updates, in the same change: the `USAGE` text of its `main.rs`, the `dragonfly`
   CLI section of `nuclearlang/dialects/dart/docs/07-reference/flutter.md` (§11; §3.1 for `config.nuc`), the
   tutorial `nuclear-synapsis-framework/docs/08-guides/tutorial.md`, these documents, the skeletons of
   `scaffold.rs` when it creates files, the skill and `agent-files/` when an agent should use it, and an ADR when
   it is a decision.
5. **Colors, logos and the animation only in a terminal**; `NO_COLOR` is respected; `check --json` through a pipe
   stays clean.
6. **When a dialect or a platform changes** (`@screen`, kinds, events), update the skeletons and test `new` +
   `make` + `check` + `analyze` + `test`.
7. **`agent-files/` is embedded in the binary** (`include_str!`) and the documentation topics too
   (`nuclearlang/docs/07-reference/`, `08-guides/`): a file renamed there breaks the build here.
8. Done = `cargo test` + `cargo clippy --all-targets` green and `installer/install.sh --no-vscode`.

## Documents

| Read | When |
|---|---|
| [docs/01-product/roadmap.md](docs/01-product/roadmap.md) | You look for what is half done, untested or pending in the CLI |
| [docs/02-architecture/overview.md](docs/02-architecture/overview.md) | You need the shape: the two binaries, the code map of `dragonfly`, how a project and its platform are found, backend and web projects, kind packages, plugins, known limits |
| [docs/02-architecture/nuclear-command.md](docs/02-architecture/nuclear-command.md) | You change a command of `nuclear`, its help topics, `spec` / `--brief`, or where it looks for dialects and definitions |
| [docs/02-architecture/agent-support.md](docs/02-architecture/agent-support.md) | You change `agent init`, the hook, the skill or `agent-files/` |
| [docs/02-architecture/build.md](docs/02-architecture/build.md) | You change `dragonfly build` / `run` / `test` / `watch` / `repair` / `explain` of a mobile app, the markers in `.dart_tool`, or the VS Code workspace |
| [docs/02-architecture/packages.md](docs/02-architecture/packages.md) | You change `config.nuc` handling, `dragonfly add` / `remove`, generated type definitions or assets |
| [docs/02-architecture/landing.md](docs/02-architecture/landing.md) | You change the landing page, the animation, the header, the help or the colors of the output |
| [docs/03-adr/README.md](docs/03-adr/README.md) | You need why a command has its shape, or why agents are supported the way they are |
| [docs/04-specs/README.md](docs/04-specs/README.md) | You continue the agent support plan |

Elsewhere:

- What a user reads about the commands: `nuclear help`, `dragonfly help`, and the `dragonfly` CLI section of
  [the flutter reference](../../nuclearlang/dialects/dart/docs/07-reference/flutter.md) (§11).
- `gen` and `make`: [the code generator](../code_generator/AGENTS.md). `device` and `terminal-device`:
  [the devices](../../device-emulators/AGENTS.md). Installing: [the installer](../../installer/AGENTS.md).
- The format of a dialect (`[toolchain]`, `[project.manifest]`) and of a project:
  `nuclearlang/docs/07-reference/dialects.md`, `projects.md`.
