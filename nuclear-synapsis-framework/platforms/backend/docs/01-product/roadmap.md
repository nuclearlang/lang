---
status: accepted
owner: Julian Molina
updated: 2026-11-22
related: [../04-specs/004-backend-parity/plan.md, ../03-adr/0001-backend-data.md]
---
# Roadmap

The pending work of the backend platform, its contract and its runtime packages. A done item is deleted. What is
pending in how one dialect writes its target is in that dialect's project; what is pending in the framework's
commands of `nuclear` is in [the command line tools](../../../../../tools/cli/AGENTS.md).

## Half done

- **Backend parity** (step 4 of the competitiveness plan;
  [spec 004](../04-specs/004-backend-parity/plan.md)). In place, in both dialects
  ([ADR-backend-0001](../03-adr/0001-backend-data.md)): `@primary(generated)`, the relations with
  `relations(...)`, `paginate` → `Page<T>` (also on the mobile local tables), `@transactional`, and the migrations
  (`nuclear migrate`), the header guards `Token` and `NoOrigin` (ADR-synapsis-0007). Left: auth (users,
sessions, a guard kind for checks beyond headers), background jobs, file uploads, a Dockerfile,
  observability (below). `nuclear make` / `check` / `watch` for backend projects belong to the command.

- **Telemetry** ([spec 012](../../../../../docs/04-specs/012-observability/tasks.md)). Done in `fastapi`: the plugin
  `telemetry`, the connections `Datadog`, `NewRelic`, `Grafana`, `Otlp`, `Metric`, the spans of requests and use
  cases, `@untraced`, `sample`. Left: `nestjs` (it consumes `@untraced` but does not bring the plugin yet: a loader
  warning), the spans of queries, outgoing HTTP, listeners and agents, `Log` sent with the trace.

- **The app's WebSocket** (ADR-synapsis-0008). Done in both dialects: `WebSocketServer`, the frames, `publish` to the
  subscribed. Left: with Kafka a socket receives only what its own process publishes (several instances need the
  events consumed for the sockets: a `shortcut:` comment in both `events` modules); topics with wildcards; the
  OpenAPI document does not list the guards' headers (the contract does).

## Untested

