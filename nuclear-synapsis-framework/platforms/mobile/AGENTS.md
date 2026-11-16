# The mobile platform of Synapsis

Apps for Android, iOS, desktop and web through one UI toolkit, written once in Nuclear by the user and the agent.
This project holds what is the same for every dialect of the platform: its contract (`platform.toml`: kinds,
decorators, plugins, layout), its runtime packages (`synapsis`, `synapsis_genkit`), its examples and
its checks. ADR key: `mobile`.

Its only dialect today is `flutter`. It lives in `nuclearlang/dialects/dart/frameworks/flutter/` and is documented
by the [`dart` dialect project](../../../nuclearlang/dialects/dart/AGENTS.md): how the code comes out is read there,
never here. What the three platforms share (what a contract is, what the loader checks) is
[`platforms/`](../AGENTS.md); the framework is [`nuclear-synapsis-framework/`](../../AGENTS.md); the rules of the
whole tree are the root [`AGENTS.md`](../../../AGENTS.md).

## Stack

- Contract: TOML (`platform.toml`), read by the compiler's loader (`nuclearlang/crates/nuclear-dialect`).
- Runtime: two packages for Flutter in Dart, `packages/synapsis` 0.1.0 and `packages/synapsis_genkit` 0.1.0
  (Dart SDK `^3.12.0`, Flutter `>=3.44.0`).
- Examples: Nuclear projects and single files with their expected output.
- Checks: one bash script, one Python script. CI: `.github/workflows/platform-mobile.yml`.

## Commands

From the root of the tree:

```sh
cargo test                           # builds the examples, compares the goldens
UPDATE_GOLDEN=1 cargo test           # rewrites the goldens after a wanted change; review the diff
python3 nuclear-synapsis-framework/platforms/mobile/checks/spec-check-synapsis.py         # the 27 Synapsis examples of the flutter reference
python3 nuclear-synapsis-framework/platforms/mobile/checks/spec-check-synapsis.py --fix   # rewrites them from the example project
FLUTTER=<sdk>/bin/flutter nuclear-synapsis-framework/platforms/mobile/checks/analyze-flutter.sh [file.nuc...]   # single-file examples through `flutter analyze`
```

From this folder:

```sh
(cd packages/synapsis && flutter pub get && flutter test && flutter analyze)    # the runtime: 64 tests
(cd examples/examples-flutter-dialect/tasks_app && nuclear build && nuclear test)
```

The last one needs the installed `nuclear` (`installer/install.sh`) and the backend example built
(`nuclear build nuclear-synapsis-framework/platforms/backend/examples/examples-backend/tasks_api`). What each check
covers: [docs/05-standards/testing.md](docs/05-standards/testing.md).

## Folders

- `platform.toml`: the contract of the platform. What `nuclear gen` writes is
  `tools/code_generator/platforms/mobile/generators.toml`.
- `packages/synapsis/`: the runtime of an app (http, local database, events, session, ACL, network, routes, logs,
  forms, dialogs, translations, splash, test helpers).
- `packages/synapsis_genkit/`: the runtime of the `genkit` plugin (AI).
- `examples/examples-flutter-dialect/`: the example projects (`clean-flutter-project`, `genkit-assistant`,
  `tasks_app`) and four single-file examples; `examples/onboarding/todos_app/`: the app of the onboarding, made only
  by `nuclear new` and `nuclear gen` (the website runs those commands again); `examples/expected/`: the goldens.
- `checks/`: `analyze-flutter.sh`, `spec-check-synapsis.py`.
- `docs/`: the context documentation (the table below).

## Rules of this project

- **The platform is Nuclear only.** Where a document describes what a project writes it names no dialect and no
  target language; a project's Nuclear never changes between the dialects of the platform (root rule 11).
- **The contract comes first.** A kind, a decorator or a plugin exists when `platform.toml` lists it; the loader
  refuses a dialect that leaves the list. A new one is added here, then in every dialect.
- **Data, not code.** The platform adds kinds and decorators only as data; language rules come from the base. A
  generic mechanism belongs in the compiler; nothing specific to this platform or to its toolkit ever does.
- **The runtime works on web**: no `dart:isolate` nor `dart:io` without a `kIsWeb` guard.
- **Never edit by hand**: `docs/07-reference/` and `docs/08-guides/` without their tools (they are checked and
  embedded in binaries), the Synapsis blocks of the flutter reference (`--fix` writes them), `examples/expected/`
  (`UPDATE_GOLDEN=1`), any `build/` folder.
- A change of the public API of a runtime package regenerates its type definitions
  ([docs/06-runbooks/runtime-release.md](docs/06-runbooks/runtime-release.md)).
- English everywhere. A change the user can see updates its documents in the same change. A decision is a new ADR
  in `docs/03-adr/`; pending work is `docs/01-product/roadmap.md` and nowhere else.
- What cannot be read from the code or the documents is asked, never invented.
- Roles the user asked for when working here: Flutter architect, Flutter and native optimizer, transpiler
  architect, framework architect.

## Documents (open only the one the task needs)

| Read when | Document |
|---|---|
| You need what the platform is for and what it leaves out | [docs/00-context/vision.md](docs/00-context/vision.md) |
| A word of the platform is unclear (kind, facade, twin, golden...) | [docs/00-context/glossary.md](docs/00-context/glossary.md) |
| You look for what is untested, pending or waiting for the user | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| You need the parts of the project, the contract's sections, the examples or the CI | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| You touch a library, a version, the type definitions or who uses this project | [docs/02-architecture/dependencies.md](docs/02-architecture/dependencies.md) |
| You work on a project's layout, `config.nuc`, assets, kind by folder or the architecture rules | [docs/02-architecture/project.md](docs/02-architecture/project.md) |
| You need what a kind or a decorator does | [docs/02-architecture/kinds.md](docs/02-architecture/kinds.md) |
| You change or use a service of the `synapsis` package, or the `genkit` runtime | [docs/02-architecture/runtime.md](docs/02-architecture/runtime.md) |
| You touch `@primary`, `saveLocal`, `<method>AsLocal()` or the local tables | [docs/02-architecture/local-database.md](docs/02-architecture/local-database.md) |
| You ask why something is the way it is | [docs/03-adr/README.md](docs/03-adr/README.md) |
| You change this project: conventions of the contract, the runtime and the docs | [docs/05-standards/coding.md](docs/05-standards/coding.md) |
| You run or add a check, a golden or a test | [docs/05-standards/testing.md](docs/05-standards/testing.md) |
| You add networking, storage, logging, events or tokens, or review for security and performance | [docs/05-standards/security.md](docs/05-standards/security.md) |
| You changed the runtime's public API, an example's output, or publish a package | [docs/06-runbooks/runtime-release.md](docs/06-runbooks/runtime-release.md) |
| You need the platform's normative rules (project, kinds, architecture, generators) | [docs/07-reference/mobile.md](docs/07-reference/mobile.md) |
| You need the API of the `synapsis` package | [docs/07-reference/synapsis.md](docs/07-reference/synapsis.md) |
| You need the short sheet an agent gets to write an app | [docs/07-reference/brief/mobile.md](docs/07-reference/brief/mobile.md) |
| You use Genkit in an app | [docs/08-guides/genkit.md](docs/08-guides/genkit.md) |
| You need the first steps of a user: a todos app in four commands | [docs/08-guides/onboarding-mobile.md](docs/08-guides/onboarding-mobile.md) |
| You need how a kind is written in the target, the generated files, the CLI or the editors | [the flutter reference](../../../nuclearlang/dialects/dart/docs/07-reference/flutter.md) |
