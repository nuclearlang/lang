---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [../../../docs/03-adr/0002-the-nuclear-workspace.md, client.md, ai-services.md, ../../../../docs/04-specs/022-workspaces-and-mcp/design.md]
---
# The Nuclear workspace (`src/workspace.ts`, `src/workspaces.ts`, `src/treeMenu.ts`)

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
| `monitor` | Nuclear Monitor | MONITOR | `Ctrl+Alt+F` | built: `command` `nuclear.monitor.open` with the selected project (`showTool`); the page's hooks `MonitorPanel.projects/selected/select/runMobile` are set in `activateWorkspace` | [`nuclear-monitor`](../../../tools/nuclear-monitor/AGENTS.md) |
| `environments` | Environments | ENV | `Ctrl+Alt+Y` | built: `command` `nuclear.environments.open`, given the last project | [`nuclear-environments`](../../../tools/nuclear-environments/AGENTS.md) (spec 021) |
| `designer` | UI designer | UI | `Ctrl+Alt+D` | a template page | [`nuclear-ui-designer`](../../../tools/nuclear-ui-designer/AGENTS.md) |
| `docs` | AI documenter | DOCS | `Ctrl+Alt+M` | a template page | [`nuclear-documentor`](../../../tools/nuclear-documentor/AGENTS.md) |
| `settings` | Settings and integrations | SETUP | `Ctrl+Alt+S` | built | [ai-services.md](ai-services.md) |

A tool with a `planned` list is a template: `ToolPanel` opens its page, which says what the tool will do. A tool
with a `command` opens its own page with that command when its tab is entered (`switchTabs`). Nuclear Atlas's
column (`pane.kind: 'chat'`) is Nuclear Chat's own list of channels (`?part=sidebar`, `#chatcol`, `syncSide`),
mounted once and kept across the column's redraws.

