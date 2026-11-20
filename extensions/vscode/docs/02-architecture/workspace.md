---
status: accepted
owner: Julian Molina
updated: 2026-11-19
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

In this order: the AI factory, the tools of a running project, the ones not built yet, the settings last.

| id | Label | Word | Key | State | Project |
|---|---|---|---|---|---|
| `builder` | Nuclear Builder | BUILD | `Ctrl+Alt+P` | built | [`nuclear-builder`](../../../tools/nuclear-builder/AGENTS.md) |
| `teams` | Your software company | TEAMS | `Ctrl+Alt+E` | built: `command` `nuclear.builder.teams` | [`nuclear-builder`](../../../tools/nuclear-builder/AGENTS.md) (the company screen) |
| `reports` | Reports | REPORTS | `Ctrl+Alt+K` | built: `command` `nuclear.builder.reports` | [`nuclear-builder`](../../../tools/nuclear-builder/docs/02-architecture/reports.md) (the Reports page, spec 017) |
| `atlas` | Nuclear Atlas | ATLAS | `Ctrl+Alt+A` | built | [`nuclear-atlas`](../../../tools/nuclear-atlas/AGENTS.md) |
| `http-connections` | HTTP Connections | HTTP | `Ctrl+Alt+H` | built | [`nuclear-http-connections`](../../../tools/nuclear-http-connections/AGENTS.md) |
| `devices` | Devices | DEVICE | `Ctrl+Alt+V` | built | [`nuclear-device-manager`](../../../tools/nuclear-device-manager/AGENTS.md) |
| `monitor` | Nuclear Monitor | MONITOR | `Ctrl+Alt+F` | built: `command` `nuclear.monitor.open` | [`nuclear-monitor`](../../../tools/nuclear-monitor/AGENTS.md) |
| `designer` | UI designer | UI | `Ctrl+Alt+D` | a template page | [`nuclear-ui-designer`](../../../tools/nuclear-ui-designer/AGENTS.md) |
| `docs` | AI documenter | DOCS | `Ctrl+Alt+M` | a template page | [`nuclear-documentor`](../../../tools/nuclear-documentor/AGENTS.md) |
| `settings` | Settings and integrations | SETUP | `Ctrl+Alt+S` | built | [ai-services.md](ai-services.md) |

A tool with a `planned` list is a template: `ToolPanel` opens its page, which says what the tool will do. A tool
with a `command` opens its own page with that command when its tab is entered (`switchTabs`).

Each tool is drawn as its icon over its word (`short`, translated). The icons are `TOOL_ICONS` of `workspace.ts`: a
24 px grid, a 1.6 line with round joins (the HUD's line), one meaning each (a factory for the Builder, three people
for the company, a bar chart with a coin for the reports, a chat bubble with a spark for Atlas, a plug with its signal both ways for HTTP Connections, a
phone for the devices, a gauge for the Monitor, a pen's nib for the designer, a page for the documenter, a gear for
the settings), in its colour (`--tc`: the theme's `nuclearHttpConnections.*` colours, VS Code's `charts.*` when the
theme has none). A template's icon is dashed and faint. The open tool has a HUD frame (two corner brackets), a
glowing bar on its left and its word in its colour. Hovering or focusing a tool shows its card beside the strip
(`#tip`: its name, its key, *not built yet*, its notices); the tools are buttons of the keyboard (Tab, Enter, Space)
with an `aria-label` of the name and the key.

## The pane of each tab

