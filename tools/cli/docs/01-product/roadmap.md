---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [tools/cli/docs/03-adr/0003-one-command-nuclear.md, tools/cli/docs/04-specs/README.md]
---
# Roadmap of the command line tools

The pending work of `nuclear`. A done item is deleted. What `gen` and `make` write is in
[the code generator's roadmap](../../../code_generator/docs/01-product/roadmap.md); the devices in
[theirs](../../../../device-emulators/docs/01-product/roadmap.md).

## Half done

- **The toolchains of a fresh machine** (ADR-cli-0004): `nuclear setup node|python` works on Linux and macOS only;
  on Windows the user installs Node.js or Python and names it (`NUCLEAR_NODE`, `NUCLEAR_PYTHON`). A Linux with musl
  gets no Nuclear Python (python-build-standalone's glibc build). Untested on a clean machine: `nuclear setup node`,
  and a `fastapi` project with only the AI archive's Python.

- **The `nuclear` CLI for backend projects** has `new`, `build`, `install`, `run`, `test`, `migrate`, `check` and
  `make` (every kind, from the platform's `[layout]` + `[skeletons]`). Missing: `watch` for backend projects, and
  `[toolchain]` for mobile (today `"flutter"` is still hard-coded in `src/framework/`).
- **Agent support** ([spec 001](../04-specs/001-agent-support/plan.md)): F7 left: harder tasks (a new project from
  scratch, no examples to copy), also for Python (fastapi); then tune the brief. F1–F6 and their measurement are in
  ADR-cli-0002.

## Untested

- The agent files (ADR-cli-0002) in Codex, OpenCode and Cursor (only Claude Code ran): that each finds the skill in
  `~/.agents/skills` / `~/.codex/skills` and reads `AGENTS.md` / the Cursor rule.
- The CLI animation (WELCOME, the shine every 5 s, the page alive until Enter) and `credits` in the user's terminal.
- `nuclear setup`: the real download (~1 GB), unpacking and PATH end to end; the dnf / zypper package names are
  not in the official guide.
- The registry of projects (`nuclear projects`) on Windows (`%LOCALAPPDATA%`) and macOS; two commands writing it at
  the same moment keep one change (the other is written on its next build). The editor's devices (`nuclear device`)
  still pick a random port for Flutter web: allowed by a backend in development (any local port), not in the
  registry. A project whose port another program holds fails to start (address in use): no other port is chosen
  then.

## To decide with the user

- Suggested CLI commands: `g crud`, `g form`, `routes`, `graph`, `rename`, `remove`, `upgrade`, `g i18n`,
  `--dry-run`.

## Pending

- **`nuclear run` of a backend in a terminal does not take a new `.nuc`** (found on a clean machine, 2026-11-21): a
  resource generated while it runs (`nuclear gen resource`) answers 404 until `run` starts again; in VS Code
  `nuclear watch` transpiles it. Wanted: `run` watching the project's `.nuc` files as `watch` does.
- **Found writing the skills library (2026-11-18)**: no OpenAPI importer; no dependency audit nor load-test command; `nuclear fmt --check` is not in the default CI line.
- **`nuclear new .` is refused** ("'.' is not a project name"; found by spec 016's measured run, 2026-11-18): an
  agent told "create it here" made a subfolder and moved its files up by hand. Wanted: `nuclear new .` creates the
  project in the current empty folder, named after it.
- **No way to look at a mobile app on a machine without a display** (same run): `nuclear device` needs one, so the
  agent installed Xvfb and Chromium with `apt-get` and took screenshots of `nuclear build web`. Wanted: a headless
  screenshot of a screen from the tools.
- **`nuclear install` keeps a folder dependency it installed before** (backend, fastapi): a project whose
  `dependencies(x = "../x")` changed still runs the old copy in `build/.venv` until it is reinstalled by hand
  (`pip install --force-reinstall --no-deps ../x`, which `nuclear-chat install` does; found by Nuclear Chat,
  2026-11-18). Wanted: a folder dependency reinstalled on every `nuclear install`, or installed editable.
  The same with the runtime in a web project: `nuclear install` kept an old `synapsis-web` of the same version in
  `build/app/node_modules` (npm does not copy a `file:` package again when its version is unchanged), so the tests
  ran the old runtime until the folder was deleted by hand (found with `nuclear-chat/ui`, 2026-11-18; again with a
  nestjs backend and `synapsis-nest`'s `origins`, 2026-11-21). Wanted: the runtime copied fresh on every
  `nuclear install`.

- The mobile path still calls Flutter directly (the SDK lookup, the `flutter` commands, devices, hot reload): move
  it to the flutter dialect's `[toolchain]` like backend and web (the consequence ADR-cli-0001 names).
- `nuclear analyze` in a fastapi project answers "the fastapi dialect has no toolchain.analyze" (found in the
  Nuclear Developer's project), and the `AGENTS.md` that `nuclear agent init` writes tells every agent to run it
  after `nuclear check`.
- Removing `@splash` leaves the native splash (`flutter_native_splash:remove` needs the yaml); check there is a
  single `@splash`; a dark variant.
- The workspace still sets `dart.previewHotReloadOnSaveWatcher` (it may give a double reload; it can be removed).
- `make screen products product_list` gives the route `/product-list` (home already has `/`): show `--route` more
  in the help.
- `nuclear add <git url>`: a kind package from a repository with a pinned version
  ([spec 002](../../../../nuclearlang/docs/04-specs/002-dialects-with-agents/plan.md), D6).
