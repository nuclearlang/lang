---
status: draft
owner: Julian Molina
updated: 2026-11-17
related: [design.md, tasks.md, ../../03-adr/0004-products-are-made-with-the-tools.md]
---
# Spec 010: migrating a project into Nuclear — Requirements

## Goal

A project written in TypeScript, Python or Dart becomes a Nuclear project that does what the original did, in
every dialect of its platform. Asked by the user on 2026-11-17, after the same programs gave other values in the
three targets (the language's roadmap, "Found by running the same programs in the three targets").

Two halves:

1. **The transpiler gives one meaning.** Each case where a target used to decide the result is either made equal in
   every dialect, or rejected by a diagnostic with its fix.
2. **What a tool cannot decide is found before anyone reads the project.** The compiler and the migration tool list
   each such place (a *migration point*); an AI agent resolves those points one by one, given only the point and
   what it needs to decide, never the whole project.

## Requirements

1. Every case of the catalogue ([design.md](design.md), "The catalogue") has a rule in
   `nuclearlang/docs/07-reference/` (the same result in every dialect, or a diagnostic), a program of
   `nuclearlang/examples/semantics/` that prints the same text in TypeScript, Dart and Python, and a unit test of
   the transpiler for its emitted code or its diagnostic.
2. `nuclear check --portability [--json]` lists every place of a Nuclear project whose meaning still depends on the
   target: code, position, the types the compiler knows, the rule, the candidate rewrites and the span of the
   declaration around it.
3. `nuclear port <folder> --from typescript|python|dart` writes the Nuclear project and its migration points
   (`.nuclear/port/points.json`). It reads the original with that language's own parser. A construct with one
   meaning is translated by the tool. A construct whose meaning changes (TypeScript's coercing `==`, `===` of two
   arrays, Python's `is`, a dataclass `==`, a condition that is not a boolean...) and a construct the tool cannot
   translate are points, each with its span in the original and in the Nuclear file.
4. An agent resolves a point from its slice only: the point, the declaration around it, the types, the rule and the
   candidates. It answers with one candidate or with Nuclear for that slice; the tool checks the answer with the
   compiler and applies it. No agent writes a whole file or reads the project.
5. A point is resolved by the user, by an agent through the MCP server (`nuclear_port_points`,
   `nuclear_port_resolve`), or by the local Nuclear Developer; the CLI works without any agent (the points are
   then left for a person).
6. The migrated project is proved: the original's tests and the Nuclear project's tests run, and their results are
   compared.
7. Generated code pays nothing for the migration: a rule that makes the targets equal costs nothing where the type
   is known (the golden rule); where it would cost, the rule is a diagnostic instead.

## Out of scope

- Translating a framework's project shape by hand: a NestJS, FastAPI, Flutter or React project is mapped to its
  Synapsis platform by the platform's generators (`nuclear new`, `make`), not by the agent.
- Two-way translation: the transpiler stays one way (`.nuc` → target); the importer is another tool.
- Node.js/Express (postponed by the user).
