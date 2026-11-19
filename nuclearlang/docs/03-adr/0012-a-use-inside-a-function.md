---
status: proposed
date: 2026-11-18
deciders: Julian Molina
---
# ADR-lang-0012: A `use` inside a function imports where it stands when the target can, and at the top when it cannot

## Context and problem

A `use` stood only at the top of a file, and a project's names are imported at the top of each file that writes
them. A command line program written in Nuclear therefore loads, on every start, every library of every command:
in `nuclear-builder` the `mcp` library alone is 300 ms of a 530 ms start, though only two commands use it. Python
runs an import when its line runs, so an import inside a function is how a Python program puts off a library;
TypeScript's and Dart's imports are static (a dynamic `import()` is a promise, a `deferred` library needs
`loadLibrary()`), so they cannot take one inside a function without changing what the function is.

## Decision

**A `use` may stand in a function or method body.** It has the forms of a top-level `use` (a module with
`{ names }`, `as alias`, `* as x from`), and in a project a path in quotes that names a `.nuc` of the project,
relative to the file (`use './member'{ memberLine }`), brings that file's declarations. Its names exist from its line
to the end of its block, as a variable does; a name it brings is not imported at the top of the file unless the file
also writes it elsewhere.

**Where it is written is the dialect's.** A dialect with the template `[syntax] use_local` writes the import where
the `use` stands, so it runs when that line runs (Python: a local `import`). A dialect without it writes the import
with the file's others (TypeScript, Dart): the program means the same, it only loads at start. The laziness is an
optimization of the target, never a meaning of the program, so the same `.nuc` builds for every dialect.

## Options considered

1. A `use` inside a function, written in place where the target can and hoisted where it cannot (chosen).
2. An `await import()` in TypeScript and a `deferred` library in Dart: the function would become async only in
   some dialects, against rule 3 of the tree (a dialect only changes the output).
3. A dialect option that imports every project name where it is used: it changes every Python file and moves import
   errors from start-up into the middle of a run, for programs that never asked for it.
4. A diagnostic in the dialects that cannot put it off: the same code would not build for all of them.

## Consequences

- Positive: a program decides which commands pay for a library; Nuclear Builder drops its `lazy(module)` helper
  (`importlib` with a string, which no checker follows).
- Negative: in TypeScript and Dart a `use` inside a function is only a scope for its names, not a later load.

## References

- The rule: `docs/07-reference/nuclear-base.md` §8; the template: `docs/07-reference/dialects.md`.
