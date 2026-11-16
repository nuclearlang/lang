---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [vision.md, ../02-architecture/overview.md, ../07-reference/backend.md]
---
# Glossary

The words of this project, where one of them can be read two ways. The rules of each kind are in
[the reference](../07-reference/backend.md).

| Term | Meaning | Not to be confused with | Where it is |
|---|---|---|---|
| platform | What a project writes: kinds, decorators, folders, `config.nuc`, plugins, tests. Identical for every dialect | a dialect | `platform.toml` |
| dialect | The language and framework the code comes out in: `fastapi`, `nestjs`. Chosen in `config.nuc`: `synapsis(platform = "backend", dialect = ...)` | the platform | `nuclearlang/dialects/<language>/frameworks/<dialect>/` |
| contract of the platform | `platform.toml`: what every backend dialect must implement | the contract of an API | `platform.toml` |
| contract of an API | `.nuclear/contract.json`: the controllers, routes and models of one backend, written by its build and served by the running app; an app generates its models and repositories from it | the OpenAPI document (`.nuclear/openapi.json`, written and served beside it) | [the guide](../08-guides/contracts.md) |
| kind | The word of a declaration: `entity`, `repository`, `model`, `usecase`, `appcomponent`, `service`, `aggregate`, `controller`, `listener`, `tools`, `agent`, `state`, `graph`, `tests`, `appConfig`, `config` | a type | `[platform] kinds` |
| component | A folder `components/<name>/` of a project (`data/`, `domain/`, `api/`, `ai/`, `events/`), closed behind its facade | a UI component | `[layout]` |
| facade | The `appcomponent` of a component: an alias for each of its use cases, the only thing another component calls | — | `components/<name>/<name>_appcomponent.nuc` |
| connection | A database, a broker, a model or another API the app declares in its `appConfig`: `SQLite`, `Postgres`, `MySQL`, `MariaDB`, `Redis`, `Kafka`, `OpenAI`, `Ollama`, `Embeddings`, `Chroma`, `Http` | a plugin | `config/project_config.nuc` |
| plugin | An optional part of the platform a project turns on (`plugins(sqlite = true)`): only the enabled ones reach the generated project's dependencies | a connection (a database connection needs its plugin) | `[platform] plugins` |
| runtime | The package the generated code imports: `synapsis-py`, `synapsis-nest` | the dialect (templates and TOML) | `packages/` |
| resource | What `nuclear gen resource` writes for one name: models or entity, repository, use cases, facade aliases, controller, tests | an entity | `[[generators.resource]]` |
| conformance example | `tasks_api`: one project built with every dialect from the same `.nuc` files | a golden of one dialect | `examples/examples-backend/tasks_api/` |
| golden | The expected generated output of an example, compared by `cargo test` | — | `examples/expected/` |
