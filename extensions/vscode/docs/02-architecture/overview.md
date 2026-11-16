---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [client.md, debugging.md, workspace.md, ai-services.md, theme.md, ../../../docs/02-architecture/overview.md]
---
# The VS Code extension: its files

One bundle, `out/extension.js` (entry `src/extension.ts`), and a second one for the terminal, `out/nuclear-builder.js`
(entry `../tools/nuclear-builder/src/cli.ts`). It activates on a `.nuc` file, on a workspace that contains one, and when startup
finishes (`onStartupFinished`).

## `src/`

| File | What it is | Document |
|---|---|---|
| `extension.ts` | the client of `nuclear-lsp`, the status bar, the generated-code view, Synapsis projects: run, debug, save, repair | [client.md](client.md) |
| `card.ts` | the project card `.nuclear/project.json` (`readCard`, `projectCard`, `appDir`, `isInstalled`) | [client.md](client.md) |
| `debug.ts` | debugging a `.nuc` under each dialect's debugger | [debugging.md](debugging.md) |
| `workspace.ts` | the Nuclear workspace: the strip, the pane, the tabs, the actions, the welcome page | [workspace.md](workspace.md) |
| `treeMenu.ts` | the right-click menu of the workspace's file tree | [workspace.md](workspace.md) |
| `notifications.ts` | the notices of what the local agents did | [ai-services.md](ai-services.md) |
| `aiSetup.ts`, `aiSetup.json`, `setupPanel.ts` | the set-up of the AI services: its engine, its data, its wizard | [ai-services.md](ai-services.md) |
| `settingsPanel.ts`, `aiSettings.ts`, `localModels.ts` | the *Settings and integrations* tool and the `nuclear.ai.*` settings | [ai-services.md](ai-services.md) |
| `connections.ts` | every external connection, checked | [ai-services.md](ai-services.md) |

## The tools it bundles

Their code is in `../tools/<tool>/src/` (compiled by this folder's `tsconfig.json`, bundled into
`out/extension.js`); each is documented in its own folder:
[Nuclear Builder](../../../tools/nuclear-builder/AGENTS.md),
[Nuclear Connector](../../../tools/nuclear-connector/AGENTS.md),
[the chat](../../../tools/nuclear-ai-chat/AGENTS.md),
[the devices](../../../tools/nuclear-device-manager/AGENTS.md).

## What `package.json` contributes

- The language `nuclear` (`.nuc`), its grammars, the semantic token modifiers and scopes.
- The themes (Chernobyl, Chernobyl Soft) and the icon themes (Chernobyl Icons, Chernobyl Soft Icons).
- One activity bar container, `nuclear`, with one webview view, `nuclear.workspace`; the view `nuclear.callStack`
  (*Nuclear Call Stack*) in the debug container while paused in a `.nuc`.
- The debugger type `synapsis` (F5 without `launch.json`) and breakpoints in `.nuc` files.
- The commands (category **Nuclear**), the `editor/title` buttons of each platform, the `webview/context` menu of
  the file tree, the keybindings.
- The colors `nuclearConnector.*`.
- The settings: `nuclear.dialect`, `nuclear.dialectPaths`, `nuclear.server.path`, `nuclear.trace.server`,
  `nuclear.buildOnSave`, `nuclear.workspace.welcome`, `nuclear.debug.followInNuclear`, `nuclear.debug.explainErrors`,
  `nuclear.ai.*` (among them `nuclear.ai.mcpCommand`, default `nuclear-mcp`, the MCP server an AI client starts
  with no argument, and `nuclear.ai.graphCommand`, default `nuclear-graph`) and the generated
  `nuclear.codemetrics.*`.

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
