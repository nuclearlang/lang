---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [vision.md, ../02-architecture/overview.md, ../07-reference/web.md]
---
# Glossary

The words of this project, where one of them can be read two ways. The rules of each kind are in
[the reference](../07-reference/web.md).

| Term | Meaning | Not to be confused with | Where it is |
|---|---|---|---|
| platform | What a project writes: kinds, decorators, folders, `config.nuc`, tests. Identical for every dialect | a dialect | `platform.toml` |
| dialect | The language and UI library the app comes out in: `react` today. Chosen in `config.nuc`: `synapsis(platform = "web", dialect = "react")` | the platform | `nuclearlang/dialects/typescript/frameworks/react/` |
| contract of the platform | `platform.toml`: what every web dialect must implement | the contract of a backend | `platform.toml` |
| contract of a backend | The description of an API a web project names with `contracts(...)` in `config.nuc`; its models and repositories are generated into `contracts/` | the platform's contract | [the backend platform's guide](../../../backend/docs/08-guides/contracts.md) |
| component (a folder) | `components/<name>/` of a project: `config/`, `data/`, `domain/`, `presentation/`, closed behind its facade | the kind `component`; a component of the UI library | `[layout]` |
| `component` (the kind) | A global piece in `shared/components/` that reacts to events with `@on(Event)` | a folder of `components/`; a view | `shared/components/{file}.nuc` |
| facade | The `appcomponent` of a component: an alias for each use case, the only thing a screen or another component calls. Its file is `{component}_component.nuc` (in the backend platform it is `{component}_appcomponent.nuc`) | the kind `component` | `components/<name>/<name>_component.nuc` |
| view | A `stateless` or a `stateful`: parameters are its props, `build()` returns an `Element` | a screen | `presentation/{screen}/` |
| screen | A view with `@screen(route, ...)`: it has an address and the router shows it | any view | `presentation/{screen}/`, `shared/screens/` |
| state model | The states of a screen, each field one state | a model of the domain | `presentation/{screen}/state_models/` |
| state manager | A `statemanager`: holds one state model and emits a new one | a use case | `presentation/{screen}/managers/` |
| runtime | The package the generated app imports: `synapsis-web` | the dialect (templates and TOML) | `packages/synapsis-web/` |
| golden | The expected generated output of the example, compared by `cargo test` | — | `examples/expected/characters/` |
