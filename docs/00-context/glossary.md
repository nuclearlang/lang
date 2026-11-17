---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: []
---
# Glossary

Use these words, with this meaning, in code, documents and the chat.

| Term | Meaning | Do not say | Where |
|---|---|---|---|
| Nuclear | The base language: what a `.nuc` file is written in. | "NuclearLang code" for a dialect's output | `nuclearlang/` |
| Dialect | The data (TOML, templates) that says how Nuclear is written in one target. It never changes what the Nuclear code is. | "backend dialect" for a platform | `nuclearlang/dialects/` |
| Language dialect | A dialect of a target language: `python`, `typescript`, `dart`, `nodejs`. | | `nuclearlang/dialects/<language>/` |
| Framework dialect | A dialect that writes a platform of the framework in a target framework: `fastapi`, `nestjs`, `flutter`, `react`. It extends a language dialect. | | `nuclearlang/dialects/<language>/frameworks/<name>/` |
| Synapsis, the framework | What the language comes with for applications: kinds, decorators, components, `config.nuc` (`synapsis(platform, dialect)`), plugins, tests. Its commands are `nuclear`'s. | | `nuclear-synapsis-framework/` |
| Platform | `web`, `mobile` or `backend`: what the user and the agent write, identical for every dialect of it. | "dialect" for a platform | `nuclear-synapsis-framework/platforms/<platform>/` |
| Contract | A platform's `platform.toml`: the kinds, decorators and plugins every dialect of it implements. | | each platform |
| Kind | The word that opens a declaration (`model`, `usecase`, `screen`): a library of Nuclear. Native kinds are a platform's; extension kinds come in a package. | "class" | the contract, kind packages |
| Type definitions (defs) | The public API of a target's library, by package and version, so names are known and imports are written. | | `nuclearlang/dialects/<language>/defs/` |
| Reference | The normative text of a project (`docs/07-reference/`): a language's rules, a dialect's equivalences. | "spec" (a spec is a change being built: `docs/04-specs/`) | each project |
| Brief | The short sheet an agent reads before writing Nuclear for a dialect or a platform. | | `docs/07-reference/brief/` |
| The Smart Graph | The local, private knowledge base every agent reads. | "the RAG" in documents | `nuclear-graph-storage/` |
| Shelf, row, card | The graph's storage: a shelf holds typed rows; a card is what a search gives back. | | the graph |
| The Developer | The local agents (coder, tester, planner...). | | `nuclear-agents/nuclear_developer/` |
| `nuclear` | The one command line tool: the compiler's commands and the framework's (`new`, `make`, `gen`, `run`, `test`...). | "the `synapsis` command" | `tools/cli/` |
| Nuclear Builder | The pipeline tool of the editors: command `nuclear-builder`, runs in `.nuclear/builder/`. | | `extensions/tools/nuclear-builder/` |
| HTTP Connections | The editors' protocol client (HTTP/REST today). | | `extensions/tools/nuclear-http-connections/` |
| Project | In these documents: one folder of the tree with its own `AGENTS.md`. In Nuclear: what a user builds (`config.nuc` or `nuclear.toml`). | "repository" for a folder | `docs/README.md` |
