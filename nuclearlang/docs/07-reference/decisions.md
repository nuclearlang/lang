# Decisions

Every decision of NuclearLang is an Architecture Decision Record kept by the project it is about, in that
project's `docs/03-adr/`, numbered from 0001 and cited with the project's key: `ADR-lang-0007`, `ADR-mobile-0002`.
An accepted decision is not edited: a new one replaces it. This page is the index of all of them.

## The whole platform (`platform`)

| ADR | Decision |
|---|---|
| [ADR-platform-0001](../../../docs/03-adr/0001-english-everywhere.md) | Everything is written in English |
| [ADR-platform-0002](../../../docs/03-adr/0002-one-repository-a-project-per-folder.md) | One repository; each project in its folder, with its own documents |
| [ADR-platform-0003](../../../docs/03-adr/0003-the-ai-loop.md) | The AI loop: a private knowledge base, local agents, one MCP server and a pipeline tool |

## The language (`lang`)

| ADR | Decision |
|---|---|
| [ADR-lang-0001](../03-adr/0001-principles.md) | One golden rule judges every proposal; Nuclear is modules and functions, not objects; the compiler writes the map of a project |
| [ADR-lang-0002](../03-adr/0002-files-and-lexical-syntax.md) | Files are `.nuc`, blocks are two spaces, words for logic and symbols for arithmetic and bits |
| [ADR-lang-0003](../03-adr/0003-functions-lambdas-and-async.md) | A function is a header plus a block, returns its last line when it declares a type, and awaits with `~` |
| [ADR-lang-0004](../03-adr/0004-variables-types-and-expressions.md) | A variable is an assignment, a block has its own scope, `if` and `match` are values, and there are no records nor `type` |
| [ADR-lang-0005](../03-adr/0005-modules.md) | A module uses its members by name, has no visibility words, is constructed by calling its PascalCase name and inherits from classes the type definitions describe |
| [ADR-lang-0006](../03-adr/0006-results.md) | Errors are values: `Result<E, T>` with the error first, propagated on its own, handled with `.ok()` / `.error()` by what the callback returns |
| [ADR-lang-0007](../03-adr/0007-dialects-and-imports.md) | The transpiler writes the imports from versioned definitions; each dialect has its own reference; a new dialect is created by an agent under written rules |
| [ADR-lang-0008](../03-adr/0008-type-definitions-and-target-packages.md) | The target's libraries are described by versioned type definitions, and any package of the target is added through Nuclear with its definitions generated |
| [ADR-lang-0009](../03-adr/0009-standard-library.md) | Nuclear has its own standard library for its base types, translated by every language dialect |
| [ADR-lang-0010](../03-adr/0010-compiler-helps-editors-and-agents.md) | Every word is documented for the editor, and the compiler corrects what an agent writes by reflex or invents |
| [ADR-lang-0011](../03-adr/0011-debugging-nuc.md) | A `.nuc` is debugged through the target's debugger with a line map, not with aligned output nor a debugger of its own |

## The python dialect (with fastapi) (`python`)

| ADR | Decision |
|---|---|
| [ADR-python-0001](../../dialects/python/docs/03-adr/0001-python-dialect-and-generic-emitter-options.md) | Python is a dialect made with the dialect system, and what it needs becomes generic emitter options |
| [ADR-python-0002](../../dialects/python/docs/03-adr/0002-fastapi-dialect.md) | The `fastapi` dialect writes the backend with FastAPI, SQLAlchemy 2 async, pydantic, LangChain and LangGraph |

## The typescript dialect (with nestjs and react) (`typescript`)

| ADR | Decision |
|---|---|
| [ADR-typescript-0001](../../dialects/typescript/docs/03-adr/0001-nestjs-dialect.md) | The `nestjs` dialect writes the backend with NestJS, Sequelize, Kafka, Redis and LangChain.js |

## The dart dialect (with flutter) (`dart`)

| ADR | Decision |
|---|---|
| [ADR-dart-0001](../../dialects/dart/docs/03-adr/0001-flutter-dialect-as-a-framework.md) | The `flutter` dialect is a framework: it generates the app over official libraries and the independent Dart package `dragonfly` |

## The framework (`synapsis`)

| ADR | Decision |
|---|---|
| [ADR-synapsis-0001](../../../nuclear-synapsis-framework/docs/03-adr/0001-the-framework-comes-with-the-language.md) | Dragonfly is Nuclear's framework: a concept independent of the target language, and a project is only `.nuc` |
| [ADR-synapsis-0002](../../../nuclear-synapsis-framework/docs/03-adr/0002-three-platforms-dialects-under-them.md) | Dragonfly has exactly three platforms; dialects are grouped under them and never show in the Nuclear code |
| [ADR-synapsis-0003](../../../nuclear-synapsis-framework/docs/03-adr/0003-components-injection-and-architecture-rules.md) | An app is closed components with layers and a facade; dependencies are injected by header; the transpiler checks the architecture |
| [ADR-synapsis-0004](../../../nuclear-synapsis-framework/docs/03-adr/0004-kinds-and-plugins-are-libraries.md) | Kinds are Nuclear's libraries: native kinds in the platform, extension kinds as packages, optional parts as plugins of `config.nuc` |
| [ADR-synapsis-0005](../../../nuclear-synapsis-framework/docs/03-adr/0005-the-services-every-app-gets.md) | Every app gets the same services from the framework: events, session, ACL, forms, translations and generic models |
| [ADR-synapsis-0006](../../../nuclear-synapsis-framework/docs/03-adr/0006-shared-contracts.md) | A backend publishes what it exposes as a contract; a client generates its models and repositories from it |

