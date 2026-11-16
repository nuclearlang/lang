---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../01-product/roadmap.md, result.md, type-definitions.md, ../04-specs/005-language-1-0/plan.md]
---
# Known limits

Read this before promising a feature, or when something "should work" and does not. What is planned to remove a
limit is in the [roadmap](../01-product/roadmap.md) and in [spec 005](../04-specs/005-language-1-0/plan.md).

## Not expressible in Nuclear yet

- Dart 3 pattern `switch`.
- Declaring named or `factory` constructors (`Character.fromJson`; calling them works).
- Operator overloading (`Offset.zero & size`).
- `const` inference in Dart.
- Patterns only in assignments: not in lambda parameters, `for` or `match` branches.
- A generic type before a member: `Set<int>.of(...)` (write `s: Set<int> = Set.of(...)`).
- Records: decided they do NOT exist (ADR-lang-0004).

## Behaviour limits

- External classes that are not in the type definitions (third-party packages like provider) leave the module
  open: no `@override`, no N0106. Fix: generate the package with `tools/defs` (or `dragonfly add <package>` in a
  project) and list it in `defs`.
- `Result` only propagates through Nuclear functions with a `Result` return (see [result.md](result.md)).
- The `typescript` and `nodejs` dialects list no type definitions (the `typescript@5.9.3` package exists and the
  framework dialects written in TypeScript list it), so a `.nuc` built with them gets no N0219/N0220.
- Type definitions carry no member types: a value returned by a library method is untyped until it is annotated.
- The operators' semantics stay the target's: `%` (TypeScript keeps the dividend's sign, Dart is never negative),
  the integer width of bitwise operators (32 bits in TypeScript, 64 in Dart), the rounding of halves
  (ADR-lang-0002).
- `use express as "express"` of `docs/07-reference/nuclear-base.md` §8 does not parse: Node.js/Express is postponed
  by the user, do not touch it until asked.

## Limits seen in generated projects

- An enum field of a model gets `null` in generated tests, and so does a field with a converter whose type is
  neither basic nor `DateTime`.
- The integration test of a mobile app needs a device (on the development machine `-d linux`, with CMake).
