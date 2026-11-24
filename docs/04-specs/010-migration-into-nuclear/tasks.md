---
status: draft
owner: Julian Molina
updated: 2026-11-17
related: [requirements.md, design.md]
---
# Spec 010 — Tasks

## Phase 0: decisions of the user

Until the importer exists, an agent migrates with the tools ([ADR-platform-0015](../../03-adr/0015-migrating-a-project-into-nuclear.md):
MCP `migration_inspect`, the graph's `strategy:migrate-project`); the importer then does the translation and the
agent resolves only its points.


- [ ] T0.2 The rule of each case of the catalogue marked "decision of the user" (`%`, integer width, `>>>`, powers).
- [ ] T0.3 The name of the command (`nuclear migrate` is the database's) and of the importer's project.

## Phase 1: one meaning in every dialect (`nuclearlang/`)

- [ ] T1.1 The compiler bugs of the catalogue fixed, each with a golden test: Dart `$true`/`$null`, `<` of texts in
      Dart, `sum()` of `double[]` in Dart, `a is b` with a variable, a base called without its arguments, TS2367.
- [ ] T1.2 The diagnostics: a condition that is not a boolean, `==`/`in` of `any`, types that do not overlap, a set
      of an element that cannot be hashed; each documented in `diagnostics.md`, with its fix and a test.
- [ ] T1.3 The "Equal" cases, one at a time: the rule in the reference, the dialects' templates or helpers, a
      program in `examples/semantics/` and a unit test of the emitted code.
- [ ] T1.4 `DIR=examples/semantics tools/stdlib-check.sh` runs in the CI, so a case stays fixed.

## Phase 2: the portability report

- [ ] T2.1 The `N04xx` points in the compiler, with the types, the rule, the candidates and the slice.
- [ ] T2.2 `nuclear check --portability [--json]`; a unit test per point (a `.nuc` and its expected JSON).

## Phase 3: the importer

- [ ] T3.1 TypeScript first: the base language, the points of the original (table "From the original only"), a
      corpus of TypeScript programs with their expected `.nuc` and `points.json`.
- [ ] T3.2 Python, then Dart, the same way.
- [ ] T3.3 The framework's shapes through the platforms' generators.

## Phase 4: the agent

- [ ] T4.1 `nuclear_port_points` and `nuclear_port_resolve` in the MCP server.
- [ ] T4.2 The Nuclear Developer's strategy `port-point` and its evaluation.

## Phase 5: the proof

- [ ] T5.1 `nuclear port --verify`: the original's tests and the Nuclear project's tests, compared.
- [ ] T5.2 A real project of each language migrated end to end.
