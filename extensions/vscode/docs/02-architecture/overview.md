---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [client.md, debugging.md, workspace.md, ai-services.md, theme.md, ../../../docs/02-architecture/overview.md]
---
# The VS Code extension: its files

One bundle, `out/extension.js` (entry `src/extension.ts`), and the Builder's diagram bundled apart for its page
(`out/builder-flow.js` and `.css`, entry `../tools/nuclear-builder/src/flow.tsx`); the Builder's runs are processes of
`nuclear-builder` (Nuclear), not code of the bundle. It activates on a `.nuc` file, on a workspace that contains one, and when startup
finishes (`onStartupFinished`).

## `src/`

| File | What it is | Document |
|---|---|---|
| `extension.ts` | the client of `nuclear-lsp`, the status bar, the generated-code view, Synapsis projects: run, debug, save, repair | [client.md](client.md) |
| `card.ts` | the project card `.nuclear/project.json` (`readCard`, `projectCard`, `appDir`, `isInstalled`) | [client.md](client.md) |
| `debug.ts` | debugging a `.nuc` under each dialect's debugger | [debugging.md](debugging.md) |
| `workspace.ts` | the Nuclear workspace: the strip, the pane, the tabs, the actions, the welcome page | [workspace.md](workspace.md) |
| `workspaces.ts` | the Nuclear workspaces (spec 022): `nuclear workspace … --json` and its JSON, the recent list, the projects opened by hand of before 0.84 moved to the global list, the empty panel's reason, the dialects of a platform; no `vscode` import | [workspace.md](workspace.md) |
| `onboarding.ts` | the onboarding's progress (the workspace, its apps, the tour, the AI services), resumed after a reload or a closed editor, 0.84.0's flag migrated; no `vscode` import | [workspace.md](workspace.md) |
| `savedProjects.ts` | the projects saved for every folder before 0.63.0, kept for `npm run test:compat` | [workspace.md](workspace.md) |
| `treeMenu.ts` | the right-click menu of the workspace's file tree | [workspace.md](workspace.md) |
| `snapshot.ts`, `snapshotCheck.ts` | one release, one snapshot (ADR-platform-0011): at start, this extension's version against the installation's `.version` and `ai/.version`, and the offer that brings them together (`nuclear update`, or the installed release's extension); the comparison tested in `test/snapshot.test.ts` | [the guide](../08-guides/README.md) |
| `scripts.ts`, `backendScripts.ts` | a backend project's scripts, like npm's: the task provider (type `nuclear`) and the explorer's *Nuclear Scripts* view; the list (`backendScripts`, tested in `test/scripts.test.ts`) | [run-and-debug](../08-guides/run-and-debug.md) |
| `notifications.ts` | the one notification system: the notices of what the local agents did, the pop-ups, the chat's notices, *Open* | [ai-services.md](ai-services.md) |
| `notify.ts` | its rules, no `vscode` import: what pops up per `nuclear.notifications`, seen, folded, the badges, which chat events call the user | [ai-services.md](ai-services.md) |
| `aiMachine.ts`, `setupPanel.ts`, `setupL10n.ts` | the welcome (the first-run onboarding over every setting): the machine, `nuclear-builder setup` run as a process, the toolchains, the providers, the team, the spending, each tool's settings | [ai-services.md](ai-services.md) |
| `toolchains.ts`, `toolchainHost.ts` | the platforms' toolchains: the settings into the environment of every process and terminal, where each is found, the cards of the welcome and the settings page | [ai-services.md](ai-services.md) |
| `settingsPanel.ts`, `settingsL10n.ts`, `settingsForm.ts`, `aiSettings.ts` | the *Settings and integrations* tool, one section per tool; a section's settings drawn as a form from what `package.json` contributes; the `nuclear.ai.*` settings | [ai-services.md](ai-services.md) |
| `spending.ts` | the `nuclear.spending.*` settings and the two confirmations before money is spent (only for an API's work, unless forced) | [ai-services.md](ai-services.md) |
| `assets.ts`, `assetsPage.ts` | the pages' bundled files, local first (spec 023): a page's URL of `out/chat-embed.js`, `out/builder-flow.*` or an icon from the extension's folder, else from the copy kept in `<globalStorage>/assets/<version>/` (that folder added to the page's roots, beside the extension's); a file in neither (a broken install) is said and taken once from this version's release (`nuclearlang-<version>.vsix` of `github.com/nuclearlang/nuclearlang`), checked against its `.sha256` (else its announced size and its `extension/package.json` version), only the pages' files extracted; then *Reload Window*. No `vscode` import in `assets.ts` (`test/assets.test.ts`, which also scans every page's sources and bundles for a URL of the internet they would load) | [overview.md](overview.md) |
| `migrateSettings.ts` | the settings that moved to their tool's section, copied at every level, the old id removed only once the new one holds the value | [ai-services.md](ai-services.md) |
| `language.ts`, `i18n.ts`, `workspaceL10n.ts`, `welcomeL10n.ts` | the language of what the extension shows (`nuclear.language`: automatic, English or Spanish), the globe, the host's `l10n.t`, the pages' dictionaries | [ai-services.md](ai-services.md) |
| `connections.ts` | every external connection, checked | [ai-services.md](ai-services.md) |

## The tools it bundles

Their code is in `../tools/<tool>/src/` (compiled by this folder's `tsconfig.json`, bundled into
`out/extension.js`); each is documented in its own folder:
[Nuclear Builder](../../../tools/nuclear-builder/AGENTS.md),
[HTTP Connections](../../../tools/nuclear-http-connections/AGENTS.md),
[Nuclear Atlas](../../../tools/nuclear-atlas/AGENTS.md),
[the devices](../../../tools/nuclear-device-manager/AGENTS.md). Nuclear Chat's host, shared by the Builder and Atlas,
is here: `src/chatHost.ts` and `src/chatView.ts` ([ai-services.md](ai-services.md), "Nuclear Chat").

## What `package.json` contributes

- Its `repository` is the tree, `nuclearlang/nuclearlang`, directory `extensions/vscode`; `bugs` its issues.

- The language `nuclear` (`.nuc`), its grammars, the semantic token modifiers and scopes.
- The themes (Chernobyl, Chernobyl Soft) and the icon themes (Chernobyl Icons, Chernobyl Soft Icons).
- One activity bar container, `nuclear`, with one webview view, `nuclear.workspace`; the view `nuclear.callStack`
  (*Nuclear Call Stack*) in the debug container while paused in a `.nuc`.
- The debugger type `synapsis` (F5 without `launch.json`) and breakpoints in `.nuc` files.
- The commands (category **Nuclear**), the `editor/title` buttons of each platform, the `webview/context` menu of
  the file tree, the keybindings.
- The colors `nuclearHttpConnections.*`.
- The settings, one section per tool (`contributes.configuration`, each with its `id`): the language and editor
  (`nuclear.dialect`, `nuclear.dialectPaths`, `nuclear.server.path`, `nuclear.trace.server`, `nuclear.buildOnSave`,
  `nuclear.workspace.welcome`, `nuclear.debug.*`), the AI services `nuclear.ai.*` (among them `nuclear.ai.mcpCommand`,
  default `nuclear-mcp`, and `nuclear.ai.graphCommand`, default `nuclear-graph`), Nuclear Builder
  `nuclear.builder.*`, the spending `nuclear.spending.*` (`budgetUsd` 5, `confirm` on, `forceConfirm` off), Nuclear
  Chat `nuclear.chat.gifs` (`pack`), Nuclear Atlas `nuclear.atlas.*`, HTTP Connections `nuclear.http.*`, the devices `nuclear.devices.*`, and the generated
  `nuclear.codemetrics.*`. Each tool reads its own through the `settings.ts` of its folder.
- Every text is a `%key%` of `package.nls.json` (English) and `package.nls.es.json` (Spanish); the host's texts are
  `l10n.t` of `i18n.ts` with `l10n/bundle.l10n.es.json`, in the language of `nuclear.language`.

## Other files

- `syntaxes/nuclear.tmLanguage.json`: the TextMate grammar, also used by JetBrains and copied by the website.
- `syntaxes/nuclear-example.tmLanguage.json`: GENERATED (the `comment.example.` scopes for the code of an
  `@example`).
- `language-configuration.json`: comments, pairs, `offSide` folding, `onEnterRules` for ` * `.
- `scripts/bundle-server.mjs`: what the extension ships besides its code
  ([the bundle](../../../docs/02-architecture/language-server.md)).
- `scripts/codemetrics-settings.mjs`: writes the `nuclear.codemetrics.*` settings from the server's defaults.

## Processes the extension starts

| Process | Started by | Ends |
|---|---|---|
| `nuclear-lsp` | the client | 5 minutes after the last `.nuc` closes, or with the window |
| `nuclear build` / `repair` / `explain` | run, save, a failure | by itself; builds are queued (`buildQueue`) |
| Flutter, a headless Chromium, Vite | the devices | with their device; a watchdog and `reap` leave none behind |
| `nuclear-graph serve`, `nuclear-developer` | *Start* / *Restart* of the settings page, when the system's services do not own them | on deactivate |
| `claude -p`, `nuclear gen`, the project's commands | a Nuclear Builder run | with the run; a hung command is killed after its limit |

A decision cited by its old platform-wide number (`ADR-00NN`, in code or commits before 2026-11-16): see
[the table of old numbers](../../../../docs/03-adr/old-numbers.md).
