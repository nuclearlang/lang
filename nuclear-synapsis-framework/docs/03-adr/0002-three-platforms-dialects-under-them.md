---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0002: Synapsis has exactly three platforms; dialects are grouped under them and never show in the Nuclear code

## Context and problem
Dialects were created so that each language could use its own things (ADR-lang-0007, ADR-lang-0002). With a Python
backend (ADR-python-0002) and a TypeScript backend (ADR-typescript-0001) written for the same framework, the Nuclear code of
the two examples came out different: `@get("/{id}")` against `@get(":id")`, `SQLite(url =
"sqlite+aiosqlite:///x.db")` against `SQLite(storage = "x.db")`, `len(xs)` against `xs.length`, `tests/` against
`test/`. That loses the real potential of Nuclear: anyone could build projects that make Nuclear incompatible with
itself. The differences that matter are between a web app, a mobile app and a backend, not between the languages
that run them ("of what use is the state management of Flutter in an HTTP API?").

## Decision
1. **Exactly three platforms: `web`, `mobile` and `backend`.** A platform is a specification written in Nuclear
   only: its project layout, `config.nuc`, kinds, decorators, connections, plugins, tests, errors and the standard
   library (ADR-lang-0009). It names no language. The user and the agent write the platform; nothing else.
2. **A dialect is a language and a framework that implements a platform**, grouped under it:
   - `backend`: `fastapi` (Python: FastAPI, SQLAlchemy 2 async, pydantic, LangChain, LangGraph) and `nestjs`
     (TypeScript: NestJS 12, Sequelize, class-validator, LangChain.js); later `express` and others, and Synapsis's
     own backend in Rust.
   - `mobile`: `flutter` (Dart); later `react-native`, `kotlin-multiplatform`, native Android.
   - `web`: `react` (ADR-web-0001); `vue` and `angular` planned.

   The language dialects `typescript`, `dart` and `python` stay as the layer the framework dialects extend, and as
   targets for a single `.nuc` without Synapsis.
3. **The Nuclear code of a project never changes when its dialect changes.** The one exception is code that uses a
   dialect's type definitions (ADR-lang-0008: `numpy` exists only in Python): it is allowed, and it ties that code
   to that dialect; the platform's own kinds and library never do. Kinds and features may differ between platforms,
   never between the dialects of one platform. A platform's reference, docs, examples and diagnostics name no
   dialect.
4. **A project declares both** in `config.nuc`, the only manifest of a Synapsis project (ADR-synapsis-0001,
   ADR-mobile-0001):

   ```nuclear
   synapsis(platform = "backend", dialect = "fastapi")
   app(name = "tasks_api", description = "...", version = "0.1.0")
   plugins(sqlite = true, ollama = true)
   ```

   `nuclear.toml` stays for projects of a language dialect without Synapsis. The command creates a project with
   `nuclear new -p <platform> -d <dialect> <name>` and reads `synapsis(...)` afterwards; it knows no language
   (ADR-synapsis-0001: `[toolchain]`).
5. **Folders and contract.** `nuclear-synapsis-framework/platforms/<platform>/platform.toml` is the platform's
   contract: its kinds, decorators, plugins and folders. A dialect lives under the language it is written in,
   `nuclearlang/dialects/<language>/frameworks/<dialect>/`, and names its platform in `[dialect]`. The loader
   refuses a dialect that misses a kind of its platform, or that brings a kind, a consumed decorator or a plugin
   its platform does not declare (N0305); a plugin of the platform a dialect does not bring yet is a warning. The
   loader test guards it. Kinds a dialect does not bring come as packages on top of it, never inside it
   (ADR-synapsis-0004).
6. **One reference per platform** (`platforms/<platform>/docs/07-reference/<platform>.md`), with the rules and the
   Nuclear; one per dialect (`nuclearlang/dialects/<language>/docs/07-reference/<dialect>.md`) with only how that
   dialect writes it (the equivalences `nuclearlang/tools/spec-check` verifies). `nuclear spec --dialect fastapi`
   prints the base, the language, the platform and the dialect. One brief per platform plus the dialect's notes.
7. **A platform is one folder of the framework**, `nuclear-synapsis-framework/platforms/<platform>/`, holding its
   contract, its reference and guides, its runtime packages, its examples and its checks. Its dialects and their
   type definitions are with their language, in `nuclearlang/dialects/<language>/`.
8. **The backend platform, unified** (what its two dialects had decided differently):
   - routes: `@controller("tasks")`, `@get()`, `@get("{id}")`, `@post("plan")`: segments without a leading slash,
     `{name}` placeholders bound to the parameter of that name; the dialect writes `/tasks/:id` or `/tasks/{id}`;
   - connections: `SQLite(file = "tasks.sqlite")` (`":memory:"` in tests), `Postgres(url)`, `MySQL(url)`,
     `MariaDB(url)`, each with `createTables = true` for development; `Redis(url)`, `Kafka(servers, group)`,
     `Ollama(model, baseUrl)`, `OpenAI(model)`, `Chroma(collection)`, `env("VAR", "default")`;
   - plugins: `sqlite`, `postgres`, `mysql`, `mariadb`, `redis`, `kafka`, `events`, `ai`, `openai`, `ollama`,
     `chroma` in every backend dialect;
   - tests in `test/*_test.nuc` (as the mobile platform); an invalid body answers 400 (`Invalid`) everywhere;
   - a graph state is read as `state.field` in every dialect.
9. **A conformance test per platform:** one example project per platform is built with every dialect of the
   platform from the same `.nuc` files, and each output passes its dialect's checks (`tsc --strict`, `pyright
   --strict`, tests, smoke).

## Options considered
1. Keeping one specification per dialect and asking the two backends to "stay close": nothing would guard it, and
   the two examples had already drifted in a day.
2. A `platform` field in `nuclear.toml`: a Synapsis project has only `.nuc` files (ADR-synapsis-0001).
3. Naming the dialects by language (`python`, `typescript`): `express` is TypeScript too; the framework is what a
   dialect is.
4. Three platforms as contracts, with the dialects grouped under them: chosen.

## Consequences
- Positive: the same project builds as a Python service or as a TypeScript service; an agent learns a platform
  once; the rule is the hard rule 11 of the root `AGENTS.md`.
- Positive: `Manifest` carries `platform`, read from `synapsis(...)` in `config.nuc`, so every tool knows what a
  project is without knowing its language.
- Negative: a kind, a decorator or a plugin exists in a platform only when it is in the contract, and a kind only
  when every dialect of the platform implements it.
- "The library is the target's" (ADR-lang-0002) is reversed for the base types by ADR-lang-0009: the standard library
  is Nuclear's own and every dialect translates it.

## References
- Replaces: ADR-0093