## The mobile platform (`mobile`)

| ADR | Decision |
|---|---|
| [ADR-mobile-0001](../../../nuclear-synapsis-framework/platforms/mobile/docs/03-adr/0001-project-manifest-packages-and-assets.md) | A project's manifest is `config.nuc`, it lists only third-party packages, and assets follow a convention |
| [ADR-mobile-0002](../../../nuclear-synapsis-framework/platforms/mobile/docs/03-adr/0002-screens-routes-dialogs-and-splash.md) | A screen is declared with `@screen`, navigation belongs to the views, and dialogs and the splash come from the runtime |
| [ADR-mobile-0003](../../../nuclear-synapsis-framework/platforms/mobile/docs/03-adr/0003-json-models-names-and-converters.md) | JSON is generated from the model: `@key` names a field and a `converter` reads and writes a value |
| [ADR-mobile-0004](../../../nuclear-synapsis-framework/platforms/mobile/docs/03-adr/0004-tests-in-nuclear.md) | Tests are written in Nuclear, and the build generates the standard ones |
| [ADR-mobile-0005](../../../nuclear-synapsis-framework/platforms/mobile/docs/03-adr/0005-readable-logs-by-component.md) | A log is a readable block by component, and the transpiler writes where it was called |
| [ADR-mobile-0006](../../../nuclear-synapsis-framework/platforms/mobile/docs/03-adr/0006-local-database.md) | The local database is the backend's ORM on the device: `@primary` models, `@repository(saveLocal)` and `<method>AsLocal()` |
| [ADR-mobile-0007](../../../nuclear-synapsis-framework/platforms/mobile/docs/03-adr/0007-accepted-rules-of-events-guards-forms-and-state.md) | Guards may be async, an event travels between engines as JSON, and the names of the session's events, translations, form checks and state builders are fixed |

## The backend platform (`backend`)

| ADR | Decision |
|---|---|
| [ADR-backend-0001](../../../nuclear-synapsis-framework/platforms/backend/docs/03-adr/0001-backend-data.md) | Backend data is written with one key decorator, a decorator per relation, `paginate`, `@transactional` and generated migrations |

## The web platform (`web`)

| ADR | Decision |
|---|---|
| [ADR-web-0001](../../../nuclear-synapsis-framework/platforms/web/docs/03-adr/0001-web-platform.md) | The web platform is the mobile platform in a browser, and its first dialect is `react` |

## The command line tools (`cli`)

| ADR | Decision |
|---|---|
| [ADR-cli-0001](../../../tools/cli/docs/03-adr/0001-a-projects-commands-come-from-its-dialects-data.md) | A project's commands come from its dialect's data; a dialect's own commands go under its name |
| [ADR-cli-0002](../../../tools/cli/docs/03-adr/0002-agents-learn-nuclear-from-a-brief-a-skill-and-the-compiler.md) | Agents learn Nuclear from a short brief, one skill, a project's agent files and the compiler's errors |

## The code generator (`codegen`)

| ADR | Decision |
|---|---|
| [ADR-codegen-0001](../../../tools/code_generator/docs/03-adr/0001-the-generators-write-finished-code-the-agent-only-what-is-not-standard.md) | The CLI and the MCP generate the standard code; an agent writes only what is not standard |

## The devices (`devices`)

| ADR | Decision |
|---|---|
| [ADR-devices-0001](../../../device-emulators/docs/03-adr/0001-a-device-is-the-app-as-flutter-web-in-chromium-driven-over-cdp.md) | A device is the app as Flutter web in Chromium, driven over CDP; one backend, a panel, a window and a terminal as fronts |

## The installers (`installer`)

| ADR | Decision |
|---|---|
| [ADR-installer-0001](../../../installer/docs/03-adr/0001-release-archives-and-one-line-installers.md) | A release is one archive per system, installed by a one-line installer into the user's folders |
| [ADR-installer-0002](../../../installer/docs/03-adr/0002-the-ai-services-come-with-the-installer.md) | The AI services come with the installer: a set-up in steps, a profile for the machine, the services at every login |

## The editor extensions (`extensions`)

| ADR | Decision |
|---|---|
| [ADR-extensions-0001](../../../extensions/docs/03-adr/0001-one-base-extension-per-editor.md) | One language server and one base extension per editor; a framework's tools go in an extension of that framework |
| [ADR-extensions-0002](../../../extensions/docs/03-adr/0002-the-nuclear-workspace.md) | The Nuclear workspace in the editor: projects and tools as tabs, one thing on screen, keyboard first |

## The Smart Graph (`graph`)

| ADR | Decision |
|---|---|
| [ADR-graph-0001](../../../nuclear-graph-storage/docs/03-adr/0001-a-library-of-typed-linked-versioned-rows.md) | The Smart Graph is a library of typed, linked, versioned rows |
| [ADR-graph-0002](../../../nuclear-graph-storage/docs/03-adr/0002-exact-facts-a-query-planner-and-the-graph-in-nuclear.md) | Questions with one right answer are answered from exact facts by a query planner; the Smart Graph is written in Nuclear |

## The Nuclear Developer (`developer`)

| ADR | Decision |
|---|---|
| [ADR-developer-0001](../../../nuclear-agents/nuclear_developer/docs/03-adr/0001-a-strategy-for-each-kind-of-request.md) | A strategy for each kind of request: the agent recognises what it is asked and follows the plan of that kind |
