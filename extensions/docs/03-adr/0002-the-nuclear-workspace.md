---
status: accepted
date: 2026-11-10
deciders: Julian Molina
---
# ADR-0002: The Nuclear workspace in the editor: projects and tools as tabs, one thing on screen, keyboard first

## Context and problem
Every Nuclear feature in the editor was a view of its own: the HTTP client in one activity bar container, the device
in a panel, the projects as VS Code windows. Working on a backend and its apps meant several windows, or a sidebar
cut into small sections that take space from the code. The user wants one place where everything of Nuclear meets,
like a tiling window manager: each project and each tool is a tab, the whole screen goes to one thing at a time and
the keyboard moves between them. VS Code's own explorer, search and git stay as they are unless the user wants them.

## Decision
The VS Code extension first; Android Studio and Zed follow as far as their platform allows.

1. **One container.** A single activity bar container, `Nuclear`, with one *Workspace* webview view. No other
   Nuclear container or sidebar view: the sidebar is a strip of tabs and a pane that depends on the active tab; the
   editor area is for one thing at a time.
2. **The strip.** A vertical strip beside the pane: the projects at the top (the Nuclear projects of the workspace
   folders, then the ones opened as tabs, and a `+` slot; each tab shows the platform's glyph with the dialect's icon
   as a badge) and the tools at the bottom. A tool that is not built has a template page that says what it will do:
   the layout and its shortcut come first, the tool later.
3. **Every tab is a workspace of its own**, a project or a tool. Switching swaps the editor area: the editors of the
   tab left are remembered per window and closed, those of the tab entered are reopened.
4. **The devices are the exception.** They stay beside the code in the mobile workspaces and in the Devices tool, like
   emulators, because hot reload is watched while coding. Entering a backend, a web or another tool workspace parks
   them: the panel closes, the app keeps running headless with its session, and the next mobile workspace gives it a
   panel again. Every switch parks the devices and takes them back after the code is reopened, so each device lands in
   its own locked editor group to the right of the code (like Android Studio) and is never merged into the code's tab
   group. A device streams at the physical pixels the panel shows, so a 3x phone stays sharp on a HiDPI screen.
5. **A project is a tab, not a window, and shares nothing with the others.** *Open a project as a tab* remembers the
   folder (user state) and shows its files in the workspace view; it does not touch the VS Code workspace folders.
   One command adds the active project's folder to them when the user wants the explorer, search and git on it.
6. **The actions of a project's platform sit in the editor title bar**, as a toolbar, never inside the file tree
   (asked by the user), each with a shortcut VS Code shows in its tooltip. Each platform has its own set and nothing
   of one platform is offered to another (context key `nuclear.platform`; no buttons while a tool is the active tab):
   - mobile: ▷ Run, ◉ Debug, ↻ Reload, ▭ Device, Build, Test, Check;
   - backend: ▷ Serve (`nuclear run`; the server restarts on each build), ◉ Debug (debugpy for fastapi, node with
     source maps for nestjs), Test, Build, Check, ⇄ API (its routes in the HTTP Connections tool);
   - web: ▷ Serve (`nuclear run`, Vite), ▭ Device, ◉ Debug, ↻ Reload, Build, Test, Check.
