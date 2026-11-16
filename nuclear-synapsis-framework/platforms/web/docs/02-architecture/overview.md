---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [runtime.md, dependencies.md, ../07-reference/web.md, ../../../docs/02-architecture/contract.md]
---
# Architecture

## From a project to an app in the browser

```
a web project (.nuc, config.nuc, public/)
   │  nuclear build .  /  dragonfly build
   ▼
the compiler ── loads ──► the dialect   nuclearlang/dialects/typescript/frameworks/react/
   │                        └─ platform = "web" ──► platform.toml   (this folder: the contract)
   ▼
build/app   the dialect's app, never edited ── imports ──► the runtime   (packages/dragonfly-web)
   │        public/ copied as it is
   ▼
the app in the browser: one route per screen
```

A project has only `.nuc` files and `public/`: `config.nuc` (`dragonfly(platform = "web", dialect = ...)`,
`app(...)`, `contracts(...)`, `dependencies(...)`), `main.nuc` (the App view: the router with every screen),
`config/project_config.nuc`, components with `config/`, `data/`, `domain/` and `presentation/`, `shared/`, tests in
`test/*_test.nuc`. The rules are [the reference](../07-reference/web.md).

## The contract: `platform.toml`

The format of a contract, how a dialect implements it and what the loader checks (N0305) are the same for the three
platforms: [the contract of a platform](../../../docs/02-architecture/contract.md). What this one holds:

| Section | In the web contract |
|---|---|
| `[platform]` | `default_dialect = "react"`. Kinds, the mobile platform's that make sense in a browser: `stateless`, `stateful`, `appConfig`, `config`, `repository`, `usecase`, `appcomponent`, `service`, `aggregate`, `statemanager`, `statemodel`, `model`, `component`, `guard`, `event`, `tests`. Decorators: http (`repository`, `get`, `post`, `put`, `patch`, `delete`, `path`, `query`, `body`), state (`stateModel`, `state`, `before`, `after`), screens, events and access (`screen`, `on`, `requires`, `acl`), tests (`mock`, `test`, `widget`, `states`) and `key`. No plugins |
| `[decorators.*]` | none |
| `[layout]` | a path per kind: `config/project_config.nuc`, `test/`, `shared/{components,guards,events}/`, and under `components/{component}/`: `config/`, `data/`, `domain/{models,usecases,services,aggregates}/`, `presentation/{screen}/` (views), `presentation/{screen}/managers/`, `presentation/{screen}/state_models/`, and the facade `{component}_component.nuc` |
| `[skeletons]` | `repository`, `model`, `usecase`, `service`, `appcomponent`, `statemodel`, `stateless`, `stateful`, `event`, `tests` |
| `[gen]`, `[[generators.*]]` | `component` (the facade); `resource`, always from another API (`--source rest`: the web platform reads APIs, and its local database is the repositories' `saveLocal`, not a resource): the models, `<Name>Error`, an HTTP repository, a use case per action, the facade's aliases, with a screen (`when = "screen"`) its state model, state manager and view, and a test with the repository mocked; `usecase`: a use case over a repository method and its alias |

What the generators do for a user is in the reference (§3, "Generators"); how they work is
[the code generator](../../../../../tools/code_generator/AGENTS.md)'s.

## The dialect that implements it

| Dialect | Language | Built on | Folder | Its documents |
|---|---|---|---|---|
| `react` | TypeScript | React 19 without JSX, React Router 7, Vite 7, Vitest 4 + jsdom + Testing Library | `nuclearlang/dialects/typescript/frameworks/react/` | [reference](../../../../../nuclearlang/dialects/typescript/docs/07-reference/react.md), [brief](../../../../../nuclearlang/dialects/typescript/docs/07-reference/brief/react.md), [guide](../../../../../nuclearlang/dialects/typescript/docs/08-guides/react.md) |

Its runtime is [`dragonfly-web`](runtime.md); `Result` comes from the runtime, not from the generated code. Why
React, and why without JSX: [ADR-web-0001](../03-adr/0001-web-platform.md).

## What the `dragonfly` command does with a web project

The command is [another project](../../../../../tools/cli/AGENTS.md). What it takes from here:

- `dragonfly new <name> -p web -d react` writes the skeleton of a project (`web_project` in
  `nuclear-synapsis-framework/cli/src/scaffold.rs`).
- `build`, `install`, `run` and `test` go through the dialect's `[toolchain]`, and `check` runs `nuclear check .`,
  as for backend projects (`non_mobile_manifest` in `nuclear-synapsis-framework/cli/src/main.rs`).
- `dragonfly make` reads `[layout]` and `[skeletons]`; `dragonfly gen resource` writes a resource's models,
  repository, use cases, view and tests from the `[[generators.*]]` (ADR-codegen-0001).

## The example

`examples/examples-web/characters/` is the complete example, with the golden `examples/expected/characters/`: a
list screen and a detail screen (`@screen` with a route), a state model and its state manager, an HTTP repository,
use cases behind the facade, a service, a global `component` that reacts to an event, a guard, a not-found screen,
and tests. How it is checked: [testing](../05-standards/testing.md).
