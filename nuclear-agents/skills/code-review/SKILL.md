---
name: code-review
description: Review a change to a Nuclear project or to the platform: the compiler's verdict, the architecture rules of nuclear check, tests, generated code left untouched, tools used before hand-written code, naming and docs. Use when reviewing a pull request, a factory run's output or a teammate's change.
title: Code review
title_es: Revisión de código
description_es: Revisar un cambio en un proyecto Nuclear o en la plataforma: el veredicto del compilador, las reglas de arquitectura de nuclear check, los tests, el código generado sin tocar, las herramientas usadas antes que el código a mano, los nombres y la documentación. Úsalo al revisar un pull request, la salida de una ejecución de la fábrica o el cambio de un compañero.
kind: practice
tags: [code review, review, pull request, quality, architecture, naming, nuclear check]
base: true
---
# Code review

## When to use

Any change before it merges: a pull request, a software factory run (`nuclear-builder run show <id>`), a local
agent's output. Read the connected code, not only the diff.

## Steps

1. **Let the tools speak first.** In the project: `nuclear check . --json` (must print `[]`), `nuclear fmt --check .`
   (must list nothing), `nuclear test` (green). Or the whole line: `nuclear-builder ci check test security`. A red
   tool is the first comment; the rest waits.
2. **Was it made with the tools?** Each new resource, screen, use case and kind should come from `nuclear gen` or
   `nuclear make` (`nuclear gen inspect` shows what the project has). Hand-written CRUD, repositories that duplicate
   a contract's, or skeletons written by hand are a request to regenerate.
3. **Generated code untouched.** No change under `build/`, no edit of `contracts/<name>/*.nuc`, no `.py`, `.ts`,
   `.dart` written for a feature. Migrations in `migrations/` are reviewed as code: a drop that should be a rename
   loses data.
4. **Architecture.** A use case is called only from the facade; a service from a use case or an aggregate; a
   repository from a use case, an aggregate (or a `tools` on the backend); another component only through its
   `appcomponent` (N0301/N0302 catch most; read for logic placed in the wrong layer: rules in a controller or a
   view, queries in a use case instead of the repository).
5. **The platform's words, not the target's.** Platform code names Nuclear's standard library only (`nuclear help
   library`); a React, Flutter, FastAPI or npm/pub/PyPI name in platform code is a bug, unless the file is meant to
   use that package's definitions and the docs say so. Names are camelCase in the `.nuc`, whatever the dialect.
6. **Behaviour and errors.** Use cases return `Result` with the platform's errors (`NotFound`, `Invalid`,
   `Unauthorized`, `Forbidden`, `Conflict`); edge cases (empty, repeated, unauthorised, concurrent) have tests;
   writes spanning several rows are `@transactional`.
7. **Tests.** Every acceptance criterion has a `@test`; no test deleted or weakened; mocks only at the repository.
8. **Security and performance** at a glance: secrets from `env(...)`, guards on private routes, no list without
   pagination, no awaited call in a loop (skills `security-review-owasp`, `performance-load`).
9. **Docs in the same change.** The project's `AGENTS.md`, `docs/`, roadmap (a done item deleted, half-done work
   recorded). For a compiler or dialect change: a new diagnostic documented in
   `nuclearlang/docs/07-reference/diagnostics.md`, every dialect word in its `docs.toml`, goldens regenerated and
   their diff read, and the parser unchanged per dialect.
10. **Write the review**: each comment with file and line, what is wrong, why, and the fix (a command to run or the
    Nuclear to change). Separate blocking from optional.

## The platform's tools

- `nuclear check . --json`, `nuclear fmt --check .`, `nuclear test`, `nuclear gen inspect`.
- `nuclear help <word> --dialect <d>` to confirm a word exists before accepting it.
- `nuclear-builder run show <id>`, `nuclear-builder run journal <id>`, `nuclear-builder checks <id>` for a factory run.
- MCP: `nuclear_check`, `developer_review` (keeps the lead's corrections as examples for the local developer).

## Pitfalls

- Approving because the check is green: the check proves the code compiles, not that it does what the spec asks.
- Reviewing the generated target code instead of the `.nuc`.
- Accepting a word that "looks right": Nuclear is not TypeScript, Dart or Python; look it up.
- Asking for an abstraction, option or wrapper nobody needs: the golden rule is minimal readable Nuclear.
- Letting docs slide to a later change: the rule is the same change.

## Checklist

- [ ] `nuclear check . --json` prints `[]`, `nuclear fmt --check .` lists nothing, `nuclear test` is green.
- [ ] Standard code came from `gen`/`make`; nothing under `build/` or `contracts/` was edited.
- [ ] No target-language file or target library name was added to platform code.
- [ ] Layers and component boundaries are respected; logic sits in its kind.
- [ ] Each criterion and error path has a test; no test was weakened.
- [ ] The project's docs and roadmap changed with the code.
- [ ] Every comment names a file, a line and a concrete fix.
