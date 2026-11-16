---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../../../docs/03-adr/0002-the-nuclear-workspace.md, client.md, ai-services.md]
---
# The Nuclear workspace (`src/workspace.ts`, `src/treeMenu.ts`)

The decision and its limits: [ADR-extensions-0002](../../../docs/03-adr/0002-the-nuclear-workspace.md). Not run in
a VS Code window yet ([roadmap](../01-product/roadmap.md)).

## The view

The container `nuclear` (activity bar) has one view, the webview view `nuclear.workspace` (`Workspace`, a
`WebviewViewProvider`, `retainContextWhenHidden`). The webview draws:

- **the strip**: the project tabs (the platform glyph `icons/platform-<platform>.svg` with the dialect's Atom
  Material icon as a badge, `DIALECT_ICONS`, and their number), `+`, and the `TOOLS` at the bottom;
- **the pane**, which depends on the active tab. `activeKey()` is a project's root or `tool:<id>`
  (`workspaceState` `nuclear.workspace.active`); `LAST_PROJECT` is the project the tools act on.

## The tools of the strip

| id | Label | Key | State | Project |
|---|---|---|---|---|
| `http-connections` | HTTP Connections | `Ctrl+Alt+H` | built | [`nuclear-http-connections`](../../../tools/nuclear-http-connections/AGENTS.md) |
| `devices` | Devices | `Ctrl+Alt+V` | built | [`nuclear-device-manager`](../../../tools/nuclear-device-manager/AGENTS.md) |
| `builder` | Nuclear Builder | `Ctrl+Alt+P` | built | [`nuclear-builder`](../../../tools/nuclear-builder/AGENTS.md) |
| `designer` | UI designer | `Ctrl+Alt+D` | a template page | [`nuclear-ui-designer`](../../../tools/nuclear-ui-designer/AGENTS.md) |
| `docs` | AI documenter | `Ctrl+Alt+M` | a template page | [`nuclear-documentor`](../../../tools/nuclear-documentor/AGENTS.md) |
| `atlas` | Nuclear Atlas | `Ctrl+Alt+A` | built | [`nuclear-atlas`](../../../tools/nuclear-atlas/AGENTS.md) |
| `settings` | Settings and integrations | `Ctrl+Alt+S` | built | [ai-services.md](ai-services.md) |

A tool with a `planned` list is a template: `ToolPanel` opens its page, which says what the tool will do.

## The pane of each tab

