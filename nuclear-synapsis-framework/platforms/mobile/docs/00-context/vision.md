---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [07-reference/mobile.md, 02-architecture/overview.md, 03-adr/README.md]
---
# Vision

## Problem

Between its screens and its backend, an app carries a lot of code that is the same in every app: http calls with
cache and retries, JSON mapping, state handling, the injector, session, access control, events, routes, forms,
translations, a local database, tests. The mobile platform lets a project write **only its business logic**, in
Nuclear; constructors, overrides, registration in the injector, serialization, http calls, state handling and
imports are written by the transpiler, and what the UI toolkit lacks comes from the platform's runtime.

The golden rule of the whole tree applies first: performance, speed and readability of the syntax. The platform's
own rules are the normative text: [mobile.md §3](../07-reference/mobile.md).

## Users

- **The user and the agent**, who write an app in Nuclear: kinds, decorators, folders, `config.nuc`, plugins and
  tests, identical for every dialect of the platform. The agent's short sheet is
  [brief/mobile.md](../07-reference/brief/mobile.md).
- **The author of a dialect**, who implements the contract (`platform.toml`) for a language and a UI toolkit.
- **A Flutter developer**, who may use the `synapsis` package by hand in any Flutter app: it is an independent
  package.

## What it is

Apps for Android, iOS, desktop and web through one UI toolkit. Three parts (ADR-dart-0001):

1. the **contract and its dialects**: `platform.toml` here; `flutter`, the only dialect today, in the
   [`dart` dialect project](../../../../../nuclearlang/dialects/dart/AGENTS.md). Kinds and decorators add
   behaviour: a `repository` with `@get` is the http call, the mapping and the cache;
2. the **runtime**: the `synapsis` package, and `synapsis_genkit` for the `genkit` plugin;
3. the **CLI and the editor extensions**, each its own project
   ([`tools/cli/`](../../../../../tools/cli/AGENTS.md), [`extensions/`](../../../../../extensions/AGENTS.md)).

## What it does not do

- It does not describe how the target code is written: that is the dialect's.
- A project's Nuclear names no dialect and no storage engine, and it has no interfaces nor classes that only pass
  data around: the layers exist in the generated code.
- A second dialect does not exist yet: `react-native` and `kotlin-multiplatform` are planned, not built.
- The local database is for what a phone shows, not for millions of rows.
- Translations use no third-party library.
- A backend and a web app are the other platforms of the framework
  ([`backend`](../../../backend/AGENTS.md), [`web`](../../../web/AGENTS.md)); an app reads a backend written in
  Nuclear through its contract (ADR-synapsis-0006).
