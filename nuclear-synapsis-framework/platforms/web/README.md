# Synapsis web

[![platform-web](https://github.com/nuclearlang/nuclearlang/actions/workflows/platform-web.yml/badge.svg)](https://github.com/nuclearlang/nuclearlang/actions/workflows/platform-web.yml) · [Website](https://nuclearlang.github.io/platforms/web)

Single-page apps in the browser, written in Nuclear with the same words as the mobile platform, and built today with
the `react` dialect on the runtime `synapsis-web`.

## Why

- A project holds only its business logic; the transpiler writes components, state, routes and imports.
- The mobile platform in a browser: whoever knows one writes the other.
- Not there yet: forms, translations, the local database, plugins ([roadmap](docs/01-product/roadmap.md)).

## How we made it

- The mobile platform in a browser, React 19 without JSX ([ADR-web-0001](docs/03-adr/0001-web-platform.md)).
- No kind name in Rust: the web's emitter rules are dialect data (ADR-web-0001).
- One contract for every web dialect ([ADR-synapsis-0002](../../docs/03-adr/0002-three-platforms-dialects-under-them.md)); a backend read through its contract ([ADR-synapsis-0006](../../docs/03-adr/0006-shared-contracts.md)).
- The onboarding example was made only by `nuclear new` and `gen` ([ADR-platform-0004](../../../docs/03-adr/0004-products-are-made-with-the-tools.md)); [the website](../../../website/README.md) is a web app of this platform.

## Try it

```sh
nuclear new todos_web -p web && cd todos_web
nuclear gen resource todos Todo --source rest:https://jsonplaceholder.typicode.com --path todos \
  --fields "id:int title:string completed:boolean" --screen todos
nuclear build && nuclear install
nuclear run               # Vite: open http://localhost:5173/todos
```

## Read next

- [The onboarding](docs/08-guides/onboarding-web.md), step by step.
- [The reference](docs/07-reference/web.md) and [the brief](docs/07-reference/brief/web.md).
- [The react guide](../../../nuclearlang/dialects/typescript/docs/08-guides/react.md).
- [The mobile platform](../mobile/README.md). [AGENTS.md](AGENTS.md): to change it.

[Apache-2.0](../../../LICENSE). By contributing you agree that your contribution is licensed under it.
