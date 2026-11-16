---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [02-architecture/overview.md]
---
# Decisions of the mobile platform

Cited from anywhere in the tree as `ADR-mobile-NNNN`. A new decision copies the platform's
[template](../../../../../docs/03-adr/0000-template.md) with the next number. An accepted ADR is never edited: a
change is a new ADR, and the old one is marked `superseded by ADR-mobile-NNNN`.

| ADR | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-project-manifest-packages-and-assets.md) | A project's manifest is `config.nuc`, it lists only third-party packages, and assets follow a convention | accepted | 2026-11-16 |
| [0002](0002-screens-routes-dialogs-and-splash.md) | A screen is declared with `@screen`, navigation belongs to the views, and dialogs and the splash come from the runtime | accepted | 2026-11-16 |
| [0003](0003-json-models-names-and-converters.md) | JSON is generated from the model: `@key` names a field and a `converter` reads and writes a value | accepted | 2026-11-16 |
| [0004](0004-tests-in-nuclear.md) | Tests are written in Nuclear, and the build generates the standard ones | accepted | 2026-11-16 |
| [0005](0005-readable-logs-by-component.md) | A log is a readable block by component, and the transpiler writes where it was called | accepted | 2026-11-16 |
| [0006](0006-local-database.md) | The local database is the backend's ORM on the device: `@primary` models, `@repository(saveLocal)` and `<method>AsLocal()` | accepted | 2026-11-16 |
| [0007](0007-accepted-rules-of-events-guards-forms-and-state.md) | Guards may be async, an event travels between engines as JSON, and the names of the session's events, translations, form checks and state builders are fixed | accepted | 2026-11-16 |

Decisions this platform lives by that belong to other projects (the platforms and their dialects, kinds as
libraries, the standard library, `Result`, closed components, events, session, ACL, forms, translations, Genkit,
shared contracts, the generators) are in the ADRs of the [framework](../../../../AGENTS.md) and of the
[language](../../../../../nuclearlang/AGENTS.md).

A decision cited by its old platform-wide number (`ADR-00NN`, in code or commits before 2026-11-16): see
[the table of old numbers](../../../../../docs/03-adr/old-numbers.md).
