# Synapsis

[![platform-mobile](https://github.com/nuclearlang/lang/actions/workflows/platform-mobile.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/platform-mobile.yml) [![platform-backend](https://github.com/nuclearlang/lang/actions/workflows/platform-backend.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/platform-backend.yml) [![platform-web](https://github.com/nuclearlang/lang/actions/workflows/platform-web.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/platform-web.yml) · [Website](https://nuclearlang.github.io/synapsis/guide/README)

The framework of NuclearLang, as Actix is Rust's: you write an app, a backend or a web app in Nuclear on one of
three platforms (`mobile`, `backend`, `web`), and a dialect turns it into Flutter, FastAPI, NestJS or React.

## Why

- A project holds only its business logic; the transpiler writes injection, JSON, http, state and imports.
- What a target framework lacks comes from a Synapsis runtime package.
- Left out on purpose: a fourth platform, target code in a project, new grammar.

## How we made it

- The framework comes with the language ([ADR-synapsis-0001](docs/03-adr/0001-the-framework-comes-with-the-language.md)).
- Three platforms, dialects under them ([ADR-synapsis-0002](docs/03-adr/0002-three-platforms-dialects-under-them.md)).
- Closed components, injection, architecture rules ([ADR-synapsis-0003](docs/03-adr/0003-components-injection-and-architecture-rules.md)).
- Kinds and plugins are libraries ([ADR-synapsis-0004](docs/03-adr/0004-kinds-and-plugins-are-libraries.md)); every app gets the same services ([ADR-synapsis-0005](docs/03-adr/0005-the-services-every-app-gets.md)).
- A backend publishes a contract its apps read ([ADR-synapsis-0006](docs/03-adr/0006-shared-contracts.md)).

## Try it

```sh
nuclear new todos_api -p backend && cd todos_api
nuclear gen resource todos Todo --fields "id:int title:string completed:boolean"
nuclear build             # a FastAPI app; dialect = "nestjs" in config.nuc gives a NestJS one
```

## Read next

- [The guide](docs/08-guides/README.md) and [the tutorial](docs/08-guides/tutorial.md).
- [The three platforms](platforms/README.md).
- [Kinds](docs/08-guides/kinds.md) and [the generators](docs/08-guides/generators.md).
- [AGENTS.md](AGENTS.md): to change it.

By contributing you agree that your contribution is licensed under the [Apache License 2.0](../LICENSE).
