---
status: accepted
owner: Julian Molina
updated: 2026-11-22
related: [overview.md, runtime-typescript.md, dependencies.md, ../06-runbooks/change-a-runtime.md]
---
# The Python runtime: `synapsis-py`

`packages/synapsis-py` (distribution `synapsis-py`, imported as `synapsis`, Python 3.12+): what the code of the
`fastapi` dialect imports. Sources in `src/synapsis/`, tests in `tests/`.

## Modules

| Module | Holds |
|---|---|
| `result` | `Result`, `Ok`, `Err` |
| `errors` | `AppError` and the errors with an HTTP status: `Invalid`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`; `IntegrityViolation`: what the runtime refuses as a database would (below) |
| `inject` | injection by type: `inject`, `provide`, `bind`, `reset` |
| `config` | `AppConfig`, `ComponentConfig`, `env`, and the connections: `Database` (a database's plugin subclasses it with its `driver` and `retries`, ADR-backend-0004), `MySQL`, `MariaDB`, `SQLite(file)`, `Redis`, `Kafka(servers, group)`, `OpenAI`, `Ollama`, `Embeddings`, `Chroma(collection, embeddings, url)`. A plain `postgres://` url gets its async driver in `_with_driver` |
| `orm` | `Entity`, the column helpers (`primary`, `column`, `created`, `updated`), the relations, `EntitySchema`, `schema_of` |
| `repository` | `Repository` (CRUD), `Query`, the operators (`gt`, `gte`, `lt`, `lte`, `ne`, `like`, `ilike`, `contains`, `icontains`, `one_of`, `is_null`, `between`), `Page`, `transactional` |
| `web` | the controller decorators (`controller`, `get`, `post`, `put`, `patch`, `delete`, `status`), `untraced` (a marker) and `router_of`: a `Result` becomes an HTTP answer, an entity its schema |
| `app` | `create_app`, the lifespan, `connection`, `connections`; serves the contract (`_serve_contract`); 405 with `Allow` and `OPTIONS` (`_not_allowed`) |
| `edge` | `Edge`, the ASGI middleware of every request: its log line, the cause of a 500 (`said` keeps the request's values out), the body's limit (413) and type (415), an encoded `/` (404), CORS |
| `wire` | how a request is read, the same as the other runtime: `read_json` (UTF-8, no `NaN`, 512 levels, no U+0000), `is_json`, `parse_param` (the parameters of the path and the query), `LIMITS` (`maxBodySize`, `maxPageSize`) |
| `server` | `python -m synapsis.server [--reload] [--port]`: uvicorn on `HOST` (default `127.0.0.1`) and `PORT`, no `Server` header, no access log of its own |
| `http` | the `Http(base_url)` connection and `HttpRepository`: methods without a body under `@get` / `@post`..., an error status becomes an `Err`, the answer is validated by the declared type (ADR-codegen-0001) |
| `ai` (optional) | `Tools`, `Agent`, `Graph`, `start` / `next`, `Messages`, `chat_model`, `vector_store` |
| `events` (optional) | `Listener`, `consumer`, `publish`, the cache (`cache_get`, `cache_set`); `sinks`, who else receives what is published |
| `guards` | `Guard`, `Token`, `NoOrigin`, `refusal` (ADR-synapsis-0007): `web.guarded` makes them a FastAPI dependency of every router |
| `sockets` (optional, plugin `websocket`) | `WebSocketServer`: a Starlette WebSocket route; each request frame goes through the app with httpx's ASGI transport; a sink of `events` sends the published to the subscribed (ADR-synapsis-0008) |
| `telemetry` (optional) | `Telemetry`, `Otlp`, `Datadog`, `NewRelic`, `Grafana` (OTLP/HTTP), `Metric`, `traced` (the span the dialect writes on each use case's `exec`). Its own providers, not OpenTelemetry's global ones (a process may set those only once): without an open connection `traced` and `Metric` do nothing. A sampler drops the traces of the `@untraced` routes and keeps `sample` of the rest |
| `testing` | `running`, `client`, `FakeModel`, `memory_database` |
| `validators` | `is_email`, `is_url` |
| `exact` | the exact numbers (ADR-backend-0003): `BigInt`, `BigDouble` (an `int` and a `Decimal` annotated with their JSON: a text both ways), `parse_bigint` / `parse_bigdouble` (the language's texts, at most `MAX_DIGITS`), `bigdouble_text`, `fits_bigint` / `fits_bigdouble`, `column_text` (SQLite's text of a value), `JsonInt` |
| `migrate` | the migrations (below) |

Behaviour worth knowing:

- The controller decorators add the leading slash to the platform's segments; an invalid body answers 400.
- A route's scalar parameters are not FastAPI's: one dependency (`web._reader`) reads them all by `wire.parse_param`
  and refuses every refused one together; the body is FastAPI's, read through `_JsonRequest.json` (`wire.read_json`).
  A `GET` route also answers `HEAD` (a second route, out of the OpenAPI document). `redirect_slashes` is off.
- Reads outside a transaction use `Database.reads`, a session whose engine is in autocommit on PostgreSQL and SQLite
  (one statement, no `BEGIN` / `ROLLBACK`); writes and `@transactional` use `sessions`.
- The Edge is inside FastAPI's `ServerErrorMiddleware`: what no handler answered is logged by it and answered 500,
  so the server never prints a stack with the request's values; `uvicorn.access` is off and the server's WebSocket
  lines (they hold the query) are filtered (`_Quiet`).
- The order of a controller's routes does not matter: a fixed segment wins over a parameter (`router_of`;
  reference §2.7).
- A parameter the dialect wrote with a trailing `_` (its name is a Python word or builtin: `type_`, `from_`) keeps
  its own name for the client: `router_of` writes the route's `{type}` as `{type_}` (the same URL) and `_endpoint`
  reads a query parameter by its alias (`?type=`). Test: `test_a_renamed_parameter_keeps_its_public_name`.
- `create_app` keeps the mounted routes in `app.state.synapsis_routes` and then calls `instrument(app)` of every
  connection (a no-op but in `Telemetry`).
- `publish` works in process when the app has no Kafka connection; the tests' `conftest` creates the listeners.
- The extras of the package are the platform's plugins (`ai`, `postgres`, `mysql`, `sqlite`, `redis`, `kafka`,
  `openai`, `ollama`, `chroma`, `telemetry`); `core` brings no driver ([dependencies](dependencies.md)).

