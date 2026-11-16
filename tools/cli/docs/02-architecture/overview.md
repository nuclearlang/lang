---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [tools/cli/docs/02-architecture/nuclear-command.md, tools/cli/docs/02-architecture/build.md, tools/cli/docs/03-adr/0001-a-projects-commands-come-from-its-dialects-data.md]
---
# The command line tools: overview

## Two binaries

| Binary | Crate | What it is for |
|---|---|---|
| `nuclear` | `nuclear-cli`, `tools/cli/` | The transpiler: a file or a `nuclear.toml` / `config.nuc` project; the documentation and the specs; type definitions; contracts; dialects; a project's agent files ([nuclear-command.md](nuclear-command.md)) |
| `dragonfly` | `dragonfly`, `nuclear-synapsis-framework/cli/` | A Dragonfly project of any platform: create it, build it, run it, test it, migrate its database, add packages, start a device, generate code |

`dragonfly` calls `nuclear` as a program for what `nuclear` already does: `nuclear build .` of a backend or web
project, `nuclear check .` of one, `nuclear agent init`. Both use the language crates as a library
(`nuclear_transpile::project`, `nuclear_dialect::Loader`, `nuclear_diag`, `nuclear_syntax::fmt`).

## Code map of `dragonfly` (`nuclear-synapsis-framework/cli/src/`)

| File | What it does | More |
|---|---|---|
| `main.rs` | The commands: `new` (n), `make` (g) with aliases, `gen`, `code`, `watch`, `build`, `run`, `test [--integration]`, `analyze`, `check`, `migrate`, `add`, `remove`, `pub`, `agent init`, `doctor`, `setup`, `repair`, `explain`, `credits`/`author`, the gateway to `flutter`; `find_flutter` / `NO_FLUTTER`; the project root is the folder with `main.nuc` or `config.nuc`, here or above (`--project <dir>` chooses it) | [build.md](build.md) |
| `explain.rs` | `dragonfly explain [--json]`: a run-time error or a test's output on stdin (Dart, Python, Node stacks) → `title`, `hint` (`HINTS`), `frames` in `.nuc` (mobile: the app's line map; backend and web: `<output>/.nuclear/lines.json`); what the Loop's local agents read instead of the raw log | [build.md](build.md) |
| `packages.rs` | `config.nuc` sync and editing, third-party definitions of a mobile app, `flutter add` / `remove` | [packages.md](packages.md) |
| `dependencies.rs` | `dragonfly add` / `remove <package>` of a backend or web project through the dialect's `[toolchain] package_*`, definitions into the project's `defs/` (`ADR-lang-0008`) | [packages.md](packages.md) |
| `assets.rs` | Assets by convention (`ADR-mobile-0001`) | [packages.md](packages.md) |
| `generate.rs`, `scaffold.rs` | `dragonfly gen` and `dragonfly make` (ADR-codegen-0001) | [the code generator](../../../code_generator/AGENTS.md) |
| `vscode.rs` | `build/<name>.code-workspace` | [build.md](build.md) |
| `doctor.rs`, `setup.rs` | `doctor` (only what NuclearLang and Dragonfly need: the CLIs, the dialect, the package, Flutter, VS Code), `setup [--dir]` (installs Flutter step by step, asking first) | — |
| `watch.rs` | `watch`: polls the `.nuc` dates every 250 ms; prints `dragonfly: transpiling/ready/errors`; exits when its parent dies (Unix) | [build.md](build.md) |
| `device/` | `device` and `terminal-device` (ADR-devices-0001) | [the devices](../../../../device-emulators/AGENTS.md) |
| `landing.rs` | The landing page, the animation, the header, the colors, the help | [landing.md](landing.md) |

## Platforms and the manifest (`ADR-synapsis-0002`)

- `dragonfly new [-p mobile] [-d flutter] <name>` (`platform_and_dialect`, `new_name`, `hint_for`): a dialect alone
  gives its platform (`-d nestjs` is backend), a platform alone its default dialect (`[platform] default_dialect` of
  `platform.toml`); neither is mobile. The name is letters, digits and `_`; an option glued to it (`shop-p`) or a
  stray word (`backend` without `-p`) is refused with a hint. The dialect is loaded and must belong to the platform.
