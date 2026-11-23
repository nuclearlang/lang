# Changelog

All notable changes to synapsis-backend are written here; versions follow [Semantic Versioning](https://semver.org).

## Unreleased

- **Three decisions of the user (2026-11-23), the same in `fastapi` and `nestjs` on SQLite, PostgreSQL, MySQL and
  MariaDB** (reference §2.1, §2.4, §2.8; spec 004 §4b):
  - **what the database refuses for integrity answers 409** `{ "status": 409, "message": "conflict" }`, as Spring
    Data REST answers Spring's `DataIntegrityViolationException`: a repeated unique value, a foreign key that
    points at nothing, a row removed while others point to it, a null in a required column, a text longer than its
    column. It answered 500 (of 16 requests at once for one email: one 201 and, measured on SQLite, 14 of the others
    500 in `fastapi` and 11 in `nestjs`; now one 201 and fifteen 409). **Breaking for a client** that took that 500
    as a failure of the server. The message is never the database's; inside `@transactional` the transaction is
    rolled back;
  - **a long text is `@column(length = n)`**: the column is the database's `VARCHAR(n)` while it holds `n`
    characters, then its text type (`MEDIUMTEXT` above 16 383 and `LONGTEXT` above 4 194 303 on MySQL and MariaDB;
    `TEXT` above 10 485 760 on PostgreSQL). `@column(length = 100000)` failed on MySQL and MariaDB (`Column length
    too big for column`) in both dialects. A text longer than its column is refused before it is written, on
    every database (409): SQLite kept it and PostgreSQL answered 500. **Breaking for an app on SQLite** that
    wrote texts longer than their `length` (255 without one): they are refused now;
  - **a rename is an option of `nuclear migrate make`**: `--rename <table>=<new table>` and `--rename
    <table>.<column>=<new column>` (the database's names, any number) write a rename that keeps the rows, with its
    way back, where the migration was edited by hand in each dialect's migration language. A rename that is not
    there is refused with the same words in both dialects. Without the option `make` writes the drop and the add
    as before; its warning now says the option (**the text of the warning changed**).
  `store_api` has coupons, whose use cases check nothing, so the database check reaches each refusal over HTTP.
- Fixed (0.94.1): a `fastapi` model with a field named `type` crashed when its class was made (`TypeError: unhashable type: 'dict'`), since 0.94.0's rule of JSON types read the field's schema as a kind; the AI services have such a model, so the release's AI archive did not build.
- **Five decisions of the user (2026-11-22), the same in `fastapi` and `nestjs`** (reference §2.1, §2.2, §2.3, §2.8):
  - **a value of another JSON type is refused** in a body: a text is never a number or a boolean, a number is never
    a text, a boolean or a `DateTime`; a number without a fraction is a whole number (`30.0`) and a whole number is a
    `double`. The answer is the 400 with the rule `type`. **Breaking for a client of a `fastapi` app** that sent
    `"30"` for an `int`, `"1.5"` for a `double`, `"true"` or `1` for a `boolean`, or a number for a `DateTime`: they
    were converted, and are refused now (`nestjs` refused all but the number for a `DateTime`, which it read as
    milliseconds where `fastapi` read seconds). An item of a list that breaks its type is named by its place in
    both (`labels.1`; `nestjs` named the list). A parameter of the path or the query still converts from its text.
    In `fastapi` the rule is the model's, so it also holds where a model is read from something else than a
    request (the answer of an HTTP repository: an API that sends `"30"` for an `int` field is refused now);
  - **a `DateTime` keeps its fraction on MySQL and MariaDB**: the column is `DATETIME(6)` (TypeORM's precision for
    the date columns it gives a fraction on MySQL), written by the migrations and by `createTables`; SQLite names it
    the same, PostgreSQL's `TIMESTAMP WITH TIME ZONE` already kept it. The same instant comes back with its
    milliseconds on the four databases. The next `nuclear migrate make` of an existing project writes the change
    of each `DateTime` column;
  - **a model built in code is checked in both dialects**: `NewCustomer(email = "nope")` throws in `nestjs` as it
    did in `fastapi` (it built the model unchecked), and a use case that lets the error go answers the same 500;
  - **`createTables` makes the schema the migrations make**, in both dialects on the four databases: the default
    of the timestamps, the foreign keys (of a join table too), the names of the types on SQLite, the names of the
    constraints. Each runtime makes the tables with what its first migration runs. After it,
    `nuclear migrate --fake` leaves nothing for the next `make`;
  - **`like` follows the case rule of the database** and `ilike` is the same everywhere: said in the reference.

  The database check holds each one: 23 more answers compared byte by byte (the refusals, the milliseconds, the
  model built in code), and a new stage, `tables` (`tables.py`), on every dialect and database: the schema
  `createTables` left against the first migration's, the names of the constraints included, and a first migration
  written as 0.93 wrote it upgraded by the next `make`.
- **TypeORM is the rule of behaviour for migrations** (ADR-backend-0002), in `fastapi` and `nestjs` alike:
  - the history is the table `migrations`, one row per migration applied (`id`, `timestamp`, `name`), in every
    dialect; a database migrated by 0.91 or 0.92 is converted by the first command (`alembic_version`,
    `SequelizeMeta` are read once and left as they were);
  - the migrations are ordered by their timestamp and need no parent: a pending migration older than the applied
    ones runs, `down` reverts the last one applied, a migration missing from the folder stops only its own revert,
    and two migrations made at the same time are no longer refused (the next `make` compares with both);
  - new: `nuclear migrate up --fake` and `down --fake` (the history changes, nothing runs: a database that already
    has its tables comes under migrations) and `--transaction all|each|none`. **The default is now `all`**: the
    whole run in one transaction, where it was one per migration;
  - `@created` / `@updated` are `NOT NULL DEFAULT CURRENT_TIMESTAMP` in every dialect (a row inserted by SQL gets
    them); a foreign key has `ON DELETE` as the relation says and no other rule (`nestjs` wrote
    `ON UPDATE CASCADE`, and `SET NULL` for an optional relation without `onDelete`); on SQLite `nestjs` writes
    `BOOLEAN` and `DOUBLE` and names its constraints. The next `nuclear migrate make` of an existing project writes
    these changes as one migration;
  - `make` refuses a changed key in both dialects (one wrote nothing, the other a change that did nothing), and
    `fastapi` drops a constraint made without a name by finding it in the database, as `nestjs` did;
  - `fastapi` no longer uses Alembic's revisions, `env.py` or `alembic_version`: Alembic writes and runs the
    operations, the files are ordered by name and run only through `nuclear migrate`.

  The database check now fails on any difference between the schemas the two dialects leave (none on SQLite,
  PostgreSQL, MySQL and MariaDB) and runs 12 migration scenarios with the real command.
- **Migrations that hold on every database** (`nuclear migrate`, reference §2.8), the same in `fastapi` and `nestjs`:
  the same lines printed, the same exit codes, the same rules. New: `nuclear migrate status` (every migration:
  applied or pending), `nuclear migrate --to <migration>` and `nuclear migrate down --to <migration>`. The rules:
  - the history is one line: two migrations made after the same one, or one the database has and the folder does
    not, are refused by every command;
  - each migration runs in a transaction of its own: a failed one stays pending, and PostgreSQL and SQLite keep
    nothing of it (MySQL and MariaDB cannot undo a schema change: the message says what is left);
  - every unique and foreign key has a name (`uq_<table>_<column>`, `fk_<table>_<column>`), so it can be dropped;
  - `make` also warns of a required column added without a default and of a column that becomes required; two
    migrations made in the same second get different names;
  - migrations made before this version still run.

  What was wrong, found by running every kind of schema change on SQLite, PostgreSQL, MySQL and MariaDB with the
  real command (the database check: `checks/database-check/migrations.py`):
  - nestjs, SQLite: changing or dropping a column **deleted the rows of the tables that point to the table** (the
    table was made again with the foreign keys on, and their `ON DELETE CASCADE` ran), and the table lost
    `AUTOINCREMENT` and kept a default that was removed. The runtime rebuilds the table itself now.
  - nestjs: a unique or a foreign key removed from a column stayed in the database (PostgreSQL, MySQL, MariaDB);
    a migration ran outside any transaction, so a failure left half of it on every database; a table that already
    existed passed as created by the migration (`CREATE TABLE IF NOT EXISTS`); a migration applied and missing from
    the folder was ignored by `up`.
  - fastapi: adding or dropping a unique on a table failed (`Constraint must have a name`), and so did dropping a
    foreign key; on SQLite a schema change ran outside the transaction, and a rebuilt table lost `AUTOINCREMENT`;
    `up` with nothing pending printed nothing, `down` with nothing applied was an error with a traceback.
  - `nuclear migrate` (and every `[toolchain]` command that does not name the installation's folders) asked for
    an install directory: it runs from the tree's own build now.
- **One body for every error and one OpenAPI document, in every dialect** (ADR-synapsis-0013): an error answers
  `{ "status", "message" }`, and an invalid body or parameter adds `errors`, one reason per field (`field`, `rule`,
  `message`), written by each runtime from what its framework reports (`synapsis.errors`, `synapsis-nest`'s
  `ErrorFilter`); `GET /openapi.json` answers the document the transpiler writes from the project. Before:
  `{"detail"}` in `fastapi`, `{"statusCode", "message"}` in `nestjs`, each validator's own words, and an OpenAPI
  document worked out by one framework only. `nestjs` reads a number or a boolean of the route or the query with
  the runtime's `IntPipe`, `DoublePipe`, `BoolPipe`.
- The database check (`checks/database-check/check.sh`, needs Docker): the new example `store_api` (customers,
  orders, tags) built with `fastapi` and `nestjs` on SQLite, PostgreSQL 16, MySQL 8.0 and MariaDB 11: the migrations
  against the real database (made, applied, the schema read back, a column added to a table with rows, reverted),
  one HTTP scenario and the project's tests; the answers are the same bytes in both dialects on the four databases.
  What it found and fixed, each with the same test in both runtimes:
  - fastapi: a `DateTime` column is an instant on every database (written in UTC, read back in UTC; SQLite, MySQL
    and MariaDB dropped the time zone, so `05:06+02:00` came back as `05:06` UTC), and a `DateTime` in a JSON answer
    is written as `toIso()` writes it (`2026-03-04T03:06:07.000Z`), as nestjs does.
  - fastapi: changing a row with an `@updated` column answered 500 (`DetachedInstanceError`): what the database
    writes is read back with the write, on every database.
  - fastapi: a route's parameter of several words is read by its Nuclear name (`{customerId}` in the path,
    `?minTotal=` in the query); it answered 400 asking for `customer_id` and `min_total`.
  - fastapi: a related row inside an answer (`order.customer`) had Python's names (`created_at`) and dates without a
    time zone; it has Nuclear's now, like the row itself.
  - fastapi: a `@manyToMany` list set on a found row (`order.tags = tags`, then `save`) failed
    (`lazy='raise'`); `save` replaces its rows of the join table, as nestjs does.
  - fastapi: `MariaDB(url)` could not be imported (`synapsis` did not export it): a project with a MariaDB
    connection did not start.
  - fastapi: a `string` column without `@column(length)` is 255 characters, as in nestjs (MySQL and MariaDB refused
    the table); on SQLite a generated key is never given again after its row is removed, as in nestjs.
  - nestjs: `ilike` works on every database (it was PostgreSQL's `ILIKE`: a syntax error on SQLite, MySQL and
    MariaDB).
  - nestjs: the row `save` answers has `null` in a column that was left out (the key was missing from the JSON
    answer of a `POST`, and present in the one of a `GET`).
  - nestjs: the rows of a loaded `@manyToMany` come without their row of the join table (each tag carried an
    `orders_tags` object).
  - nestjs: a model's list of texts, numbers or booleans (`labels: string[]`) is validated item by item; every body
    with one answered 400 ("labels must be a string").
- Environments (spec 021): synapsis-py (`synapsis.config.load_env_file`) and synapsis-nest (`loadEnvFile` of
  `config.ts`) load the app's `.env` (written by `nuclear build --env <name>`) at start, never replacing a variable
  the process has. The reference says `env()`, the files, `--env` and `nuclear env` (§2.8).
- fastapi: a parameter named like a function of Python (`type`, `list`, `max`...) is written `type_` so it no
  longer hides that function in the body; outside it keeps its own name (`@_public_names`: a route's `?max=`, an MCP
  tool's `type`, a keyword call), and synapsis-py reads a renamed reserved word (`from_`) by its own name too. `rick_api`'s `alive(max)` is written `alive(max_)`.
- The example `tasks_api`: the planner reports each step that could not become a task (`PlanReply.failed`, the
  reason with it) instead of leaving it out; an appcomponent's alias propagates its `Result` like the use case it
  names.
- One JSON per model in every dialect (ADR-synapsis-0012): a `fastapi` model extends `synapsis.Model` and its JSON
  has Nuclear's names (`lastRead`, not `last_read`), as `nestjs` and the contract; an entity's answer too.
- A client generated from the contract sends a route's model parameter as the body itself (`@body input: NewTask`),
  and keeps a list's and a map's default (`members: string[] = []`).
- Tests that call the app (ADR-synapsis-0010), fastapi and nestjs: `appClient()` sends requests over HTTP
  (`get`/`post`/`put`/`patch`/`delete`/`request`: `HttpAnswer` with `status`, `body`) and opens the app's WebSocket
  (`socket(path, headers)`: `Err` with 401/403 when refused; `request`, `subscribe`, `next(seconds)`, `close`);
  `testEnv(NAME = "value")` in `config.nuc` is the tests' environment (a test token). fastapi's `app/main.py` gains
  `create()`; nestjs gets `src/test_env.ts` and `npm test` imports it first.
- Guards (ADR-synapsis-0007), fastapi and nestjs: `guards: Guard[] = [NoOrigin(), Token(value = env("T"), header =
  "X-Token")]` in the `appConfig` checks every route, the contract's routes and the WebSocket's upgrade;
  `@controller("x", guards = [...])` adds a controller's own. Headers only (never a token in the query); an empty
  token refuses everything; a guarded app serves no documentation pages.
- The app's WebSocket (ADR-synapsis-0008), fastapi and nestjs: `plugins(websocket = true)` and
  `WebSocketServer(path = "ws")` in `connections` serve the same controllers over one socket (JSON frames: requests
  and their answers, `subscribe`/`unsubscribe`), and `~publish(topic, value)` pushes to the subscribed clients.
- The contract (`.nuclear/contract.json`) says `webSocket`, each controller's `transports` and `guards`, the app's
  `guards` and the `events` it publishes (topic, component, payload).
- Telemetry (spec 012), fastapi: `plugins(telemetry = true)` and one of `Datadog(...)`, `NewRelic(...)`, `Grafana(...)`,
  `Otlp(url)` in `connections` send traces and metrics over OTLP; every request and use case is a span by itself,
  `Metric.count` / `Metric.record` write metrics, `@untraced` leaves out a use case, a route or a controller,
  `sample` keeps a share of the traces. nestjs accepts `@untraced` and does not bring the plugin yet.
- `[toolchain] package_*` in fastapi (pip) and nestjs (npm, with the `@types` package of one that ships no types):
  `nuclear add|remove <package>` (ADR-lang-0008). `[project.manifest.advice]`: `flask`, `django`, `express`, `fastify`,
  `koa` are added with a word on what the platform already gives.
- First public version.
- HTTP repositories (`Http` connection, bodiless `@get`/`@post`...) in fastapi and nestjs; `@key` for a JSON key that differs from the field; `[[generators]]` for `nuclear gen` (ADR-codegen-0001).
- `[[generators.usecase]]`: `nuclear gen usecase` writes a use case over a repository method, its alias in the facade and its route (ADR-codegen-0001).
- The order of a controller's routes no longer matters, in both dialects: a fixed segment wins over a parameter. Before, fastapi added the routes by method name (`GET <prefix>/search` of a generated resource answered 400, taken by `{id}`) and nestjs in the order written (`synapsis-py` `router_of`, `synapsis-nest` `configureApp`; `spec/backend.md` §2.7).
- `[[generators.resource]]`: the repository and the controller are merged (`merge = true`), so an action added to a resource that exists gets the members it lacks (ADR-developer-0001).
- nestjs: `npm test` (what `nuclear test` runs) removes `dist/test` before compiling: `tsc` never deletes the output of a source that is gone, so a test that was deleted or renamed kept running from its old `.js` and failed the project.
