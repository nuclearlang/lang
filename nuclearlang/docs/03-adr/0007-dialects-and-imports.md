---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0007: The transpiler writes the imports from versioned definitions; each dialect has its own reference; a new dialect is created by an agent under written rules

## Context and problem

Imports are the part of a file an agent gets wrong most often and reads least. The libraries of a target change
with each version. The rules of the base must not fill with one target's details. And a new target should not need
the team that wrote the compiler.

## Decision

**Imports written by the transpiler.** The transpiler writes the imports: it knows the libraries of the dialect
(type definitions, ADR-lang-0008) and organizes them per component, module or function. `use` exists for shortcuts
(`use flutter.ui`).

**Versioned technologies.** The transpiler keeps versions of each technology with their dictionaries (the type
definitions packages `name@version`).

**Optional agents.** Optionally the transpiler can connect to a coding agent (Claude, Codex, OpenCode) to optimize
and personalize the generated code. The compiler has no such connection today.

**Dialect references.** The base reference (`docs/07-reference/nuclear-base.md`) describes no dialect; every
dialect has its own reference (`dialects/<language>/docs/07-reference/<dialect>.md`), which inherits from the base.

**New dialects with agents.** A new dialect is created by a coding agent (Claude, Codex, OpenCode) following the
rules, the process and the restrictions of `docs/07-reference/dialects.md` §8; each rule of its reference has at
least one verified example. Per-project kinds and decorators are postponed.

## Options considered

No alternative was recorded for these decisions.

## Consequences

- Positive: a `.nuc` has no import lines for what the dialect knows; a reference's examples are the real output
  (`tools/spec-check`); a dialect is data a third party can write.
- Negative: a name that is in no definitions package cannot be imported for the author (N0106): the package must be
  described first (ADR-lang-0008). What a template cannot express needs a new generic option in the compiler, which
  the agent that creates a dialect cannot add.

## References

- `docs/07-reference/dialects.md` (§5.2 auto-imports, §8 creating a dialect with an agent),
  `docs/08-guides/create-a-dialect-with-an-agent.md`, `docs/04-specs/002-dialects-with-agents/plan.md`.
- Replaces: ADR-0014, ADR-0015, ADR-0025, ADR-0073
