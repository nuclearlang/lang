---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0001: One golden rule judges every proposal; Nuclear is modules and functions, not objects; the compiler writes the map of a project

## Context and problem

A language made for AI agents and the people who work with them gets a constant flow of proposals: a rule, a
shortcut, a kind for a framework. Without one test for all of them the language grows two ways to write each thing.
The targets are object-oriented languages, but agents and readers work better with plain modules and functions. And
an agent that must read every file of a project to change one of them spends its context before it starts.

## Decision

**The golden rule.** Performance, speed and readability of the syntax, for the base language and every dialect. A
rule, a shortcut or a kind is accepted only if it respects the three: the generated code runs as fast as what an
expert in the target would write, transpiling is immediate, and Nuclear code reads effortlessly.

**Not object oriented.** Nuclear is like Elixir: components, modules and functions. It still has modules with
constructors and inheritance, only so that it transpiles to object-oriented languages.

**Generated context maps.** The compiler generates the context documentation of the code, so an agent goes to the
concrete code instead of reading all of it. Today it writes one map per project, `.nuclear/map.md`: every
declaration with its kind, its description (its doc comment) and its members, grouped by component, in Nuclear, the
same for every dialect of a platform.

## Options considered

No alternative was recorded for these three decisions.

## Consequences

- Positive: one test for every proposal, also for a dialect's kinds and shortcuts; a module is the only unit to
  learn; the description an agent reads is written once, as the doc comment of the declaration.
- Negative: a feature that the targets have and that breaks one of the three is refused (records, ADR-lang-0004);
  the map describes only what the doc comments of the project say.

## References

- `docs/07-reference/nuclear-base.md` §1 (the principles), `docs/07-reference/projects.md` §1.1 (the project map),
  `crates/nuclear-transpile/src/map.rs`.
- Replaces: ADR-0038, ADR-0016, ADR-0017