## Data

How the data words of [ADR-backend-0001](../03-adr/0001-backend-data.md) are built:

- **Relations**: `many_to_one`, `one_to_many`, `many_to_many`, `one_to_one` in `orm.py`, all `lazy="raise"`: a
  relation that was not asked for is never queried. The foreign key is appended to the table in
  `Entity.__init_subclass__`. Join tables are made when the mappers are configured, so `Database.open` calls
  `configure_mappers()`; SQLite runs `PRAGMA foreign_keys=ON`.
- **Answers**: `wire_of` turns a row and every related row that was loaded into their schemas (`schema_of`), so
  the JSON has Nuclear's names at every level; `EntitySchema` leaves an unloaded relation out. A `DateTime` is
  written as `toIso()` writes it (`models.wire_date`: UTC, milliseconds, `Z`), in entities and models.
- **A route's parameters** keep Nuclear's names for the client: `{customerId}` and `?minTotal=` reach
  `customer_id` and `min_total` (`web._public`).
- **Columns**: a `DateTime` is `UtcDateTime` (written in UTC and read back in UTC on every database: SQLite, MySQL
  and MariaDB keep no time zone; its `load_dialect_impl` names the column with its fraction: `DATETIME(6)` on
  MySQL, MariaDB and SQLite, `TIMESTAMP WITH TIME ZONE` on PostgreSQL); a text without `length` is `String(255)`, as the other runtime; the mapper reads
  back what the database writes (`eager_defaults`: `@created`, `@updated`, defaults), so the row a use case answers
  is complete on a database without `RETURNING`; SQLite tables are `AUTOINCREMENT`.
- **A `@manyToMany` list set on a found row** whose list was not loaded is kept on the row (`Entity.__setattr__`)
  and written by `Repository.save`, which replaces its rows of the join table.
- **What the generated project gives the runtime**: `main.py` and `conftest.py` list every entity
  (`entities=[...]`), so SQLAlchemy knows all the tables; two entities that name each other are imported only for
  the type checker (`if TYPE_CHECKING:`).
- **A value's JSON type is its field's** (the reference, §2.3): `models.typed` rewrites the core schema pydantic
  makes of a `Model` (and of an entity's schema): a boolean is strict, and a whole number, a number and a date get
  a check before pydantic's that refuses the Python types pydantic would convert (a text, a boolean; a number for a
  date). `30.0` stays a whole number and the keys of a map stay texts. A route or query parameter is not a model:
  FastAPI converts it from its text.
- **A model built in code** is checked by pydantic when it is made (`ValidationError`); nothing handles it, so it
  answers 500.
