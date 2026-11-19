---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../07-reference/nestjs.md, ../03-adr/0001-nestjs-dialect.md, overview.md, dependencies.md]
---
# The `nestjs` dialect: the backend platform written in TypeScript

`frameworks/nestjs/` (`extends = "nodejs"`, which extends `typescript`; `platform = "backend"`). The platform (its
kinds, decorators, folders, `config.nuc`, plugins and tests, in Nuclear) is
[the backend platform's](../../../../../nuclear-synapsis-framework/platforms/backend/AGENTS.md); its contract is
`nuclear-synapsis-framework/platforms/backend/platform.toml`. This dialect holds only how each of those is written:
NestJS 12 (ES modules) controllers, repositories over tables with Sequelize, DTOs validated with class-validator,
Kafka listeners and the Redis cache, LangChain.js / LangGraph.js tools, agents and graphs, and the Nest modules,
written by the dialect. The generated code calls the platform's runtime package `synapsis-nest`
(`nuclear-synapsis-framework/platforms/backend/packages/synapsis-nest`). Normative equivalences:
[../07-reference/nestjs.md](../07-reference/nestjs.md). Decision: ADR-typescript-0001.

## What it changes of its parents

- `[syntax] project_import = "{{relative}}.js"`: NestJS 12 is ES modules, so a relative import names the compiled
  file.
- `builtin_result = false`: `Result`, `Ok` and `Err` are the runtime's.
- `type_args_as_args = ["inject"]`: `inject<Repo>()` → `inject(Repo)`, the class is the token.
- `route_param = ":name"`: the platform's `@get("{id}")` → `@Get(':id')` (the templates read the converted path
  as `decor.get.path`).
- `[types] Error = "AppError"`: a use case fails with an `AppError` whose status is the HTTP answer. Nuclear's
  `Error(message)` is `new AppError(message)`; `e.message` is `(e as AppError).message` (a caught exception is
  `unknown` in TypeScript).
- `replaces`: in Nest, `Transform` is the class-transformer decorator, not the Node stream.
- `expect(condition)` in a test is `assert.ok(condition)` (`node:assert/strict`).
- `[imports]`: `use common`, `core`, `config` → `@nestjs/common`, `@nestjs/core`, `@nestjs/config`.

## How each kind is written

Names are written as they are (a `controller Users` stays `Users`).

| Kind | Template | TypeScript |
|---|---|---|
| `appConfig`, `config` | `appconfig.tpl`, `config.tpl` | a class that extends `AppConfig` / `ComponentConfig` with `readonly` connections |
| `entity` | `entity.tpl`, `entity_field.tpl` | a sequelize-typescript model (`@Table`, `@Column`, `@PrimaryKey`, `@AutoIncrement`, `@CreatedAt`, `@UpdatedAt`, `@BelongsTo`, `@HasMany`, `@HasOne`, `@BelongsToMany`); the Nuclear field decorators are read by the template |
| `repository` | `repository.tpl`, `repository_method.tpl` | `Repository<Entity>` with CRUD and the model injected with `@InjectModel`; each method builds one query per call (`self_member = "q.{{name}}"`) |
| `repository` with `@repository(path = "...")` | `repository_http_method.tpl` | `HttpRepository`: a method without a body and with `@get` / `@post` / `@put` / `@patch` / `@delete` is an HTTP call |
| `model` | `model.tpl`, `model_field.tpl` | a DTO validated with class-validator from the field's type and the rule decorators (`@required`, `@email`, `@minLength`, `@min`...: `IsString`, `IsInt`, `IsEmail`, `MinLength`, `Min`...) |
| `usecase`, `service`, `aggregate` | `injectable.tpl` | an `@Injectable` class whose dependencies are `private readonly` constructor parameters |
| `appcomponent` | `injectable.tpl` | the use cases are injected in its constructor and each alias calls `field.method` (`alias_via = "constructor"`) |
| `controller` | `controller.tpl`, `controller_method.tpl` | a Nest controller; route parameters, the body and the query are read by themselves (`route` in `params_list` and `tinfo.model`: `@Param` + `ParseIntPipe` / `ParseBoolPipe` / `ParseFloatPipe`, `@Body`, `@Query`); a `Result` it answers goes through the runtime's `ResultInterceptor` |
| `listener` | `listener.tpl` | a `Listener` whose `@consumer("topic")` methods receive every message of the Kafka topic (in the same process without Kafka) |
| `tools` | `tools.tpl` | LangChain.js `tool`s with zod schemas built from the parameters; the doc comment is what the model reads (`doc_text` / `doc_literal`); a method without one is a helper |
| `agent` | `agent.tpl` | a LangChain agent (`createAgent`) with `ask(text, thread)` |
| `state` | `state.tpl` | a LangGraph `Annotation.Root` and its type (`typeof Name.State`); a `Messages` field is `Messages()` |
| `graph` | `graph.tpl` | a LangGraph.js `StateGraph` from the node methods (`@start`, `@next("node")`) with `run(state, thread)` |
| `tests` | `tests.tpl`, `tests_method.tpl` | a `node:test` suite (`describe`) that starts the app before each test (`startTestApp(AppModule)`, databases in memory) and stops it after; `inject<X>()` gives the instances |

Kind by folder (`[project.kinds]`): `components/*/data/entities` and `shared/entities` → `entity`;
`components/*/domain/models` and `shared/models` → `model`; `components/*/ai/states` → `state`; `test` → `tests`.

## Data relations and transactions

