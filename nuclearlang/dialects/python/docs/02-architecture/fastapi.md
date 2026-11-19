---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../07-reference/fastapi.md, ../03-adr/0002-fastapi-dialect.md, overview.md, dependencies.md]
---
# The `fastapi` dialect: the backend platform written in Python

`frameworks/fastapi/` (`extends = "python"`, `platform = "backend"`). The platform (its kinds, decorators, folders,
`config.nuc`, plugins and tests, in Nuclear) is
[the backend platform's](../../../../../nuclear-synapsis-framework/platforms/backend/AGENTS.md); its contract is
`nuclear-synapsis-framework/platforms/backend/platform.toml`. This dialect holds only how each of those is written:
FastAPI controllers, SQLAlchemy 2 async repositories, pydantic models, LangChain / LangGraph tools, agents and
graphs. The generated code calls the platform's runtime package `synapsis-py` (import name `synapsis`,
`nuclear-synapsis-framework/platforms/backend/packages/synapsis-py`). Normative equivalences:
[../07-reference/fastapi.md](../07-reference/fastapi.md). Decision: ADR-python-0002.

## What it changes of `python`

- `builtin_result = false`: `Result`, `Ok` and `Err` are the runtime's (`synapsis.result`), shared by the app and
  the framework; `replaces` drops the parent's automatic imports of `Result`, `Ok`, `Err` and `Field`.
- `[types] Error = "AppError"`: a use case fails with an `AppError` (`NotFound`, `Invalid`, `Conflict`...) whose
  status is the HTTP answer. Nuclear's `Error(message)` is `AppError(message)`; `e.message` goes through the helper
  `_message` (an `AppError` has `message`, a caught exception does not: its text is `str(e)`).
- `expect(condition)` in a test is `assert condition`.
- In a model, `Field` is pydantic's, not the `dataclasses` one.

## How each kind is written

| Kind | Template | Python |
|---|---|---|
| `appConfig`, `config` | `appconfig.tpl`, `config.tpl` | a subclass of `AppConfig` / `ComponentConfig` with its connections; no constructor |
| `entity` | `entity.tpl`, `entity_field.tpl` | a SQLAlchemy 2 table (`Entity`, `Mapped`); the field decorators (`@primary(generated)`, `@column(...)`, `@created`, `@updated`, the relations) are read by the template, not written as Python decorators. Two related entities import each other under `if TYPE_CHECKING:` (`type_imports = true`): SQLAlchemy finds them by name, the import is for pyright |
| `repository` | `repository.tpl`, `repository_method.tpl` | `Repository[Entity]` with CRUD; the entity is the `@repository(Entity)` argument or the name without `Repository`. Each method writes `q = self.query()` and `self_member = "q.{{name}}"`, so the user's lines (`where`, `orderBy`, `limit`, `getOne`...) build one query per call. Methods return an awaitable (callers write `~`) |
| `repository` with `@repository(path = "...")` | `repository_http_method.tpl` | `HttpRepository`: a method without a body and with `@get` / `@post` / `@put` / `@patch` / `@delete` is an HTTP call |
| `model` | `model.tpl`, `model_field.tpl` | a pydantic `BaseModel`; the rule decorators (`@required`, `@email`, `@minLength`...) become pydantic constraints (`Annotated`, `MinLen`, `MaxLen`, `Ge`, `Le`, `AfterValidator`, `is_email`, `is_url`); `@key` names the field in the JSON |
| `usecase`, `service`, `aggregate`, `controller` | `injectable.tpl` | a plain class with its decorators; a use case has one `exec` that returns `Result` |
| `appcomponent` | `injectable.tpl` | aliases to the use cases through `inject` (`alias_via = "inject"`) |
| `controller` | `injectable.tpl` | the runtime's `controller` / `get` / `post`... decorators over FastAPI. They add the leading slash to the platform's segments; path parameters, the body (a model) and the query are read by themselves; an invalid body answers 400; a `Result` answers its value or the `AppError`'s status; an entity in a body or an answer goes through a pydantic schema built from its columns |
| `listener` | `listener.tpl` | a `Listener` whose `@consumer("topic")` methods receive every message (aiokafka; in the same process without Kafka) |
| `tools` | `tools.tpl` | LangChain tools: a method with a doc comment is a tool and the doc comment is what the model reads; a method without one is a helper |
| `agent` | `agent.tpl` | a LangChain agent (`create_agent`) with `ask(text, thread)` |
| `state` | `state.tpl`, `state_field.tpl` | a pydantic model (nodes read `state.field`); a field without a default gets its type's empty value (lists, texts, numbers, booleans, `Messages`; a nullable gets `None`) |
| `graph` | `graph.tpl` | a LangGraph `StateGraph` from the node methods (`@start`, `@next("node")`) with `run(state, thread)` |
| `tests` | `tests.tpl`, `tests_method.tpl` | a pytest class; `@test("...")` methods; `inject<X>()` gives the app's instances; a `Result` is kept (`results = "keep"`) |

Kind by folder (`[project.kinds]`): `components/*/data/entities` and `shared/entities` → `entity`;
`components/*/domain/models` and `shared/models` → `model`; `components/*/ai/states` → `state`; `test` → `tests`.

## Data relations and transactions

