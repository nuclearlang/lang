---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, runtime-python.md, dependencies.md, ../06-runbooks/change-a-runtime.md]
---
# The TypeScript runtime: `dragonfly-nest`

`packages/dragonfly-nest` (npm `dragonfly-nest`, ES modules): what the code of the `nestjs` dialect imports. Sources
in `src/`, tests in `test/`, built to `dist/` (`npm run build` = `tsc -p tsconfig.json`).

## Entry points and modules

| Import | Module | Holds |
|---|---|---|
| `dragonfly-nest` | `result` | `Result`, `Ok`, `Err` |
| | `errors` | `AppError`, `Invalid`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict` |
| | `config` | `AppConfig`, `ComponentConfig`, `env`, `databaseOf`, and the databases (`Postgres`, `MySQL`, `MariaDB`, `SQLite`) with `url` or `file` + `createTables` |
| | `repository` | `Entity`, `Repository`, `Query`, the operators (`gt`, `gte`, `lt`, `lte`, `ne`, `like`, `ilike`, `oneOf`, `isNull`, `between`), `Page`, `transactional`, `joinTable`, `Related` |
| | `web` | `ResultInterceptor`, `configureApp`; serves the contract (`serveContract`) |
| | `http` | `Http` and `HttpRepository`; the answer is the raw JSON, not decoded by the model |
| | `app` | `createApp`, `Connections`, `inject`, `connection`, `register` |
| `dragonfly-nest/events` | `events` | `Redis`, `Kafka(servers, group)`, `Listener`, `consumer`, `publish`, the cache (`cacheGet`, `cacheSet`) |
| `dragonfly-nest/ai` | `ai` | `ChatModel` / `Ollama` / `OpenAI`, `Embeddings` (`'provider:model'`), `Chroma` + `ChromaStore`, `vectorStore`, `Tools`, `Agent`, `Graph`, `start` / `next`, `Messages`, `StateOf`, `FakeModel` |
| `dragonfly-nest/testing` | `testing` | `startTestApp`, `stopTestApp`, `useConnection` |
| `dragonfly-nest/migrate` | `migrate` | the migrations (below); also the bin `dragonfly-nest-migrate` |

Behaviour worth knowing:

- The entry points are apart so a production install without `@nestjs/testing`, the AI libraries or a broker's
  client still loads the base (they are optional peers: [dependencies](dependencies.md)).
- `ChromaStore` is chromadb's client behind a LangChain `VectorStore`. `@langchain/community` was rejected: its
  peers conflict with zod 4 and ioredis 6.
- The order of a controller's routes does not matter: a fixed segment wins over a parameter (`configureApp`;
  reference §2.7).
- In the tests the databases are SQLite in memory (`DRAGONFLY_DATABASE=memory`, set by `startTestApp`).

## How it is installed

Its own `devDependencies` build it (`npm install` in its folder). An app, and `nuclearlang/tools/node`, install it
as a copy, never as a link:

```sh
npm install --no-save --install-links <path to>/packages/dragonfly-nest
```

A symlink resolves the runtime's peers in its own `node_modules`, and two copies of `@nestjs/common` break `tsc`.
So the install is repeated after the runtime is rebuilt (the nestjs check does it:
[testing](../05-standards/testing.md)).

## Data

How the data words of [ADR-backend-0001](../03-adr/0001-backend-data.md) are built:

- **Relations**: the runtime's `Entity` base keeps the relations given to the constructor (sequelize drops them).
  `save` writes a `@manyToOne` that is set to a row and `$set`s a `@manyToMany` list. Only the side with the column
  declares the foreign key (`constraints: false` on `@HasMany` / `@HasOne`). `joinTable(name, fk, other)` makes the
  join table (no timestamps).
- **Types**: `Related<T>` types a single relation, so the decorator metadata never reads the other class (two ES
  modules that import each other).
- **Transactions**: an `AsyncLocalStorage` whose transaction every repository call passes as `{ transaction }`. It
  opens on the database of the last repository made ([roadmap](../01-product/roadmap.md)).

## Migrations

Sequelize has no autogenerate, so the runtime brings its own (`src/migrate.ts`, bin `dragonfly-nest-migrate`), run
by `dragonfly migrate` after `tsc` (the dialect's `[toolchain]` keys `migrate_make`, `migrate`, `migrate_down`):

```sh
npx dragonfly-nest-migrate make "add done to tasks" --dir <migrations>   # one migration: the entities minus the last one
npx dragonfly-nest-migrate up --dir <migrations>                         # applies the pending ones
npx dragonfly-nest-migrate down --dir <migrations>                       # reverts the last one
```

- It reads the `entities` and the `config` the app module exports.
- `schemaOf` reads the entities' attributes, `diff` compares them with the `schema` the last migration exports (so
  `make` never reads the database), `render` writes `up` / `down` over `queryInterface`.
- Applied migrations are listed in `SequelizeMeta` (sequelize-cli's table). umzug was not needed.

## Tests and type definitions

- `test/runtime.test.ts`, `data.test.ts` (the same cases as the Python runtime's `test_data.py`),
  `migrate.test.ts`; `npm test` = `tsc -p tsconfig.test.json && node --test dist-test/test/`. The nestjs check runs
  them ([testing](../05-standards/testing.md)).
- The compiler and the editors know the runtime's names from its type definitions,
  `nuclearlang/dialects/typescript/defs/dragonfly-nest/<version>/` (modules `dragonfly-nest`, `dragonfly-nest/ai`,
  `dragonfly-nest/events`, `dragonfly-nest/testing`): regenerated after a change of the public API
  ([runbook](../06-runbooks/change-a-runtime.md)).
