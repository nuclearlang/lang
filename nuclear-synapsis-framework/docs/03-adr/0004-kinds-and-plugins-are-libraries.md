---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0004: Kinds are Nuclear's libraries: native kinds in the platform, extension kinds as packages, optional parts as plugins of `config.nuc`

## Context and problem
Kinds are to Synapsis what libraries are to a language. There are native kinds and kinds written by a project or
by the community, as extensions of the dialect a developer uses; a developer must never have to touch the parser,
the lexer or the emitter to write one. And a project must not get heavier with what it does not use: full Genkit
support for the mobile platform, database drivers, Kafka or LangChain are wanted only by the projects that ask for
them, through "a section in `config.nuc`, like a pubspec or a package.json but only to enable these packages".

What already held: a kind is data, not code (`[kinds.<word>]` in a TOML file plus a template; no kind name is
written in Rust), and a project could add a kind with a child dialect. What was missing: a unit smaller than a
dialect to share and install; knowing which dialects a kind exists for; keeping the real dialect in `config.nuc`
(a child dialect hid it from the command and the editors); and every framework written so far had needed new
generic emitter capabilities, because templates have no expressions, only sections and filters.

## Decision
1. **Plugins.** A dialect declares `[project.plugins.<name>]` (packages, dev packages, type definitions, kinds,
   names, requires); `config.nuc` enables them with `plugins(name = true)`. A kind or a name of a plugin that is
   not enabled is N0304, with the line to add; an unknown plugin or value is N0303. Project templates get
   `plugins.<name>`, `plugins.packages` and `plugins.dev_packages`, so a generated manifest lists only the enabled
   packages; the `nuclear` command adds and removes the Flutter packages of the plugins (`.synapsis_plugins`).
   The plugins' type definitions are always loaded (their index only), so editors know them. The plugins of a
   platform are a list of its contract, the same in every dialect (ADR-synapsis-0002).
2. **Catalogs.** Mobile: `genkit` and one plugin per provider. Backend: `sqlite`, `postgres`, `mysql`, `mariadb`,
   `redis`, `kafka`, `events` (in-process publish), `ai`, `openai`, `ollama`, `chroma`. The runtimes keep the
   optional parts in their own modules (`synapsis.ai`, `synapsis.events`; `synapsis-nest/ai`,
   `synapsis-nest/events`, kafkajs and ioredis loaded when opened), so a project without a plugin does not need
   its package.
3. **Genkit for the mobile platform** (the runtime package `synapsis_genkit`): Genkit in the app and remote
   flows, with the providers Firebase AI, Google AI, Vertex AI, OpenAI and Anthropic. Providers are connections of
   the project config (descriptors without plugin imports); the generated `lib/synapsis_genkit.g.dart` (only with
   the plugin) turns them into plugins and registers a schema per model of the app (`SchemanticType.from` with its
   fields and `fromJson`, no schemantic codegen). Kinds: `tools` (doc comment = description, parameters = JSON
   schema), `chat` (history, `send`, `stream`, `ChatController`), `flow` (`GenkitFlow`, `generateObject` with a
   text fallback for servers without structured output), `remote` (`defineRemoteAction`, call and stream),
   `knowledge` (embed and cosine search, `context` for RAG). Tests: `startFakeGenkit`.
4. **Two sources of kinds.** Native kinds are the platform's: listed in its `platform.toml`, implemented
   identically by every dialect of the platform. Extension kinds come in packages written by a project or by the
   community on top of one or more dialects of a platform. A dialect's own TOML never adds kinds (N0305): what a
   dialect would add goes in a package, so any other dialect can implement it.
5. **A kind package is a plugin that is not shipped with the dialect.** It is a folder `kinds/<name>/`: a
   `kind.toml` with `[package]` (name, version, platform, description), a `docs.toml`, and one folder per dialect
   it supports (`fastapi/kind.toml` with `[plugin]`, the dialect sections and the templates). A package belongs to
   exactly one platform: its kinds never appear in a project of another platform, even when the word exists there
   with another meaning (`repository` is table queries in backend and HTTP calls in mobile). A project enables it
   with `plugins(<name> = true)`, exactly like a shipped plugin, and keeps `synapsis(platform = "backend", dialect
   = "fastapi")`: the dialect is always the platform's dialect, never a child dialect that wraps it.
6. **Portability.** A package declares the dialects it implements; the Nuclear of the kind is the same in all of
   them. A project that enables a package implemented for only some dialects of its platform is tied to those
   dialects, the same exception type definitions have; a package enabled without an implementation for the
   project's dialect is N0306. A package may gain implementations later without changing its Nuclear.
7. **A kind never touches the compiler.** A package holds TOML, templates, a runtime package in the target
   language, type definitions and docs; nothing else. A kind adds no syntax: it is a header and a block of the base
   grammar, and its words are kinds, decorators, modifiers and clauses. When a template cannot express something,
   the author asks for a generic capability (an `[options]` entry or a template variable) and it is added for
   every kind; never a case for one kind or one language.
8. **Project dialects** keep their shortcuts. The kinds they add are extension kinds of that project: allowed,
   tied to the dialect they extend, not checked by the platform contract. A kind package is the portable form.
9. **Owed to kind authors:** `nuclear kind new <name>` (the skeleton), `nuclear add <source>` (installs a
   package), one `docs.toml` per package read by the editors, the missing-implementation diagnostic, the guide
   `docs/08-guides/kinds.md`; and, not delivered yet, `nuclear dialect test` over a package and installing from a
   repository with a pinned version.
10. **The editor tells kinds apart.** The loader gives every kind its source (`Dialect.kind_sources`): the
    language's (`dart`'s `data`, `mixin`), native of the platform, or an extension package (name, version, the
    dialects it implements). The language server lists, for a project, only the kinds of its platform (the native
    ones plus the packages its `config.nuc` enables) and shows each kind's source and docs; the same word may mean
    different things in two platforms, and the editor always shows the meaning of the project's platform.

## Options considered
1. Kinds inside a child dialect named in `config.nuc`: the real dialect disappears from the manifest, nothing says
   which dialects the kind exists for, and there is nothing to install.
2. A kind API in Rust or WebAssembly (a plugin computes the output): it would let a kind fake syntax and emit code
   no template reviewer reads; it moves the parser problem to the author, the opposite of the goal.
3. Letting each dialect declare extra kinds (dropping N0305): the Nuclear of a platform would drift again between
   its dialects, which ADR-synapsis-0002 forbids.
4. Packages of TOML, templates and a runtime, enabled as plugins: chosen.

## Consequences
- Positive: a project carries only the packages of the plugins it enables; a kind is shared and installed without
  a release of the compiler; the rule is part of the hard rule 11 of the root `AGENTS.md`.
- The template engine (a Mustache subset with filters) and the fixed data it receives are kept. The cost is that
  new data comes from the compiler; the benefit is that a kind can only produce code an expert reads (the golden
  rule, ADR-lang-0001). It is revisited only if the first community packages show that templates are not enough.
- Two generic emitter capabilities came with Genkit: `async_methods` also for methods that await nothing, and
  `async` in the `methods` of kind templates.
- Negative: a capability a template lacks waits for the compiler, for every kind author.

## References
- Replaces: ADR-0092, ADR-0095
