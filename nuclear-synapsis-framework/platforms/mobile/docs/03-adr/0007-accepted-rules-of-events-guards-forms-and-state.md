---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0007: Guards may be async, an event travels between engines as JSON, and the names of the session's events, translations, form checks and state builders are fixed

## Context and problem

Eleven rules of the platform were accepted together. Those about screens, routes and dialogs are in
[ADR-mobile-0002](0002-screens-routes-dialogs-and-splash.md) and the one about generated tests in
[ADR-mobile-0004](0004-tests-in-nuclear.md). This ADR holds the six that belong to the services those two do not
cover: access, events, session, translations, forms and state.

Two of them answer a real limit. A guard that asks a server cannot answer at once, but most guards can, and views
and use cases must not all wait because of a few. And an event published from another engine (a background task of
workmanager) cannot be sent as an object: Flutter engines share no objects.

## Decision

**Async guards.** `Guard.canActivate()` returns `FutureOr<bool>`; with `~` in its body it is `Future<bool>`. The
router waits for it (its `redirect` stays sync when no guard is async); `AclBuilder` shows `fallback` until it
answers; an async use case with `@acl` uses `Guards.verify`; `Acl.check` is the version of `Acl.can` that waits.
The sync `Acl.can`, `Acl.canOpen` and `Guards.check` throw a clear error with an async guard.

**Events from another engine.** The `event` kind writes `fromJson` / `toJson` (json_serializable) and `eventName`.
From a background isolate, an event with a name travels as its name and its JSON text, and `Events.decoder`,
registered at startup with the models, reads it back. So the fields of an event are JSON types.

**The session's events.** `GlobalEvents` uses `sessionStarted` and `sessionEnded` (and `onSessionEnded`).

**Translations use `.tr()`.**

**`@validate("field")` takes the field as text**; a bare name is `N0106`.

**Each state model generates its own `<Model>Builder<Manager>`**, not a generic `StateBuilder<Manager>`.

## Options considered

1. Making every guard async: it would force every view and every use case to wait, also for the sync guards.
2. Sending event objects between engines: only JSON-like values travel.

## Consequences

- Positive: a guard may ask a server without changing the sync ones; a background task reaches the app's screens
  with a typed event.
- Negative: an `event` has a `part` file and needs `build_runner`, like a model
  ([ADR-mobile-0003](0003-json-models-names-and-converters.md)); an event field that is not a JSON type is an error
  of `build_runner`. `canActivate` of a `Guard` written by hand in Dart may return `bool` or `Future<bool>`.

## References

- Where each of the eleven rules is: `forward` required in `acl`, the Accept button only with `onAccept`,
  transitions per screen and nested routes, [ADR-mobile-0002](0002-screens-routes-dialogs-and-splash.md); the
  values of a generated test, [ADR-mobile-0004](0004-tests-in-nuclear.md); the other six, here.
- The services these rules belong to: events (ADR-synapsis-0005), session (ADR-synapsis-0005), ACL (ADR-synapsis-0005), forms
  (ADR-synapsis-0005), translations (ADR-synapsis-0005).
- Behaviour: [runtime.md](../02-architecture/runtime.md).
- Replaces: ADR-0085
