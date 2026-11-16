---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0003: JSON is generated from the model: `@key` names a field and a `converter` reads and writes a value

## Context and problem

A model in Nuclear is only its definition; reading it from and writing it to JSON is not business logic and must
not be written by hand. Two things the definition alone cannot say: a field whose name in the JSON is not its name
in the model, and a value whose JSON form is not its type's (a date as text, an address as a string).

## Decision

**`json_serializable` + `build_runner`.** The transpiler writes the annotations and the `part`; the mapping is
generated code.

**`@key("json_name")`** on a model's field is its name in the JSON (in Dart, `@JsonKey(name:)`).

**A converter is a kind.** `converter Name` with `fromJson(json: J) T` and `toJson(value: T) J` (in Dart, a
`JsonConverter<T, J>`; the types are taken from the signature of `fromJson`). A field uses it with `@Name`. In
Dart, a PascalCase decorator without arguments is a call to its const constructor (`@Name` → `@Name()`).

## Options considered

None recorded.

## Consequences

- Positive: a model stays a list of fields; a converter is written once, in `shared/converters/`, and is visible
  everywhere.
- Negative: a model has a `part` file and the app needs `build_runner`. The same holds for an `event`, which
  carries the same mapping ([ADR-mobile-0007](0007-accepted-rules-of-events-guards-forms-and-state.md)): a field
  that is not a JSON type is an error of `build_runner`, not of the transpiler.

## References

- A converter's optional `sample()` for the generated tests: [ADR-mobile-0004](0004-tests-in-nuclear.md).
- Generic models (`Page<T>`): ADR-synapsis-0005.
- Replaces: ADR-0044, ADR-0064
