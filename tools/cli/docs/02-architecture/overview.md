---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [tools/cli/src/framework/mod.rs, tools/cli/docs/03-adr/0003-one-command-nuclear.md, tools/cli/docs/02-architecture/nuclear-command.md, tools/cli/docs/02-architecture/build.md, tools/cli/docs/03-adr/0001-a-projects-commands-come-from-its-dialects-data.md]
---
# The command line tool: overview

## One binary, two sets of commands (ADR-cli-0003)

| Commands | Code | What they are for |
|---|---|---|
| The compiler's | `src/main.rs`, `src/agent.rs` | A file or a `nuclear.toml` / `config.nuc` project; the documentation and the specs; type definitions; contracts; dialects; a project's agent files ([nuclear-command.md](nuclear-command.md)) |
| Environments | `src/env.rs` | Spec 021: the dotenv parser, the precedence of the files, the keyring (crate `keyring`: Secret Service over zbus, Keychain, Credential Manager; the account `<project>-<key>/<env>/<NAME>`, the key of `.nuclear/env-key`; without a keyring a secret goes to `.env.<env>.local`), `--env` / `NUCLEAR_ENV` / `.nuclear/env`, `nuclear env`, what `build` writes (`build/.env`, or `Manifest::env` for a client) and N0311/N0312 at each `env()` |
| The framework's | `src/framework/` | A Synapsis project of any platform: create it, build it, run it, test it, migrate its database, add packages, start a device, generate code |

`main` asks `framework::claims(args)` first: a command only the framework has (`OWN`: `new`, `make`/`g`, `gen`,
`run`, `test`, `install`, `migrate`, `add`, `remove`, `device`, `terminal-device`, `watch`, `code`, `analyze`,
`clean`, `repair`, `explain`, `monitor`, `env`, `pub`, `flutter`, `doctor`, `setup`, `credits`...), no command at all (the landing
page), `build` / `check` without a path or with a target (`TARGETS`: `apk`, `web`, ...), and `agent init` inside a
project of the framework go to `framework::main`; everything else is the compiler's. `nuclear help` prints both
usages, the framework's under "projects of the framework".

The framework's `build` and `check` of a backend or web project run `nuclear build .` / `nuclear check .` (the
installed command, as a program). Both sets use the language crates as a library (`nuclear_transpile::project`,
`nuclear_dialect::Loader`, `nuclear_diag`, `nuclear_syntax::fmt`); the framework's also `nuclear_codegen` and
`nuclear_devices`.

## Code map of `src/framework/`