The rules of the relation decorators are the platform's data (`[decorators.args]` and `[decorators.fields]` of its
`platform.toml`, merged into this dialect by the loader); they are checked on Nuclear names, so the `snake_case`
output does not matter. The entity templates read `tinfo.decor` (the related entity's table),
`tinfo.fields_decor.primary` (its key), `owner` / `owner_decor` (the entity the field is in) and the `unquote`
filter. `app/main.py` and `tests/conftest.py` list every entity (`entities=[...]`) so SQLAlchemy knows all tables.
What the runtime does with them (`many_to_one`, `one_to_many`, `many_to_many`, `one_to_one`, `transactional`,
`Page`) is the backend platform's.

## Project files

A folder with `config.nuc` (`synapsis(platform = "backend", dialect = "fastapi")`); `nuclear build .` writes
`build/`. `[project] sources = "app"`; the platform's `test/` is written to pytest's `tests/`
(`[project.outputs]`).

| File | Template | Holds |
|---|---|---|
| `app/main.py` | `main.tpl` | the FastAPI `app`: `create_app` with the project config, every component config, controller, listener and entity |
| `tests/conftest.py` | `conftest.tpl` | a fixture that runs every test with the project's connections, the databases replaced by a fresh in-memory SQLite and the listeners created |
| `pyproject.toml` | `pyproject.tpl` | name, version and description of `app(...)`; `requires-python = ">=3.12"`; `synapsis-py`, `uvicorn` and the packages of the enabled plugins and of `dependencies(...)`; pytest (`asyncio_mode = "auto"`) and pyright strict settings |

`config.nuc` sections: `synapsis`, `app`, `plugins`, `contracts`, `dependencies`. `dependencies(name = "version")`
adds a package of pip; a version that starts with `.` or `/` is a folder. `[project.manifest.advice]` says, when
`flask` or `django` is added, what the platform already gives in its place (the project may add it all the same).

## Plugins

The optional parts of the runtime; only the enabled ones go to `pyproject.toml`, and only then are their names
imported (`synapsis.ai`, `synapsis.events`).

| Plugin | Packages | Gives |
|---|---|---|
| `sqlite` | `aiosqlite>=0.20` | `SQLite(file = ...)` |
| `postgres` | `asyncpg>=0.30` | `Postgres(url = ...)` |
| `mysql`, `mariadb` | `aiomysql>=0.2` | `MySQL(url = ...)`, `MariaDB(url = ...)` |
| `redis` | `redis>=5.2` | `Redis(url = ...)`, `cacheGet`, `cacheSet` |
| `kafka` | `aiokafka>=0.12` | `Kafka(servers = ..., group = ...)`: `publish` reaches the broker |
| `events` | none | `publish` and the `listener` kind with `@consumer` in the same process |
| `ai` | `langchain>=1.0`, `langchain-core>=1.0`, `langgraph>=1.0` | the `tools`, `agent`, `state` and `graph` kinds, chat models and embeddings |
| `openai` (needs `ai`) | `langchain-openai>=0.3` | `OpenAI(model = ...)` |
| `ollama` (needs `ai`) | `langchain-ollama>=0.3` | `Ollama(model = ...)` |
| `chroma` (needs `ai`) | `langchain-chroma>=0.2`, `chromadb>=0.6` | `Chroma(collection = ..., url = ...)` |

## Toolchain

What the `nuclear` command runs in `build/` (`[toolchain]`; `[toolchain.windows]` has the same with
`.venv\Scripts\`):

| Key | Command |
|---|---|
| `install` | `python3 -m venv .venv`, then pip installs the runtime from `{{packages}}/synapsis-py` and the app (`-e '.[test]'`) |
| `needs` | `python`: the CLI finds Python (`NUCLEAR_PYTHON`, the one included with NuclearLang, Nuclear's own, the PATH) and puts it first in the PATH of these commands (ADR-cli-0004) |
| `install_local` | reinstalls a dependency that is a folder (`--no-deps --force-reinstall`) |
| `run` | `.venv/bin/uvicorn app.main:app --reload --port {{port}}` (`url = "http://localhost:8000"`, `ready = "Uvicorn running"`, `installed = ".venv"`) |
| `test` | `.venv/bin/python -m pytest -q` |
| `package_add`, `package_remove`, `package_version`, `package_defs` | pip, the version it resolved, and `tools/defs/python/gen.py --distribution` for the package's type definitions, written into the project's `defs/`. A bare version (`4.17.0`) is exact (`==`); a constraint is `>=` |
| `migrate_make`, `migrate`, `migrate_down` | `python -m synapsis.migrate make\|up\|down --dir {{migrations}}` (Alembic over the project's `migrations/`) |

There is no `analyze` key ([roadmap](../01-product/roadmap.md)). The editor's debug launch (`[[toolchain.launch]]`)
runs `uvicorn` under debugpy with the app's virtual environment, without `--reload` (the debugger owns the
process), after the task `nuclear: build`.

## Architecture rules

`[architecture]`, scope `components`: a use case is called only by its `appcomponent`; a service by use cases and
aggregates; an aggregate by use cases; a repository by use cases, aggregates and tools. Another component sees only
the `appcomponent`, models, entities, tools, agents, states and graphs. Tests are exempt.
