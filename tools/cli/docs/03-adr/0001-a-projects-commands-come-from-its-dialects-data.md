---
status: accepted
date: 2026-11-10
deciders: Julian Molina
---
# ADR-0001: A project's commands come from its dialect's data; a dialect's own commands go under its name

## Context and problem
The `dragonfly` CLI, the VS Code extension and the website each carried their own copy of how a dialect's generated
project is installed, run, debugged and served: ports, urls, framework commands and dialect names written in Rust
and TypeScript. A new dialect needed code in three places. The CLI also needs one shape for its commands that holds
for every dialect: some commands are the same in all of them, some belong to one.

## Decision
1. **Common commands stay at the first level** (`build`, `check`, `make`, `run`, `test`...): the project already
   says its dialect. **A dialect's own commands go under its name**: `dragonfly <dialect> <command>`
   (`dragonfly flutter add`). A subcommand the dialect does not define goes to its own CLI as it is
   (`dragonfly flutter doctor` → `flutter doctor`).
2. **A dialect's `[toolchain]` is the only source** of how its generated project is installed, compiled, run,
   tested, served by an editor and debugged: the commands, `url`, `ready`, `installed`, `[[toolchain.launch]]`,
   `[toolchain.settings]`, `extensions`, with `[toolchain.<os>]` overrides (the format is in
   `nuclearlang/docs/07-reference/dialects.md`). `dragonfly` runs those commands and writes the editor workspace
   from them; nothing in Rust or TypeScript names a port or a framework command.
3. **A platform names its default dialect** (`[platform] default_dialect` of its `platform.toml`):
   `dragonfly new -p <platform>` uses it, and so does an older Flutter app whose `config.nuc` has no
   `dragonfly(...)` line.
4. **The project card carries `toolchain`** (`url`, `serve`, `installed` in `.nuclear/project.json`): an editor
   reads it instead of loading the dialect (the web device's server, the base urls of the HTTP tool, "needs
   install").
5. **`nuclear build` removes the output of a removed `.nuc`**, from the previous build's line map.

The release archives and the one-line installers were decided together with this; they are the installer's
decision: ADR-installer-0001.

## Options considered
1. Each tool keeps its own table of dialects (what there was): three copies that drift, and code for every new
   dialect.
2. The dialect declares it as data, and every tool reads it. Chosen.

## Consequences
- Positive: a new dialect is runnable and debuggable from the CLI and the editor with no code change; the editor
  does not load a dialect to know where a project answers.
- Negative: the mobile path of the CLI still calls Flutter directly (its SDK lookup, devices and hot reload);
  moving it to `[toolchain]` is its own step ([roadmap](../01-product/roadmap.md)).

## References
- Replaces: ADR-0067, ADR-0101
- The platforms and their dialects: `ADR-synapsis-0002`.
