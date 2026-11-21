---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [../02-architecture/overview.md, ../01-product/roadmap.md]
---
# Testing the VS Code extension

## What is tested

| Level | What it covers | How |
|---|---|---|
| Types | every file of `src/` and of `../tools/*/src` | `npm run compile` (`tsc -p . --noEmit` before the bundle) |
| The editors' side, without the editor | the money's two confirmations, the moved settings, the teams through `nuclear-builder team`, a Builder run as a process (its question as an `ask`, the answer on stdin, exit 3 when nobody answers) against a stub command, the retries, the tools' `PATH`, the connections, Nuclear Atlas's templates, the 3B rule of the local models, every host text in Spanish, the language (`nuclear.language`: the setting, the editor, the system, the default), `l10n.t` (the Spanish bundle, the English fallback), every page dictionary's Spanish, the globe in every page's header | `npm test` → `../tools/nuclear-builder/test/editors.test.ts` (`vscode` stubbed by `test/vscode-stub.ts`) |
| The onboarding resumed (spec 022) | the steps only go forward; a saved step resumed (after *This window*'s reload, a closed editor, a new window), `services` until the set-up is finished or declined; the first run; 0.84.0's flag resumed once when nothing says it was finished (fixture `global-state-0.84.0-onboarding.json`); a marker's apps; Atlas's chat root without a project (`chatRoots`) | `npm test` → `test/onboarding.test.ts` |
| The Nuclear workspaces (spec 022) | `nuclear workspace … --json` parsed (the last JSON line, `null`, `{error}`, an older `nuclear`'s usage), the recent list (first, once, at most 10, only those still there), the projects opened by hand kept per folder until 0.83 joining the global list (fixtures `global-state-0.62.json`, `workspace-state-0.83.json`), the empty panel's reason, the dialects of a platform, an open workspace showing its apps only (no scan, no project opened by hand, none before it is known), a failed reading keeping the workspace while its marker is there | `npm test` → `test/workspaces.test.ts` |
| Spanish everywhere | every key of `package.nls.json` in `package.nls.es.json`; every `l10n.t('…')` literal of `src/` and `../tools/*/src` (and the backend scripts' details) in `l10n/bundle.l10n.es.json`; every page dictionary's `es` with every key of its `en` (nested ones too), and no file with a dictionary left out of the test | `npm test` → `test/l10n.test.ts` |
| No local models (ADR-platform-0013) | no contributed setting (its id, its texts in English and Spanish) nor the Settings and integrations page names Ollama, a local model or profile, the Nuclear Developer or `contextTokens`; the Smart Graph's settings stay | `npm test` → `test/no-local.test.ts`; the old values in `../tools/nuclear-builder/test/compat.test.ts` |
| The toolchains | the variables the settings give `nuclear` (a Flutter executable or SDK root, the included Python by default, the user's own variables kept), where each is found (setting → variable → NuclearLang's own → PATH, Windows' extensions), `nuclear doctor --json` and an older CLI without it | `npm test` → `test/toolchains.test.ts`; the welcome's step and the settings' section by hand in a headless browser |
| The notifications' rules | what pops up for each `nuclear.notifications`, a notice seen by its tool or place, a repeat folded, the badges, which chat events call the user (direct messages, `@you`, questions, an answer's end; never the user's own, `system`, an edit, a run's progress or question) | `npm test` → `test/notify.test.ts`; the strip and the Builder's page by hand in a headless browser |
| Nuclear Chat's host | the relay of the pages' frames (ids apart, the token added, one subscription per topic), the host file → the registration, a run's posts and buttons, a spec draft's difference, the connection against a fake socket (registered again and caught up after a reconnection; a service down answered 503 with how to fix it) | `npm test` → `test/chat.test.ts`; against the real service, by hand from Node (spec 013 T3.2's check) |
| HTTP Connections' WebSockets | the contract's WebSocket fields read tolerantly, the tree's `WS` badges and events, the ws:// urls of an environment, the urls and `{{var}}`, the message log and history (also from their source, as the page runs them), the page's script, a real socket against an echo server (the guard's header sent, no `Origin`) | `npm test` → `../tools/nuclear-http-connections/test/sockets.test.ts` (its own stub, `test/vscode-stub.ts`) |
| The Builder's engine | the stations, the gates, the checks, the money, the delivery, the safety | Nuclear's tests: `../tools/nuclear-builder/tests/test_factory.nuc` and the others there (pytest, in its `build/`) |
| The set-up | the profiles and what each says, the suggested profile, the machine file, the files that start the services on each system, the steps of a profile, the requirements on the three systems, the ports, the AI archive's launchers; the user's guide `installer/docs/08-guides/ai-setup.md` says of each profile what `setup.json` says | Nuclear's tests: `../tools/nuclear-builder/tests/test_setup.nuc` (pytest, in its `build/`) |
| The bundle | the bundled server loads every bundled dialect without the tree | `npm run server` ends with `nuclear-lsp --check-bundle` |
| The server | completion, hover, projects | `cargo test -p nuclear-lsp`, in the language project |

`npm test` (the `test` script of `package.json`, whose version is the extensions' one: 0.53.1) bundles the test file with esbuild (`vscode` aliased to the stub) into `out/test/` and runs it with
`node --test`.

## What has no test

No test opens a VS Code window: the panels, the workspace, run and debug are tried by hand, and what was never
tried is listed in the roadmaps ([this extension](../01-product/roadmap.md), each tool's).

## Trying something without the editor

- **Nuclear Builder**: `nuclear-builder run <spec> --events` in a terminal is what the page runs; `../tools/nuclear-builder/src/runs.ts`
  has no `vscode` import, so a script bundled with esbuild drives a run the way the page does.
- **The web device**: `../tools/nuclear-device-manager/src/web-session.ts` has no `vscode` import. Bundle a script that imports it with esbuild and run
  it with node against a built app.
- **A theme**: render a preview with the real tokens (the grammar and the server), or quit VS Code completely
  before looking ([theme.md](../02-architecture/theme.md)).
- **The extension itself**: open this folder in VS Code and press F5.
