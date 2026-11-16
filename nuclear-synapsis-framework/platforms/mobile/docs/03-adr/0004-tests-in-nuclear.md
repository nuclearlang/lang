---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0004: Tests are written in Nuclear, and the build generates the standard ones

## Context and problem

A project has only `.nuc` files, so its tests cannot be files of the target. And a large part of an app's tests is
the same in every app: a model reads its JSON, a repository sends the request it declares, a route asks for a
session or a permission, a screen opens.

## Decision

**Tests are kinds.** `tests` (folder `test/`) and `integration` (folder `integration_test/`, on a device), with
`@mock`, `@test`, `@states` (bloc_test) and `@widget`; mocks with mocktail. A method without a decorator is the
group's setUp or tearDown; `X.m()` in a test is the injected `X`; a `Result` does not propagate in a test.

**The build generates the standard tests**: of the models (their JSON), the repositories (the http contract), the
routes (session and ACL) and the screens.

**The values of a generated test.** An enum field of a model gets its first value (`Plan.values.first.name`). A
field with a converter gets the JSON the converter writes for a value the tests can make; for a type the tests
cannot invent, the converter's optional `sample() T` gives the value; without it, the field gets `null`.

## Options considered

None recorded.

## Consequences

- Positive: the tests of an app are in the language of the app; what the framework writes, the framework tests;
  the twins of the local database are checked without a request
  ([ADR-mobile-0006](0006-local-database.md)).
- Negative: a converter of a type the tests cannot invent needs a `sample()` to be covered.

## References

- What runs where: [testing.md](../05-standards/testing.md); the test helpers of the runtime:
  [synapsis.md §7](../07-reference/synapsis.md).
- Of the eleven rules accepted together, this ADR holds one: the values of a generated test.
- Replaces: ADR-0049, ADR-0085
