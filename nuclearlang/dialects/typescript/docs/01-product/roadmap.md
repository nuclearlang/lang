---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/nestjs.md, ../02-architecture/react.md, ../05-standards/testing.md]
---
# Roadmap of the `typescript` dialect

The pending work of `typescript` and of its framework dialects `nestjs` and `react`: only what is about how the
output is written in TypeScript. A done item is deleted. What is pending of the backend and web platforms
themselves (their kinds, their runtime packages, their commands) is in each platform's roadmap.

## Untested

- **`nestjs` database drivers.** MySQL, MariaDB and Postgres never ran; only SQLite did.
- **`nestjs` with OpenAI.** Only Ollama ran.
- **The `nestjs` `ilike`.** It is Sequelize's `Op.iLike`, which is PostgreSQL only: with MySQL, MariaDB or SQLite
  it is not case-insensitive everywhere. Only SQLite ran, with `like`.

## Pending

- **Found building Nuclear Chat's UI (spec 013, 2026-11-18)**, each worked around in `nuclear-chat/ui/` with a
  `shortcut:` comment or a different form:
  - a model declared with its fields in the header (`Texts(lang: string = "en")` plus methods) loses the fields
    (`this.lang` does not exist); written with the field in the body;

- **Telemetry in `nestjs`** (spec 012 of the tree): `[project.plugins.telemetry]`, the OpenTelemetry SDK started
  before Nest is imported, `@traced` on each use case's `exec` from a template like `fastapi`'s
  `usecase_method.tpl`, `@untraced` routes out of the traces (today it is only consumed), `Metric` with named
  attributes (they arrive as one object).
- **The base dialect lists no type definitions.** `dialect.toml` has no `defs` line (python's has
  `defs = ["python@3.14"]`), so `nuclear defs list --dialect typescript` prints nothing and a plain `typescript`
  file gets no automatic imports from TypeScript's library; `typescript@5.9.3` arrives only through `react` and
  `nestjs`. Adding it changes the goldens of `typescript`: a change of its own, with its diff reviewed.
- **Vector stores (Chroma) for LangChain.js**, like the `Chroma` connection of the `fastapi` dialect.
  TODO(human): `frameworks/nestjs/dialect.toml` already has the plugin `chroma` (`chromadb`) and imports `Chroma`
  and `vectorStore` from `synapsis-nest/ai`. What is still missing, or can this item be deleted?
