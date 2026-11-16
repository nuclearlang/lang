# Dragonfly backend

The backend platform of Dragonfly: HTTP APIs, databases with relations, migrations and transactions, events, AI
agents and graphs, written once in Nuclear and built with either dialect: `fastapi` (Python: FastAPI, SQLAlchemy,
Alembic, LangGraph) or `nestjs` (TypeScript: NestJS, Sequelize, LangChain.js).

Start with the rules of the platform, [docs/07-reference/backend.md](docs/07-reference/backend.md), and the guide of
the dialect you build with: [fastapi](../../../nuclearlang/dialects/python/docs/08-guides/fastapi.md) or
[nestjs](../../../nuclearlang/dialects/typescript/docs/08-guides/nestjs.md). An app that calls your backend gets its
models and repositories generated: [docs/08-guides/contracts.md](docs/08-guides/contracts.md).

## What is inside

`platform.toml` (the contract every backend dialect implements), `packages/{dragonfly-py,dragonfly-nest}` (the
runtimes), `examples/` (`tasks_api` builds with both dialects), `checks/{fastapi,nestjs}-check`, `docs/`.

The dialects are in `nuclearlang/dialects/python/frameworks/fastapi/` and
`nuclearlang/dialects/typescript/frameworks/nestjs/`, with their type definitions beside them.

## Working on it

It is built by the `nuclear` compiler and the `dragonfly` CLI of the same tree. From the root of the tree:

```sh
(cd nuclearlang/tools/node && npm install)                    # the shared Node tools of the checks
python3 -m venv nuclearlang/tools/python/.venv && nuclearlang/tools/python/.venv/bin/pip install -r nuclearlang/tools/python/requirements.txt
installer/install.sh
```

The commands, the rules and the checks before a change: [AGENTS.md](AGENTS.md) and
[docs/05-standards/testing.md](docs/05-standards/testing.md).

## License

[Apache-2.0](../../../LICENSE). By contributing you agree that your contribution is licensed under it.
