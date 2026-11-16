---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0005: A module uses its members by name, has no visibility words, is constructed by calling its PascalCase name and inherits from classes the type definitions describe

## Context and problem

Nuclear has no classes, but it transpiles to languages that do: a module must give the equivalence of a class and
its constructor with as little noise as possible (`this.`, `new`, `private`, `@override`), also when its base is a
class of a library that is not in the file.

## Decision

**Implicit `this`.** Inside a module, members are used by name; the resolver knows with certainty when a name is a
member and the dialect adds `this`/`self` when the target needs it. Less noise.

**No visibility modifiers.** No `private`, `public` or `protected`. Visibility between components is a project rule
(ADR-synapsis-0003 and the `[architecture]` section of a dialect).

**Construct with PascalCase.** There is no `new`: calling a PascalCase name constructs an object; the dialect writes
whatever the target needs.

**Constructor of an inheriting module.** `super(...)` as the first line of the body (its arguments are the received
parameters); without it the base is called without arguments. A parameter named like a member of the base is that
member, not a new field.

**External classes.** Versioned type definitions (like `.d.ts`), generated from the SDK (format and repository: old
ADR-0040), mark overrides and give the inherited members of classes that are not in the file.

## Options considered

1. An explicit `$` prefix for members: rejected.

## Consequences

- Positive: a method that overrides one of a base is marked by the compiler (`override`, `@override`), not by the
  author; a name nothing defines is still an error inside a module.
- Negative: a base that is neither in the file nor in the type definitions leaves the module open: no override
  mark and no N0106 (`docs/02-architecture/limits.md`).

## References

- `docs/07-reference/nuclear-base.md` §4.2, §4.5, §6.3; `docs/02-architecture/emitter.md` (inheritance).
- Replaces: ADR-0006, ADR-0007, ADR-0008, ADR-0034, ADR-0035
