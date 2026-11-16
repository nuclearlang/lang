---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0001: The `nestjs` dialect writes the backend with NestJS, Sequelize, Kafka, Redis and LangChain.js

## Context and problem

The user asked for the TypeScript dialect of the backend with NestJS and Sequelize as the ORM, and decided: the
official integration (`@nestjs/sequelize` + `sequelize-typescript`), the `nestjs` dialect as Synapsis's, and the
scope of the Python backend dialect: CRUD, Redis and Kafka, LangChain.js.

## Decision

**The same Synapsis as the Python backend dialect** (ADR-python-0002): `entity`, `repository` (CRUD and one query
per method call, `self_member = "q.{{name}}"`), `model`, `usecase`, `appcomponent`, `service`, `aggregate`,
`controller`, `appConfig` / `config`, `listener`, `tools`, `agent`, `state`, `graph`, `tests`; the same query names
(`where`, `orderBy`, `getOne`...), errors (`AppError` with HTTP statuses) and decorators. Names stay as written:
Nuclear's `camelCase` is TypeScript's. The dialect extends `nodejs`, which extends `typescript`.

**NestJS 12, ES modules.** Relative imports end in `.js`, `"type": "module"`, `tsconfig` `nodenext`. Tests run with
`node:test` on the compiled code (decorator metadata, no test framework to configure); `expect(cond)` is
`assert.ok`.

**Generated per project.** `src/app.module.ts` (a global module per component, and the app module with
`SequelizeModule.forRootAsync` so tests use SQLite in memory), `src/main.ts`, `package.json` (only the drivers and
optional parts the project enables: the plugins of ADR-synapsis-0004) and `tsconfig.json`.

**Nest idioms.** Use cases are injected in the appcomponent's constructor (`alias_via = "constructor"`); the
repository's model comes with `@InjectModel`; route parameters, the body and the query are read by themselves
(`route` in `params_list`: `@Param` + `ParseIntPipe`, `@Body`, `@Query`); DTOs are validated with class-validator
from the field's type and the same rule decorators as the mobile forms (`@minLength`, `@email`...). A `Result`
answered by a controller goes through `ResultInterceptor`.

**Messaging and AI.** kafkajs (`publish`, listeners with `@consumer`, missing topics created; without Kafka the
listeners of the process receive it) and ioredis (`cacheGet` / `cacheSet`); LangChain.js `tool` + zod schemas from
the parameters (`doc_text` / `doc_literal`), `createAgent`, LangGraph.js `StateGraph` over `Annotation.Root`,
models through `initChatModel` (Ollama, OpenAI). The Chroma vector store is chromadb's client behind a LangChain
`VectorStore` in the runtime.

**Type definitions of TypeScript.** `nuclearlang/tools/defs/typescript/gen.js` runs the TypeScript compiler over
the `.d.ts` files: the standard library (implicit) and NestJS, Sequelize, class-validator, class-transformer, RxJS
and the runtime. The order of `defs` decides a name two packages export (class-validator's `IsInt`, Nest's
`Query`).

**Generic emitter additions, not NestJS cases.** `relative` in `project_import`; `alias_via = "constructor"`;
`route`; `field_decor`; `components` and `uses` in project templates; `tinfo` in `field`; `type_args_as_args` with
names; `doc_text` / `doc_literal`; `left_infix` / `right_infix` / `null` in operators (TypeScript writes
`== null` / `!= null`, which also covers `undefined`); N0219 only with native named arguments.

## Options considered

1. `@nestjs/sequelize` + `sequelize-typescript`, the official integration. Chosen by the user.
2. `@langchain/community` for the vector store. Rejected: its peers conflict with zod 4 and ioredis 6.

## Consequences

- Positive: `nuclear-synapsis-framework/platforms/backend/examples/examples-backend/tasks_api` (golden) builds to a
  project that passes `tsc --strict`, its Nuclear tests (`node:test`: CRUD, conflict, listener, tools) and
  `nuclear-synapsis-framework/platforms/backend/checks/nestjs-check/check.sh` (HTTP CRUD, 400 / 404 / 409). It ran
  by hand with a local Ollama (the agent lists and adds tasks, the planner graph creates them) and against real
  Redis and Kafka (temporary containers).
- Positive: the same `.nuc` builds with the other backend dialect (ADR-synapsis-0002).
- A kind's name is written as it is: `controller Users` is `Users`, not `UsersController`.
- Negative: the MySQL, MariaDB and Postgres drivers and OpenAI never ran (`nuclearlang/dialects/typescript/docs/01-product/roadmap.md`).

## References

- Replaces: ADR-0091