| File | What it does | More |
|---|---|---|
| `mod.rs` | `claims`, `main` and the commands: `new` (n), `make` (g) with aliases, `gen`, `code`, `watch`, `build`, `run`, `test [--integration]`, `analyze`, `check`, `migrate`, `add`, `remove`, `pub`, `agent init`, `doctor`, `setup`, `repair`, `explain`, `credits`/`author`, `intro`, the gateway to `flutter`; `find_flutter` / `NO_FLUTTER`; the project root is the folder with `main.nuc` or `config.nuc`, here or above (`--project <dir>` chooses it) | [build.md](build.md) |
| `monitor.rs` | `nuclear monitor [--json]` (spec 015 of the platform): the report of a run with `--monitor` (`.nuclear/monitor/report.json`, found here or above) as its hot spots (`slow`, `loop`, `connections`, `memory`) and the call tree; `--monitor` itself is read by `main` (`NUCLEAR_MONITOR`, then `NUCLEAR_MONITOR_FILE` set to the project's report by `monitored`, inherited by the build and the app it starts) | [build.md](build.md) |
| `runlog.rs` | the project's run log `.nuclear/logs/run.log` of `nuclear run`: an ISO time per line, ANSI stripped, kept under 1 MB, never stopping the run when it cannot be written; `step: build|install|serve <url>|flutter`, the build's and the server's output (tee'd: stdin inherited, stdout/stderr piped to the terminal and the log, colours kept on a terminal), `failed: <why>`, `exited: <code>`; a mobile run logs only its steps (Flutter keeps the terminal). The editor follows it (▷ Serve) and the MCP tool `project_run_log` reads it | — |
| `explain.rs` | `nuclear explain [--json]`: a run-time error or a test's output on stdin (Dart, Python, Node stacks) → `title`, `hint` (`HINTS`), `frames` in `.nuc` (mobile: the app's line map; backend and web: `<output>/.nuclear/lines.json`); what the Nuclear Builder's local agents read instead of the raw log | [build.md](build.md) |
| `packages.rs` | `config.nuc` sync and editing, third-party definitions of a mobile app, `flutter add` / `remove` | [packages.md](packages.md) |
| `dependencies.rs` | `nuclear add` / `remove <package>` of a backend or web project through the dialect's `[toolchain] package_*`, definitions into the project's `defs/` (`ADR-lang-0008`) | [packages.md](packages.md) |
| `assets.rs` | Assets by convention (`ADR-mobile-0001`) | [packages.md](packages.md) |
| `vscode.rs` | `build/<name>.code-workspace` | [build.md](build.md) |
| `doctor.rs`, `setup.rs` | `doctor` (only what NuclearLang and Synapsis need: the command, the dialect, the package, Flutter, VS Code), `setup [--dir]` (installs Flutter step by step, asking first) | — |
| `watch.rs` | `watch`: polls the `.nuc` dates every 250 ms; prints `nuclear: transpiling/ready/errors`; exits when its parent dies (Unix) | [build.md](build.md) |
| `landing.rs` | The landing page, the animation, the header, the colors, the help | [landing.md](landing.md) |

`new`, `make` and `gen` are written by `nuclear_codegen` (`scaffold`, `generate`; ADR-codegen-0001): `mod.rs` keeps
only the commands (`make`, `make_from_layout`, `gen_command`, `ensure_http`, `GEN_USAGE`) and prints what it reports
([the code generator](../../../code_generator/AGENTS.md)). `device` and `terminal-device` parse and run through
`nuclear_devices` (ADR-devices-0001; [the devices](../../../../device-emulators/AGENTS.md)).

## Platforms and the manifest (`ADR-synapsis-0002`)

- `nuclear new [-p mobile] [-d flutter] <name>` (`platform_and_dialect`, `new_name`, `hint_for`): a dialect alone
  gives its platform (`-d nestjs` is backend), a platform alone its default dialect (`[platform] default_dialect` of
  `platform.toml`); neither is mobile. The name is letters, digits and `_`; an option glued to it (`shop-p`) or a
  stray word (`backend` without `-p`) is refused with a hint. The dialect is loaded and must belong to the platform.
- A mobile project is scaffolded (`nuclear_codegen::scaffold::project`), its Flutter app created (`flutter create` in `build/app`) and
  built. A backend project gets `scaffold::backend_project`: `config.nuc`, `config/project_config.nuc` with
  `SQLite(file = env("DATABASE", "app.sqlite"), createTables = true)`, `plugins(sqlite = true)` and a first test in
  `test/app_test.nuc`. A web project gets `scaffold::web_project`: `config.nuc`, `main.nuc` (the App with
  `createElement(RouterProvider, router = appRouter())`), an `Http` connection and `config/project_config.nuc`;
  screens are added with `nuclear make screen`. `--websocket` gives a backend `plugins(events, websocket)` and
  `WebSocketServer(path = "ws")`, a web app a `WebSocket` connection instead of `Http`; `--token <ENV_VAR>` gives a
  backend `guards = [NoOrigin(), Token(value = env(ENV_VAR))]` (`scaffold::NewOptions`). Every `new` also runs
  `nuclear agent init`.
- `manifest()` reads `config.nuc` through `Manifest::read` (`synapsis(platform, dialect)`, `app(name)`). An app
  without that line is an app of the mobile platform's default dialect (`any_manifest`); its `nuclear check`
  reports N0303 with the line to add. `packages::template` writes the `synapsis(...)` line first.
