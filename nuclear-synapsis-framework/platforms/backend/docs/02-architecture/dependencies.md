---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, runtime-python.md, runtime-typescript.md]
---
# Dependencies

## Inside the tree

| Who | Depends on | How | Notes |
|---|---|---|---|
| The dialects `fastapi` and `nestjs` | `platform.toml` | data, merged by the loader | `platform = "backend"` in each `dialect.toml` |
| A built backend | `dragonfly-py` or `dragonfly-nest` | a library | the generated `pyproject.toml` / `package.json` asks for it by name; the dialect's `[toolchain] install` installs it from the installation's `packages/` |
| The compiler and the editors | the type definitions of the runtimes | `nuclearlang/dialects/python/defs/dragonfly/`, `nuclearlang/dialects/typescript/defs/dragonfly-nest/` | generated from the runtimes ([runbook](../06-runbooks/change-a-runtime.md)) |
| The checks | `nuclearlang/tools/python/.venv`, `nuclearlang/tools/node/node_modules`, the `nuclear` command (`cargo run -p nuclear-cli`) | tools | the versions the checks and the type definitions are made with are those installed there (`requirements.txt`, `package.json`) |
| The compiler's tests | `examples/` and `examples/expected/` | goldens | `nuclearlang/crates/nuclear-transpile/tests/projects.rs`, `golden.rs` |
| The mobile and web platforms | a backend's contract (`.nuclear/contract.json`) | generated models and repositories | ADR-synapsis-0006; the mobile example `tasks_app` is generated against `tasks_api` |
| The installer | `platform.toml`, `docs/07-reference/`, `docs/08-guides/`, `packages/` | copied into an installation | `installer/release/stage.sh`; `installer/release/build-runtimes.sh` builds `dragonfly-nest` first |

## Outside: `dragonfly-py` (`packages/dragonfly-py/pyproject.toml`)

Python 3.12 or later. Always installed:

| Library | Version | Used for |
|---|---|---|
| fastapi | ≥ 0.115 | the HTTP API |
| pydantic | ≥ 2.9 | models, validation |
| sqlalchemy[asyncio] | ≥ 2.0.36 | entities, repositories |
| alembic | ≥ 1.14 | the migrations of the database schema (`dragonfly migrate`) |
| httpx | ≥ 0.27 | HTTP repositories: a backend that calls another API |

The extras, one per plugin of the platform. The generated `pyproject.toml` lists the extras the project uses;
`core` is the package with no driver.

| Extra | Libraries |
|---|---|
| `ai` | langchain ≥ 1.0, langchain-core ≥ 1.0, langgraph ≥ 1.0 |
| `postgres` | asyncpg ≥ 0.30 |
| `mysql` | aiomysql ≥ 0.2 |
| `sqlite` | aiosqlite ≥ 0.20 |
| `redis` | redis ≥ 5.2 |
| `kafka` | aiokafka ≥ 0.12 |
| `openai` | langchain-openai ≥ 0.3 |
| `ollama` | langchain-ollama ≥ 0.3 |
| `chroma` | langchain-chroma ≥ 0.2, chromadb ≥ 0.6 |
| `test` | pytest ≥ 8, pytest-asyncio ≥ 0.24, httpx ≥ 0.27, aiosqlite ≥ 0.20 |

## Outside: `dragonfly-nest` (`packages/dragonfly-nest/package.json`)

Peers the app brings:

| Library | Version | Used for |
|---|---|---|
| @nestjs/common, @nestjs/core, @nestjs/sequelize | ≥ 10 | the framework (the runtime is built and tested with NestJS 12) |
| sequelize, sequelize-typescript | ≥ 6, ≥ 2 | entities, repositories, migrations |
| class-validator, class-transformer | ≥ 0.14, ≥ 0.5 | the validation of models |
| reflect-metadata, rxjs | ≥ 0.1, ≥ 7 | NestJS's own needs |

Optional peers, loaded only by the entry point that needs them:

| Library | Version | Entry point |
|---|---|---|
| ioredis | ≥ 5 | `dragonfly-nest/events` (Redis, the cache) |
| kafkajs | ≥ 2 | `dragonfly-nest/events` (Kafka) |
| langchain, @langchain/core, @langchain/langgraph, @langchain/ollama, @langchain/openai | ≥ 1 | `dragonfly-nest/ai` |
| chromadb | ≥ 3 | `dragonfly-nest/ai` (`ChromaStore`) |
| @nestjs/testing | ≥ 10 | `dragonfly-nest/testing` |

`@langchain/community` is not used: its peers conflict with zod 4 and ioredis 6. The runtime's own
`devDependencies` (TypeScript 5.9, sqlite3, `@nestjs/platform-express`, the libraries above) build and test it.

## Services a backend may connect to

Declared by a project as connections, each behind its plugin: SQLite, PostgreSQL, MySQL, MariaDB; Redis; Kafka;
OpenAI, Ollama; Chroma; any HTTP API (`Http`). Which of them ran against a real service is in each dialect's
roadmap; the migrations' in [this roadmap](../01-product/roadmap.md).
