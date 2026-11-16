# Synapsis

The framework of NuclearLang. You write an app, a backend or a web app in Nuclear on one of three **platforms**
(`mobile`, `backend`, `web`), and a **dialect** turns it into Flutter, FastAPI, NestJS or React. Synapsis is to
Nuclear what Actix is to Rust: the language comes with its framework, and no other is needed.

## Why it exists

Writing an app usually means choosing and wiring many packages: state, JSON, injection, http, routing,
translations, tests. That wiring is the same in every app, and an agent spends its turns on it. With Synapsis a
project holds only its business logic; constructors, overrides, injection, JSON, http, states, modules and imports
are written by the transpiler, and what a target framework lacks comes from a runtime package of Synapsis.

What it leaves out on purpose:

- **A fourth platform**, and any feature that exists in one dialect of a platform only.
- **Target code in a project.** A project is only `.nuc`; everything generated goes to `build/` and is never
  edited.
- **New grammar.** A kind is a header and a block of the base language.
- **Replacing the target's own tools.** Flutter's CLI still builds and runs an app; Synapsis drives it.

## How we made it

- **The framework comes with the language** and is a concept, not a target: components, layers and kinds that each
  dialect applies to its technology. The `nuclear` command knows no language; what it runs comes from the dialect
  ([ADR-synapsis-0001](docs/03-adr/0001-the-framework-comes-with-the-language.md)).
- **Exactly three platforms; dialects only change the language underneath.** Two backends written for the same
  framework came out with different Nuclear (`@get("/{id}")` against `@get(":id")`), so a platform became a
  specification in Nuclear only, and the same `.nuc` builds for every dialect of it
  ([ADR-synapsis-0002](docs/03-adr/0002-three-platforms-dialects-under-them.md)).
- **One shape for every project**: closed components with layers and a facade (`appcomponent`), dependencies
  injected from a kind's header, and the transpiler checks who may call whom
  ([ADR-synapsis-0003](docs/03-adr/0003-components-injection-and-architecture-rules.md)).
- **Kinds are libraries**: TOML, templates and a runtime, never compiler code; optional parts are plugins enabled
  in `config.nuc`, so a project carries only what it uses
  ([ADR-synapsis-0004](docs/03-adr/0004-kinds-and-plugins-are-libraries.md)).
- **Every app gets the same services**: events, session, ACL, forms, translations and generic models
  ([ADR-synapsis-0005](docs/03-adr/0005-the-services-every-app-gets.md)).
- **A backend publishes a contract**, and an app that calls it generates its models and repositories from it
  ([ADR-synapsis-0006](docs/03-adr/0006-shared-contracts.md)).

The framework itself is data and documents: one contract per platform (`platforms/<platform>/platform.toml`), read
by the compiler, and runtime packages in Dart, Python and TypeScript. Its commands (`new`, `gen`, `make`, `run`,
`test`...) are commands of `nuclear`, in [the command line tools](../tools/cli/AGENTS.md); what `gen` and `make`
write is [the code generator](../tools/code_generator/AGENTS.md).

## Try it

With `nuclear` installed ([the command line tools](../tools/cli/docs/08-guides/README.md) say how), a backend in
three commands:

```sh
nuclear new todos_api -p backend
cd todos_api
nuclear gen resource todos Todo --fields "id:int title:string completed:boolean"
nuclear check --json      # []
nuclear build             # todos_api: 19 files → ./build   (a FastAPI app)
```

Change one word of `config.nuc`, `dialect = "fastapi"` to `dialect = "nestjs"`, and `nuclear build` again: the same
14 `.nuc` files become a NestJS app. The onboarding of each platform goes on from there (install, test, run):
[backend](platforms/backend/docs/08-guides/onboarding-backend.md),
[web](platforms/web/docs/08-guides/onboarding-web.md),
[mobile](platforms/mobile/docs/08-guides/onboarding-mobile.md).

## Where to read next

- The guide, with every platform, its dialects and its plugins: [docs/08-guides/README.md](docs/08-guides/README.md).
- The tutorial, an app from scratch (`nuclear help tutorial`): [docs/08-guides/tutorial.md](docs/08-guides/tutorial.md).
  Kinds, yours and the community's: [docs/08-guides/kinds.md](docs/08-guides/kinds.md). The generators:
  [docs/08-guides/generators.md](docs/08-guides/generators.md).
- The three platforms: [platforms/](platforms/README.md).
- What the framework is for: [docs/00-context/vision.md](docs/00-context/vision.md); every decision:
  [docs/03-adr/](docs/03-adr/README.md).
- To change it: [AGENTS.md](AGENTS.md), and the rules of the whole tree in [the root AGENTS.md](../AGENTS.md).

By contributing you agree that your contribution is licensed under the [Apache License 2.0](../LICENSE).
