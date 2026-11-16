---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [05-standards/testing.md, 05-standards/security.md, 02-architecture/overview.md]
---
# Conventions

The rules of the whole tree are the root [`AGENTS.md`](../../../../../AGENTS.md) (English everywhere, quality
first, no commits unless the user asks). These are the ones of this project.

## The platform

- Language rules come from the base. The platform adds **kinds and decorators only as data**: `platform.toml`
  here, TOML and templates in each dialect.
- A generic mechanism belongs in the compiler (projects, decorator arguments, architecture names, call sites);
  nothing specific to this platform, to a dialect or to a UI toolkit ever does. A template capability that is
  missing is asked for as a generic one.
- Kinds and features may differ between platforms, never between the dialects of this one.
- The standard library is Nuclear's: a target's library name in platform code, reference, docs or examples is a
  bug.

## `platform.toml`

How a contract is changed (the contract first, then every dialect, the `docs.toml` entry, the reference) is the
same for the three platforms: [changing a contract](../../../docs/02-architecture/contract.md). In this one:

- The arguments of the data decorators are the same as the backend platform's (`[decorators.args]`).
- A removed decorator gets its line in `[decorators.replaced]`, so a project that still writes it is told what
  replaces it (`N0309`).
- A generator template writes finished, compiling Nuclear, each declaration under a comment that says what it is
  for; `merge = true` on a declaration a later run may complete.
- Every new diagnostic code is documented in the language's
  [diagnostics.md](../../../../../nuclearlang/docs/07-reference/diagnostics.md).

## The runtime packages

- **They work on web**: no `dart:isolate` nor `dart:io` without a `kIsWeb` guard.
- The `dragonfly` package re-exports nothing of the libraries it uses: each name is imported from its own, so no
  import is left over.
- It stays an independent package: usable by hand in any Flutter app, with its README, CHANGELOG and `example/`.
- An app-wide service is a `Global` (`register`, `init`, `dispose`).
- Nothing the dialect generates names what is behind a service (the storage engine of the local database): the
  generated code calls the package's classes, so the engine can change in the package alone.
- The package logs its own work through `Log` (http, the splash's failures, translations).
- Lints: `flutter_lints`; `flutter analyze` reports nothing.
- A change of the public API updates [dragonfly.md](../07-reference/dragonfly.md) and regenerates the type
  definitions in the same change ([runbook](../06-runbooks/runtime-release.md)).

## The documents

- `docs/07-reference/mobile.md` holds only final rules and only Nuclear: no dialect's name where it says what a
  project writes, no questions, no history, no "pending". Doubts go to the user; decisions become ADRs.
- A change the user of the platform can see updates its documents in the same change: the reference, the guide,
  the context documents of this folder, the `CHANGELOG.md`.
- One fact, one file: what is the dialect's is linked in the
  [`dart` dialect project](../../../../../nuclearlang/dialects/dart/AGENTS.md), never copied here.
