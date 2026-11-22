---
status: accepted
date: 2026-11-22
deciders: Julian Molina
---
# ADR-lang-0013: The helpers of lodash are part of the language, brought by the transpiler

## Context and problem

The functions of lodash that serve Nuclear were written once in Nuclear and tested in every language dialect
(`nuclear-synapsis-framework/lodash`), but no program could use them: Nuclear has no way for a project to take a
library written in Nuclear, and a helper asked for by name through a package manager would exist for some dialects
and not for others. Asked how a project should take them, the user decided (2026-11-22): "lodash ya viene en nuclear
y synapsis nativo, siempre viene como cualquier funcionalidad del lenguaje; tú internamente agrega el import en cada
dialecto de la manera más optimizada."

## Decision

**The helpers are Nuclear's own, like its library.** A file calls `chunk(xs, 2)` or `uniqBy(users, (u) => u.name)`
with no `use`, in every dialect of every platform, present and future: they are Nuclear source, so a new dialect
needs nothing of its own.

**The transpiler brings only what is used.** A helper a file calls is written with the helpers it calls, and
nothing else:

- a file built alone gets them in its own output, before its code;
- a project gets one generated file (`nuclear_helpers`) with the helpers the whole project uses, and each file
  imports from it, by name, the ones it calls.

A program that calls none is exactly what it was: no runtime, no package of a target, nothing to install.

**Whose name it is.** A name is a helper only where nothing nearer defines it: a local, a member of the module, a
declaration of the file or of the project, or a name the file imports with `use` is always the program's own. A
helper wins over a function a target has under the same name (`zip` and `range` of Python, `merge` of a JavaScript
library the dialect imports on its own), so the same Nuclear means the same in every dialect; that function is
still reached with its `use`. A helper another helper calls gives way to a declaration of the program with its name
(it is written as `nuclear<Name>`).

**How it is found.** A file is emitted as it is; the free names nothing of the program defines that are helpers
make it be emitted once more with them (`crates/nuclear-transpile/src/helpers.rs`). A file with no helper pays one
set lookup per free name.

## Options considered

1. A package per target (npm, pub, PyPI) with its type definitions: one more thing to publish and install for every
   dialect, and a project tied to the dialects that have it. Rejected by the user.
2. `nuclear add` copying the `.nuc` files into a project: the helpers would be the project's code, in every
   project, and every dialect would compile all of them. Superseded by the user's decision.
3. Members of the base types (`xs.chunk(2)`): changes the rules of the library, one name per operation on a type;
   the helpers that are not about one value (`zip`, `range`, `flow`, `merge`) would not fit.
4. Writing every helper into every output: simple, and against the golden rule (generated code as an expert's).

## Consequences

- Positive: one set of helpers in every dialect, tested by the same 226 cases built both ways (the helpers as a
  project's code, and brought by the transpiler); a new dialect gets them for free; no cost for a program that does
  not use them.
- Negative: 117 names are no longer free for a target's function of the same name without a `use`; inside a module
  that extends a class nothing describes (an open module), a free name is taken for that class's member and brings
  no helper; the editors do not complete nor document the helpers yet (the roadmap).

## References

- `docs/07-reference/library.md` §13, `crates/nuclear-transpile/src/helpers.rs`, `project::build`.
- `nuclear-synapsis-framework/lodash/` (the source, its cases, `check.sh`).
