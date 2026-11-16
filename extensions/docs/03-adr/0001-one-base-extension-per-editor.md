---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0001: One language server and one base extension per editor; a framework's tools go in an extension of that framework

## Context and problem
The same `.nuc` language is turned into several targets, and each framework brings tools of its own: how an app is
run and debugged, its devices, its hot reload. An editor needs the language for every dialect, and those tools only
for the projects of one framework.

## Decision
One language server (`nuclearlang/crates/nuclear-lsp`) and one base extension, "NuclearLang", per editor. The base
extension gives, for any dialect: syntax, highlighting, the theme, the code metrics, diagnostics, completion and the
line map between a `.nuc` and its generated file.

Each file's dialect comes from its project: `nuclear.toml`, `config.nuc`, or the dialect's `[project] marker`.

What depends on a framework's tools (run, debug, devices, hot reload) goes in one extension per framework, which
depends on the base. Only the base registers the language, the grammar and the language server. A framework
extension activates on its dialect's `[project] marker` and prefixes everything it contributes with its dialect, so
two framework extensions never collide (ADR-platform-0002).

What an editor needs from a language is declared by the dialect: `[docs]` and `[project] marker` / `output`.

## Consequences
- Positive: the base extension serves any dialect, because what it needs from one is data of the dialect.
- Negative: until the framework extensions exist, the base extensions of VS Code and JetBrains carry the run, debug,
  device and hot reload parts of Dragonfly projects (`../01-product/roadmap.md`).

## References
- Replaces: ADR-0077
