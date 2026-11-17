---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, runtime.md]
---
# Dependencies

## Inside the tree

| Who | Depends on | How | Notes |
|---|---|---|---|
| The dialect `react` | `platform.toml` | data, merged by the loader | `platform = "web"` in its `dialect.toml` |
| A built web app | `synapsis-web` | a library | the dialect's `[toolchain] install` installs it from the installation's `packages/`, as a copy |
| The compiler and the editors | the type definitions of the runtime and of the libraries a view uses | `nuclearlang/dialects/typescript/defs/{react,react_router,vitest,testing_library_react,synapsis-web}/` | generated from `nuclearlang/tools/node/node_modules` ([runbook](../06-runbooks/change-the-runtime.md)) |
| The check | `nuclearlang/tools/node/node_modules`, the `nuclear` command (`cargo run -p nuclear-cli`) | tools | the versions the check and the type definitions are made with are those installed there (`package.json`) |
| The compiler's tests | `examples/examples-web/characters/` and `examples/expected/characters/` | a golden | `nuclearlang/crates/nuclear-transpile/tests/projects.rs` |
| A web project | a backend's contract | generated models and repositories (`contracts(...)` in `config.nuc`) | ADR-synapsis-0006; [the backend platform's guide](../../../backend/docs/08-guides/contracts.md) |
| The installer | `platform.toml`, `docs/07-reference/`, `packages/` | copied into an installation | `installer/release/stage.sh`; `installer/release/build-runtimes.sh` builds `synapsis-web` first |
| The website of NuclearLang | this platform | a Synapsis web project | `website/` of this tree |

The package names the tree as its repository (`nuclearlang/lang`, `package.json` `repository` and `bugs`).

## Outside: `synapsis-web` (`packages/synapsis-web/package.json`)

Peers the app brings:

| Library | Version | Used for |
|---|---|---|
| react, react-dom | ≥ 19 | views, hooks, rendering |
| react-router | ≥ 7 | the router behind `@screen`, `goTo`, `goBack` |
| vitest | ≥ 3 (optional) | `synapsis-web/testing` |
| @testing-library/react | ≥ 16 (optional) | `synapsis-web/testing` (`renderScreen`) |

Its own `devDependencies` build and test it: TypeScript 5.9, vitest 4, jsdom 28, React 19.3, React Router 7.18.

The type definitions in the tree are of `react@19.3.1`, `react_router@7.18.5`, `vitest@4.1.12`,
`testing_library_react@16.3.3` and `synapsis-web@0.1.0`.

## What the generated app adds

The bundler (Vite 7), the test runner (Vitest 4 with jsdom) and Testing Library are the dialect's choice, written
into the generated `package.json` by the dialect; React's own libraries that could replace pieces of the runtime
(zustand, TanStack Query, react-hook-form, zod) are an open decision ([roadmap](../01-product/roadmap.md)).
