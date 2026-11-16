---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [vision.md, ../02-architecture/overview.md, ../../platforms/docs/02-architecture/contract.md]
---
# Glossary

Use these words in code, documents and conversations. Paths start at the root of the tree.

| Term | Definition | Do not say | Where it is in the code |
|---|---|---|---|
| Synapsis | The framework of NuclearLang: what a project adds to the base language. | "the Flutter framework" | `synapsis(...)` in `config.nuc`; the `nuclear` command; the `synapsis*` runtime packages |
| Platform | One of `web`, `mobile`, `backend`: a specification in Nuclear only (project layout, `config.nuc`, kinds, decorators, connections, plugins, tests, errors). What the user and the agent write. | "target", "framework" for a platform | `nuclear-synapsis-framework/platforms/<platform>/`; `Dialect.platform` |
| Platform contract | The file `platform.toml` of a platform: what every dialect of it must implement, identically. | "the contract" alone, when a shared contract could be meant | `platforms/<platform>/platform.toml`; `check_platform` in `nuclearlang/crates/nuclear-dialect/src/model.rs` |
| Language dialect | How the base language and its library are written in one language: `typescript`, `dart`, `python`, `nodejs`. | "platform" | `nuclearlang/dialects/<language>/` |
| Framework dialect (in the code and the references: "Synapsis dialect") | A language and a framework that implement a platform: `flutter`, `fastapi`, `nestjs`, `react`. Extends a language dialect. | naming it by its language | `nuclearlang/dialects/<language>/frameworks/<dialect>/`; `[dialect] platform` |
| Project dialect | A dialect inside a project that extends a dialect with that project's shortcuts and kinds. | "kind package" | `<project>/dialects/<name>/` |
| Kind | The word that says what a declaration is (`usecase`, `repository`, `controller`, `stateless`). Data, not code: `[kinds.<word>]` plus a template. | "class type", "annotation" | a dialect's `dialect.toml` and `templates/` |
| Native kind | A kind of a platform: listed in its contract, implemented by every dialect of it. | | `[platform] kinds` |
| Extension kind | A kind that comes in a kind package or a project dialect, on top of a dialect. | | `KindSource::Package` |
| Kind package | A folder with a `kind.toml`, a `docs.toml` and one folder per dialect it implements; it belongs to one platform and is enabled like a plugin. | "plugin" for the folder itself | `<project>/kinds/<name>/`, `<install>/kinds/`; `Loader.packages` |
| Plugin | An optional part of a framework (a database driver, Genkit, Kafka) that a project carries only when `config.nuc` enables it. | "dependency" | `[project.plugins.<name>]` of a dialect; `plugins(name = true)` |
| Decorator | A `@word` a project may write on a declaration or a field; the platform lists the ones it allows. | "annotation" | `[platform] decorators`, `[decorators.*]` |
| Component | A feature of an app: a folder `components/<c>/` with layers, closed to the other components. | "module" | `[architecture] scope = "components"` |
| Facade | The kind `appcomponent`: what the rest of the app sees of a component. | | `[layout] appcomponent` |
| Global component | The kind `component` in `shared/components/`: cross-cutting use cases with `@on(Event)` methods. | "component" alone | `[layout] component` |
| `config.nuc` | The only manifest of a Synapsis project: `synapsis(platform, dialect)`, `app(...)`, `plugins(...)`, `contracts(...)`. | "the pubspec", "nuclear.toml" | `Manifest` in `nuclearlang/crates/nuclear-transpile` |
| Connection | A database, a chat model, a broker or an HTTP API, declared in the project's `config/` and never opened by hand. | | kinds `appConfig`, `config` |
| Layout | Where the file of each kind goes in a project. | "folder convention" | `[layout]` of the contract; `nuclear help layout --dialect <d>` |
| Runtime package | What a target framework lacks, written in the target language and added to a generated project automatically. | "SDK" | `platforms/<platform>/packages/` |
| Shared contract (a project's contract) | The description of what a project exposes or calls, written at every build; a client generates Nuclear from a backend's. | "platform contract" | `.nuclear/contract.json`; `contracts(...)`; `contracts/<name>/` |
| Conformance test | One example of a platform built from the same `.nuc` with every dialect of the platform. | | `backend_example_builds_with_every_backend_dialect` |