- `build` writes the project card `.nuclear/project.json` (`project::write_metadata`;
  `nuclearlang/docs/07-reference/projects.md` §1.1).
- Dialects and the runtime packages are found in the installation (`nuclear_dialect::install_dir()`:
  `$NUCLEAR_HOME`, or the folder above the binary's `bin/`), else in the working tree it was built in.
  `NUCLEAR_DIALECT_PATH` adds dialect folders; `SYNAPSIS_PACKAGE` names the `synapsis` Dart package.

## Backend and web projects

`non_mobile_manifest(root)` tells a backend or web project (`synapsis(platform = "backend"|"web", ...)`) from a
mobile app. For it (ADR-cli-0001):

- `build` is `nuclear build .`; `install`, `run`, `test`, `analyze` run the dialect's `[toolchain]` command of that
  name (`backend_command`: `{{packages}}` = `<install>/packages`; more placeholders through `vars`, quoted by
  `shell_quote`) with `sh -c` (`cmd /C` on Windows) in the output folder. `fill_command` also fills `{{tools}}`
  (`<install>/tools`), `{{url}}`, `{{port}}` and `{{host}}`. A command the dialect does not have is refused with the
  list of those it has. Each of these commands also writes the editor workspace (`vscode::write`), and `build`
  runs `[toolchain] compile` once the app is installed, so a running server restarts on the build.
- `install` also runs `[toolchain] install_local` once per folder dependency of `config.nuc` (`{{path}}`; a package
  manager keeps the old copy of a folder whose version did not change), then generates the missing type definitions
  ([packages.md](packages.md)).
- `nuclear migrate [make "<message>" | up | down]` runs `migrate_make` / `migrate` / `migrate_down` with
  `{{message}}` and `{{migrations}}` = `<project>/migrations` (`migrate_command`; `ADR-backend-0001` §5).
- `nuclear check` (no path) delegates to `nuclear check .` (the Flutter check resolves a pubspec and fonts they do not have).
- `nuclear make <kind> <component> <Name> [--screen <s>]` writes the platform's `[skeletons]` entry at its
  `[layout]` path ([the code generator](../../../code_generator/docs/02-architecture/overview.md)).

## Kind packages (`ADR-synapsis-0004`)

`nuclear add <folder>` installs a kind package (`kinds/<name>/` with `kind.toml` `[package]`) in `<install>/kinds/`
after loading it with every dialect it implements (`add_package`, `copy_dir`). `loader()` of both sets of commands adds
`kinds/` of the current folder and `<install>/kinds` to `Loader.packages`. The skeleton of a package comes from
`nuclear kind new <name> -p <platform> -d <dialect>`.

## Plugins (`ADR-synapsis-0004`)

`build` of a mobile app adds the packages of the plugins `config.nuc` enables (`plugin_packages`,
`project::enabled_plugins`) and removes those of plugins turned off (`sync_plugin_packages`,
`build/app/.synapsis_plugins`); a `local` package is found with `runtime_package` (the installed `packages/`, else
the working tree).

## Known limits

- Generators normalize a name with `snake()` but do not validate identifiers (a leading digit, reserved words).
- `--org` only in `new`; when `build` creates a missing app it uses `com.example`.
- The `synapsis` Dart package is a local path until it is on pub.dev.
- Mobile apps are built with the Flutter commands called from Rust; backend and web projects through the dialect's
  `[toolchain]`. `manifest()` still refuses a non-mobile project on the Flutter-only paths (`code`, `device`, `pub`,
  `flutter`).
- A fresh web project builds and type-checks (`tsc`), but `vite build` and `nuclear run` need the react runtime's
  bundling fix: rollup cannot resolve `react` from the `--install-links`ed `synapsis-web`
  ([the web platform](../../../../nuclear-synapsis-framework/platforms/web/AGENTS.md)).
