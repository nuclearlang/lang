# Synapsis backend

[![platform-backend](https://github.com/nuclearlang/lang/actions/workflows/platform-backend.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/platform-backend.yml) · [Website](https://nuclearlang.github.io/platforms/backend)

HTTP APIs, databases, events and AI agents, written once in Nuclear and built with `fastapi` (Python) or `nestjs`
(TypeScript).

## Why

- A project writes only its business logic; kinds (`entity`, `repository`, `controller`...) write the rest.
- One project builds as a Python or a TypeScript service from the same files.
- Mobile and web apps generate their models from the backend's contract.
- Not there yet: authentication, background jobs, uploads ([roadmap](docs/01-product/roadmap.md)).

## How we made it

- One platform, two dialects ([ADR-synapsis-0002](../../docs/03-adr/0002-three-platforms-dialects-under-them.md)).
- The data words: relations, `paginate`, `@transactional`, migrations ([ADR-backend-0001](docs/03-adr/0001-backend-data.md)).
- A backend publishes its contract ([ADR-synapsis-0006](../../docs/03-adr/0006-shared-contracts.md)); plugins in `config.nuc` ([ADR-synapsis-0004](../../docs/03-adr/0004-kinds-and-plugins-are-libraries.md)).
- The onboarding example was made only by `nuclear new` and `gen` ([ADR-platform-0004](../../../docs/03-adr/0004-products-are-made-with-the-tools.md)).

## Try it

```sh
nuclear new todos_api -p backend && cd todos_api
nuclear gen resource todos Todo --fields "id:int title:string completed:boolean"
nuclear build && nuclear install
nuclear test              # 3 passed
nuclear run               # http://localhost:8000, its OpenAPI docs at /docs
```

## Read next

- [The onboarding](docs/08-guides/onboarding-backend.md), step by step.
- [The reference](docs/07-reference/backend.md) and [the brief](docs/07-reference/brief/backend.md).
- The dialect guides: [fastapi](../../../nuclearlang/dialects/python/docs/08-guides/fastapi.md), [nestjs](../../../nuclearlang/dialects/typescript/docs/08-guides/nestjs.md).
- [An app that calls your backend](docs/08-guides/contracts.md). [AGENTS.md](AGENTS.md): to change it.

[Apache-2.0](../../../LICENSE). By contributing you agree that your contribution is licensed under it.
