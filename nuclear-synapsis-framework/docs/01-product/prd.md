---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../00-context/vision.md, roadmap.md, ../02-architecture/rules.md]
---
# PRD: Dragonfly

## Summary

The framework built into NuclearLang: three platforms written in Nuclear, each implemented by one or more dialects.
A project holds only business logic in `.nuc` files; the transpiler and a runtime package of the platform give the
rest. The requirements of the whole platform (the language, the editors, the agents) are in the tree's own PRD;
this file holds only what the framework must give.

## Scope

| Platform | What it is | Dialects | Planned dialects |
|---|---|---|---|
| `mobile` | apps for Android, iOS, desktop and web through one UI toolkit | `flutter` (Dart) | `react-native`, `kotlin-multiplatform`, native Android |
| `backend` | HTTP APIs, data, events and AI agents | `fastapi` (Python), `nestjs` (TypeScript) | `express`, Dragonfly's own backend in Rust |
| `web` | web apps in the browser through one UI library | `react` (TypeScript), a first version | `vue`, `angular` |

Excluded: a fourth platform; a feature of one dialect only; replacing the target's own tools (the `dragonfly`
command drives them).

## Functional requirements

| Requirement | State |
|---|---|
| A platform is a contract every dialect of it implements identically; the loader refuses a dialect that leaves it | done (`platforms/docs/02-architecture/contract.md`) |
| The same `.nuc` of a project builds with every dialect of its platform | done for `backend` (the conformance test); `mobile` and `web` have one dialect each |
| The mobile platform: its kinds (model, repository, usecase, screen, statemanager, form...), a runtime package, generated tests | done |
| The backend platform with two dialects and their runtimes | done; what is left for parity is in the backend platform's roadmap |
| The web platform | first version; what is left is in the web platform's roadmap |
| Optional parts as plugins a project enables in `config.nuc` | done (ADR-synapsis-0004) |
| Kinds a project or the community writes, as packages, without touching the compiler | half done ([roadmap](roadmap.md)) |
| A client app generates its models and repositories from a backend's contract | done; limits in the [roadmap](roadmap.md) (ADR-synapsis-0006) |
| One command for every platform: new, make, gen, build, run, test, and what each platform adds | the `dragonfly` command: see `tools/cli/` |

## Non-functional requirements

| Requirement |
|---|
| The golden rule: generated code as fast as an expert's, instant transpilation, minimal readable Nuclear. A kind, decorator or shortcut that breaks one of the three is rejected (ADR-lang-0001). |
| Generated code passes the target's analyzer without warnings: `flutter analyze` with `flutter_lints`, `tsc --strict`, `pyright --strict`. |
| A no-change `dragonfly build` takes about 40 ms. |
| A platform's reference, docs, examples and diagnostics name no dialect and no target's library. |

## Open questions

The design questions waiting for the user are in the [roadmap](roadmap.md), "To decide with the user".
