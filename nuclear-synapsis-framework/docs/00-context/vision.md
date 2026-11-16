---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [glossary.md, ../01-product/prd.md, ../03-adr/0001-the-framework-comes-with-the-language.md]
---
# Vision

## Problem

Writing an app on a platform usually means choosing and wiring many packages: state, JSON, injection, http,
routing, translations, tests. With Dragonfly the dialect already brings that architecture: in Nuclear only the
business logic is written, and constructors, overrides, injection, JSON, http, states, modules and imports are
written by the transpiler.

Dragonfly is to Nuclear what Actix is to Rust: the language comes with its framework, and no other is needed. It
is what a project adds to the base language: kinds, decorators, components, `config.nuc`, plugins and tests.

The philosophy is common; each platform applies it its own way, because platforms are incompatible (a `stateless`
view does not exist in an HTTP API). The differences that matter are between a web app, a mobile app and a
backend, not between the languages that run them. So Dragonfly has exactly three **platforms** (`web`, `mobile`,
`backend`), each written once in Nuclear, and a **dialect** only changes the language and framework the code comes
out in: the Nuclear code of a project never changes when its dialect changes (ADR-synapsis-0002).

## Users

| User | Needs |
|---|---|
| AI coding agents | one way to write each thing, the same in every dialect of a platform; a fixed place for each file; diagnostics when the architecture is broken |
| Developers of apps | write business logic only; a project that builds, tests and runs with one command |
| Kind authors (a project, the community) | add a kind to a platform with TOML, templates and a runtime, never touching the compiler |
| Dialect authors | implement a platform in another language and framework from its contract, with the loader saying what is missing |

## What it does not do

- It does not replace the target's own tools: Flutter's CLI still builds and runs; Dragonfly drives it.
- It has no fourth platform and no feature that exists in one dialect of a platform only.
- A project holds no target code: everything generated goes to `build/` and is never edited
  (ADR-synapsis-0001).
- It never reads target code back into Nuclear (a non-goal of the whole platform).
- It adds nothing to the grammar: a kind is a header and a block of the base language (ADR-synapsis-0004).
