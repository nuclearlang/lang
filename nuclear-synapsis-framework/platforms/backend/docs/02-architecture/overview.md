---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [runtime-python.md, runtime-typescript.md, dependencies.md, ../07-reference/backend.md, ../../../docs/02-architecture/contract.md]
---
# Architecture

## From a project to a running app

```
a backend project (.nuc, config.nuc)
   │  nuclear build .  /  dragonfly build
   ▼
the compiler ── loads ──► the dialect   nuclearlang/dialects/<language>/frameworks/<dialect>/
   │                        └─ platform = "backend" ──► platform.toml   (this folder: the contract)
   ▼
build/   the dialect's project, never edited ── imports ──► the runtime   (packages/)
   │     .nuclear/contract.json, .nuclear/openapi.json
   ▼
the running app: its routes, GET /.nuclear/contract.json, GET /.nuclear/openapi.json
```

A project has only `.nuc` files: components with `data/` (entities, repositories), `domain/` (models, use cases),
`api/` (controllers), `ai/` (tools, agents, states, graphs), `events/` (listeners) and the `appcomponent` facade;
`config/project_config.nuc` with the connections; `config.nuc` with `dragonfly(platform = "backend", dialect =
...)`, `app(...)` and `plugins(...)`; tests in `test/*_test.nuc`; errors as `Result`; Nuclear's standard library.
The rules are [the reference](../07-reference/backend.md).

## The contract: `platform.toml`

The format of a contract, how a dialect implements it and what the loader checks (N0305) are the same for the three
platforms: [the contract of a platform](../../../docs/02-architecture/contract.md). What this one holds:

| Section | In the backend contract |
|---|---|
| `[platform]` | `default_dialect = "fastapi"`. Kinds: `appConfig`, `config`, `entity`, `repository`, `model`, `usecase`, `appcomponent`, `service`, `aggregate`, `controller`, `listener`, `tools`, `agent`, `state`, `graph`, `tests`. Decorators: data (`entity`, `primary`, `column`, `created`, `updated`, `repository`, the relations, `transactional`), the API (`controller`, `get`, `post`, `put`, `patch`, `delete`, `status`), events and graphs (`consumer`, `start`, `next`, `state`), tests (`test`), validation (`required`, `email`, `url`, `minLength`, `maxLength`, `min`, `max`, `pattern`) and `key` (a model field's name in the JSON). Plugins: `sqlite`, `postgres`, `mysql`, `mariadb`, `redis`, `kafka`, `events`, `ai`, `openai`, `ollama`, `chroma` |
| `[decorators.args]`, `[decorators.fields]` | the arguments of `@primary` and of the relation decorators and the rules behind N0308 (below) |
| `[decorators.replaced]` | `generated` → `@primary(generated = true)` (N0309) |
| `[layout]` | a path per kind: `config/project_config.nuc`, `test/`, and under `components/{component}/`: `data/entities/`, `data/repositories/`, `domain/{models,usecases,services,aggregates}/`, `api/`, `events/`, `ai/`, `ai/states/`, `config/`, and the facade `{component}_appcomponent.nuc` |
| `[skeletons]` | one per kind, except `appConfig` and `graph` |
| `[gen]`, `[[generators.*]]` | `component` (the facade); `resource`: from another API (`when = "rest"`: the models, an HTTP repository) or from the database (`when = "db"`: the entity, `New<Name>`, a repository with `page`, the tests), and for both a use case per action, the facade's aliases and the controller; `usecase`: a use case over a repository method, its alias and its route |

What the generators do for a user is in the reference (§2.13); how they work is
[the code generator](../../../../../tools/code_generator/AGENTS.md)'s.

## The dialects that implement it

| Dialect | Language | Built on | Folder | Its documents |
|---|---|---|---|---|
| `fastapi` | Python 3.12+ | FastAPI, SQLAlchemy 2 async, pydantic, Alembic, LangChain / LangGraph, pytest | `nuclearlang/dialects/python/frameworks/fastapi/` | [reference](../../../../../nuclearlang/dialects/python/docs/07-reference/fastapi.md), [guide](../../../../../nuclearlang/dialects/python/docs/08-guides/fastapi.md) |
| `nestjs` | TypeScript (ES modules) | NestJS 12, sequelize-typescript, class-validator, LangChain.js / LangGraph.js, `node:test` | `nuclearlang/dialects/typescript/frameworks/nestjs/` | [reference](../../../../../nuclearlang/dialects/typescript/docs/07-reference/nestjs.md), [guide](../../../../../nuclearlang/dialects/typescript/docs/08-guides/nestjs.md) |

Each dialect has one runtime here: [`dragonfly-py`](runtime-python.md), [`dragonfly-nest`](runtime-typescript.md).
In both, `Result` comes from the runtime, not from the generated code.

## What every built app serves

Both runtimes serve the two documents the compiler wrote next to the app: `GET /.nuclear/contract.json` and
`GET /.nuclear/openapi.json` (`_serve_contract` in `packages/dragonfly-py/src/dragonfly/app.py`, `serveContract` in
`packages/dragonfly-nest/src/web.ts`). A mobile or web project declares the backend in its `config.nuc` and gets its
models and repositories generated from the contract (ADR-synapsis-0006): the files and the flow are in
[shared contracts](../../../../docs/02-architecture/shared-contracts.md), the steps for a user in
[the guide](../08-guides/contracts.md).

## How the data words are built

The rules of `@primary` and of the relation decorators ([ADR-backend-0001](../03-adr/0001-backend-data.md)) are data
of this platform: `[decorators.args]` and `[decorators.fields]`, merged into both dialects by the loader. The
emitter's `check_field_rules` raises N0308 with no decorator name in Rust; it compares Nuclear names, so the case a
dialect writes does not matter. A dialect's templates read `tinfo.decor` (the decorators of the related entity: its
table), `tinfo.fields_decor.primary` (its key), `owner` / `owner_decor` (the entity the field is in) and the
`unquote` filter. What each runtime does with them: [Python](runtime-python.md#data),
[TypeScript](runtime-typescript.md#data).

## The examples

| Example | Shows | Built with | Golden |
|---|---|---|---|
| `examples/examples-backend/tasks_api/` | tasks and an assistant: `Project` ↔ `Task` ↔ `Tag` relations, a paged route, a transactional use case, an HTTP repository, events, an agent with tools and a graph | every dialect (written with `nestjs` in its `config.nuc`; the fastapi check switches it) | `examples/expected/tasks_api/` |
| `examples/examples-fastapi/rick_api/` | characters: a REST API, an agent with its tools, a graph | `fastapi` | `examples/expected/rick_api/` |
| `examples/examples-nestjs/users.nuc` | one file | `nestjs` | `examples/examples-nestjs/users.ts` |

The mobile example `tasks_app` (`../mobile/examples/examples-flutter-dialect/tasks_app`) is generated against
`tasks_api`'s contract. How the examples are checked: [testing](../05-standards/testing.md).
