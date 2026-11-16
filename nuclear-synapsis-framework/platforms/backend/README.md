# Synapsis backend

The backend platform of Synapsis: HTTP APIs, databases with relations, migrations and transactions, events, and AI
agents and graphs, written once in Nuclear and built with either dialect: `fastapi` (Python) or `nestjs`
(TypeScript).

## Why it exists

A backend repeats the same framework code in every project: routes, validation, JSON, injection, queries,
migrations. Here a project writes only its business logic, and the kinds (`entity`, `repository`, `usecase`,
`controller`, `agent`...) write the rest. Because the platform is the same for every dialect, one project builds as
a Python service or as a TypeScript service from the same files, and an app of the mobile or web platform gets its
models and repositories generated from the backend's contract.

What it leaves out on purpose: how a dialect writes its target (that is each dialect's reference), any kind or
feature that exists in one dialect only, and loading a relation by itself (no lazy query, no eager loading by
default). Not there yet: authentication, guards and sessions, background jobs, file uploads, a Dockerfile,
observability, CORS ([roadmap](docs/01-product/roadmap.md)).

## How we made it

- **One platform, two dialects** ([ADR-synapsis-0002](../../docs/03-adr/0002-three-platforms-dialects-under-them.md)):
  the first two backends, in Python and TypeScript, came out with different Nuclear; the platform was made the
  contract both implement (`platform.toml`), and the conformance example `examples/examples-backend/tasks_api`
  builds with both.
- **The data words** ([ADR-backend-0001](docs/03-adr/0001-backend-data.md)): one key decorator, a decorator per
  relation, `paginate`, `@transactional` and generated migrations, the same words as on mobile where they mean the
  same.
- **A backend publishes its contract** and OpenAPI, which its clients read
  ([ADR-synapsis-0006](../../docs/03-adr/0006-shared-contracts.md)).
- **Optional parts are plugins** of `config.nuc` (`sqlite`, `postgres`, `redis`, `kafka`, `ai`, `openai`...)
  ([ADR-synapsis-0004](../../docs/03-adr/0004-kinds-and-plugins-are-libraries.md)).
- **The runtimes behave the same**: `packages/synapsis-py` and `packages/synapsis-nest` get every behaviour with the
  same test in both.

**The onboarding example was made with the tools.** `examples/onboarding/todos_api` was written only by
`nuclear new` and `nuclear gen`, no file by hand
([ADR-platform-0004](../../../docs/03-adr/0004-products-are-made-with-the-tools.md)); the website runs those
commands again on every build and fails if they no longer give it.

## Try it

With `nuclear` installed and Python 3.12 or later:

```sh
nuclear new todos_api -p backend
cd todos_api
nuclear gen resource todos Todo --fields "id:int title:string completed:boolean"
nuclear check --json      # []
nuclear build             # the FastAPI app in build/
nuclear install           # its virtual environment
nuclear test              # 3 passed
nuclear run               # http://localhost:8000, its OpenAPI docs at /docs
```

Set `dialect = "nestjs"` in `config.nuc` and build again: the same `.nuc` files become a NestJS app. Step by step:
[docs/08-guides/onboarding-backend.md](docs/08-guides/onboarding-backend.md).

## Where to read next

- The rules of the platform, every kind and plugin (`nuclear help backend`):
  [docs/07-reference/backend.md](docs/07-reference/backend.md); the short sheet an agent reads:
  [docs/07-reference/brief/backend.md](docs/07-reference/brief/backend.md).
- The guide of the dialect you build with: [fastapi](../../../nuclearlang/dialects/python/docs/08-guides/fastapi.md)
  or [nestjs](../../../nuclearlang/dialects/typescript/docs/08-guides/nestjs.md).
- An app that calls your backend: [docs/08-guides/contracts.md](docs/08-guides/contracts.md).
- What the platform is for: [docs/00-context/vision.md](docs/00-context/vision.md).
- To change it (the runtimes, the checks, the goldens): [AGENTS.md](AGENTS.md).

[Apache-2.0](../../../LICENSE). By contributing you agree that your contribution is licensed under it.
