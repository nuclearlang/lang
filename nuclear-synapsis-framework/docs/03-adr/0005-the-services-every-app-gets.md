---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0005: Every app gets the same services from the framework: events, session, ACL, forms, translations and generic models

## Context and problem
With Dragonfly a project does not choose and wire packages: what an app always needs comes with the framework, as
the same concepts in every platform, implemented natively by each one. These are the decisions on what those
services are and how they are written in Nuclear.

## Decision
**Global events.** A global manager (`Events`) with two operations, `publish` and `subscribe`, like Guava's
EventBus or Node's EventEmitter. Delivery is on demand: an event reaches only the visible screen and the global
components at once; a hidden screen gets the last event of each type when it is shown again. Background isolates
of the app also publish.

**Session.** `session.start(data, ...)` and `session.destroy()` (which publishes the end to the global events),
kept in secure storage. It combines with the ACL when the developer wants.

**ACL.** Based on Phalcon (roles that inherit others, permissions per role, everything denied unless allowed) and
on NestJS (guards: kind `guard` with `canActivate`). By default there is only logged in or not; roles are
optional.

**Forms.** Format validation belongs to presentation: a form model (kind `form`, in `presentation/<p>/forms/`)
with the rules as decorators on its fields (`@required`, `@email`, `@minLength(n)`...), a form manager (kind
`formmanager`, `@form(F)`) that only validates, and widgets (`DragonflyForm`, `FormTextField`...) bound by field
name. Business rules stay in the domain; `@validate("field")` asks the component.

**Translations.** Native JSON dictionaries (no third-party libraries), one per component and language in
`assets/i18n/<locale>/<component>.json`; the key is `<component>.<path>`, used as `"key".tr()`. Optional remote
dictionaries, stored by version on every platform.

**Generic models.** A model can have type parameters (`Page<T>` with `results: T[]`) and interfaces (`ApiFailure >
Exception`); the dialect writes what is needed (Dart: `genericArgumentFactories` of json_serializable, the
`fromJson` of each argument in repositories). A kind that would not write generics or interfaces is an error
(N0218) instead of losing them.

## Options considered
None recorded in the decisions this one replaces.

## Consequences
- Positive: an app needs no third-party package for events, session, permissions, forms or translations, and
  writes them the same way whatever the dialect.
- Positive: the dictionaries in `assets/` are the one kind of file that is not `.nuc` a project writes by hand
  (ADR-synapsis-0001).
- Negative: each platform implements each service natively, so a service exists in a platform only when its
  contract and its runtime have it; what a platform still lacks is in that platform's roadmap.

## References
- Replaces: ADR-0052, ADR-0054, ADR-0056, ADR-0058, ADR-0060, ADR-0062
