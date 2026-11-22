---
status: accepted
owner: Julian Molina
updated: 2026-11-22
related: [overview.md, runtime-python.md, dependencies.md, ../06-runbooks/change-a-runtime.md]
---
# The TypeScript runtime: `synapsis-nest`

`packages/synapsis-nest` (npm `synapsis-nest`, ES modules): what the code of the `nestjs` dialect imports. Sources
in `src/`, tests in `test/`, built to `dist/` (`npm run build` = `tsc -p tsconfig.json`).

## Entry points and modules

| Import | Module | Holds |
|---|---|---|
| `synapsis-nest` | `result` | `Result`, `Ok`, `Err` |
| | `errors` | `AppError`, `Invalid`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict` |
| | `config` | `AppConfig`, `ComponentConfig`, `env`, `databaseOf`, and the databases (`Postgres`, `MySQL`, `MariaDB`, `SQLite`) with `url` or `file` + `createTables` |
| | `repository` | `Entity`, `Repository`, `Query`, the operators (`gt`, `gte`, `lt`, `lte`, `ne`, `like`, `ilike`, `oneOf`, `isNull`, `between`), `Page`, `transactional`, `joinTable`, `Related` |
| | `web` | `ResultInterceptor`, `configureApp`; serves the contract (`serveContract`) |
| | `http` | `Http` and `HttpRepository`; the answer is the raw JSON, not decoded by the model |
| | `app` | `createApp`, `Connections`, `inject`, `connection`, `register` |
| `synapsis-nest/events` | `events` | `Redis`, `Kafka(servers, group)`, `Listener`, `consumer`, `publish`, the cache (`cacheGet`, `cacheSet`), `sinks` |
| `synapsis-nest/sockets` | `websocket` | `WebSocketServer`: `ws` on the app's HTTP server (`Connection.instrument`, called by `configureApp`); each request frame goes through the app over the loopback (ADR-synapsis-0008) |
| `synapsis-nest/ai` | `ai` | `ChatModel` / `Ollama` / `OpenAI`, `Embeddings` (`'provider:model'`), `Chroma` + `ChromaStore`, `vectorStore`, `Tools`, `Agent`, `Graph`, `start` / `next`, `Messages`, `StateOf`, `FakeModel` |
| `synapsis-nest/testing` | `testing` | `startTestApp`, `stopTestApp`, `useConnection` |
| `synapsis-nest/migrate` | `migrate` | the migrations (below); also the bin `synapsis-nest-migrate` |

Behaviour worth knowing:

- The entry points are apart so a production install without `@nestjs/testing`, the AI libraries or a broker's
  client still loads the base (they are optional peers: [dependencies](dependencies.md)).
- `ChromaStore` is chromadb's client behind a LangChain `VectorStore`. `@langchain/community` was rejected: its
  peers conflict with zod 4 and ioredis 6.
- The order of a controller's routes does not matter: a fixed segment wins over a parameter (`configureApp`;
  reference §2.7).
- In the tests the databases are SQLite in memory (`SYNAPSIS_DATABASE=memory`, set by `startTestApp`).

## How it is installed

Its own `devDependencies` build it (`npm install` in its folder). An app, and `nuclearlang/tools/node`, install it
as a copy, never as a link:

```sh
npm install --no-save --install-links <path to>/packages/synapsis-nest
```

A symlink resolves the runtime's peers in its own `node_modules`, and two copies of `@nestjs/common` break `tsc`.
So the install is repeated after the runtime is rebuilt (the nestjs check does it:
[testing](../05-standards/testing.md)).

## Data

How the data words of [ADR-backend-0001](../03-adr/0001-backend-data.md) are built:

- **Relations**: the runtime's `Entity` base keeps the relations given to the constructor (sequelize drops them).
  `save` writes a `@manyToOne` that is set to a row and `$set`s a `@manyToMany` list. Only the side with the column
  declares the foreign key (`constraints: false` on `@HasMany` / `@HasOne`). `joinTable(name, fk, other)` makes the
  join table (no timestamps); a loaded `@manyToMany` comes without its rows of the join table.
- **Rows**: after an insert `save` sets `null` in every column the insert did not name (sequelize leaves them
  undefined, and the JSON answer would lack them).
- **`ilike`** is PostgreSQL's `ILIKE` there and `lower(column) LIKE lower(pattern)` on the other databases.
- **Types**: `Related<T>` types a single relation, so the decorator metadata never reads the other class (two ES
  modules that import each other).
- **Transactions**: an `AsyncLocalStorage` whose transaction every repository call passes as `{ transaction }`. It
  opens on the database of the last repository made ([roadmap](../01-product/roadmap.md)).

## Migrations

Sequelize has no autogenerate, so the runtime brings its own (`src/migrate.ts`, bin `synapsis-nest-migrate`), run
by `nuclear migrate` after `tsc` (the dialect's `[toolchain]` keys `migrate_make`, `migrate`, `migrate_down`,
`migrate_status`):

```sh
npx synapsis-nest-migrate make "add done to tasks" --dir <migrations>   # one migration: the entities minus the last one
npx synapsis-nest-migrate up [--to <name>] --dir <migrations>           # applies the pending ones
npx synapsis-nest-migrate down [--to <name>] --dir <migrations>         # reverts the last one, or every one after <name>
npx synapsis-nest-migrate status --dir <migrations>                     # every migration: applied or pending
```

The rules a user sees are the reference's (§2.8), the same words and exit codes as the Python runtime. How this one
keeps them:

- It reads the `entities` and the `config` the app module exports.
- `schemaOf` reads the entities' attributes, `diff` compares them with the `schema` the last migration exports (so
  `make` never reads the database), `render` writes `up` / `down` over `queryInterface`, the `schema` and `parent`:
  the migration it was made after.
- `chain` orders the files by `parent` and refuses two files with the same parent and a parent that is missing. A
  file written before `parent` existed follows the file before it by name.
- Applied migrations are listed in `SequelizeMeta` (sequelize-cli's table: the file's name). `status` refuses a name
  that is not in the folder and a pending migration before an applied one. umzug was not needed.
- `run` applies or reverts one migration in a transaction of its own, with its line of `SequelizeMeta`. The
  migration's database has one connection (`databaseOfApp`: `pool.max = 1`), so `START TRANSACTION` holds everything
  the migration runs. On SQLite the foreign keys are off while it runs and `PRAGMA foreign_key_check` must be empty
  before it is kept.
- A migration gets `migrator(queryInterface)`: Sequelize's queryInterface with what it gets wrong made right.
  - `createTable` refuses a table that exists (Sequelize writes `CREATE TABLE IF NOT EXISTS`); on PostgreSQL, MySQL
    and MariaDB it adds each unique and foreign key by name after the table.
  - `addColumn` and `changeColumn` leave the column as the attribute says, with its unique and its foreign key: a
    constraint that goes is found by its column in the database's catalog, whatever name it has.
  - `removeColumn` drops the column's constraints first; `renameColumn` is `ALTER TABLE ... RENAME COLUMN` on every
    database.
  - SQLite cannot alter a column: `rebuild` reads the table from the database (`pragma_table_info`, `index_list`,
    `foreign_key_list`), makes it again with the change, copies the rows and renames it. Sequelize's own rebuild
    loses `AUTOINCREMENT`, the constraints' rules and, with the foreign keys on, the rows of the tables that point
    to the table (their `ON DELETE CASCADE` runs when it is dropped).

## Tests and type definitions

- `test/runtime.test.ts`, `data.test.ts` (the same cases as the Python runtime's `test_data.py`),
  `migrate.test.ts` (the same cases as `test_migrate.py`); `npm test` = `tsc -p tsconfig.test.json && node --test dist-test/test/`. The nestjs check runs
  them ([testing](../05-standards/testing.md)).
- The compiler and the editors know the runtime's names from its type definitions,
  `nuclearlang/dialects/typescript/defs/synapsis-nest/<version>/` (modules `synapsis-nest`, `synapsis-nest/ai`,
  `synapsis-nest/events`, `synapsis-nest/sockets`, `synapsis-nest/testing`): regenerated after a change of the public API
  ([runbook](../06-runbooks/change-a-runtime.md)).
