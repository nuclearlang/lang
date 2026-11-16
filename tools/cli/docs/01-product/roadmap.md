---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [tools/cli/docs/03-adr/0003-one-command-nuclear.md, tools/cli/docs/04-specs/README.md]
---
# Roadmap of the command line tools

The pending work of `nuclear`. A done item is deleted. What `gen` and `make` write is in
[the code generator's roadmap](../../../code_generator/docs/01-product/roadmap.md); the devices in
[theirs](../../../../device-emulators/docs/01-product/roadmap.md).

## Half done

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

## To decide with the user

- Suggested CLI commands: `g crud`, `g form`, `routes`, `graph`, `rename`, `remove`, `upgrade`, `g i18n`,
  `--dry-run`.

## Pending

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
