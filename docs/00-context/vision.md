---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: []
---
# Vision

## Problem
An AI agent that writes an application spends most of its tokens on code that is always the same: the wiring of a
framework, imports, serialization, state, tests. It also invents APIs that do not exist. People who work with
agents read and review that code.

NuclearLang is a minimal base language for agents and the people who work with them: the fastest to write and to
read, with the fewest tokens. It is not compiled to machine code. A transpiler written in Rust turns `.nuc` into
the code of another technology through **declarative dialects** (TOML and templates loaded at run time), one way
only: `.nuc` → `.ts` / `.dart` / `.py`. It never reads target code.

The language comes with its framework, Synapsis (`nuclear-synapsis-framework/`), as Rust has
Actix: three platforms (`web`, `mobile`, `backend`) written once in Nuclear. The framework brings the architecture; in Nuclear only the business logic is written, and the transpiler generates the rest.

Open source, in the spirit of Rust, Deno, Gleam and Bun.

## Users
- AI coding agents (Claude, Codex, OpenCode, the local agents): few tokens, one way to write each thing, clear
  diagnostics with fixes, a reference they can follow, type definitions so they do not invent APIs.
- Developers of applications: write the business logic only; a project that builds, tests and runs with one
  command; editor support like the target's own.
- Authors of dialects: add a target or a framework without touching Rust: data files, templates, a contract, tests.

## The golden rule
**Performance, speed and readability of the syntax**, for the base language and every dialect
(`ADR-lang-0001`): generated code as fast as an expert's in the target, instant transpilation, minimal and
readable Nuclear. A rule, kind or shortcut that breaks one of the three is rejected.

## Non-goals
- Reading or converting target code into Nuclear.
- Records, operator overloading, pattern `switch` of Dart 3 (`nuclearlang/docs/02-architecture/limits.md`).
- Replacing the target's own tools: Flutter's command still builds and runs; `nuclear` drives it.

## Constraints
- Technical: the parser never changes per dialect; Rust decides what is emitted, the dialect how.
- Of the user: local models of at most 3B parameters (`ADR-platform-0003`); Node.js/Express is postponed.