- **A project**: its file tree. `list` → `entries`, lazily; `Icons.entriesOf` skips `.git` and the plain names of
  `files.exclude`, folders first. Each entry wears its icon of the Chernobyl icon theme
  (`icon-themes/<slug>-icon-theme.json`, the user's variant), with VS Code's lookup: `fileNames` → the longest
  `fileExtensions` → `file`; `folderNames[Expanded]` → `folder[Expanded]`. The icons are webview uris
  (`localResourceRoots`: icons and icon-themes). `open` → `vscode.open`; a `FileSystemWatcher` on the root posts
  `refreshDir`.
- **`tool:http-connections`**: the environment bar (change / edit / ↻) and `HttpModel.tree()` drawn with chevrons, inline
  `GLYPHS` and the `nuclearHttpConnections.*` colors (the collapsed ids are kept in the webview). An endpoint →
  `nuclear.httpConnections.open`; a node's button → `updateContracts` / `addOpenApi`.
- **`tool:devices`**: `devices()` of `tools/nuclear-device-manager/src/mobile-device.ts` (title, a status dot) with *▷ run* (`nuclear.runOnDevice(id, root)`)
  and *+ New device* (a quick pick of `PRESETS` → `nuclear.openDevice(preset)`).
- **The other tools**: a line about the tool and, for `agent`, `builder` and `settings`, the list of their notices.

## The actions of a project

`PLATFORM_ACTIONS[platform]` are the `editor/title` buttons of `package.json`: the commands `nuclear.action.<id>`,
shown by the context key `nuclear.platform` that `refresh()` sets, run by `action(id)`.

| Platform | Actions |
|---|---|
| mobile | ▷ Run, ◉ Debug, ↻ Reload, ▭ Device, ⚒ Build, ✓ Test, ☑ Check |
| backend | ▷ Serve, ◉ Debug, ✓ Test, ⚒ Build, ☑ Check, ⇄ API |
| web | ▷ Serve, ▭ Device, ◉ Debug, ↻ Reload, ⚒ Build, ✓ Test, ☑ Check |

- Mobile run / debug → `nuclear.run` / `nuclear.debug` with the root; reload → `flutter.hotReload`; device →
  `nuclear.runOnDevice(undefined, root)`; api → the HTTP Connections tool.
- The rest runs in a terminal named `<project> · <action>` with `TERMINAL_COMMANDS` (`nuclear run`, `build`,
  `test`, `check`); `nuclear install` goes first for a backend or web run or test when the app has no packages.
- A mobile run, debug or device of a root outside the workspace folders saves a `PendingAction` in the global
  state, adds the folder and reloads; `activateWorkspace` resumes it.
- `Workspace.pickDevice(p, mode)` asks which device ▷ Run / ◉ Debug / ▭ Device use; `Workspace.mobileRoot`: the
  Devices pane runs a mobile project only.

## Projects and the switch of tabs

Projects = `findProjects()` (the workspace folders) + the roots saved in `globalState`
`nuclear.workspace.projects` (opened with `openProject`, read by `projectAt`: the card, else `config.nuc` /
`nuclear.toml` by regex).

`go(key)` calls `switchTabs(from, to)`:

1. the open `TabInputText` tabs of the tab left go to `workspaceState` `nuclear.workspace.tabs` (path, column,
   active); leaving the HTTP Connections tool keeps the keys of its open component panels (`model.reopen`);
2. every tab is closed (`tabGroups.close`) except the device webviews (`viewType` ends with `synapsisDevice`) and
   the unsaved editors, which stay open until saved;
3. the devices are parked (`nuclear.parkDevices`), always before anything is reopened;
4. the tab entered comes back: a project's text files, or a tool's page (`ComponentPanel.restore` for HTTP Connections,
   Nuclear Builder, the settings and Nuclear Atlas panels, the template page of a tool that is not built);
5. the devices are unparked (`nuclear.unparkDevices`) when the tab entered is a mobile project or the Devices tool.

Clicking a tab or an action posts a toast with its shortcut.

## Commands and keys

Commands `nuclear.workspace.{show,project,openProject,tool,action,welcome,addToVsCode}`; `project`, `tool` and
`action` without arguments show a quick pick. Keybindings in `package.json`: `Ctrl+1..9` the project tabs,
`Ctrl+Alt+N/O/W` the container, open a project, the welcome page; the tools `Ctrl+Alt+H/V/P/D/M/A/S`; the actions
`Ctrl+Alt+R/G/L/B/T/C` on `nuclear.action.*` (`Ctrl+Alt+R` is `run` on mobile and `serve` on backend and web).

`WelcomePanel` is a singleton in column one, drawn again on `Workspace.onDidChange`; it opens on activation when
`nuclear.workspace.welcome` is on and every tab group is empty.

## The right-click menu of the file tree (`treeMenu.ts`)

Each row of the tree carries `data-vscode-context`; the host computes it (`contextFor`) from the clicked path and
the platform's layout (`nuclear help layout`), and `package.json` shows an item of `webview/context` only when its
id is in `nuclearMake` or its flag is true.

- New File, New Folder, Rename, Delete (to the trash).
- *New with Synapsis* (`nuclear make` / `gen`, `makeArgs`), limited to what the clicked folder and the platform
  allow: a config file gets no "new project", a `usecases` folder gets only "new use case".
- `build/`, `node_modules/` and the files that make a project are protected: they get nothing.

## Notices on the strip

The workspace sets `WebviewView.badge` (the Nuclear icon of the activity bar), a count on the tab of `agent`,
`builder` and `settings`, and the list in the tool's pane: [ai-services.md](ai-services.md).
