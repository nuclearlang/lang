---
name: review-good-practices
description: Review the change against the platform's architecture and readable Nuclear - the rules a compiler does not check.
title_es: Revisar las buenas prácticas
description_es: Revisar el cambio contra la arquitectura de la plataforma y el Nuclear legible: las reglas que un compilador no comprueba.
---
# Review good practices

- **The platform's architecture**: a use case is called only from its component's appcomponent; another
  component sees only the appcomponent, models, events, guards and screens; a screen calls its statemanager; only a
  use case calls a repository.
- **The tools first**: what a generator writes was generated, not written by hand; no generated file was edited.
- **Nuclear's names and library**: camelCase members, PascalCase types; Nuclear's library (`length`, `add`,
  `x in xs`), never the target's; no dialect named in platform code.
- **Readable**: one thing per file and per method; names that say what they hold; a doc comment on each
  declaration others use; no dead code, no repeated block that a shared one could be.
- **Tests that test**: each test checks one behaviour with `expect`; no test without an `expect`; no test that
  passes whatever the code does.
- **Texts and secrets**: the texts a user sees are translation keys; a secret is `env("VAR")`, never in code.

Each finding: the file and line, the rule, and the change, in Nuclear.