- **`contains` / `icontains`** are SQLAlchemy's `contains` / `icontains` with `autoescape=True`: `LIKE '%' || :text
  || '%' ESCAPE '/'`, the text's `%`, `_` and `/` escaped with `/` (`icontains`: `ILIKE` on PostgreSQL, `lower()` on
  both sides elsewhere). The other runtime writes the same SQL.
- **An optional field left empty** is `None` and pydantic writes it `null`: it is never left out of an answer.
- **Transactions**: a session kept in a `ContextVar`, which `Repository.use()` joins. `transactional` runs the use
  case again, `RETRIES` (3) times, when `must_retry` reads a serialization failure or a deadlock from the driver's
  error (SQLSTATE `40001`, `40P01`; MySQL's and MariaDB's number 1213); `publish` inside one hands its sending to
  `after_commit`, a second `ContextVar` the commit empties. Test:
  `test_a_transaction_the_database_refuses_for_another_runs_again` (the same as `data.test.ts`).
- **Defaults**: a field's default is also the column's SQL default (`column(default=...)` sets `server_default`),
  so a non-null column can be added to a table that has rows.

- **Exact numbers** (`orm.ExactInteger`, `orm.ExactDecimal`): `BIGINT` and `NUMERIC(p, s)`, on SQLite `_LiteExact`
  (`EXACT TEXT`, `EXACT TEXT(p,s)`: the value's text with `s` decimals). Their comparator writes `gt`, `gte`, `lt`,
  `lte`, `between` and `orderBy` as `_ExactCompare` / `_ExactOrder`, compiled for each database: a plain comparison,
  or on SQLite the size of the text (the digits before the point, negative for a negative value) and then the text
  (the other way for a negative value), the same SQL as the other runtime. `repository._fits` refuses a value the
  column cannot hold (409). A body's JSON numbers are `exact.JsonInt` (`wire.read_json`), so a `bigint` field refuses
  them and still takes an `int` of the program; `web` reads an exact parameter by its annotation
  (`get_type_hints(include_extras=True)`).

## Migrations

What the database refuses for integrity answers 409 `conflict` (the platform's reference §2.4; Spring Data REST's
answer to Spring's `DataIntegrityViolationException`): `create_app` handles SQLAlchemy's `IntegrityError` (a unique,
a foreign key, a required column, on the four databases) and `errors.IntegrityViolation`, which `repository._fits`
raises from `save` and `update` for a text longer than its column (counted with `len`: code points). The exception
leaves `@transactional` through its `session.begin()`, which rolls back. Test:
`test_what_the_database_refuses_for_integrity_is_a_409` (the same cases as `data.test.ts`).

An exact column is `ExactInteger()` / `ExactDecimal(p, s)` in a migration (`_render`; the file imports them). SQLite
keeps their words (`EXACT TEXT(p,s)`): `_reflected` reads them back as the exact types and `_compare_type` compares
them, so `make` sees a changed precision or scale; after each migration applied on SQLite, `_exact_texts` writes the
texts of every `EXACT TEXT(p,s)` column again with its decimals (rounded half away from zero, as the other databases
convert the column; a value with more digits than the column takes fails the migration). Test:
`test_an_exact_column_is_made_and_changed_by_its_precision_and_scale`.

A text column is `String(n)` (`orm.TEXT_LENGTH` = 255 without `length`). `orm.text_type(dialect, n)` is the one
rule of its type (the same as `textType` of synapsis-nest), and `orm._text` compiles every `String(n)` with it on
PostgreSQL, MySQL and MariaDB: an entity, `createTables` and a migration (`sa.String(length=n)`) all name the same
type.

`synapsis.migrate` is what `nuclear migrate` runs (the dialect's `[toolchain]` keys `migrate_make`, `migrate`,
`migrate_down`, `migrate_status`):

```sh
python -m synapsis.migrate make "add done to tasks" --dir <migrations>   # one migration: the entities minus the migrations
python -m synapsis.migrate up [--to <name>] --dir <migrations>           # applies the pending ones
python -m synapsis.migrate down [--to <name>] --dir <migrations>         # reverts the last one applied, or every one applied after <name>
python -m synapsis.migrate status --dir <migrations>                     # every migration: applied or pending
# up, down: --fake (only the history changes), --transaction all|each|none (default all)
```

The rules a user sees are the reference's (§2.8): TypeORM's behaviour (ADR-backend-0002), the same words and exit
codes as the TypeScript runtime. How this one keeps them:

- Alembic writes and runs the operations; its revisions, its `env.py` and its `alembic_version` are not used. A
  migration is `versions/<timestamp>_<slug>.py` with `upgrade()` and `downgrade()` over `op`, loaded as a module
  and run inside `Operations.context` (`_apply`). The files are ordered by their name (`_files`).
- `make` never reads the database: it runs every migration on an empty SQLite in memory and asks Alembic's
  autogenerate for the difference with the entities (`produce_migrations`, `render_python_code`, in batch mode).
  `_prepare` names every unique and foreign key the migration makes or drops (`uq_<table>_<column>`,
  `fk_<table>_<column>`) and collects the warnings. A changed key is compared here, because Alembic does not see
  it, and refused. The entities carry no constraint names, so a migration of before 0.91 still compares equal.
- `make --rename` (`_renamed`): each rename is checked against the SQLite the migrations made and the entities, made
  there (`ALTER TABLE ... RENAME`), and written as a line of the file before what autogenerate finds: Alembic's
  `op.rename_table`, and `rename_column` (this module's: one `ALTER TABLE ... RENAME COLUMN` on every database,
  where Alembic's `alter_column` rebuilds the table on SQLite and needs the whole column on MySQL). The way back is
  the same lines reversed, last.
- The history is the table `migrations` (`_history_table`: `id`, `timestamp`, `name`), read by `_history` in the
  order of `id`. When it is missing it is made, from `alembic_version` if the database was migrated before 0.93
  (every file up to that revision, or to that timestamp, was applied); `alembic_version` is left as it was.
- `up`, `down` and `status` open one connection to the default database of the app's configuration (`create_app`
  keeps it in `app.state`). `_execute` runs the steps and writes the history with each: one transaction for the
  run (`all`), one per migration (`each`) or an engine in `AUTOCOMMIT` (`none`). SQLite's driver is opened with
  `autocommit=False`, or a schema change would run outside the transaction; after each migration
  `PRAGMA foreign_key_check` must be empty.
- Batch mode makes SQLite (which cannot alter a column) and the other databases run the same file. Alembic rebuilds
  a table of SQLite from what it reads in the database; `_reflected` (a `column_reflect` listener) says the three
  things that are not read there: `AUTOINCREMENT`, the name of a constraint made without one, and the fraction of a
  `DateTime` (`DATETIME(6)` is read as `DATETIME`).
- A `DateTime` column is written `UtcDateTime()` in a migration (`_render`; the file imports it). A migration of
  before 0.94 has `sa.DateTime(timezone=True)`, which makes the column without a fraction as it always did:
  `_compare_type` tells the two apart on `make`'s SQLite by the words of the type, so the next `make` writes the
  change.
- `create_tables(connection)` (`createTables`, called by `Database.open`) makes the tables the database does not
  have with Alembic's own operations (`CreateTableOp.from_table`, `CreateIndexOp.from_index`), named by `_prepare`
  and run in the migrations' context: what the first migration runs, so the tables are the same.
- `_drop_constraint` replaces Alembic's implementation of `drop_constraint`: on PostgreSQL, MySQL and MariaDB a
  unique or a foreign key whose name is not in the database is found by its columns.
- `created()` and `updated()` (`orm.py`) are `NOT NULL` with `(CURRENT_TIMESTAMP)` as the server default (with the
  parentheses, the one spelling MySQL takes for a column with a fraction), for a row written by SQL. The app writes
  them itself (`default` and `onupdate` `_clock`: UTC to the millisecond, once per statement, so a new row's two are
  one instant), as the other runtime does: the database's clock has whole seconds on SQLite and MySQL. `schema_of`
  still leaves them out of a body (`info["clock"]`).
- `MigrateError` is what a user must know or do: printed as `error: ...`, exit code 1, no traceback.

## Tests and type definitions

- `tests/test_runtime.py`, `test_data.py` (the same cases as the TypeScript runtime's `data.test.ts`),
  `test_http.py`, `test_migrate.py` (the same cases as `migrate.test.ts`), `test_types.py` (the same cases as `types.test.ts`), `test_exact.py` (the same cases as `exact.test.ts`); pytest with `asyncio_mode = "auto"`. The fastapi check runs them
  ([testing](../05-standards/testing.md)).
- The compiler and the editors know the runtime's names from its type definitions,
  `nuclearlang/dialects/python/defs/synapsis/<version>/` (modules `synapsis`, `synapsis.ai`, `synapsis.events`,
  `synapsis.testing`, `synapsis.validators`): regenerated after a change of the public API
  ([runbook](../06-runbooks/change-a-runtime.md)).