- **A project**: its file tree. `list` → `entries`, lazily; `Icons.entriesOf` skips `.git` and the plain names of
  `files.exclude`, folders first. Each entry wears its icon of the Chernobyl icon theme
  (`icon-themes/<slug>-icon-theme.json`, the user's variant), with VS Code's lookup: `fileNames` → the longest
  `fileExtensions` → `file`; `folderNames[Expanded]` → `folder[Expanded]`. The icons are webview uris
  (`localResourceRoots`: icons and icon-themes). `open` → `vscode.open`; a `FileSystemWatcher` on the root posts
  `refreshDirs` (the folders changed, at most every 200 ms: a build writes hundreds of files). It looks and moves
  like VS Code's explorer: 22 px rows, a twistie that turns, indent guides on hover (`tree.indentGuidesStroke`), the
  list's hover, selection (active when the tree has the focus, inactive otherwise) and focus outline; the keyboard
  walks it (↑ ↓ Home End, → opens or goes in, ← closes or goes up, Enter and Space open). The active editor's file is
  revealed (`reveal`: its folders opened, the file selected). The indent is the explorer's default (8 px), not the
  user's `workbench.tree.indent`.
- **`tool:http-connections`**: the environment bar (change / edit / ↻) and `HttpModel.tree()` drawn with chevrons, inline
  `GLYPHS` and the `nuclearHttpConnections.*` colors (the collapsed ids are kept in the webview). An endpoint →
  `nuclear.httpConnections.open`; a node's button → `updateContracts` / `addOpenApi`, the others (`addSocket`, and
  `open` of a node's protocol badge, `WS`) → `HttpModel.runAction`.
- **`tool:devices`**: `devices()` of `tools/nuclear-device-manager/src/mobile-device.ts` (title, a status dot) with *▷ run* (`nuclear.runOnDevice(id, root)`)
  and *+ New device* (a quick pick of `PRESETS` → `nuclear.openDevice(preset)`).
- **`tool:builder`**: *+ New spec*, the Builder's specs by component and layer and its runs as an accordion
  (`builderSidebar()` of `tools/nuclear-builder/src/panel.ts`, drawn with `workbench.ts`'s `specTree` and `runOutline`
  inlined; `sidebarChanged` sends `builderSidebar` messages, the tree redrawn in place). A click is a
  `builder` message (`op`: `spec`, `run`, `node`, `new`) → `BuilderPanel.drive`, which opens the page and does it.
- **The other tools**: a line about the tool.

Under every pane, the list of every tool's notices (below, *Badges and notifications*).

## The actions of a project

`platformActions()[platform]` are the buttons of the files pane, under the project's name (`renderFiles`, the
`.actions` row; a click posts `action`), and the `editor/title` buttons of `package.json` (Cursor shows none of an
extension's title bar buttons): the commands `nuclear.action.<id>`,
shown by the context key `nuclear.platform` that `refresh()` sets, run by `action(id)`.

| Platform | Actions |
|---|---|
| mobile | ▷ Run, ◉ Debug, ↻ Reload, ▭ Device, ⚒ Build, ✓ Test, ☑ Check |
| backend | ▷ Serve, ◉ Debug, ✓ Test, ⚒ Build, ☑ Check, ⇄ API |
| web | ▷ Serve, ▭ Device, ◉ Debug, ↻ Reload, ⚒ Build, ✓ Test, ☑ Check |

- Mobile run / debug → `nuclear.run` / `nuclear.debug` with the root; reload → `flutter.hotReload`; device →
  `nuclear.runOnDevice(undefined, root)`; api → the HTTP Connections tool.
- The rest runs in a terminal named `<project> · <action>` with `TERMINAL_COMMANDS` (`nuclear run`, `build`,
  `test`, `check`); `nuclear install` goes first for a test when the app has no packages (`nuclear run` installs
  them itself, as a step of its log).
- ▷ Serve is followed (`followRun`): a progress notification reads the lines `nuclear run` appends to the project's
  `.nuclear/logs/run.log` (`RunFollower` of `launch-log.ts`): building, installing, starting the server, ready when its
  address answers; `failed:`, `exited:` or a step silent past its limit (`RUN_STALL_MS`) shows why with *Show the log*
  and *Try again*.
- A mobile run, debug or device of a root outside the workspace folders saves a `PendingAction` in the global
  state, adds the folder and reloads; `activateWorkspace` resumes it.
- `Workspace.pickDevice(p, mode)` asks which device ▷ Run / ◉ Debug / ▭ Device use; `Workspace.mobileRoot`: the
  Devices pane runs a mobile project only.

## Projects and the switch of tabs

Projects = `findProjects()` (the workspace folders) + the roots opened with *Open a Project* (`Ctrl+Alt+O`) in this folder, saved in `workspaceState` (`savedProjects.ts`): each folder's workspace shows only its own projects, never another folder's (before 0.63.0 they were kept in `globalState` for every folder; a folder keeps the ones inside it)
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
`Ctrl+Alt+N/O/W` the container, open a project, the welcome page; the tools `Ctrl+Alt+P/E/A/H/V/F/D/M/S`; the actions
`Ctrl+Alt+R/G/L/B/T/C` on `nuclear.action.*` (`Ctrl+Alt+R` is `run` on mobile and `serve` on backend and web).

`WelcomePanel` is a singleton in column one, drawn again on `Workspace.onDidChange`; it opens on activation (since 0.73.2 only when the user turned it on: the setting is off by default) when
`nuclear.workspace.welcome` is on and every tab group is empty.

## The right-click menu of the file tree (`treeMenu.ts`)

Each row of the tree carries `data-vscode-context`; the host computes it (`contextFor`) from the clicked path and
the platform's layout (`nuclear help layout`), and `package.json` shows an item of `webview/context` only when its
id is in `nuclearMake` or its flag is true.

- New File, New Folder, Rename, Delete (to the trash).
- *New with Synapsis* (`nuclear make` / `gen`, `makeArgs`), limited to what the clicked folder and the platform
  allow: a config file gets no "new project", a `usecases` folder gets only "new use case".
- `build/`, `node_modules/` and the files that make a project are protected: they get nothing.

## Badges and notifications

Every notice of the one system ([ai-services.md](ai-services.md)) reaches the column three ways:

- `WebviewView.badge`: the unread count on the Nuclear icon of the activity bar.
- A badge on the tool's icon of the strip: its unread count (`9+` above nine) in a small square framed and lit in
  the tool's colour (`--tc`, the HUD's line), which pings twice when it appears (not with reduced motion); the
  tool's `aria-label` and its card add the count (`newCount`). `atlas`: what members said to the user in Nuclear
  Chat; `builder`: runs that wait for the user (a gate, the QA plan) or ended; `settings`: connections. Opening the
  tool reads them (the badge clears).
- The list at the bottom of the column (`#notes`, under every pane, at most 38 % of its height): every tool's
  notices, newest first, the unread with a bar in their tool's colour; a click, Enter or Space posts `notice` →
  `openNotice`, the same place as the pop-up's *Open*. A Nuclear Chat notice keeps its message id (`chatWhere` in
  `notify.ts`): it opens the chat at `/<workspace>/<channel>?message=&thread=`, the message highlighted and its thread
  open.
