# The `python` dialect

[![ci](https://github.com/nuclearlang/nuclearlang/actions/workflows/ci.yml/badge.svg)](https://github.com/nuclearlang/nuclearlang/actions/workflows/ci.yml) [![platform-backend](https://github.com/nuclearlang/nuclearlang/actions/workflows/platform-backend.yml/badge.svg)](https://github.com/nuclearlang/nuclearlang/actions/workflows/platform-backend.yml) · [Website](https://nuclearlang.github.io/python/reference/python)

How Nuclear is written in Python: typed Python 3.12+ that passes `pyright --strict`. Its framework dialect,
`fastapi`, writes the [backend platform](../../../nuclear-synapsis-framework/platforms/backend/README.md) of Synapsis.

## Why

- The same Nuclear runs where Python is the right target, without bending to Python.
- The `.nuc` keeps `camelCase`; the dialect writes `snake_case`.
- The library is Nuclear's: a Python name such as `len` in Nuclear code is a bug.

## How we made it

- No Python in Rust: what it needed became generic emitter options ([ADR-python-0001](docs/03-adr/0001-python-dialect-and-generic-emitter-options.md)).
- PEP 8 layout, PEP 695 generics, a `Result` runtime in the file (ADR-python-0001).
- `fastapi`: FastAPI, SQLAlchemy 2 async, pydantic, LangChain, over `synapsis-py` ([ADR-python-0002](docs/03-adr/0002-fastapi-dialect.md)).
- Type definitions generated with `inspect` from a pinned virtual environment.

## Try it

```sh
cargo run -q -p nuclear-cli -- build hello.nuc --dialect python   # def full_name(first_name: str, ...) -> str:
cargo run -q -p nuclear-cli -- dialect check fastapi              # dialect 'fastapi' (fastapi → python) is valid
cargo run -q -p nuclear-cli -- spec --brief --dialect fastapi     # the short sheet an agent reads
```

## Read next

- [The fastapi guide](docs/08-guides/fastapi.md): a backend, as a user writes it.
- The reference: [python.md](docs/07-reference/python.md) and [fastapi.md](docs/07-reference/fastapi.md).
- [How it is built](docs/02-architecture/overview.md).
- [The other dialects](../README.md). [AGENTS.md](AGENTS.md): to change this dialect.