The rules of the relation decorators are the platform's data (`[decorators.args]` and `[decorators.fields]` of its
`platform.toml`, merged into this dialect by the loader). The entity templates read `tinfo.decor` (the related
entity's table), `tinfo.fields_decor.primary` (its key), `owner` / `owner_decor` (the entity the field is in) and
the `unquote` filter. Only the side with the column declares the foreign key (`constraints: false` on `@HasMany` /
`@HasOne`); a join table is `joinTable(name, fk, other)`; `Related<T>` types a single relation so the decorator
metadata never reads the other class (ES modules with circular imports). What the runtime does with them is the
backend platform's.

## Project files

A folder with `config.nuc` (`synapsis(platform = "backend", dialect = "nestjs")`); `nuclear build .` writes
`build/`. `[project] sources = "src"`; the platform's `test/` stays `test/`.

| File | Template | Holds |
|---|---|---|
| `src/app.module.ts` | `app_module.tpl` | one global Nest module per component, from the `components` variable of the project templates (its entities, repositories, use cases, services, listeners, tools, agents, graphs, appcomponent and controllers) and the app module with `SequelizeModule.forRootAsync`, so tests use SQLite in memory |
| `src/main.ts` | `main.tpl` | `createApp(AppModule)` and `listen` on `PORT` (default 3000) |
| `package.json` | `package_json.tpl` | `"type": "module"`; scripts `build`, `start`, `dev` (`tsc` then `node --watch`), `test` (removes `dist/test`, then `tsc` and `node --test`: `tsc` never deletes the output of a source that is gone); NestJS, Sequelize, class-validator and the runtime; the packages of the enabled plugins (`plugins.packages`) and of `dependencies(...)` |
| `tsconfig.json` | `tsconfig.tpl` | ES2022, `nodenext`, strict, decorators with metadata, source maps |
| `.npmrc` | inline | `install-links=true`: npm copies the runtime (a `file:` dependency) instead of linking it; from a link TypeScript resolves the runtime's imports next to the runtime's own folder, not the app's |

Tests run with `node:test` on the compiled code (decorator metadata; no test framework to configure).
`config.nuc` sections: `synapsis`, `app`, `plugins`, `contracts`, `dependencies`.
`[project.manifest.advice]` says, when `express`, `fastify` or `koa` is added, what the platform already gives in
its place.

## Plugins

Only the enabled ones go to `package.json`, and only then are their names imported (`synapsis-nest/ai`,
`synapsis-nest/events`).

| Plugin | Packages | Gives |
|---|---|---|
| `sqlite` | `sqlite3 ^6.0.0` | `SQLite(file = ...)` |
| `postgres` | `pg ^8.13.0` | `Postgres(url = ...)` |
| `mysql` | `mysql2 ^3.11.0` | `MySQL(url = ...)` |
| `mariadb` | `mariadb ^3.4.0` | `MariaDB(url = ...)` |
| `redis` | `ioredis ^5.11.0` | `Redis(url = ...)`, `cacheGet`, `cacheSet` |
| `kafka` | `kafkajs ^2.2.4` | `Kafka(servers = ..., group = ...)`: `publish` reaches the broker; missing topics are created |
| `events` | none | `publish` and the `listener` kind with `@consumer` in the same process |
| `ai` | `langchain ^1.6.0`, `@langchain/core ^1.3.0`, `@langchain/langgraph ^1.6.0`, `zod ^4.0.0` | the `tools`, `agent`, `state` and `graph` kinds and chat models (`initChatModel`) |
| `openai` (needs `ai`) | `@langchain/openai ^1.8.0` | `OpenAI(model = ...)` |
| `ollama` (needs `ai`) | `@langchain/ollama ^1.3.0` | `Ollama(model = ...)` |
| `chroma` (needs `ai`) | `chromadb ^3.5.0` | `Chroma(collection = ..., url = ...)` |

## Toolchain

What the `nuclear` command runs in `build/` (`[toolchain]`):

| Key | Command |
|---|---|
| `install` | `npm install {{packages}}/synapsis-nest && npm install` (`installed = "node_modules"`) |
| `needs` | `node`: the CLI finds Node.js (`NUCLEAR_NODE`, Nuclear's own, the PATH) or offers `nuclear setup node` (ADR-cli-0004) |
| `install_local` | `npm install --install-links {{path}}`: a dependency that is a folder, installed again |
| `compile` | `npx tsc -p tsconfig.json`: `nuclear build` compiles too once the app is installed, and the running server (`node --watch`) restarts on it |
| `run` | `npm run dev` (`url = "http://localhost:3000"`, `ready = "Nest application successfully started"`) |
| `test` | `npm test` |
| `package_add`, `package_remove`, `package_version`, `package_companion`, `package_defs` | npm, the version it resolved, the `@types/<name>` package of one that ships no types, and `tools/defs/typescript/gen.js --package` for its type definitions, written into the project's `defs/`. A constraint is `^<version>` |
| `migrate_make`, `migrate`, `migrate_down` | `npx tsc`, then `npx synapsis-nest-migrate make\|up\|down --dir {{migrations}}` (the project's `migrations/`, compared with the compiled entities) |

The editor's debug launch (`[[toolchain.launch]]`, type `node`) runs `dist/src/main.js` with its source maps after
the task `nuclear: build`: a breakpoint in the generated `.ts` binds through `dist/*.js.map`, one in a `.nuc`
through `.nuclear/lines.json`.

## Architecture rules

`[architecture]`, scope `components`: a use case is called only by its `appcomponent`; a service by use cases and
aggregates; an aggregate by use cases; a repository by use cases, aggregates and tools. Another component sees only
the `appcomponent`, models, entities, tools, agents, states and graphs. Tests are exempt.
