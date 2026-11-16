---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0001: Synapsis is Nuclear's framework: a concept independent of the target language, and a project is only `.nuc`

## Context and problem
Writing an app usually means choosing and wiring many packages: state, JSON, injection, http, routing,
translations, tests. Nuclear is a minimal language for agents and people, so that wiring cannot be the user's work,
and it cannot be different in every target the transpiler writes. Two things had to be fixed: what the framework is
(the companion of one target, or part of the language), and what a project made with it holds.

## Decision
**The framework is called Synapsis and it comes with the language.** It is to Nuclear what Actix is to Rust: no
other framework is needed. In Nuclear only the business logic is written; constructors, overrides, injection,
JSON, http, states, modules and imports are written by the transpiler. What a target framework lacks is added by a
runtime package of Synapsis in the target language (the first one: the Dart package `synapsis`, with the classes
and features Flutter lacks).

**It is a framework concept, not a target.** Synapsis is components, layers and architecture kinds; each dialect
applies it to its technology. The `nuclear` command knows no language: what it needs from each one (how to
install, run, test, migrate, add a package) is declared by the dialect in `[toolchain]`.

**The `.nuc` files are a project of their own.** They are separate from the target app, which is generated complete
in another folder (`build/`; `build/app` for a Flutter app) and is never edited.

**A project is only `.nuc`.** No `nuclear.toml` and no files of other types, except the dictionaries of
translations in `assets/` (ADR-synapsis-0005). The manifest is Nuclear too: `config.nuc` (ADR-mobile-0001, ADR-synapsis-0002).
Everything generated goes to `build/`.

## Options considered
1. Synapsis as the framework of the `flutter` dialect only, with its Dart package: the first form of the decision,
   generalized.
2. Synapsis as a framework concept every dialect applies to its technology: chosen.

## Consequences
- Positive: one architecture to learn for every target; a project is read and reviewed as Nuclear only; nothing
  generated is ever mixed with what a person or an agent writes.
- Positive: a dialect declares its `[toolchain]`, so the command needs no code for that dialect's language.
- Negative: everything the command does with a target has to be declared as data of the dialect.
- Later decisions added folders that are not `.nuc` beside the sources, each written or read by a tool: the copy of
  a url contract in `contracts/<name>/contract.json` (ADR-synapsis-0006), kind packages in `kinds/<name>/`
  (ADR-synapsis-0004), generated type definitions in `defs/` (ADR-lang-0008) and `migrations/` in a backend (ADR-backend-0001).

## References
- Replaces: ADR-0041, ADR-0045, ADR-0050, ADR-0072
