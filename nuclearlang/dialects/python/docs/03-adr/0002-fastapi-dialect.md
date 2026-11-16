---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0002: The `fastapi` dialect writes the backend with FastAPI, SQLAlchemy 2 async, pydantic, LangChain and LangGraph

## Context and problem

The user asked for Synapsis on Python with LangChain / LangGraph, based on the domain kinds of the Flutter
framework: REST APIs with `@controller`, `@get`, `@post` like NestJS; repositories that reach tables through an ORM
instead of an HTTP API but read almost the same; CRUD like TypeORM with a model; connections to external systems
(Kafka, Redis, Postgres, MySQL) in the config; pydantic; and the most used library for each basic need, without
two that do the same.

## Decision

**The dialect.** `fastapi` extends `python` (ADR-python-0001) and implements the backend platform (ADR-synapsis-0002). It has
the same architecture as the mobile framework: components, `usecase` (one `exec` returning `Result`),
`appcomponent` (aliases through `inject`), `service`, `aggregate`, `config` / `appConfig`, architecture rules; kinds
by folder for `entity`, `model`, `state` and `tests`.

**Data.** The ORM is SQLAlchemy 2 async, decided with the user. An `entity` is a SQLAlchemy 2 table whose field
decorators are TypeORM's (`@entity`, `@primary`, `@column(...)`, `@created`, `@updated`; the generated key and the
relations are ADR-backend-0001's). A `repository` is `Repository[Entity]` with CRUD (`find`, `findAll`, `save`,
`remove`) and methods whose lines build one query per call (`where`, `orderBy`, `limit`, `offset`, then `getOne` →
`Result`, `getMany`, `count`, `exists`, `update`, `delete`): the kind writes `q = self.query()` and
`self_member = "q.{{name}}"`, so the user's lines stay as written. Repository methods return an awaitable (callers
write `~`).

**API.** `controller` and the runtime's decorators over FastAPI. A `Result` answers its value or the `AppError`'s
status (`NotFound` 404, `Invalid` 400, `Unauthorized` 401, `Forbidden` 403, `Conflict` 409). An entity in a body or
an answer goes through a pydantic schema built from its columns (`schema_of`). A `model` is a pydantic model.

**AI.** `tools` (methods → LangChain StructuredTools; the docstring is the description), `agent` (LangChain
`create_agent` with an in-memory checkpointer, `ask` / `stream`), `state` (a pydantic model, `Messages`) and
`graph` (a `StateGraph` from methods, `@start`, `@next`, `Command` for run-time routes). Models through
`init_chat_model` / `init_embeddings` (OpenAI and Ollama behind one API); Chroma through langchain-chroma.

**Messaging and cache.** `listener` with `@consumer("topic")` (aiokafka), `publish`, `cacheGet` / `cacheSet`
(`redis.asyncio`).

**Runtime.** The package `synapsis-py` (import name `synapsis`,
`nuclear-synapsis-framework/platforms/backend/packages/synapsis-py`): the injector, the connections opened by the
app's lifespan, `create_app`, testing helpers (`running`, `client`, `FakeModel`, in-memory databases). The build
writes `app/main.py`, `tests/conftest.py` and `pyproject.toml`; the optional parts are plugins of `config.nuc` (old
ADR-0092).

## Options considered

No alternative was recorded besides the choice of SQLAlchemy 2 async as the ORM, taken with the user.

## Consequences

- Positive: `nuclear-synapsis-framework/platforms/backend/examples/examples-fastapi/rick_api` (golden) builds to a
  project that passes `pyright --strict`, its Nuclear tests (pytest) and
  `nuclear-synapsis-framework/platforms/backend/checks/fastapi-check/check.sh` end to end (REST CRUD, 409, 400,
  404, the agent over HTTP with a fake model, tools, the graph, OpenAPI).
- Positive: the same `.nuc` builds with the other backend dialect; the check builds the `tasks_api` example with
  both (ADR-synapsis-0002).
- Negative: no run yet against real Postgres, MySQL, Redis, Kafka or OpenAI (`nuclearlang/dialects/python/docs/01-product/roadmap.md`).

## References

- Replaces: ADR-0090
