---
status: accepted
owner: Julian Molina
updated: 2026-11-23
related: [../06-runbooks/change-a-runtime.md, ../02-architecture/overview.md, ../../../docs/05-standards/testing.md]
---
# Testing

The tests every platform shares (the contract, the layout, the generators, what a golden and a conformance example
are) are in [testing a platform](../../../docs/05-standards/testing.md). Here: what this platform adds.

## What is tested at each level

| Level | What it covers | Run by |
|---|---|---|
| The compiler's tests | Every example built and compared with its golden: `examples/expected/rick_api/`, `examples/expected/tasks_api/`, `examples/expected/store_api/` (`nuclearlang/crates/nuclear-transpile/tests/projects.rs`), `examples/examples-nestjs/users.ts` (`golden.rs`); conformance: `tasks_api` built with `nestjs` and `fastapi` (`backend_example_builds_with_every_backend_dialect`); `tasks_api` also as the backend of the mobile `tasks_app` | `cargo test` at the root of the tree |
| The runtimes' tests | `packages/synapsis-py/tests/` (pytest), `packages/synapsis-nest/test/` (`node:test`) | the two checks |
| The fastapi check | `rick_api` built; pyright `--strict` and the project's own tests on the generated code; a live run; then the conformance example | `checks/fastapi-check/check.sh` |
| The nestjs check | the runtime built; `tasks_api` built; `tsc --strict` and the project's own tests; a live run; the migrations | `checks/nestjs-check/check.sh` |
| The database check | `store_api` built with each dialect for SQLite, PostgreSQL, MySQL and MariaDB (real servers in Docker): the strict checker, every kind of migration with `nuclear migrate` against the real database, one HTTP scenario, the project's tests, the tables `createTables` makes against the first migration's; the answers compared between dialects and databases, the schemas' differences listed; a project made with `nuclear new` migrated | `checks/database-check/check.sh` |
| The app check | `store_api` and `tasks_api` built with each dialect and run as a user runs them: every line they log read against an allow-list, the same hostile requests sent to both dialects and the answers compared (SQL injection, errors, bodies, guards, CORS, the WebSocket), the advisories of the dependencies, the same load on PostgreSQL with the SQL statements of a request counted | `checks/app-check/check.sh` |
| The references' equivalences | each dialect's reference against the real output (the dialects' projects own them) | `nuclearlang/tools/spec-check/check.py` |

## Set up, once

From the root of the tree:

```sh
(cd nuclearlang/tools/node && npm install)
python3 -m venv nuclearlang/tools/python/.venv
nuclearlang/tools/python/.venv/bin/pip install -r nuclearlang/tools/python/requirements.txt
nuclearlang/tools/python/.venv/bin/pip install -e nuclear-synapsis-framework/platforms/backend/packages/synapsis-py --config-settings editable_mode=compat
(cd nuclear-synapsis-framework/platforms/backend/packages/synapsis-nest && npm install)
```

## Running the checks

```sh
cargo test
sh nuclear-synapsis-framework/platforms/backend/checks/fastapi-check/check.sh
sh nuclear-synapsis-framework/platforms/backend/checks/nestjs-check/check.sh
sh nuclear-synapsis-framework/platforms/backend/checks/database-check/check.sh   # needs Docker
sh nuclear-synapsis-framework/platforms/backend/checks/app-check/check.sh        # needs Docker and the network
```

The first two scripts find the tree from their own place (`NUCLEAR_ROOT` overrides it), build with
`cargo run -p nuclear-cli -- build` and stop at the first failure, printing the failed command's whole output.

**`fastapi-check/check.sh`**, in order:

1. Builds `examples/examples-fastapi/rick_api` into its `build/`.
2. pyright over the generated project, then its tests (pytest: the project's `test/*_test.nuc`).
3. `smoke.py`: the REST API over an in-memory database (201, 409, 400, 404, the list), the agent with its tools and
   the graph with a fake chat model (no network), and `/openapi.json`.
4. The runtime's tests: `packages/synapsis-py/tests`.
5. **Conformance**: copies `examples/examples-backend/tasks_api` (written for `nestjs`), switches its `config.nuc`
   to `dialect = "fastapi"`, builds it, runs pyright and its tests.
6. **Migrations**: on that copy, with `DATABASE` set to a fresh SQLite file, `synapsis.migrate make "first"`,
   `up`, then `make "again"` must answer "no changes".

**`nestjs-check/check.sh`**, in order:

1. Builds the runtime with `tsc` and copies it fresh into `nuclearlang/tools/node/node_modules`
   (`npm install --no-save --install-links`). npm keeps an old copy of the same version, so the script removes it
   first; a `--no-save` install also prunes the other runtime installed the same way, so the web platform's check
   installs its own again.
2. Builds `examples/examples-backend/tasks_api` and links `node_modules` into its `build/`.
3. `tsc --strict`, then the project's tests (`node --test "dist/test/**/*.js"`).
4. `smoke.mjs`: the REST CRUD over SQLite in memory (`SYNAPSIS_DATABASE=memory`), validation (400 with two
   messages), the errors of a `Result` (409, 404).
5. **Migrations**: with `DATABASE` set to a fresh SQLite file, `migrate make "first"`, `up`, then `make "again"`
   must answer "no changes".
6. The runtime's tests (`tsconfig.test.json`, `dist-test/test/**/*.js`).

**`database-check/check.sh`** (needs Docker running, besides the set-up above). It proves that one Nuclear project
behaves the same in every dialect on every database. `check.sh fastapi postgres` runs only those dialects and
databases (any of `fastapi`, `nestjs`; any of `sqlite`, `postgres`, `mysql`, `mariadb`). It prints one `ok` / `FAIL`
line per dialect, database and stage, goes on after a failure and exits 1 if any failed.

- **One pair after another** (no option): about 50 minutes, the `migrations` stage most of it (87 runs of
  `nuclear migrate` per pair; `nestjs` compiles its TypeScript on each).
- **`--parallel`**: the eight pairs at the same time, each a run of its own (its folder, containers and ports), after
  the shared preparation (the `nestjs` runtime, `cargo build`) is done once; then the comparisons over all of them.
  The delivery gate runs it (`installer/release/delivery.sh`, step `databases`).
- **`OUT=<dir>`** also keeps the run's answers and schemas in `<dir>`; **`--compare <dir>`** makes only the
  comparisons over what several runs kept, and fails when a pair asked for left nothing. The CI runs one job per pair
  (`platform-backend.yml`, job `databases`) and the job `compare` over all of them.

1. Starts `postgres:16-alpine`, `mysql:8.0` and `mariadb:11` one at a time, each in a throwaway container
   (`nuclear-dbcheck-<pid>-<database>`, a free port of `127.0.0.1`, its data in memory), waits for its health check,
   and removes it when done; a `trap` removes them all however the script ends. SQLite is a file.
2. For each dialect and database: copies `examples/examples-backend/store_api` to a temporary folder (`TMPDIR`;
   `KEEP=1` keeps it) and changes only the dialect, the plugin and the connection (`Postgres(url =
   env("DATABASE_URL"))`..., without `createTables`), in an empty database of its own (`store_<dialect>`). Then, the
   stages:
   - **build**, **checker**: `nuclear build`, then pyright or `tsc --strict`.
   - **new** (SQLite only, once per dialect): a project made with `nuclear new` and `nuclear gen resource`, then
     `nuclear migrate status`, `make`, `up`, `make` (no changes), `status`, `down`, `status`.
   - **migrations** (`migrations.py`): every step runs the real command, `nuclear migrate`, of the tree's build
     (`target/debug` is first on `PATH`; the project's `build/` gets the shared tools as `.venv` or
     `node_modules`, in place of `nuclear install`). After each step `db.py` reads the real schema back (tables,
     columns, type, length, null, the default by its meaning, the key, the unique columns, the foreign keys and
     their `ON DELETE`) and the rows. A `down` must leave exactly the schema read before its `up`. One line per
     scenario is printed under the stage (`+`):
     1. `make`, `up`, nothing left to make, `status`, `down` to an empty database, `down` with nothing applied.
     2. The tables are there and the history is empty: `up` is refused whole; `up --fake` and `down --fake` change
        the history only.
     3. A column with a default added to a table with rows (`points: int = 7`); the rows were inserted by SQL
        without `created_at` / `updated_at` (their default).
     4. A column's type, null, default and length changed, a unique added.
     5. A table, a foreign key on a table with rows (`@manyToOne`) and a join table (`@manyToMany`).
     6. A table and two columns renamed: without `--rename`, `make` writes a drop and an add and warns (the warning
        says the option); nine renames that are not there are refused with the same words; with `--rename
        shops=stores --rename shops.name=title --rename orders.shop_id=store_id` it writes the renames only: the
        rows and the foreign key follow, `down` renames back.
     7. A column, a unique and a foreign key dropped (its column stays); the unique first renamed in the database
        to the name a database gives one made without a name.
     8. A failing migration after a good one, with `--transaction all` (PostgreSQL and SQLite keep neither), `each`
        (the good one stays) and `none` (what the failed one did stays); MySQL and MariaDB keep what ran and the
        message says so; fixed, it applies.
     9. A pending migration older than the applied ones (applied, and reverted first by `down`); a migration
        missing from the folder (only its revert is refused).
     10. The history as 0.91 / 0.92 kept it (`alembic_version`, `SequelizeMeta`) converted in place.
     11. `down --to` the first migration (the first schema again, the rows kept), `up --to` the second, `up`.
     12. The entities of step 3 again: one migration drops everything added since; the app of the next stage runs
         on that schema.
     13. A text longer than a `VARCHAR` holds: the note of an order made 100000 characters long (`MEDIUMTEXT` on
         MySQL and MariaDB, `VARCHAR(100000)` on the others), then 5000000 (`LONGTEXT`), a text of 100000
         characters kept through `up` and `down`, then 2000 again: the schema of step 3.
     14. An exact column of another scale (`rate: bigdouble` from `NUMERIC(40, 20)` to `NUMERIC(40, 4)` and back,
         each database's names checked by `db.EXACT`): the value rounded half away from zero (`1.123456789` →
         `1.1235`, SQLite's text written again), a `bigint` of 2^63 − 1 kept, `down` and a migration back.
   - **integration**: the built app started on that database and driven by `scenario.py`, the same requests for
     every dialect and database: CRUD, defaults, the unique email (409), invalid bodies (400), missing rows (404),
     pages, search in any case (`icontains`: a `%`, a `_`, the escape `/` and a backslash in the text are characters), filters and order, unicode and emoji, a text of 2000 characters, the limits of an
     `int`, decimals, booleans, null against an empty text, timestamps with a time zone, the milliseconds of a
     `DateTime` written and read back, a value of another JSON type refused for each type (and `30.0` taken as a
     whole number, a number of the query converted), a model built in code that breaks its rule (500) and one that keeps them (its optional field left empty is `null`), the relations loaded and
     not loaded, the tags of an order replaced, two `@transactional` use cases whose `Err` comes after a write
     (checked with SQL: nothing was kept), 32 concurrent writes and reads, 16 concurrent requests for one unique
     value (one row, one 201 and fifteen 409, never a 500), what the database refuses for integrity (the coupons,
     whose use cases check nothing: a repeated unique value, the same value twice in one transaction, a foreign
     key that points at nothing, a null in a required column, a row others point to, a text longer than its
     column: each 409 `conflict`, the transaction rolled back, a text of the column's length in characters
     kept), the cascade of a delete; the exact numbers (the balances): a `bigint` of 2^63 − 1 and a `bigdouble` of
     40 digits as JSON texts, `0.1 + 0.2` added by the app stored and read back as `0.3` (and `0.3` in the database
     itself), a search with `gte` sorted by value with negative values, and what the columns cannot hold refused
     with 409 (2^63, more decimals or more digits than the column has) while a JSON number or a text that is no
     number is 400.
   - **tests**: the project's `test/*_test.nuc` with the dialect's runner (their database is in memory).
   - **tables** (`tables.py`): the same project built with `createTables = true` on an empty database of its own
     (`made_<dialect>`) and the note of an order 100000 characters long (the text type of each database); the app
     is started once, so it makes the tables. Their schema, with the names of the
     uniques and foreign keys, is written as step 0 for the comparison between the dialects. Then, with
     `nuclear migrate`: `make`, `up` refused (the tables are there), `up --fake`, nothing left to make, `down`
     (the tables go), `up`: the schema must be the one `createTables` made, names included. Last, the first
     migration is written as 0.93 wrote it (a `DateTime` without its fraction; the lines in the dialect's
     migration language) and applied, and rows are written by SQL; the next `make` must write the change, and
     `up` must give the schema `createTables` made with the rows kept and a fraction written by SQL kept too;
     `down` and `up` again.
3. **schemas**: `db.py compare` compares the schemas the two dialects left on the same database after each step,
   and the one `createTables` left (step 0, with the names of the constraints)
   (columns, the type as the database names it, null, default, key, unique, foreign keys with `ON DELETE` and
   `ON UPDATE`). Any difference is a failure (`~` lines): ADR-backend-0002.
4. **answers**: every answer of the scenario is written normalized (an id becomes the order its row was made in,
   `createdAt` / `updatedAt` their shape with the milliseconds, and the scenario fails if not one of them has a
   fraction, `401.0` is `401`; the body of an error whole, with its reasons) and the files are
   compared byte by byte: the same in every dialect on every database.

What the scenario leaves out of the comparison because it differs by run, and says in its line: how many of the
losers of the race for a unique value answer 409 or 500 ([roadmap](../01-product/roadmap.md)).

**`app-check/check.sh`** (needs Docker and, for the advisories, the network; about fifteen minutes). It reads what
an app prints, attacks it and loads it, in each dialect, and compares the dialects. The apps are `store_api` (with
six probe routes: the Nuclear of `checks/app-check/probes/`, wired in the copy by `nuclear gen usecase`) and
`tasks_api` (the guards, the WebSocket), built by `nuclear build`; no target code is written. `check.sh logs`,
`security` or `performance` runs only those stages. One PostgreSQL runs in a throwaway container
(`nuclear-appcheck-<pid>-postgres`, a free port of `127.0.0.1`, its data in memory, removed however the script ends).

A defect the check found and nobody fixed yet is a **known finding**: a line of `checks/app-check/known.txt`
(`<stage> <id> | what it is`), or a pattern of `KNOWN` in `logs.py`. The check fails on a finding that is not there,
and on a known one that no longer happens: the fix deletes its line, so the file never says more than the truth.
Each known finding is in the [roadmap](../01-product/roadmap.md) with its fix.

1. **logs** (SQLite), per dialect: `nuclear build`, the strict checker, then twice (development mode: what
   `nuclear run` starts; production mode: the same server without the reloader or the watcher:
   `python -m synapsis.server`, `node dist/src/main.js`) `nuclear migrate`
   `status`, `make`, `up`, `make`, `status`, `down`, `up`, the app started and driven by the database check's
   scenario, a request with a token and a body that must never be logged, a 500; then the project's tests.
   `logs.py` reads every line of every step, and of the apps of the other stages:
   - each line is on `ALLOW` (what a healthy run prints), on `CAUSES` (the error that ends the stack of a 500 the
     scenario or a probe provokes on purpose) or on `KNOWN`, each with whose line it is (the tool, the runtime, the
     generated code, a dependency) and why. A stack counts as one line, its last. **A line on no pattern fails the
     check**: a new warning, a deprecation notice, an error;
   - no log holds the database's password, a guard's token or the body of the request;
   - what a request leaves in each dialect's log is compared: a line per request in the one format of the
     reference (§2.8: time, method, path without its query, status, milliseconds), the cause of a 500 (its head
     `<time> ERROR <METHOD> <path> <type>: <message>`, read with its stack as one line), no query, no parameter of
     SQL, no `input_value`, no terminal colour in a file.
2. **security**: both dialects up at once (`store_api` on SQLite and on PostgreSQL, `tasks_api` on SQLite, production
   mode) and `security.py` sends each the same request. A probe is a finding when the dialects answer another
   status (for an error: another body), when an answer is not the one the probe wants, or when an error shows a
   stack, SQL, a path or the name of what runs underneath:
   - **SQL injection** (both databases): six hostile texts through the path, the query, a body and every
     repository word a request can feed (`like`, `ilike`, `contains`, `icontains`, `oneOf`, `between`, `orderBy`'s
     field and direction, `limit`, `offset`, `paginate`); a field that is no column; then the table is still there
     with the same rows in both dialects; a `%` stays a wildcard of `like` and is a character of `contains` and
     `icontains` (and so are `_`, a backslash and the escape `/`);
   - **parameters**: what is a whole number, a number, true or false; a missing, a repeated, a default one; a
     page larger than `maxPageSize` (answered with 100 rows);
   - **errors**: the bodies of 400, 404 and 500, the server's headers, `/docs`, `/redoc`, `/openapi.json`,
     `/.nuclear/*`, `/.env`, other methods, long paths and headers;
   - **bodies**: fields the model does not list (`id`, `createdAt`, a relation, `__proto__`), 200 KB to 30 MB,
     50 000 levels deep, numbers beyond every range, invalid UTF-8, a body on a GET, seven content types;
   - **CORS**: without `origins` and with one, a request and a preflight from the listed origin, an unlisted port of
     `127.0.0.1`, another and `null` (production); the PostgreSQL app again with `NUCLEAR_ENV=development` and
     `NUCLEAR_DEV_ORIGINS`: any port of `localhost`, `127.0.0.1`, `[::1]` and the registry's origin allowed, a look-alike
     host, another host and `null` refused, never credentials;
   - **guards**: `Token` and `NoOrigin` (no token, a wrong, shorter, longer, empty, repeated one, the header's and
     the value's case, in the query, every method, a path in another case or encoded, the documents), a
     controller's guard over the app's;
   - **the WebSocket**: the upgrade's guards, a frame that is not JSON, binary, 1 MB and 20 MB, not an object
     (`null`, a number, a list), a controller's guard, headers of a frame, a path that would leave the app
     (`@host`, an absolute URL, `<digit>/x`: the port beside the app's); a frame that stops the app ends the probes;
   - the address the server listens on with no host given;
   - **advisories** (`audit.py`): pip-audit over `nuclearlang/tools/python/requirements.txt`, `npm audit` over
     `packages/synapsis-nest` and over the `package.json` of a generated project.
3. **performance** (PostgreSQL, production mode, one dialect at a time): `performance.py` seeds 120 customers and,
   for six routes (a row, a page of 20, a row with its orders and their tags with 5 and with 20 orders, a write, a
   write in `@transactional`), counts the SQL statements of one request in the server's statement log, then runs
   `load.mjs` three times: 32 kept-alive connections, 3000 requests, after 300 of warm-up, the machine's load read
   before each. It prints requests per second, p50, p95, p99, the errors, the app's memory, its start-up time and
   the connections it left open. **It never fails on a speed.** It fails on an error under load, on a route that
   costs more statements than its bound (`ROUTES` in `performance.py`: one for a row, two for a page), on a relation that costs more statements
   with more rows (N + 1), and on a dialect more than ten times slower than the other on a route (two languages
   and two libraries, one process each, on a machine that does other work: ten times is a defect, not a
   difference). `APPCHECK_POOL=1` also exhausts the connection pool (the table locked 75 seconds, 40 requests).

## Conventions

- **One feature, both dialects.** A feature has a test in Nuclear in the example (`test/*_test.nuc`), which each
  dialect runs with its own runner; a behaviour of the runtimes has the same test in both
  (`packages/synapsis-py/tests/test_data.py`, `packages/synapsis-nest/test/data.test.ts`: `contains`, `@created` /
  `@updated` to the millisecond; `tests/test_types.py`, `test/types.test.ts`: an optional field `null` in every
  answer; `tests/test_exact.py`, `test/exact.test.ts`: the exact numbers as texts, compared and sorted by value on
  SQLite, refused with 409 beyond their column; the migrations:
  `tests/test_migrate.py`, `test/migrate.test.ts`).
- **Goldens.** When the generated output changes on purpose: `UPDATE_GOLDEN=1 cargo test`, then review the diff. An
  expected file the build no longer produces is a failure too.
- **No network, no real service** in the fastapi and nestjs checks: SQLite (in memory or a temporary file) and fake
  chat models (`FakeModel`). The database check is the one that runs real servers, in Docker, and nothing else
  outside this machine. What was never run against a real service is listed in the roadmaps (this one and each
  dialect's).
- **A difference between the dialects or between the databases is a bug of a runtime or of a dialect**, fixed there
  with the same test in both runtimes; the scenario is never bent to hide it. What cannot be the same is said in the
  roadmap and in the scenario's line.
- **The tests of a project start from an empty database**: in memory, empty in each test.

## CI

`.github/workflows/platform-backend.yml`, on a change to `nuclearlang/**`, `tools/cli/**`, the Cargo files or this
folder: Node 26 and Python 3.14; `npm ci` in `nuclearlang/tools/node` and `installer/release/build-runtimes.sh`;
the Python tools and the runtime; the equivalences of the `fastapi` and `nestjs` references; then the fastapi and
nestjs checks. The database check and the app check are not in the CI yet ([roadmap](../01-product/roadmap.md)).
