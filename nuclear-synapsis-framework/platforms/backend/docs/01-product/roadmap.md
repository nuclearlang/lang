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
- A unique or a foreign key made without a name by a migration of before 0.91, dropped on a real PostgreSQL, MySQL
  or MariaDB with a database that old: the check renames a constraint to the database's own name to stand for it.
- A migration on a table with millions of rows (SQLite rebuilds the table; the other databases alter it in place).
- Two requests that change the same row at once inside `@transactional` (two checkouts of one customer): the
  platform has no word to lock a row, and no check says what each database does.
- `nuclear migrate` on Windows (`cmd /C` quoting).
- **The types of a body beyond a model's own fields** (a value of another JSON type is refused, reference §2.3;
  the runtime tests and the database check cover `string`, `int`, `double`, `boolean`, `DateTime`, a list of
  texts and of whole numbers, an optional field). Not run in either dialect: a body that is an entity, a model
  inside a model, a map (its keys are texts: one dialect converts them, the other does not check a map), and a
  model that reaches the app another way (the payload of an event, the answer of an HTTP repository, what an
  agent's model returns).
- **Which texts are a `DateTime`**: a number is refused in both dialects and a text that is no date too; a text
  with a time zone means the same instant in both (the check). Not compared: a date without a time
  (`"2026-03-04"`), a time without a zone, a text of digits: each dialect reads them with its own parser.
- **The migration that gives a `DateTime` its fraction, on a table with many rows or on a database a release
  before 0.94 really made**: the check writes the first migration as 0.93 wrote it and upgrades two rows.
- **What a model built in code throws**: each dialect's own error and message (pydantic's `ValidationError`, the
  runtime's `InvalidModel`); only the 500 a use case answers when it lets it go is compared.
- **`createTables` on a database that already has some of the tables**, made another way (by 0.93's
  `createTables`): it makes the missing ones and leaves the others as they are, so those keep the old schema;
  only an empty database was run.

## To decide with the user

Found by the database check (2026-11-21): the same in both dialects today, or different, but not what a user would
expect; each needs a rule before it is changed.

- **An optional field of a model that was left empty is `null` in one dialect's answer and absent in the other's**
  (found 2026-11-22: `GET /customers/draft` of `store_api` answers `"nickname": null` in fastapi and no `nickname`
  in nestjs; an entity's answer has `null` in both). The check reads that answer and does not compare it.
- **`@created` / `@updated` have whole seconds in one dialect and milliseconds in the other** on SQLite and MySQL:
  fastapi leaves them to the database's clock (`CURRENT_TIMESTAMP`: whole seconds there), nestjs writes the app's
  clock. The column keeps the fraction in both (the check compares the shape of these two, not their digits).

- The first provider of authentication: JWT only, or also sessions with cookies for web clients
  ([spec 004](../04-specs/004-backend-parity/plan.md) §5).

## Pending

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
- **What the three decisions of 2026-11-23 left** (spec 004 §4b):
  - *The 409 of the database.* Only the integrity errors are converted (SQLSTATE class 23, SQLite's constraint
    error). Spring's `DataIntegrityViolationException` also covers the data errors of class 22 (a number out of
    its column's range, a date that is none): a database that raises one still answers 500, and SQLite raises
    none (an `int` larger than 32 bits is refused by PostgreSQL, MySQL and MariaDB and kept by SQLite). Not
    tested: a violation outside HTTP (a listener, a request over the app's WebSocket), a check constraint, a
    deferred constraint, a deadlock or a lock timeout (still 500).
  - *A long text.* The length is checked by the repository (`save`, `update`): a row written by SQL, or by a
    `@manyToMany` list, is not. A long text that is unique, a key or has a default is refused by MySQL and MariaDB
    when its table is made (a unique over a text type; a default on a text type before MySQL 8.0.13): the compiler
    does not say it. The row of a table on MySQL and MariaDB holds 65 535 bytes of `VARCHAR` columns: a table with
    several `@column(length = 16383)` is refused there. The rule counts four bytes per character: a database made
    with another character set is not tested. Making a column shorter while a row holds a longer text fails on
    PostgreSQL, MySQL and MariaDB and passes on SQLite; `make` does not warn of it.
  - *A rename.* The unique and the foreign key of a renamed table or column keep their names (`uq_shops_name` on
    `stores.title`): a database migrated through a rename has other constraint names than one made new. Not
    tested: the rename of a key column other tables point to, of a `@created` / `@updated` column, of a join
    table; MariaDB older than 10.5.2 and MySQL older than 8.0 (no `RENAME COLUMN`); a rename and a change of the
    same column in one `make` on MySQL and MariaDB.
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
