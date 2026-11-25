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
| | `model` | `IsDateTime` (a `DateTime` field of a model), `checkModel` and `InvalidModel` (a model built in code) |
| | `config` | `AppConfig`, `ComponentConfig`, `env`, `databaseOf`, and the databases (`Database`, which a database's plugin subclasses with its Sequelize `dialect` and `retries`, ADR-backend-0004; `SQLite`) with `url` or `file` + `createTables` |
| | `repository` | `Entity`, `Repository`, `Query`, the operators (`gt`, `gte`, `lt`, `lte`, `ne`, `like`, `ilike`, `contains`, `icontains`, `oneOf`, `isNull`, `between`), `Page`, `transactional`, `joinTable`, `Related` |
| | `web` | `ResultInterceptor`, `ErrorFilter` (every error's body; what the database refuses: below; 405 with `Allow`, `OPTIONS`; the cause of a 500 in the log), the parameters' pipes (`IntPipe`, `DoublePipe`, `BoolPipe`, `TextPipe`, `RequiredPipe`), `configureApp`; serves the contract (`serveContract`) |
| | `edge` | the middleware of every request (`edge`): its log line, the body's limit (413) and type (415) read into a `RawBody`, an encoded `/` (404) and unreserved letter, CORS; `readJson` (UTF-8, 512 levels, no U+0000), `limits` (`maxBodySize`, `maxPageSize`), `logCause` |
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
- Nest's body parsers are off (`bodyParser: false` in `createApp` and `startTestApp`): the edge reads the body, the
  global `BodyPipe` parses it only for a route that takes one, and class-validator runs on the body only
  (`BodyValidation`). A pipe never throws: it returns `Refused`, and every route method is wrapped
  (`refusedTogether`, with its metadata) so it refuses the parameters together, before the body.
- Express's `x-powered-by` and `etag` are off; its router is case sensitive and strict (a last `/`), set on the
  router itself before Nest adds the routes. The logger has colours only in a terminal (`NO_COLOR` too).
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
- **`contains` / `icontains`** (`Contains`): `column LIKE '%text%' ESCAPE '/'`, the text's `%`, `_` and `/` escaped
  with `/` and the whole pattern quoted by `sequelize.escape` (Sequelize has no `ESCAPE`); `icontains` is `ILIKE` on
  PostgreSQL and `lower(column) LIKE lower('%text%')` elsewhere: the SQL SQLAlchemy's `contains(autoescape=True)`
  writes in the other runtime.
- **Answers**: `ResultInterceptor` gives every answer to `answerOf` (`model.ts`), which writes `null` for each
  optional field of a model left `undefined` (the fields class-validator's `IsOptional` marks, read once per class),
  in a model, a model inside it and the items of a list or a `Page`; a row (a Sequelize model) is not walked (its
  columns are `null` already), and an answer that needs nothing is answered as it is.
- **`@created` / `@updated`** are Sequelize's `@CreatedAt` / `@UpdatedAt`: the app's clock (`new Date()`, to the
  millisecond), the same instant for a new row's two.
- **A value's JSON type is its field's** (the reference, §2.3): the validation pipe converts nothing
  (`transform` without implicit conversion), so class-validator's type decorators refuse a value of another type.
  Two things are the runtime's: `IsDateTime` reads the value as it came (class-transformer has already made a
  `Date` of a number) and takes a text only; `reasonsOf` names the item of a list that breaks its type
  (`tags.1`), which class-validator does not.
- **A model built in code** is checked by its constructor when it is given values (`checkModel`:
  `validateSync`, `InvalidModel` with the same reasons as a body). class-transformer builds the body of a request
  without values, so the pipe checks it once.
- **Columns**: a `DateTime` is `DataType.DATE(6)`; Sequelize writes the milliseconds only to a column with a
  length.
- **Types**: `Related<T>` types a single relation, so the decorator metadata never reads the other class (two ES
  modules that import each other).
- **Exact numbers** (`exact.ts`, ADR-backend-0003): `BigDouble` is the class the dialect writes in each file that uses
  the type (`templates/bigdouble.tpl`; `exact.test.ts` holds them the same), not exported: the runtime reads one and
  takes one of any file by its members (`isBigDouble`). `exactColumn` gives an entity's field its getter (the
  database's text or number read back as a `bigint` / `BigDouble`) and setter (`columnText`: the text with the
  column's decimals); the repository finds an exact column by its type (`BIGINT`, `DECIMAL`), writes a value as a
  number literal (MySQL compares a quoted text with a DECIMAL as a double) and on SQLite compares and sorts the text
  by value (`liteCompare`, `liteOrder`: the same SQL as the other runtime); `fits` refuses what the column cannot
  hold. `IsBigInt` / `IsBigDouble` / `MinExact` / `MaxExact` are the model's; `BigIntPipe` / `BigDoublePipe` the
  parameters'; the app's `json replacer` writes a `bigint`, `Entity.toJSON` keeps the columns in their order.
- **Transactions**: an `AsyncLocalStorage` whose transaction every repository call passes as `{ transaction }`. It
  opens on the database of the last repository made ([roadmap](../01-product/roadmap.md)).
  `transactional` runs the use case again, `RETRIES` (3) times, when `mustRetry` reads a serialization failure or a
  deadlock from Sequelize's `DatabaseError` (SQLSTATE `40001`, `40P01`; MySQL's and MariaDB's `errno` 1213); `publish`
  inside one hands its sending to `afterCommit`, kept with the transaction until it commits. Test: `runs again a
  transaction the database refuses for another one` (the same as `test_data.py`).

## Migrations

What the database refuses for integrity answers 409 `conflict` (the platform's reference §2.4; Spring Data REST's
answer to Spring's `DataIntegrityViolationException`): `ErrorFilter` asks `refusedForIntegrity`, true for
Sequelize's `ValidationError` (a unique, and a required column, which Sequelize checks before the database),
`ForeignKeyConstraintError`, and a `DatabaseError` whose SQLSTATE is of class 23 or SQLite's `SQLITE_CONSTRAINT`.
`repository.ts` `fits` throws `Conflict` from `save` and `update` for a text longer than its column (counted in
code points, not UTF-16 units). `@transactional` rolls back on any error. Test: `data.test.ts` (the same cases as
`test_data.py`).

A text column is `DataType.STRING(n)` (255 without `length`). `textType(dialect, n)` of `migrate.ts` is the one
rule of its type (the same as `text_type` of synapsis-py), and `migrator` applies it to every column it makes or
changes on PostgreSQL, MySQL and MariaDB (`core`): `createTables` and a migration name the same type.

Sequelize has no autogenerate, so the runtime brings its own (`src/migrate.ts`, bin `synapsis-nest-migrate`), run
by `nuclear migrate` after `tsc` (the dialect's `[toolchain]` keys `migrate_make`, `migrate`, `migrate_down`,
`migrate_status`):

```sh
npx synapsis-nest-migrate make "add done to tasks" --dir <migrations>   # one migration: the entities minus the migrations
npx synapsis-nest-migrate up [--to <name>] --dir <migrations>           # applies the pending ones
npx synapsis-nest-migrate down [--to <name>] --dir <migrations>         # reverts the last one applied, or every one applied after <name>
npx synapsis-nest-migrate status --dir <migrations>                     # every migration: applied or pending
# up, down: --fake (only the history changes), --transaction all|each|none (default all)
```

The rules a user sees are the reference's (§2.8): TypeORM's behaviour (ADR-backend-0002), the same words and exit
codes as the Python runtime. How this one keeps them:

- It reads the `entities` and the `config` the app module exports.
- `schemaOf` reads the entities' attributes as the migrations write them: a `@created` / `@updated` column gets the
  default `CURRENT_TIMESTAMP`, and a foreign key keeps only its `onDelete` (never Sequelize's own
  `ON UPDATE CASCADE`; the dialect's template writes `NO ACTION` for a relation without a rule).
- `diff` compares them with `schemaAfter`: the tables once every migration of the folder is applied. Each file
  exports `schema` (the tables when it was made) and `known` (the migrations it was made after), so a file brings
  only what it changed: two made at the same time both count. A file of before 0.93 has `parent` or neither.
  `diff` refuses a changed key. `render` writes `up` / `down` over `queryInterface`.
- `make --rename` (`renamed`): each rename is checked against `schemaAfter` and the entities, made on a copy of
  that schema (the references of the other tables follow), and written as `renameTable` / `renameColumn` before
  what `diff` finds between that copy and the entities.
- The history is the table `migrations` (`id`, `timestamp`, `name`), read by `history` in the order of `id`. When
  it is missing it is made, from `SequelizeMeta` if the database was migrated before 0.93; `SequelizeMeta` is left
  as it was. umzug was not needed.
- `execute` runs the steps and writes the history with each: one transaction for the run (`all`), one per
  migration (`each`) or none. The migration's database has one connection (`databaseOfApp`: `pool.max = 1`), so
  `START TRANSACTION` holds everything a migration runs. On SQLite the foreign keys are off while it runs and
  `PRAGMA foreign_key_check` must be empty after each migration.
- A migration gets `migrator(queryInterface)`: Sequelize's queryInterface with what it gets wrong made right.
  - `createTable` refuses a table that exists (Sequelize writes `CREATE TABLE IF NOT EXISTS`); on PostgreSQL, MySQL
    and MariaDB it adds each unique and foreign key by name after the table; on SQLite it writes the statement
    itself, with the types by the names the other dialect writes (`BOOLEAN`, `DOUBLE`) and every constraint named.
  - `addColumn` and `changeColumn` leave the column as the attribute says, with its unique and its foreign key: a
    constraint that goes is found by its column in the database's catalog, whatever name it has.
  - `removeColumn` drops the column's constraints first; `renameColumn` is `ALTER TABLE ... RENAME COLUMN` on every
    database.
  - SQLite cannot alter a column: `rebuild` reads the table from the database (`pragma_table_info`, `index_list`,
    `foreign_key_list`), makes it again with the change, copies the rows and renames it. Sequelize's own rebuild
    loses `AUTOINCREMENT`, the constraints' rules and, with the foreign keys on, the rows of the tables that point
    to the table (their `ON DELETE CASCADE` runs when it is dropped).
- An exact column is `BIGINT` / `DECIMAL({precision, scale})` in a migration; on SQLite `sqlOf` names it `EXACT TEXT` /
  `EXACT TEXT(p,s)`, and after each migration applied there `exactTexts` writes the texts of every `EXACT TEXT(p,s)`
  column again with its decimals (the same rule as synapsis.migrate). The default of a `bigint` is its number
  (`{ literal }`), of a `bigdouble` its text, as the other runtime writes them.
- `createTables(sequelize)` makes the tables the database does not have from `schemaFrom(sequelize)` (the schema
  a migration file holds) through `migrator(...).createTable`: the code of the first migration, so the tables are
  the same. `Database.sequelize()` gives it to Sequelize as a `beforeBulkSync` hook with `synchronize: true`:
  Sequelize's own `sync` then finds every table there and makes none (the tests' database in memory too).
- A `DateTime` is `DATE({length: 6})` in a migration: `DATETIME(6)` on MySQL and MariaDB (Sequelize's), on SQLite
  (`sqlOf` writes it: Sequelize writes no fraction there), `TIMESTAMP WITH TIME ZONE` on PostgreSQL. The clock of
  `@created` / `@updated` is the literal `(CURRENT_TIMESTAMP)`: MySQL refuses `CURRENT_TIMESTAMP` without the
  parentheses as the default of a column with a fraction.

## Tests and type definitions

- `test/runtime.test.ts`, `data.test.ts` (the same cases as the Python runtime's `test_data.py`),
  `migrate.test.ts` (the same cases as `test_migrate.py`), `types.test.ts` (the same cases as `test_types.py`), `exact.test.ts` (the same cases as `test_exact.py`); `npm test` = `tsc -p tsconfig.test.json && node --test dist-test/test/`. The nestjs check runs
  them ([testing](../05-standards/testing.md)).
- The compiler and the editors know the runtime's names from its type definitions,
  `nuclearlang/dialects/typescript/defs/synapsis-nest/<version>/` (modules `synapsis-nest`, `synapsis-nest/ai`,
  `synapsis-nest/events`, `synapsis-nest/sockets`, `synapsis-nest/testing`): regenerated after a change of the public API
  ([runbook](../06-runbooks/change-a-runtime.md)).
