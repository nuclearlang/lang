# The `typescript` dialect

[![ci](https://github.com/nuclearlang/lang/actions/workflows/ci.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/ci.yml) [![platform-backend](https://github.com/nuclearlang/lang/actions/workflows/platform-backend.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/platform-backend.yml) [![platform-web](https://github.com/nuclearlang/lang/actions/workflows/platform-web.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/platform-web.yml) · [Website](https://nuclearlang.github.io/typescript/reference/typescript)

How Nuclear is written in TypeScript: TypeScript 5 with ES modules that passes `tsc --strict`. Its framework
dialects write `react` for the [web platform](../../../nuclear-synapsis-framework/platforms/web/README.md) and
`nestjs` for the [backend platform](../../../nuclear-synapsis-framework/platforms/backend/README.md).

## Why

- The same Nuclear runs in the browser and on Node.js, written as an expert would.
- The library is Nuclear's: a TypeScript name such as `push` in Nuclear code is a bug.
- A framework dialect leaves out what its platform's contract does not have.

## How we made it

- Nothing of TypeScript in Rust: only generic options and template variables ([ADR-typescript-0001](docs/03-adr/0001-nestjs-dialect.md)).
- `react`: React 19 without JSX, React Router 7, Vite 7, Vitest 4 ([ADR-web-0001](../../../nuclear-synapsis-framework/platforms/web/docs/03-adr/0001-web-platform.md)).
- `nestjs`: NestJS 12, Sequelize, kafkajs, LangChain.js, over `synapsis-nest` ([ADR-typescript-0001](docs/03-adr/0001-nestjs-dialect.md)).
- Type definitions generated with the TypeScript compiler over the `.d.ts` files.

## Try it

```sh
cargo run -q -p nuclear-cli -- build hello.nuc --dialect typescript        # export function shout(...): string[]
cargo run -q -p nuclear-cli -- dialect check react                         # dialect 'react' (react → typescript) is valid
cargo run -q -p nuclear-cli -- defs show useState --dialect react          # the hook's API in Nuclear notation
```

## Read next

- The guides: [react](docs/08-guides/react.md) and [nestjs](docs/08-guides/nestjs.md).
- The reference: [typescript.md](docs/07-reference/typescript.md), [react.md](docs/07-reference/react.md), [nestjs.md](docs/07-reference/nestjs.md).
- [How it is built](docs/02-architecture/overview.md).
- [The other dialects](../README.md). [AGENTS.md](AGENTS.md): to change this dialect.
