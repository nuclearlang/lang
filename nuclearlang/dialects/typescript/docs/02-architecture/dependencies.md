---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, nestjs.md, react.md, ../06-runbooks/type-definitions.md, ../03-adr/README.md]
---
# Dependencies of the `typescript` dialect

## Inside the tree

| This dialect uses | For | Where |
|---|---|---|
| The compiler | loading, validating and emitting | [the language project](../../../../AGENTS.md) |
| The `nodejs` dialect | `nestjs` extends it (the `node:` module shortcuts and automatic imports) | [../../../nodejs/AGENTS.md](../../../nodejs/AGENTS.md) |
| The backend platform's contract and its runtime `synapsis-nest` | what `nestjs` implements and what its output imports (`synapsis-nest`, `synapsis-nest/events`, `synapsis-nest/ai`, `synapsis-nest/testing`) | `nuclear-synapsis-framework/platforms/backend/` (`platform.toml`, `packages/synapsis-nest`) |
| The web platform's contract and its runtime `synapsis-web` | what `react` implements and what its output imports (`synapsis-web`, `synapsis-web/testing`) | `nuclear-synapsis-framework/platforms/web/` (`platform.toml`, `packages/synapsis-web`) |
| The type definitions generator | `defs/` | `../../tools/defs/typescript/` (`gen.js`, `generate.sh`) |
| The installed TypeScript libraries | the generator and the checks read them | `../../tools/node/` (`package.json`, `node_modules`) |

## The target

| Dependency | Version | Use |
|---|---|---|
| TypeScript | 5 (definitions of `typescript@5.9.3`, the ES2022 library) | the language of the output; `tsc --strict` is its check |
| ES modules | `"type": "module"` in every generated `package.json` | how files import each other |
| Node.js | the generated `nestjs` `package.json` asks for `@types/node` `^24.0.0`; `../../tools/node` installs `@types/node` `^26.6.6` | runs `nestjs` and its tests (`node:test`, `node --watch`) |

## Libraries the `nestjs` output is written against (ADR-typescript-0001)

| Need | Library | Plugin of `config.nuc` |
|---|---|---|
| HTTP API, modules, injection | NestJS 12 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) | always |
| SQL | Sequelize through the official integration (`@nestjs/sequelize` + `sequelize-typescript`), with `sqlite3`, `pg`, `mysql2` or `mariadb` as the driver | `sqlite`, `postgres`, `mysql`, `mariadb` |
| Validation of DTOs | class-validator, class-transformer | always |
| Cache | ioredis | `redis` |
| Messages | kafkajs | `kafka` (`events` for the `listener` kind) |
| Tools, agents, chat models | LangChain.js (`tool` + zod schemas, `createAgent`, `initChatModel`: Ollama and OpenAI) | `ai`, `openai`, `ollama` |
| Graphs | LangGraph.js (`StateGraph` over `Annotation.Root`) | `ai` |
| Vectors | `chromadb`'s client behind a LangChain `VectorStore` in the runtime | `chroma` |
| Tests | `node:test` and `node:assert` on the compiled code | always |

`@langchain/community` is not used: its peers conflict with zod 4 and ioredis 6.

## Libraries the `react` output is written against (ADR-web-0001)

| Need | Library |
|---|---|
| Views | React 19 (`react`, `react-dom`), without JSX |
| Routes | React Router 7 |
| Build and dev server | Vite 7 |
| Tests | Vitest 4 + jsdom + Testing Library (`@testing-library/react`) |

## Type definitions

`defs/<package>/<version>/`, generated from the packages' `.d.ts` files with the TypeScript compiler. They give the
automatic imports, the inherited members and the checks of constructor arguments. Look one up with
`nuclear defs show <Name> --dialect nestjs` or `nuclear defs search <text> --dialect react`.

| Dialect | `defs` |
|---|---|
| `typescript`, `nodejs` | none |
| `nestjs` | `typescript@5.9.3` (the standard library: implicit, never imported), `nestjs_common@12.3.2`, `nestjs_core@12.3.2`, `nestjs_sequelize@12.0.0`, `class_validator@0.15.1`, `class_transformer@0.5.1`, `sequelize_typescript@2.1.6`, `synapsis-nest@0.1.0`, `sequelize@6.37.8`, `nestjs_testing@12.3.2`, `rxjs@7.8.2` |
| `react` | `typescript@5.9.3`, `synapsis-web@0.1.0`, `react@19.3.1`, `react_router@7.18.5`, `vitest@4.1.12`, `testing_library_react@16.3.3` |

The order of a `defs` list decides which package gives a name two of them export: in `nestjs`, class-validator's
`IsInt` / `Min` / `Max` (not sequelize-typescript's) and Nest's `Query` (not the runtime's). A hand-written
`[auto_imports]` entry wins over the definitions.

A package a project adds (`nuclear add <package>`) gets its definitions generated into the project's own `defs/`
by the `[toolchain] package_defs` command; the dialect's `defs/` is not touched. Format and loading rules:
[../../../../docs/07-reference/definitions.md](../../../../docs/07-reference/definitions.md).
