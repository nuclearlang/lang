---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [07-reference/mobile.md, 02-architecture/kinds.md, 02-architecture/project.md]
---
# Glossary

Use these words, with these meanings, in code, documents and conversations.

| Term | Meaning | Where it appears |
|---|---|---|
| Platform | What the user and the agent write: kinds, decorators, folders, `config.nuc`, plugins and tests, in Nuclear, the same for every dialect. Here: `mobile` | `platform.toml` |
| Dialect | The language and the UI toolkit the code comes out in. Today only `flutter` | `nuclearlang/dialects/dart/frameworks/flutter/` |
| Contract of the platform | The kinds, decorators and plugins every dialect of the platform must implement, identically | `platform.toml`, `[platform]` |
| Contract of a backend | What a backend written in Nuclear publishes; `contracts(...)` in `config.nuc` generates `contracts/<name>/` from it (ADR-synapsis-0006). Not the contract of the platform | `examples/examples-flutter-dialect/tasks_app` |
| Kind | The word that says what a declaration is (`repository`, `usecase`, `stateless`...). In some folders the folder gives it and no word is written | `platform.toml` `kinds`, `[layout]` |
| Decorator | `@name(...)` on a declaration, a method or a field; the list a project may write is the contract's | `platform.toml` `decorators` |
| Plugin | An optional part an app enables in `config.nuc` (`plugins(genkit = true)`); an app that does not enable it does not carry its packages | `platform.toml` `plugins` |
| Component | A business unit in `components/<name>/` with its own config, data, domain and presentation. Closed: another component sees only what the architecture rules allow | `components/` |
| Facade | The `appcomponent` of a component: what the screens and the other components see of it, usually an alias per use case | `components/<c>/<c>_component.nuc` |
| Global component | The kind `component`, in `shared/components/`: anyone uses it and its `@on(Event)` methods always receive | `shared/components/` |
| Connection | What a config declares to reach the outside: `Http`, `WebSocket`, an AI provider. Named with `connectionName`; the one without a name is the default | `appConfig`, `config` |
| State model | The states of a screen: each field is one state; a boolean field is a state without data | `presentation/<screen>/state_models/` |
| State manager | The kind `statemanager`: the state of one screen; its `@state` methods emit a state of its state model | `presentation/<screen>/managers/` |
| View | A `stateless` or a `stateful`. Only views use the UI toolkit's context and navigate | `presentation/` |
| Screen | A view with `@screen(route, ...)` | `presentation/<screen>/`, `shared/screens/` |
| Guard | The kind `guard`: an own access check, `canActivate()`, sync or async | `shared/guards/` |
| Event | The kind `event`: a typed global event with JSON fields | `shared/events/` |
| Converter | The kind `converter`: how a field's value is read from and written to JSON | `shared/converters/` |
| Local table | The table on the device of a model that has `@primary` | [local-database.md](../02-architecture/local-database.md) |
| Twin | `<method>AsLocal()`: the copy of a repository's GET method that answers from the device and never sends a request | [local-database.md](../02-architecture/local-database.md) |
| Runtime | The packages an app runs on: `dragonfly`, and `dragonfly_genkit` with the `genkit` plugin | `packages/` |
| Generated tests | The tests the build writes by itself for models, repositories, routes and screens | [testing.md](../05-standards/testing.md) |
| Golden | The expected output of an example, compared by `cargo test` | `examples/expected/`, the `.dart` beside a single-file example |
