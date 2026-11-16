---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0001: The `flutter` dialect is a framework: it generates the app over official libraries and the independent Dart package `dragonfly`

## Context and problem

Two questions are decided together: how much of a Flutter app is written in Nuclear, and where the code that
Flutter itself lacks lives. The records this ADR replaces hold the decisions without their discussion.

## Decision

**The dialect minimizes Flutter.** Nuclear holds the business logic and the transpiler generates the app with a
light clean architecture. The layers exist in the generated Dart, not in Nuclear. The `flutter` dialect is the
dialect of the mobile platform (ADR-synapsis-0002): the platform says which kinds, decorators and folders exist; the
dialect (`nuclearlang/dialects/dart/frameworks/flutter/`) says how each is written in Dart, with its project
structure, architecture rules and tests (`nuclearlang/dialects/dart/docs/07-reference/flutter.md`).

**Official ecosystem libraries, not code of our own.** The generated app relies on `bloc` / `flutter_bloc`
(state), `json_serializable` / `json_annotation` (JSON), `get_it` (dependency injection) and `dio` (network).
Later decisions added, on the same rule, `fpdart` for `Result` (ADR-lang-0006) and `hive_ce` for the local database
(ADR-mobile-0006); the dialect also relies on `go_router` (routes), `connectivity_plus` and `flutter_secure_storage`.

**The Flutter CLI underneath.** The SDK, packages, builds and devices are handled by `flutter`; the `dragonfly`
command calls it inside the generated app.

**`dragonfly` is an independent Dart package.** What does not exist in Flutter lives in the package `dragonfly`
(`nuclear-synapsis-framework/platforms/mobile/packages/dragonfly`), publishable on pub.dev and also usable by
hand, without Nuclear; its API is
`nuclear-synapsis-framework/platforms/mobile/docs/07-reference/dragonfly.md`. The `flutter` dialect generates code
that uses it.

## Options considered

No alternative was recorded.

## Consequences

- Positive: a Nuclear app holds only business logic; the generated Dart is a Flutter app over official ecosystem
  libraries.
- Positive: the package can be used and published on its own.
- The dialect knows the package through its type definitions (`dragonfly@0.1.0` in `defs`): they are regenerated
  when the package's public API changes.
- Negative: none recorded.

## References

- Replaces: ADR-0039, ADR-0051
