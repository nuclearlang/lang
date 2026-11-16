---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [glossary.md, ../03-adr/0001-principles.md, ../02-architecture/limits.md]
---
# Vision

## Problem

AI coding agents and the people who work with them spend tokens and make mistakes on languages that have several
ways to write each thing. NuclearLang is a minimal base language built for them: the fastest to write and read,
with the fewest tokens. It is not compiled to machine code: a transpiler written in Rust turns `.nuc` into the code
of another technology through **declarative dialects** (TOML + templates loaded at run time). One way only:
`.nuc` → `.ts` / `.dart` / `.py`; it never reads target code.

## Users

| User | Needs from the language |
|---|---|
| AI coding agents (Claude, Codex, OpenCode) | few tokens, one way to write each thing, clear diagnostics with fixes, a spec they can follow, type definitions so they do not invent APIs |
| Developers | the same `.nuc` in the editor as any native language: completion, hover, navigation, debugging |
| Dialect authors | add a target or a framework without touching Rust: data files, templates, a contract, tests |

## The golden rule

**Performance, speed and readability of the syntax**, for the base language and every dialect
(ADR-lang-0001): generated code as fast as an expert's in the target, instant transpilation (read only what is
needed), minimal and readable Nuclear. A rule, a kind or a shortcut that breaks one of the three is rejected.

## Goals

| Goal | Measure |
|---|---|
| Generated code is the expert's | it passes the target's analyzer without warnings: `flutter analyze` with `flutter_lints`, `tsc --strict`, `pyright` |
| Instant transpilation | a project of 26 files builds in about 20 ms in release; a completion of the server takes under 1 ms |
| Every error teaches | every diagnostic has a code documented in `docs/07-reference/diagnostics.md`, and a fix when it is exact |
| Every word is documented | every reserved word (`base/docs.toml`) and every word of a dialect (`docs.toml`) has editor documentation |

## What it does not do

- Read or convert target code into Nuclear.
- Change the parser for a dialect: dialect words are data.
- Object orientation as a goal: Nuclear is components, modules and functions; modules have constructors and
  inheritance only so that it transpiles to object-oriented languages.
- Records, a `type` keyword, visibility modifiers, inferred parameters, hoisting.
- Wrap the target's libraries: only the base types have Nuclear's own vocabulary (ADR-lang-0009); every other
  library is written as it is, through its type definitions.
- A package manager of its own: a package is installed with the target's (ADR-lang-0008).
- What is not expressible yet (operator overloading, Dart 3 pattern `switch`, declaring named constructors):
  [limits.md](../02-architecture/limits.md).

## Constraints

- Everything in English: code, comments, diagnostics, dialects, examples, documents.
- Errors over magic: explicit beats implicit when in doubt.
- Node.js/Express is postponed by the user.