Each tool is drawn as its icon over its word (`short`, translated). The icons are `TOOL_ICONS` of `workspace.ts`: a
24 px grid, a 1.6 line with round joins (the HUD's line), one meaning each (a factory for the Builder, three people
for the company, a bar chart with a coin for the reports, a chat bubble with a spark for Atlas, a plug with its signal both ways for HTTP Connections, a
phone for the devices, a gauge for the Monitor, three layers for the environments, a pen's nib for the designer, a page for the documenter, a gear for
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
  `refreshDirs` (the folders changed, at most every 200 ms: a build writes hundreds of files). A file clicked in the tree
  opens in the main editor group (`openInMain`: the leftmost group that is not a device's), and a lock found on that
  group is lifted: there is one main group, at the left. The watcher lives as
  long as its project (the column is drawn again many times a second while a run works, and a new watcher would miss
  what is written while it starts); when watching starts, the page reads every loaded folder again (`all`). It looks and moves
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

`platformActions()[platform]` are the `editor/title` buttons of `package.json` and, for an editor that shows none of
an extension's title bar buttons (Cursor), the rows of the *Actions* accordion at the bottom of the files pane, below
the tree and collapsed by default (`renderFiles`, `.acc`; each row is the action's name and, at its right, dimmed, its
key, as a menu of VS Code shows it; a click posts `action`; ADR-extensions-0002 rule 6): the commands `nuclear.action.<id>`,
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

## The Nuclear workspace and its apps (spec 022)

A Nuclear workspace is a folder with `.workspace/workspace.nuc` (one business project and its apps; the CLI's guide:
`nuclear help workspace`). The extension reads and changes it only through `nuclear workspace … --json` (the installed
`nuclear`, `nuclearCommand()`), parsed by `src/workspaces.ts` (no `vscode` import; `test/workspaces.test.ts`): the
answer is the last JSON line (`add` prints `nuclear new`'s lines first), `null` from `find` outside a workspace,
`{"error"}` (exit 1) shown as `nuclear workspace: <message>`; an older `nuclear` without the command is told to update.

- **The open workspace** (`Workspace.loadWorkspace`, on activation and when VS Code's folders change): the one that
  holds one of VS Code's folders (`find --json` run in it), and only it: as VS Code shows only its folder, a window whose
  folder is not a workspace (or was deleted) opens none; the empty panel offers the recent ones.
- **The recent workspaces**: `globalState` `nuclear.workspaces.recent` (`{root, name, openedAt}`, the last opened
  first, at most 10, `remember`); the ones whose marker is gone are not offered (`alive`). Never `workspaceState`: a
  change of VS Code's folder never loses them.
- **The slots of the strip** (`shownProjects`; each a `.tab.app`: the platform's glyph with the dialect's badge over
  the app's name, the strip 64 px wide) are the workspace's apps whose folder exists, in the marker's order
  (`projectAt` of each, else the app's own JSON), and nothing else: no scan of VS Code's folders, no project opened by
  hand (a workspace is the clean folder the editor works on; *Open a Project as a Tab* there offers *Add an app*).
  Without a workspace: the projects of VS Code's folders (`findProjects()`), then the ones opened by hand. Until
  `loadWorkspace` has answered once, no slot: the scan of a parent folder never shows, even for a moment, the projects
  of other workspaces. A `FileSystemWatcher` on `<root>/.workspace/workspace.nuc` reads the workspace again (300 ms
  after a burst): an app added by the MCP server, an agent or a terminal appears at once; a failed reading while the
  marker is there keeps the workspace (`afterReload`), only a deleted marker closes it. A workspace or an app whose
  folder was deleted from the disk (`gone()`, checked when drawn, by a watcher on the folders and when the window is
  focused again) stays on the strip faded and crossed out (✕): it is never opened, Nuclear Atlas never opens a chat on
  it (`chatRoots` skips a folder that is not there), the panel says it was deleted and offers the other workspaces.
  `workspace()` is then none: no command runs in that folder (`nuclear workspace` runs from the home folder) and no
  app is added to it, so nothing makes it again; the welcome whose workspace was deleted before its apps starts again
  from making or opening one (`withoutGone`), and a VS Code folder that is not there is not asked to be kept.
- **The projects opened by hand** (*Open a Project as a Tab*, `Ctrl+Alt+O`): this window's folder's own list,
  `workspaceState` `nuclear.workspace.window.projects` (`saved()`, `savedHere`: the deleted ones left out), as VS Code
  keeps a folder's state; a folder's list of 0.63 to 0.83 (`nuclear.workspace.projects` in its `workspaceState`) is
  read with it (fixture `test/fixtures/compat/workspace-state-0.83.json`). The global list of 0.84 to 0.88.3
  (`nuclear.workspace.projects` in `globalState`) showed every window's projects in each and is no longer read.
- **The header**: the workspace's initials head the strip and its name heads the files pane (`.wsbar`); both open
  `workspaceMenu()` (rename, description, add / rename / remove an app, open the marker, *Do it with me by chat*, the
  recent workspaces, open, create). `+` adds an app when a workspace is open (else opens a project as a tab); the right
  click on an app's tab offers rename and remove.
- **The empty panel** (`emptyState`: no workspace and no project): why (no folder open, or the folder is not a
  workspace), the recent workspaces, *Open a workspace…*, *Create a workspace*, and the old *open a project as a tab*.

| Command | What it does |
|---|---|
| `nuclear.workspace.create` | the parent folder (picker) and the name; `workspace new <parent>/<name> --name <name>`; then it opens |
| `nuclear.workspace.open` | a folder (picker) or a recent root; `find`; a folder that is not a workspace is offered to become one (`workspace new <folder>`) |
| `nuclear.workspace.addApp` | the platform (the three), the dialect (the platform's installed ones, `nuclear dialect list` filtered by `dialectsOf`, the default first; asked only when there are several), the name; `workspace add`; the new app's tab opens |
| `nuclear.workspace.removeApp` | confirmed (modal): *Remove, keep the folder* or *Remove and delete the folder…*, which asks again before `--delete` |
| `nuclear.workspace.renameApp` | `workspace rename <folder> <new>` (the project's `app(name)` stays) |
| `nuclear.workspace.menu` | the header's menu |

Opening a workspace (`openIn`): in an empty window it becomes the window's folder (`vscode.openFolder`); in a window
with a folder it asks *This window* (the folder replaced) or *A new window*; a window whose folder is inside the
workspace just shows it.

**Do it with me by chat** (`Workspace.chat`): Nuclear Atlas opens on its direct message with a first message in the
composer (`AtlasPanel.compose`), on the workspace's folder, or before there is one on the extension's own
`globalStorage/welcome` folder. The user sends it; the agent works through the MCP server's tools (`workspace_create`,
`app_add`…), which ask the user before each change.

## The switch of tabs

`go(key)` calls `switchTabs(from, to)`; a tool tab entered again (the active one, kept by a window reloaded) opens its
page again (`showTool`), which no switch would do:

1. the open `TabInputText` tabs of the tab left go to `workspaceState` `nuclear.workspace.tabs` (path, column,
   active); leaving the HTTP Connections tool keeps the keys of its open component panels (`model.reopen`);
2. every tab is closed (`tabGroups.close`) except the device webviews (`viewType` ends with `synapsisDevice`), the welcome (`nuclear.welcome`: an app added from it opens while the user goes on there) and
   the unsaved editors, which stay open until saved;
3. the devices are parked (`nuclear.parkDevices`), always before anything is reopened;
4. the tab entered comes back: a project's text files, or a tool's page (`ComponentPanel.restore` for HTTP Connections,
   Nuclear Builder, the settings and Nuclear Atlas panels, the template page of a tool that is not built);
5. the devices are unparked (`nuclear.unparkDevices`) when the tab entered is a mobile project or the Devices tool.

Clicking a tab or an action posts a toast with its shortcut.

## Commands and keys

Commands `nuclear.workspace.{show,project,openProject,tool,action,welcome,addToVsCode,create,open,addApp,removeApp,renameApp,menu}`; `project`, `tool` and
`action` without arguments show a quick pick. Keybindings in `package.json`: `Ctrl+1..9` the project tabs,
`Ctrl+Alt+N/O/W` the container, open a project, the welcome page; the tools `Ctrl+Alt+P/E/K/A/H/V/F/Y/D/M/S`; the actions
`Ctrl+Alt+R/G/L/B/T/C` on `nuclear.action.*` (`Ctrl+Alt+R` is `run` on mobile and `serve` on backend and web).

`WelcomePanel` is a singleton in column one: the welcome of spec 022 in three short steps, each with *Do it with me
by chat*: (1) *Create your workspace* (what a workspace and its marker are, the parent folder and the name, or open
one, or a recent one), (2) *Add your apps* (the workspace's apps listed, a platform, its dialect and a name), (3) a tour,
one card per tool (`TOUR`: the workspace, HTTP Connections, Environments, the Builder and the teams, Atlas and Nuclear
Chat, the devices, Monitor, Reports, the settings), each with its key and *open it*; then a link to the AI services'
set-up (`nuclear.ai.setup`, unchanged), the shortcuts folded, the startup switch. Its texts are `welcomeL10n.ts`; it is
drawn again only when what it shows changed and keeps what the user typed (`vscode.setState`). The first run starts
with it, and its progress survives a reload, a new window and a closed editor (`src/onboarding.ts`, no `vscode`
import, `test/onboarding.test.ts`):

- `globalState` `nuclear.onboarding` = `{step, root?, chosenWindow?, at}`, the step one of `workspace`, `apps`,
  `tour`, `services`, `done`, never going back (`advance`). It is written before anything that may reload or close
  the window: `openIn` saves `apps` with the workspace's root and the window chosen before `vscode.openFolder` (which
  restarts the extensions); *Next: the tour* saves `tour`; *Finish: set up the AI services* saves `services`, opens the
  set-up page and closes the welcome; *Skip the welcome* saves `done`.
- On activation, `resume` decides: a saved step that is not `done` comes back (`services` ends once the set-up's
  `nuclear.onboarding.done` or `nuclear.ai.setup.declined` is set; its page marks the onboarding `done` when it finishes
  or is declined); never saved and nothing here, the first run (`workspace`). The welcome opens at its step
  (`resumeWelcome`) on its workspace; when this window shows another workspace, *Continue setting up NuclearLang with
  the workspace …?* offers to open it. At `services` the set-up is offered (`SetupPanel.offer`); while the onboarding
  goes on, `extension.ts` makes no offer of its own.
- *A new window*: the progress is global, so the new window resumes the welcome and this one closes it
  (`WelcomePanel.handOver`, no offer).
- Closed by the user: after the tour it moves to `services`; at any step the set-up is offered, and the workspace's
  steps come back at the next start.
- 0.84.0 marked `nuclear.workspace.welcomed` the moment the welcome opened, finished or not: with no saved progress,
  that flag, no recent workspace whose marker names an app and the AI services not set up, the onboarding is resumed
  once (at `apps` on the last workspace, else `workspace`; fixture `global-state-0.84.0-onboarding.json`).

Once it is `done`, the page opens at startup only when `nuclear.workspace.welcome` is on and every tab group is empty.

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
  notices, newest first, the unread with a bar in their tool's colour. Before each, a check: whether what it asked is
  done (`done` in `notify.ts`). A run's notice is done by itself once the run no longer waits (`settle`, from
  `BuilderPanel.refreshRun`); the user marks any notice done or pending again with it (`noticeDone` → `toggle`), and a
  done one is dimmed and struck through. A click, Enter or Space on the rest posts `notice` →
  `openNotice`, the same place as the pop-up's *Open*. A Nuclear Chat notice keeps its message id (`chatWhere` in
  `notify.ts`): it opens the chat at `/<workspace>/<channel>?message=&thread=`, the message highlighted and its thread
  open.
