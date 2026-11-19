---
status: accepted
date: 2026-11-19
deciders: Julian Molina
---
# ADR-lang-0012: Imports are made lazy by the transpiler where a project asks

## Context and problem

A command line program written in Nuclear loads, on every start, every library of every command: in
`nuclear-builder` the `mcp` library alone is 300 ms of a 400 ms start, though only two commands use it. Python runs an
import when its line runs, so an expert puts an import a few commands need inside the function (or the branch) that
uses it. Nuclear writes every import at the top of the file. TypeScript's and Dart's imports are static (a dynamic
`import()` is a promise, a `deferred` library needs `loadLibrary()`), so they cannot take one inside a function
without changing what the function is.

## Decision

**`use` stays at the top of a file; the laziness is the transpiler's.** A project opts in with
`lazy_imports = true` in `[project]` of `nuclear.toml`. Then an import whose names only function and method bodies
use (never a signature, a class base, a field, a constant or top-level code) is written at the start of the
narrowest block of each function that holds all its uses, never inside a loop; a one-line branch of a `match` or an
`if` used as a value is written as a block so it can hold one. Every other import stays at the top. A dialect whose
target can import inside a block has the template `[syntax] local_import` (Python); without it the option changes
nothing. Off by default: an app (a backend, a mobile or web app) keeps its imports at the top, as an expert writes
them.

## Options considered

1. A project option the transpiler applies, Nuclear unchanged (chosen).
2. A `use` inside a function (proposed 2026-11-18): it changed the language for an optimization of one target, and in
   TypeScript and Dart it was only a scope.
3. Every import lazy in every Python file: it moves import errors from start-up into the middle of a run, for programs
   that never asked for it.

## Consequences

- Positive: the same `.nuc` for every dialect; a command line program loads only what its command runs
  (`nuclear-builder team list`: 410 ms → 70 ms).
- Negative: an import error of a lazy module shows when its block first runs, not at start (the project asked for
  it; its tests run every command).

## References

- The option: `docs/07-reference/projects.md`; the template: `docs/07-reference/dialects.md`; the equivalence:
  `dialects/python/docs/07-reference/python.md` §3.15; the code: `docs/02-architecture/emitter.md`.
