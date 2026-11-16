---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [contract.md, ../05-standards/testing.md, ../../../docs/02-architecture/overview.md, ../../../docs/03-adr/0002-three-platforms-dialects-under-them.md]
---
# What a platform is

Paths without a root are relative to `nuclear-synapsis-framework/platforms/`; a path that starts with
`nuclearlang/`, `installer/` or `.github/` starts at the root of the tree.

A platform is a specification written in Nuclear only: the project layout, `config.nuc`, the kinds, the
decorators, the connections, the plugins, the tests and the errors of one kind of software. It names no language.
It is what the user and the agent write; a dialect is only the language and framework the code comes out in, and
the Nuclear code of a project never changes when its dialect changes (ADR-synapsis-0002). There are exactly three.

| Platform | What it is | Default dialect | Dialects (in `nuclearlang/dialects/`) | Runtime packages (`<platform>/packages/`) |
|---|---|---|---|---|
| [`mobile`](../../mobile/AGENTS.md) | apps for Android, iOS, desktop and web through one UI toolkit | `flutter` | `dart/frameworks/flutter` | `synapsis`, `synapsis_genkit` (Dart) |
| [`backend`](../../backend/AGENTS.md) | HTTP APIs, data, events and AI agents | `fastapi` | `python/frameworks/fastapi`, `typescript/frameworks/nestjs` | `synapsis-py` (Python), `synapsis-nest` (TypeScript) |
| [`web`](../../web/AGENTS.md) | web apps in the browser through one UI library | `react` | `typescript/frameworks/react` | `synapsis-web` (TypeScript) |

Kinds and features may differ between platforms (`stateless` is mobile and web, `controller` is backend), never
between the dialects of one platform. The same word may mean different things in two platforms: `repository` is
table queries in backend and HTTP calls in mobile. The web platform takes the kinds of the mobile platform that
make sense in a browser, with the same words, so an app's domain reads the same on a phone and on the web
(ADR-web-0001).

## What a platform folder holds

```
<platform>/
├── platform.toml     the contract every dialect of the platform implements (contract.md)
├── packages/         the runtime packages: what the target frameworks lack, in the target languages
├── examples/         projects in Nuclear, and expected/ with their golden output
├── checks/           scripts that run the generated code against the target's own tools
├── kinds/            kind packages shipped with the platform (optional; none today)
├── docs/             its documents; 07-reference/ is the normative text, 08-guides/ what a user reads
└── AGENTS.md, CLAUDE.md, README.md, CHANGELOG.md
```

What is **not** here: the dialects that implement the platform and the type definitions of its runtime packages,
which live with their language (`nuclearlang/dialects/<language>/frameworks/<dialect>/`,
`nuclearlang/dialects/<language>/defs/<package>/<version>/`), and what `nuclear make` and `nuclear gen` write, which
is the code generator's (`tools/code_generator/platforms/<platform>/generators.toml`).

- **Runtime packages.** One per target language of the platform's dialects, plus those of its plugins. A generated
  project gets them by itself; a project never lists them in `config.nuc`. A change to the public API of a runtime
  package means regenerating its type definitions (the platform's own documents say how).
- **Examples.** Each platform has the complete projects its tests build; `examples/expected/<project>/` is the
  golden output, compared by `cargo test` and accepted with `UPDATE_GOLDEN=1 cargo test`.
- **Checks.** What `cargo test` cannot do: the target's analyzer, the target's test runner and a live run of the
  generated project ([testing.md](../05-standards/testing.md)).
- **Reference.** `docs/07-reference/<platform>.md` is the platform's rules in Nuclear only, and
  `docs/07-reference/brief/<platform>.md` the short sheet an agent reads. How a dialect writes each kind is in that
  dialect's reference, `nuclearlang/dialects/<language>/docs/07-reference/<dialect>.md`.

## In an install

`installer/release/stage.sh` copies, for each platform: `platform.toml`, `docs/07-reference/` and `docs/08-guides/`
into `$NUCLEAR_HOME/platforms/<platform>/`, every folder of `packages/` into `$NUCLEAR_HOME/packages/`, and
`kinds/` into `$NUCLEAR_HOME/kinds/`. A built JavaScript package must have its `dist/` or the staging stops. What a
build or a test leaves inside a package (`build`, `node_modules`, `__pycache__`...) is never copied.

The loader finds the contracts in its platform folders (`Loader.platform_paths`): the `platforms/` of the install
and, while the source tree is on disk, `nuclear-synapsis-framework/platforms/` (`nuclear_dialect::Home`).
The generators of each platform are not in a platform folder: the install has them in `$NUCLEAR_HOME/generators/`,
copied from `tools/code_generator/platforms/` (`Home.generators`, `Loader::generators_file`).
