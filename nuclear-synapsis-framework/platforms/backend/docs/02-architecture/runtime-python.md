---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, runtime-typescript.md, dependencies.md, ../06-runbooks/change-a-runtime.md]
---
# The Python runtime: `dragonfly-py`

`packages/dragonfly-py` (distribution `dragonfly-py`, imported as `dragonfly`, Python 3.12+): what the code of the
`fastapi` dialect imports. Sources in `src/dragonfly/`, tests in `tests/`.

## Modules

| Module | Holds |
|---|---|
| `result` | `Result`, `Ok`, `Err` |
| `errors` | `AppError` and the errors with an HTTP status: `Invalid`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict` |
| `inject` | injection by type: `inject`, `provide`, `bind`, `reset` |
| `config` | `AppConfig`, `ComponentConfig`, `env`, and the connections: `Postgres`, `MySQL`, `MariaDB`, `SQLite(file)`, `Redis`, `Kafka(servers, group)`, `OpenAI`, `Ollama`, `Embeddings`, `Chroma(collection, embeddings, url)`. A plain `postgres://` url gets its async driver in `_with_driver` |
| `orm` | `Entity`, the column helpers (`primary`, `column`, `created`, `updated`), the relations, `EntitySchema`, `schema_of` |
| `repository` | `Repository` (CRUD), `Query`, the operators (`gt`, `gte`, `lt`, `lte`, `ne`, `like`, `ilike`, `one_of`, `is_null`, `between`), `Page`, `transactional` |
| `web` | the controller decorators (`controller`, `get`, `post`, `put`, `patch`, `delete`, `status`) and `router_of`: a `Result` becomes an HTTP answer, an entity its schema |
| `app` | `create_app`, the lifespan, `connection`, `connections`; serves the contract (`_serve_contract`) |
| `http` | the `Http(base_url)` connection and `HttpRepository`: methods without a body under `@get` / `@post`..., an error status becomes an `Err`, the answer is validated by the declared type (ADR-codegen-0001) |
| `ai` (optional) | `Tools`, `Agent`, `Graph`, `start` / `next`, `Messages`, `chat_model`, `vector_store` |
| `events` (optional) | `Listener`, `consumer`, `publish`, the cache (`cache_get`, `cache_set`) |
| `testing` | `running`, `client`, `FakeModel`, `memory_database` |
| `validators` | `is_email`, `is_url` |
| `migrate` | the migrations (below) |

Behaviour worth knowing:

- The controller decorators add the leading slash to the platform's segments; an invalid body answers 400.
- The order of a controller's routes does not matter: a fixed segment wins over a parameter (`router_of`;
  reference §2.7).
- `publish` works in process when the app has no Kafka connection; the tests' `conftest` creates the listeners.
- The extras of the package are the platform's plugins (`ai`, `postgres`, `mysql`, `sqlite`, `redis`, `kafka`,
  `openai`, `ollama`, `chroma`); `core` brings no driver ([dependencies](dependencies.md)).

## Data

How the data words of [ADR-backend-0001](../03-adr/0001-backend-data.md) are built:

- **Relations**: `many_to_one`, `one_to_many`, `many_to_many`, `one_to_one` in `orm.py`, all `lazy="raise"`: a
  relation that was not asked for is never queried. The foreign key is appended to the table in
  `Entity.__init_subclass__`. Join tables are made when the mappers are configured, so `Database.open` calls
  `configure_mappers()`; SQLite runs `PRAGMA foreign_keys=ON`.
- **Answers**: `to_dict` and `EntitySchema` leave an unloaded relation out.
- **What the generated project gives the runtime**: `main.py` and `conftest.py` list every entity
  (`entities=[...]`), so SQLAlchemy knows all the tables; two entities that name each other are imported only for
  the type checker (`if TYPE_CHECKING:`).
- **Transactions**: a session kept in a `ContextVar`, which `Repository.use()` joins.
- **Defaults**: a field's default is also the column's SQL default (`column(default=...)` sets `server_default`),
  so a non-null column can be added to a table that has rows.

## Migrations

`dragonfly.migrate` runs Alembic for `dragonfly migrate` (the dialect's `[toolchain]` keys `migrate_make`,
`migrate`, `migrate_down`):

```sh
python -m dragonfly.migrate make "add done to tasks" --dir <migrations>   # one migration: the entities minus the last one
python -m dragonfly.migrate up --dir <migrations>                         # applies the pending ones
python -m dragonfly.migrate down --dir <migrations>                       # reverts the last one
```

- `make` never reads the database: it brings an empty SQLite in memory to the last migration and lets Alembic's
  autogenerate write the difference.
- The folder is an Alembic script folder (`env.py`, `script.py.mako`, `versions/`), written the first time.
- `up` and `down` use the default database of the app's configuration, which `create_app` keeps in `app.state`;
  `alembic_version` lists what is applied.
- Migrations are written in batch mode, so SQLite (which cannot alter a column) and the other databases run the
  same file.

## Tests and type definitions

- `tests/test_runtime.py`, `test_data.py` (the same cases as the TypeScript runtime's `data.test.ts`),
  `test_http.py`, `test_migrate.py`; pytest with `asyncio_mode = "auto"`. The fastapi check runs them
  ([testing](../05-standards/testing.md)).
- The compiler and the editors know the runtime's names from its type definitions,
  `nuclearlang/dialects/python/defs/dragonfly/<version>/` (modules `dragonfly`, `dragonfly.ai`, `dragonfly.events`,
  `dragonfly.testing`, `dragonfly.validators`): regenerated after a change of the public API
  ([runbook](../06-runbooks/change-a-runtime.md)).
