---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, fastapi.md, ../06-runbooks/type-definitions.md, ../03-adr/README.md]
---
# Dependencies of the `python` dialect

## Inside the tree

| This dialect uses | For | Where |
|---|---|---|
| The compiler | loading, validating and emitting; the generic options this target needed | [the language project](../../../../AGENTS.md) |
| The backend platform's contract | the kinds, decorators and layout `fastapi` implements | `nuclear-synapsis-framework/platforms/backend/platform.toml` |
| The runtime `synapsis-py` | what the generated `fastapi` code imports (`synapsis`, `synapsis.ai`, `synapsis.events`, `synapsis.testing`, `synapsis.validators`) | `nuclear-synapsis-framework/platforms/backend/packages/synapsis-py` |
| The type definitions generator | `defs/` | `../../tools/defs/python/` (`gen.py`, `generate.sh`) |
| The pinned Python libraries | the generator and the checks read them | `../../tools/python/requirements.txt` → `../../tools/python/.venv` |

## The target

| Dependency | Version | Use | Decision |
|---|---|---|---|
| Python | 3.12 or later (the generated `pyproject.toml` says `requires-python = ">=3.12"`); the definitions are of 3.14, the version installed | the language of the output | ADR-python-0001 |
| pyright | strict mode | the type check of the output: the role `tsc --strict` and `flutter analyze` have for the other targets | ADR-python-0001 |
| PEP 8 layout, 88 columns | black / ruff's width | how the output is laid out | ADR-python-0001 |
| pytest (`asyncio_mode = "auto"`) | from `synapsis-py[test]` | the tests of a `fastapi` project | ADR-python-0002 |

## Libraries the `fastapi` output is written against

One library per need, the most used, never two that do the same (ADR-python-0002).

| Need | Library | Plugin of `config.nuc` |
|---|---|---|
| HTTP API | FastAPI (on Starlette), served by uvicorn | always |
| Validation, models, graph states | pydantic | always |
| SQL | SQLAlchemy 2 async, with `aiosqlite`, `asyncpg` or `aiomysql` as the driver | `sqlite`, `postgres`, `mysql`, `mariadb` |
| Migrations | Alembic (`synapsis.migrate`) | always |
| Cache | `redis.asyncio` | `redis` |
| Messages | aiokafka | `kafka` (`events` for the `listener` kind) |
| Tools, agents, chat models, embeddings | LangChain (`create_agent`, `init_chat_model`, `init_embeddings`: OpenAI and Ollama behind one API) | `ai`, `openai`, `ollama` |
| Graphs, checkpoints | LangGraph | `ai` |
| Vectors | Chroma through `langchain-chroma` | `chroma` |

## Type definitions

`defs/<package>/<version>/`, generated from the installed modules with `inspect`. They give the automatic imports,
the inherited members and the checks of constructor arguments. Look one up with
`nuclear defs show <Name> --dialect python` or `nuclear defs search <text> --dialect fastapi`.

| Dialect | `defs` |
|---|---|
| `python` | `python@3.14`: `builtins` (implicit: never imported), `typing`, `dataclasses`, `enum`, `abc`, `collections`, `collections.abc`, `functools`, `itertools`, `datetime`, `time`, `json`, `re`, `math`, `random`, `decimal`, `uuid`, `pathlib`, `os`, `logging`, `asyncio`, `contextlib` |
| `fastapi` (added to the parent's) | `synapsis@0.1.0`, `pydantic@2.14.2`, `fastapi@0.162.0`, `starlette@1.10.0`, `sqlalchemy@2.1.8`, `langchain_core@1.7.4`, `langchain@1.4.8`, `langgraph@1.2.19`, `langchain_openai@1.7.3`, `langchain_ollama@1.1.0`, `langchain_chroma@1.1.0`, `chromadb@1.5.9`, `openai@3.44.0`, `ollama@0.6.3`, `asyncpg@0.32.0`, `redis@8.1.0`, `aiokafka@0.15.0`, `pydantic_settings@2.16.2` |

A package a project adds (`nuclear add <package>`) gets its definitions generated into the project's own `defs/`
by the `[toolchain] package_defs` command; the dialect's `defs/` is not touched. Format and loading rules:
[../../../../docs/07-reference/definitions.md](../../../../docs/07-reference/definitions.md).