- An HTTP repository in a project's tests: an `Http` connection takes no fake transport and `nuclear test` starts no
  stub server, so a use case that calls another API is tested only on models built by hand (found in Nuclear
  Chat's Tenor and Giphy searches, 2026-11-18).

- **Telemetry against the real vendors** (spec 012; left for later by the user, 2026-11-18). Only in-memory exporters
  and a refused local port ran. To do, with `rick_api` and `plugins(telemetry = true)`:
  1. `Otlp(url = "http://localhost:4318")` against a local collector (Grafana Alloy or Jaeger): the request and use
     case spans arrive, one trace per request, `@untraced` routes absent, `sample` respected.
  2. `Datadog(apiKey = env("DD_API_KEY"))` through the Agent with its OTLP receiver on, and without an Agent through
     the OTLP intake of the account's site: traces and delta metrics in APM.
  3. `NewRelic(licenseKey = env("NEW_RELIC_LICENSE_KEY"), region = "us")` and `region = "eu"`.
  4. `Grafana(url, instanceId, token)` against a Grafana Cloud stack's OTLP gateway: traces in Tempo, metrics in
     Mimir.
  5. The app stopping with the destination down (today the exporter retries for about ten seconds).
- Other versions of the database servers: the database check runs `postgres:16-alpine`, `mysql:8.0` and
  `mariadb:11` only (on a developer's machine and in `.github/workflows/platform-backend.yml`).
- `nuclear migrate` after a real `nuclear install` with `nestjs` (with `fastapi` it ran on a project made by
  `nuclear new`, through the MCP server's `project_migrate`, 2026-11-22): the database check gives the project's
  `build/` the shared tools of the checks (`.venv`, `node_modules`) in place of `nuclear install`.
- Two `nuclear migrate` at the same time on one database (two instances of an app deployed at once): nothing locks
  the history.
- A migration that changes the key of a table: `make` writes nothing for it in one dialect and a change that does
  nothing in the other.
- A migration on a table with millions of rows (SQLite rebuilds the table; the other databases alter it in place).
- Two requests that change the same row at once inside `@transactional` (two checkouts of one customer): the
  platform has no word to lock a row, and no check says what each database does.
- `nuclear migrate` on Windows (`cmd /C` quoting).

## To decide with the user

Found by the database check (2026-11-21): the same in both dialects today, or different, but not what a user would
expect; each needs a rule before it is changed.

- **A unique column the use case did not check answers 500.** Of 16 requests at once for one email, one makes the
  row, those the use case saw answer 409 and the rest reach the database's unique error: a 500 in both dialects.
  Wanted: a rule (409?) for a unique violation.
- **A text given for a number in a body** (`"age": "30"`) is accepted by one dialect's validator and refused by
  the other's (not run: known from each validator; the error bodies themselves are one, ADR-synapsis-0013).
- **A `DateTime` keeps its milliseconds on PostgreSQL and SQLite and loses them on MySQL and MariaDB** (both
  dialects write a `DATETIME` without fraction).
- **No text column longer than `@column(length = n)`.** A `string` field without a length is 255 characters in both
  dialects; there is no word for a text of any length.
- **`@created` / `@updated` are written by the database in one dialect** (a nullable column with the default
  `CURRENT_TIMESTAMP`) **and by the app in the other** (a `NOT NULL` column without a default): the same answers
  through the app, but a row inserted by SQL needs them in the second. It is the one difference of meaning the
  database check lists between the schemas the two dialects' migrations leave (`~` lines); the others are spelling
  (below).
- **The schemas of the two dialects are not the same bytes.** Besides the timestamps: a foreign key has
  `ON UPDATE CASCADE` in one dialect and no rule in the other (a key never changes through the app); on SQLite a
  `boolean` is `BOOLEAN` in one and `TINYINT(1)` in the other, a `double` is `DOUBLE` and `DOUBLE PRECISION`, and a
  table made by its first migration and never rebuilt has unnamed constraints in one. Wanted: one schema, column by
  column, with a check that compares the databases' own DDL.
- **What the migrations do not do, and the tools they follow do** (each needs a rule first):
  - *A database made before its migrations* (`createTables`, then the first `nuclear migrate`): it is refused
    (`table ... already exists`). Flyway has `baseline`, Alembic `stamp`: a command that marks the migrations as
    applied without running them.
  - *A migration edited after it was applied* is not noticed. Flyway and Liquibase keep a checksum of each file in
    the history and refuse; Alembic, Sequelize, TypeORM and Rails do not.
  - *The SQL of a migration without running it* (`--sql`, a dry run): Flyway, Alembic (offline mode) and Rails
    print it.
  - *A lock against two runs at once*: Flyway and Liquibase lock the history table, Rails takes an advisory lock;
    Alembic, Sequelize and TypeORM do not.
  - *A rename found by `make`*: every tool writes a drop and an add, and none guesses; Django and Prisma ask the
    user at `make` time. Today the file is edited by hand, in the dialect's migration language: the same Nuclear
    project needs two different edits. A word in Nuclear for it (a rename said in the entity) would be a change of
    the language.
  - *Data that goes with the schema* (seeds; Flyway's repeatable migrations, Sequelize's seeders) and *one
    migration from many* (squash: Django, Rails' schema file).
  - *A history of applied migrations with their date* in one table of the same shape in every dialect: today each
    dialect keeps its tool's table (one holds the last migration, the other the list).
- **A model built in code is validated in one dialect only** (`NewCustomer(email = "nope")` throws in fastapi; in
  nestjs only a request's body is validated).
- **`like` follows the database's case rule** (PostgreSQL tells the case apart; MySQL, MariaDB and SQLite do not for
  ASCII); `ilike` is the same everywhere.

- The first provider of authentication: JWT only, or also sessions with cookies for web clients
  ([spec 004](../04-specs/004-backend-parity/plan.md) §5).

## Pending

- **A unique or a foreign key made by a migration of before 0.91 has no name** (the database chose one). Dropping it:
  one dialect finds it by its column; the other writes `drop_constraint(None)` and `make` warns to write the name by
  hand. Wanted: found by its column in both.
- **A pending migration before an applied one** (a file added in the middle of the line) is refused in one dialect
  and not seen in the other, whose history holds only the last migration applied.

- **Found writing the skills library (2026-11-18)**: no users with password hashing or JWT auth; no multipart upload; no background jobs; no documented way to read a raw request body or headers (webhook signatures); no `graph` make-kind. `@status` is in the reference but undocumented for fastapi, and the reference says 400 for an invalid body where fastapi answers 422.
- **The listeners of one test receive the events of the next** (synapsis-py): `testing.running` resets the injector
  but not `events._listeners`, so each test adds one more instance of every listener and a published event reaches
  all of them (Nuclear Chat's members answered five times in its fifth test, 2026-11-18; its responders now ignore a
  message they are already answering). Wanted: `running` forgets the listeners it did not make, in both runtimes.

- **A repository whose name implies an entity nobody declares compiles** (found by a rename, ADR-developer-0001). With
  `Supplier` renamed to `Vendor` and `SupplierRepository` left, `nuclear check .` reports nothing and the generated
  Python fails when imported (`NameError: name 'Supplier' is not defined`). The repository kind takes its entity
  from its own name: the compiler should report a `<Name>Repository` without a declared `<Name>` (a diagnostic of
  the platform's contract, both dialects). The rename tool renames the names built from the old one, so it no
  longer leaves one.
- **`@acl` and sessions**, as the mobile platform has them (Flutter); a `guard` kind for checks beyond headers.
- **Limits of the data words** (ADR-backend-0001):
  - the join table's name is always `<owner table>_<field>` (no custom name);
  - `@transactional` uses the default database only (nestjs: the database of the last repository made, a
    `shortcut:` comment in `packages/synapsis-nest/src/repository.ts`);
  - the members of `Page<T>` are untyped in Nuclear (type definitions carry no member types:
    `items: Task[] = page.items`);
  - pyright over `packages/synapsis-py/src` shows 4 errors (`events.py`, the `Select` typing of
    `repository.py`).
- **Publish `synapsis-py`** on PyPI: the generated `pyproject.toml` asks for `synapsis-py` by name.
- **Publish `synapsis-nest`** on npm: the generated `package.json` asks for it by name.
- The user's project `~/Documents/projects/nuc/python/nuclear_langgraph_agent` still writes `@generated()` in
  `components/tasks/data/entities/task.nuc`: it is N0309 now; the fix is `@primary(generated = true)` (not changed:
  it is the user's project).
