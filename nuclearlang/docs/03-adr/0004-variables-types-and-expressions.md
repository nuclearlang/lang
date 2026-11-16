---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0004: A variable is an assignment, a block has its own scope, `if` and `match` are values, and there are no records nor `type`

## Context and problem

Declaring, typing and combining values must have one form each, and the compiler must be able to tell a mistake
(a name nothing defines, a variable read outside its block) instead of guessing.

## Decision

**Variables.** `x = 1` declares a variable. The transpiler decides whether it is a constant or mutable (it is
mutable when it is reassigned in its block); there is no `const`/`let`/`var` in Nuclear.

**Block scope and values.** A variable created inside `if`, `for`, `while`, `match` or `try` does not exist
outside (N0105). A name nothing defines is an error (N0106). `if` and `match` are values, as in Elixir:
`x = if ...`.

**Map type.** `<Key, Value>` anywhere a type goes: `get(name: string) <string, string>`. A map value is always
written between `{ }`.

**No `type`.** It is not reserved and does not declare type aliases.

**No records.** Several values go in a map `<K, V>` or a list.

**Enum item without a value.** In a key-value enum, an item without a value takes its own name: `medium` →
`"medium"`.

**`x as T`, `x!`, `X<T>(...)`** are kept as in TypeScript and Dart. The `<` of a generic call goes right after the
name; with a space it is a comparison.

**Bounded generics.** `<T: Comparable>` (`:` means extends, as in inheritance).

**Cascades.** Lines that start with `..` below an expression; `..` on the same line is still a range.

**Destructuring.** Lists (`[a, ...rest] = xs`, `_` ignores) and maps (`{ a, "k": b } = m`), Elixir style with
TypeScript syntax: `...` instead of `|` (already union types and `match` alternatives). Names are all new or all
existing (N0107).

**`if` inside lists.** `[a, if cond b]`, without `else`; there is no `for` inside lists (`...xs.map(...)` is used).

## Options considered

1. Dart-style records: rejected.
2. `|` to split a list in a pattern, as in Elixir: taken already by union types and `match` alternatives.

## Consequences

- Positive: no declaration keyword to choose; a typo in a name is N0106 instead of a new variable; a value is
  built where it is used (`x = if ...`, `[a, if cond b]`).
- Negative: patterns exist only in assignments, not in lambda parameters, `for` or `match` branches
  (`docs/02-architecture/limits.md`).

## References

- `docs/07-reference/nuclear-base.md` §3, §3.1, §5, §6, §7; `docs/02-architecture/emitter.md`.
- Replaces: ADR-0003, ADR-0018, ADR-0022, ADR-0024, ADR-0026, ADR-0027, ADR-0028, ADR-0030, ADR-0031, ADR-0032,
  ADR-0033
