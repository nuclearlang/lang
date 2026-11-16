---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/overview.md, ../01-product/roadmap.md]
---
# Testing the VS Code extension

## What is tested

| Level | What it covers | How |
|---|---|---|
| Types | every file of `src/` and of `../tools/*/src` | `npm run compile` (`tsc -p . --noEmit` before the bundle) |
| The engines, without the editor | Nuclear Builder (retries, a run retried from a stage or a step, a run from scratch, an interrupted run recovered, a stalled call, the preflight, a hung command, the generate and analysis steps, the acceptance), the chat's templates and history, the 3B rule of the local models | `npm test` → `../tools/nuclear-builder/test/engine.test.ts` |
| The set-up | the profiles and what each says, the suggested profile, the machine file, the files that start the services on each system, the steps of a profile, the requirements on the three systems; the user's guide `installer/docs/08-guides/ai-setup.md` says of each profile what `aiSetup.json` says | `npm test` → `test/setup.test.ts` |
| The bundle | the bundled server loads every bundled dialect without the tree | `npm run server` ends with `nuclear-lsp --check-bundle` |
| The server | completion, hover, projects | `cargo test -p nuclear-lsp`, in the language project |

`npm test` bundles the two test files with esbuild (`vscode` external) into `out/test/` and runs them with
`node --test`.

## What has no test

No test opens a VS Code window: the panels, the workspace, run and debug are tried by hand, and what was never
tried is listed in the roadmaps ([this extension](../01-product/roadmap.md), each tool's).

## Trying something without the editor

- **Nuclear Builder**: `../tools/nuclear-builder/src/engine.ts` has no `vscode` import; `nuclear-builder`
  (`out/nuclear-builder.js`) drives it from a terminal.
- **The web device**: `../tools/nuclear-device-manager/src/web-session.ts` has no `vscode` import. Bundle a script that imports it with esbuild and run
  it with node against a built app.
- **A theme**: render a preview with the real tokens (the grammar and the server), or quit VS Code completely
  before looking ([theme.md](../02-architecture/theme.md)).
- **The extension itself**: open this folder in VS Code and press F5.
