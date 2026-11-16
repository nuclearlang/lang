# The web platform

The web platform of Synapsis: apps that run in the browser, written in Nuclear with the same words as the mobile
platform. This folder holds what is the same for every dialect: the contract (`platform.toml`), the runtime package
the generated app runs on, the example and the check. The Nuclear of a web project never changes when its dialect
changes.

Paths in these documents are relative to this folder (`nuclear-synapsis-framework/platforms/web/`); a path that
starts with `nuclearlang/`, `nuclear-synapsis-framework/`, `tools/`, `installer/` or `.github/` starts at the root
of the tree. The rules of the whole platform are in [the root `AGENTS.md`](../../../AGENTS.md).

## Stack

- The contract: `platform.toml`, TOML read by the compiler's loader (`nuclearlang/crates/nuclear-dialect`).
- The one dialect that implements it today, documented by the TypeScript dialect project: `react` (React 19 without
  JSX, React Router 7, Vite 7, Vitest 4 + jsdom + Testing Library).
- The runtime: `packages/synapsis-web` (npm, ESM, TypeScript 5.9; peers `react`, `react-dom`, `react-router`).
- The check: an `sh` script over `nuclearlang/tools/node` (tsc, vitest, vite). CI:
  `.github/workflows/platform-web.yml`.

## Commands

From the root of the tree:

```sh
# once
(cd nuclearlang/tools/node && npm install)                     # the shared Node tools of the check
(cd nuclear-synapsis-framework/platforms/web/packages/synapsis-web && npm install)

# before a change is done
cargo test                                   # the example, its golden
sh nuclear-synapsis-framework/platforms/web/checks/react-check/check.sh   # tsc --strict, the tests, vite build, the runtime's tests
UPDATE_GOLDEN=1 cargo test                   # the generated output changed on purpose: regenerate, review the diff
installer/install.sh                         # the user runs the installed copy: install after a change

# the runtime alone, in packages/synapsis-web
npx tsc -p tsconfig.json && npx vitest run
```

## Folders

- `platform.toml`: the contract: kinds, decorators, `[layout]`. What `nuclear make` and `gen` write
  (`[skeletons]`, `[gen]`, `[[generators.*]]`) is `tools/code_generator/platforms/web/generators.toml`.
- `packages/synapsis-web/`: the runtime (`src/`, `test/runtime.test.ts`).
- `examples/examples-web/characters/`: the complete example (list and detail screens, state, events, a guard,
  tests).
- `examples/expected/characters/`: its golden output.
- `checks/react-check/check.sh`: the check.
- `docs/`: this project's documents (the table below). `CHANGELOG.md`: what changed for a user.

Outside this folder: the dialect (`nuclearlang/dialects/typescript/frameworks/react/`) and the type definitions
(`nuclearlang/dialects/typescript/defs/{react,react_router,vitest,testing_library_react,synapsis-web}/`).

## Rules

1. **The web platform is the mobile platform in a browser.** A kind that exists on both has the same word and the
   same rules; a kind is added here with the mobile platform's word, never a new one
   ([ADR-web-0001](docs/03-adr/0001-web-platform.md)).
2. **The platform names no dialect.** `docs/07-reference/web.md`, the brief, `platform.toml` and the `.nuc` of the
   example hold only Nuclear and Nuclear's own library. How React writes a kind is in the dialect's reference.
3. **`platform.toml` is the contract.** A kind or a decorator a dialect uses is listed there, or the loader refuses
   the dialect (N0305).
4. **No JSX.** A view returns elements made with the runtime's HTML functions; the parser does not change for a
   dialect.
5. **A changed public API of the runtime** means its type definitions are regenerated
   ([runbook](docs/06-runbooks/change-the-runtime.md)).
6. **The example is a golden.** Output that changed on purpose: `UPDATE_GOLDEN=1 cargo test`, then review the diff.
7. **A file's name in `docs/07-reference/` is its topic**: `nuclear help web` and `nuclear spec --brief` find them
   by name, and the installer copies the folder with `platform.toml` and `packages/`. They are normative: changed
   only with the feature they describe.
8. Done = `cargo test`, `cargo clippy --all-targets` and the check green, the reference and these documents
   updated in the same change, `docs/01-product/roadmap.md` current.

## Documents

| Read | When |
|---|---|
| [docs/00-context/vision.md](docs/00-context/vision.md) | You need what the platform is for, how it relates to mobile and what it does not do |
| [docs/00-context/glossary.md](docs/00-context/glossary.md) | A word has two meanings here (component, view, screen, contract) |
| [docs/01-product/roadmap.md](docs/01-product/roadmap.md) | You look for what is half done, untested or pending in the platform and its runtime |
| [docs/02-architecture/overview.md](docs/02-architecture/overview.md) | You need the shape: how a project becomes an app, each section of `platform.toml`, the dialect, the example, what the command reads here |
| [docs/02-architecture/runtime.md](docs/02-architecture/runtime.md) | You change `packages/synapsis-web` (views, state, http, session, router, tests) |
| [docs/02-architecture/dependencies.md](docs/02-architecture/dependencies.md) | You add or move a library of the runtime, or need who depends on this folder |
| [docs/03-adr/README.md](docs/03-adr/README.md) | You need why the platform copies mobile, why React without JSX, or what React's libraries could replace |
| [docs/05-standards/testing.md](docs/05-standards/testing.md) | You run or change the check, the golden or a runtime test |
| [docs/06-runbooks/change-the-runtime.md](docs/06-runbooks/change-the-runtime.md) | You changed the runtime and need the steps after it |
| [docs/07-reference/web.md](docs/07-reference/web.md) | You need the rules of the platform: the project, every kind, the architecture rules (`nuclear help web`) |
| [docs/07-reference/brief/web.md](docs/07-reference/brief/web.md) | You want the short sheet an agent reads before writing a web app |

Elsewhere:

- How the `react` dialect writes the platform: [the TypeScript dialect](../../../nuclearlang/dialects/typescript/AGENTS.md)
  (`docs/07-reference/react.md`, its brief, `docs/08-guides/react.md`).
- The same words on a phone: [the mobile platform](../mobile/AGENTS.md). The backend an app talks to and the
  contract it is generated from: [the backend platform](../backend/AGENTS.md).
- What the three platforms share (the format of `platform.toml`, what the loader checks, the common tests):
  [the platforms](../AGENTS.md). The philosophy: [the framework](../../AGENTS.md). The commands (`nuclear new -p
  web`, `build`, `run`, `test`): [the command line tools](../../../tools/cli/AGENTS.md). `nuclear make` and `gen`:
  [the code generator](../../../tools/code_generator/AGENTS.md).
- The compiler, the loader and the format of a dialect and of a project: [the language](../../../nuclearlang/AGENTS.md).
