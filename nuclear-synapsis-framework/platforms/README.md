# The platforms of Synapsis

[![platform-mobile](https://github.com/nuclearlang/lang/actions/workflows/platform-mobile.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/platform-mobile.yml) [![platform-backend](https://github.com/nuclearlang/lang/actions/workflows/platform-backend.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/platform-backend.yml) [![platform-web](https://github.com/nuclearlang/lang/actions/workflows/platform-web.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/platform-web.yml) · [Website](https://nuclearlang.github.io/platforms)

The three kinds of software Synapsis makes: `mobile` apps, `backend` services and `web` apps. This level holds what
the three share: the contract every dialect of a platform implements.

## Why

- What matters is phone, API or browser, not the language underneath.
- A fixed contract keeps the Nuclear of one dialect compatible with another.
- Left out on purpose: a fourth platform, any dialect's name in a contract.

## How we made it

- Three platforms, dialects under them ([ADR-synapsis-0002](../docs/03-adr/0002-three-platforms-dialects-under-them.md)).
- The contract comes first: the loader refuses a dialect that leaves it ([contract](docs/02-architecture/contract.md)).
- The web platform is the mobile one in a browser ([ADR-web-0001](web/docs/03-adr/0001-web-platform.md)).

| Platform | Dialects |
|---|---|
| [`mobile`](mobile/README.md) | `flutter` |
| [`backend`](backend/README.md) | `fastapi` (default), `nestjs` |
| [`web`](web/README.md) | `react` |

## Try it

```sh
cargo test -p nuclear-dialect --test loader       # every framework dialect implements its platform's contract
cargo test -p nuclear-transpile --test projects   # the examples of every platform: goldens and conformance
```

## Read next

- [What a platform is](docs/02-architecture/overview.md) and [how it is tested](docs/05-standards/testing.md).
- The dialects: [nuclearlang/dialects/](../../nuclearlang/dialects/README.md).
- The framework above them: [Synapsis](../README.md). To change this level: [AGENTS.md](AGENTS.md).
