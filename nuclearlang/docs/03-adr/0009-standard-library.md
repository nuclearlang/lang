---
status: accepted
date: 2026-11-04
deciders: Julian Molina
---
# ADR-0009: Nuclear has its own standard library for its base types, translated by every language dialect

## Context and problem

Calling the target's library (`xs.push(x)` in TypeScript, `xs.add(x)` in Dart, `xs.append(x)` in Python) ties a
`.nuc` to one target. With three platforms whose Nuclear must not change between dialects (ADR-synapsis-0002), a `.nuc`
that calls `xs.length` cannot be the same file that calls `len(xs)`. The user chose Nuclear's own vocabulary over
TypeScript's or Python's.

## Decision

**Nuclear defines the members of its base types** (`string`, `int`, `double`, `boolean`, `T[]`, `<K, V>`,
`Set<T>`, `Bytes`) and a small set of objects (`Math`, `Json`, `Regex`, `DateTime`, `Duration`, `delay`,
`awaitAll`, `print`): `docs/07-reference/library.md`. One name per operation, camelCase, properties for cheap
queries (`length`, `isEmpty`, `first`, `keys`), methods for everything else; the most widespread name wins when the
targets disagree (`contains`, `add`, `upper`, `trim`, `join`, `sorted`).

**Every language dialect translates it** (`[library.<type>]`, a template per member with the receiver and the
arguments, including the lambda's parameters and body so Python can write a comprehension). The emitter rewrites a
member of a base type when the receiver's type is known (declared, a literal, or the result of a library member or
a declared function); when it is not known and the name belongs to more than one type with different translations,
it reports that the receiver needs a type.

**A target's library name on a base type is an error** in every dialect, with the Nuclear name as the fix:
`xs.push(x)` → "use add". The type definitions of libraries (ADR-lang-0008) are untouched: `numpy`, `dio`,
`Text(...)` are written as they are; only the base types are Nuclear's.

**One `examples/stdlib/` set for every target**, checked by `tools/stdlib-check.sh` in TypeScript, Dart and Python
with the same expected output.

## Options considered

1. The target's library, with no library of Nuclear's own (no wrapper between the code and the platform; agents
   already know those APIs): it was the first decision; it makes the same `.nuc` impossible to build for two
   targets.
2. TypeScript's vocabulary as the standard (agents know it best): it would make the Python output read as a
   translation and tie the language to one target's naming.
3. Python's vocabulary: the same, the other way; and `len(xs)` as a function reads worse than a property.

## Consequences

- Positive: the Nuclear code of a project does not change with its dialect; the generated code stays the expert's
  (the templates write `len(xs)`, `[f(x) for x in xs]`, `xs.where(f).toList()`); the guide, the references, the
  briefs and the examples use one vocabulary, kept honest by `tools/spec-check`.
- Negative: a second vocabulary to learn next to the targets'; a member on a receiver whose type is not known is
  not translated (`docs/01-product/roadmap.md`).
- Dart's fpdart-style `Result` and Flutter's widget API are not library members: they are type definitions.
- The operators stay as decided in ADR-lang-0002.

## References

- `docs/07-reference/library.md`, `docs/07-reference/dialects.md` §5.8, `crates/nuclear-dialect/src/library.rs`,
  `dialects/<language>/library.toml`.
- Replaces: ADR-0094