- A mobile project is scaffolded (`scaffold::project`), its Flutter app created (`flutter create` in `build/app`) and
  built. A backend project gets `scaffold::backend_project`: `config.nuc`, `config/project_config.nuc` with
  `SQLite(file = env("DATABASE", "app.sqlite"), createTables = true)`, `plugins(sqlite = true)` and a first test in
  `test/app_test.nuc`. A web project gets `scaffold::web_project`: `config.nuc`, `main.nuc` (the App with
  `createElement(RouterProvider, router = appRouter())`), an `Http` connection and `config/project_config.nuc`;
  screens are added with `dragonfly make screen`. Every `new` also runs `nuclear agent init`.
- `manifest()` reads `config.nuc` through `Manifest::read` (`dragonfly(platform, dialect)`, `app(name)`). An app
  without that line is an app of the mobile platform's default dialect (`any_manifest`); its `dragonfly check`
  reports N0303 with the line to add. `packages::template` writes the `dragonfly(...)` line first.
- `build` writes the project card `.nuclear/project.json` (`project::write_metadata`;
  `nuclearlang/docs/07-reference/projects.md` §1.1).
- Dialects and the runtime packages are found in the installation (`nuclear_dialect::install_dir()`:
  `$NUCLEAR_HOME`, or the folder above the binary's `bin/`), else in the working tree it was built in.
  `NUCLEAR_DIALECT_PATH` adds dialect folders; `DRAGONFLY_PACKAGE` names the `dragonfly` Dart package.

## Backend and web projects

`non_mobile_manifest(root)` tells a backend or web project (`dragonfly(platform = "backend"|"web", ...)`) from a
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
- `dragonfly migrate [make "<message>" | up | down]` runs `migrate_make` / `migrate` / `migrate_down` with
  `{{message}}` and `{{migrations}}` = `<project>/migrations` (`migrate_command`; `ADR-backend-0001` §5).
- `dragonfly check` delegates to `nuclear check .` (the Flutter check resolves a pubspec and fonts they do not have).
- `dragonfly make <kind> <component> <Name> [--screen <s>]` writes the platform's `[skeletons]` entry at its
  `[layout]` path ([the code generator](../../../code_generator/docs/02-architecture/overview.md)).

## Kind packages (`ADR-synapsis-0004`)

`dragonfly add <folder>` installs a kind package (`kinds/<name>/` with `kind.toml` `[package]`) in `<install>/kinds/`
after loading it with every dialect it implements (`add_package`, `copy_dir`). `loader()` of both binaries adds
`kinds/` of the current folder and `<install>/kinds` to `Loader.packages`. The skeleton of a package comes from
`nuclear kind new <name> -p <platform> -d <dialect>`.

## Plugins (`ADR-synapsis-0004`)

`build` of a mobile app adds the packages of the plugins `config.nuc` enables (`plugin_packages`,
`project::enabled_plugins`) and removes those of plugins turned off (`sync_plugin_packages`,
`build/app/.dragonfly_plugins`); a `local` package is found with `runtime_package` (the installed `packages/`, else
the working tree).

## Known limits

- Generators normalize a name with `snake()` but do not validate identifiers (a leading digit, reserved words).
- `--org` only in `new`; when `build` creates a missing app it uses `com.example`.
- The `dragonfly` Dart package is a local path until it is on pub.dev.
- Mobile apps are built with the Flutter commands called from Rust; backend and web projects through the dialect's
  `[toolchain]`. `manifest()` still refuses a non-mobile project on the Flutter-only paths (`code`, `device`, `pub`,
  `flutter`).
- A fresh web project builds and type-checks (`tsc`), but `vite build` and `dragonfly run` need the react runtime's
  bundling fix: rollup cannot resolve `react` from the `--install-links`ed `dragonfly-web`
  ([the web platform](../../../../nuclear-synapsis-framework/platforms/web/AGENTS.md)).