7. **Every platform runs, debugs and reloads pre-configured, as Flutter does.** Saving a `.nuc` of a backend or web
   project builds it, so the running server or page reloads (`nuclear.buildOnSave`); `install` runs first when the app
   has no packages. `nuclear build` writes `build/<name>.code-workspace` for every platform (the tasks build,
   install, run, test, check and the dialect's debug launch), and every `nuclear build` writes `.nuclear/lines.json`,
   so a breakpoint in a `.nuc` stops in every debugger and the paused line shows in the `.nuc`.
8. **The tools are workspaces too, independent of the projects.**
   - The HTTP Connections tool works like Bruno: its pane is the endpoints tree of every project (platform → project → contracts
     / components → endpoints, OpenAPI documents, the environment); a component is an editor tab and each endpoint a
     tab inside it, so the tab bar never fills with requests. A component panel keeps its tabs, forms and responses
     while its workspace is left. Environments belong to the window (`<first folder>/.nuclear/http.json`, else the
     extension's storage).
   - The Devices tool lists the open Synapsis devices with their state and opens as many as wanted (a preset each),
     each in its own locked editor group tiled horizontally with its own app, so several users can be signed in at
     once. A project's ▭ Device offers the open devices, a new one or the Devices workspace; ▷ Run and ◉ Debug of a
     mobile project offer the same plus *Other Flutter device…* (Flutter's own picker). A run that names no device
     takes a free one or opens a new one, never a running one; a device's ▷ run restarts its own app.
   - **An app lives on its own.** Closing a device tab only hides it (the app and its session go on; the Devices
     workspace lists it as hidden and shows it again). The ✕ of the Devices workspace, the panel's ■ or the end of
     its session end it at once (session, page connection, browser, Flutter). A watchdog runs every minute: a device
     nobody looked at for 30 minutes ends, and any Flutter or browser process of this window that no device owns is
     killed. Devices take the lowest free number; a session is named after its device.
9. **The web device.** ▭ Device of a web project opens the app beside the code in a headless Chromium the editor
   drives, with the mobile device's machinery: desktop, laptop, tablet and phone sizes (user agent and touch for
   tablets and phones), rotation, *Responsive* with any size, zoom; an address bar with back, forward, reload (Shift:
   without cache), the page in the user's browser and Chrome's DevTools of the page; `prefers-color-scheme`, network
   throttling (fast 4G, slow 3G, offline), no cache; a dock with the page's Console (errors counted, a line's source
   opens the generated file) and Network (method, status, address, type, size, time), filtered; a screenshot into
   `build/screenshots/`; ◉ Debug attaches VS Code's JavaScript debugger to that page.
10. **The file tree is the explorer's equal.** It wears the Chernobyl icon theme with VS Code's own lookup (file
    name, longest extension, folder name, open or closed) and hides what `files.exclude` hides.
11. **Keyboard first.** Fixed bindings: `Ctrl+1` … `Ctrl+9` the project tabs, `Ctrl+Alt+N` the container,
    `Ctrl+Alt+O` open a project, `Ctrl+Alt+W` the welcome page, one `Ctrl+Alt+<letter>` per tool (`H`, `V`, `P`, `D`,
    `M`, `A`, `S`) and per action (`R`, `G`, `L`, `B`, `T`, `C`). Clicking a tab or an action does the same and shows
    a short toast with its shortcut, so the mouse teaches the keys. The user may rebind any of them.
12. **A welcome page at startup** (`nuclear.workspace.welcome`, on by default, only when the window restored no
    editor) explains the workspace, lists the projects with their shortcut and the tools, and can turn itself off.
13. **The other editors.** Android Studio gets tool windows and actions with shortcuts (the HTTP Connections tool window,
    `Alt+Shift+H`). Zed cannot contribute keybindings or views.

## Options considered
1. **One webview with the strip and the pane (chosen).**
2. Multi-root workspace folders as the project tabs: the first added folder reloads the window and VS Code's explorer
   shows every folder at once; the user asked not to touch VS Code's own system unless wanted.
3. The native explorer beside the strip: a built-in view cannot be placed inside an extension's container, and the
   views of a container stack vertically, so a strip and a tree side by side need one webview.
4. A horizontal tab row above a native tree: it fits the sidebar's stacking, but not the vertical strip the user drew.

## Consequences
- Positive: one place for every Nuclear feature; projects side by side without windows; the screen for one thing at a
  time; every action has a key.
- Negative:
  - The HTTP tree and the file tree are drawn by the webview, not native trees: the file tree has no git decorations
    and no drag and drop (the user adds the folder to the VS Code workspace for those).
  - A component panel's memory lives in the window, not on disk.
  - The editors remembered per workspace are text editors; an unsaved editor is not closed by a switch (no save
    prompt: it stays open until saved).
  - The Dart extension launches Flutter only for a project inside the workspace folders, so Run, Debug and Device of
    a mobile project opened as a tab first add its folder to them: the window reloads once and the user state
    `nuclear.workspace.pendingAction` continues the action.
  - The editor title bar is the only toolbar an extension can fill, so the actions show only while an editor is open
    (not on the welcome page).
  - The terminals the actions open are named per project and action, but not swapped with the workspace.
  - `Ctrl+1` … `Ctrl+9` replace VS Code's "focus editor group N"; a desktop environment may take a
    `Ctrl+Alt+<letter>` (the user rebinds).

## References
- Replaces: ADR-0099
- The contract the HTTP Connections tool reads: ADR-synapsis-0006. The Synapsis device: ADR-devices-0001.
