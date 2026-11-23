---
status: accepted
owner: Julian Molina
updated: 2026-11-23
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

- **Found by the backend's app check (2026-11-23)**, in `frameworks/nestjs/`:
  - **the default of a controller's parameter is not written** (`templates/controller_method.tpl` writes the name
    and the type only): `list(page: int = 1)` becomes a required `page`, so `GET /customers` of `store_api`, and the
    list route `nuclear gen resource` writes, answer 500 where the `fastapi` app answers 200. The golden
    `examples/expected/store_api` holds it (probe `param.default`);
  - **the app listens on every network of the machine** (`templates/main.tpl`: `app.listen(port)`), also when
    `nuclear run` starts it; the `fastapi` app listens on `127.0.0.1` (probe `bind.store`);
  - **every build prints the warning N0305** (`does not bring these plugins ... telemetry`), whatever the project's
    plugins, and each `nuclear migrate` command prints three `npm notice run` lines (`npx` in `[toolchain]`).

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
