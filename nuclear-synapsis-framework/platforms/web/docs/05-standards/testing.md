---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../06-runbooks/change-the-runtime.md, ../02-architecture/overview.md, ../../../docs/05-standards/testing.md]
---
# Testing

The tests every platform shares (the contract, the layout, the generators, what a golden is) are in
[testing a platform](../../../docs/05-standards/testing.md). Here: what this platform adds. With one dialect the web
platform has no conformance test yet: it gets one with its second dialect.

## What is tested at each level

| Level | What it covers | Run by |
|---|---|---|
| The compiler's tests | `examples/examples-web/characters/` built and compared with its golden `examples/expected/characters/` (`nuclearlang/crates/nuclear-transpile/tests/projects.rs`) | `cargo test` at the root of the tree |
| The runtime's tests | `packages/dragonfly-web/test/runtime.test.ts`: 7 vitest tests in jsdom (repository, cache, mocks, states, views, events) | the check; `npx vitest run` in the package |
| The check | the runtime built; the example built; `tsc --strict`, the example's own tests and a production bundle of the generated app; the runtime's tests | `checks/react-check/check.sh` |
| The reference's equivalences | the `react` reference against the real output (the TypeScript dialect's project owns it) | `nuclearlang/tools/spec-check/check.py` |

## Set up, once

From the root of the tree:

```sh
(cd nuclearlang/tools/node && npm install)
(cd nuclear-synapsis-framework/platforms/web/packages/dragonfly-web && npm install)
```

## Running the check

```sh
cargo test
sh nuclear-synapsis-framework/platforms/web/checks/react-check/check.sh
```

The script finds the tree from its own place (`NUCLEAR_ROOT` overrides it) and stops at the first failure. In
order:

1. Builds the runtime with `tsc` and copies it fresh into `nuclearlang/tools/node/node_modules`
   (`npm install --no-save --install-links`). npm keeps an old copy of the same version, so the script removes it
   first; a `--no-save` install also prunes the other runtime installed the same way, so the backend platform's
   nestjs check installs its own again.
2. Builds `examples/examples-web/characters` (`cargo run -p nuclear-cli -- build`) and links `node_modules` into
   its `build/app`.
3. `tsc --strict` over the generated app.
4. The example's own tests with vitest in jsdom (4 tests, written in Nuclear in `test/characters_test.nuc`).
5. `vite build`: a production bundle.
6. The runtime's tests, in `packages/dragonfly-web`.

## Conventions

- **The tests of a project are written in Nuclear** (`tests` in `test/`): the app starts with its real config and
  every request answers what the test prepares; a class is a mock with `@mock`. The words are the mobile
  platform's (`@test`, `@states`, `@widget`).
- **The golden.** When the generated output changes on purpose: `UPDATE_GOLDEN=1 cargo test`, then review the diff.
- **No browser.** The check ends at jsdom and a bundle; the app in a real browser is in the
  [roadmap](../01-product/roadmap.md) as untested.

## CI

`.github/workflows/platform-web.yml`, on a change to `nuclearlang/**`, `tools/cli/**`, the Cargo files or this
folder: Node 26; `npm ci` in `nuclearlang/tools/node` and `installer/release/build-runtimes.sh`; the equivalences of
the `react` reference; then the check.
