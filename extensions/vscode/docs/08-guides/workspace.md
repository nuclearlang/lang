---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [README.md, run-and-debug.md, ../02-architecture/workspace.md, ../../../docs/03-adr/0002-the-nuclear-workspace.md]
---
# The Nuclear workspace

The Nuclear icon of the activity bar (`Ctrl+Alt+N`) opens one view, **Workspace**: a vertical strip of tabs and a
pane beside it. Each tab is a workspace of its own, either a project or a tool. Switching tabs swaps the editor
area: the editors of the tab you leave are saved and closed, and those of the tab you enter are opened again. An
unsaved editor stays open (you never get a save prompt), and the devices stay beside the code.

## Your workspace and its apps

Start from a **Nuclear workspace**: a folder for one business project and its apps (a backend, a web app, mobile
apps). Its file `.workspace/workspace.nuc` says which apps belong to it, so the editor, the MCP server and your agents
always find them. The editor opens the workspace that holds VS Code's open folder, else the last one you opened: the
recent workspaces are remembered by the editor, so a change of VS Code's folder never loses them.

- **Create a workspace**: *Nuclear: Create a Workspace* asks the folder it goes in and its name.
- **Open one**: *Nuclear: Open a Workspace* (a folder that is not a workspace yet is offered to become one). In an
  empty window it becomes the window's folder; otherwise you choose this window or a new one.
- **Add an app**: `+` on the strip, or *Nuclear: Add an App to the Workspace*: its platform (backend, web, mobile),
  its dialect when the platform has several (the default first) and its name. The app is made inside the workspace
  (`nuclear new`) and its tab opens.
- **Rename or remove an app**: right click on its tab. Removing takes it out of the workspace and keeps its folder,
  unless you choose to delete the folder too (asked twice).
- **The workspace's menu**: its initials at the top of the strip, or its name over the files: rename it, its
  description, its apps, its marker file, another workspace, *Do it with me by chat*.
- **By chat**: *Do it with me by chat* opens Nuclear Atlas with the request written in the composer. Send it, and
  your agent does it through the MCP server, asking you before each change.

With no workspace and no project, the view says why (no folder is open, or the open folder is not a workspace) and
offers the recent workspaces, *Open a workspace…* and *Create a workspace*. The same commands also work from a
terminal: `nuclear workspace new|add|remove|rename|edit|list` (`nuclear help workspace`).

The welcome page (`Ctrl+Alt+W`, opened on the first run) walks the three steps: create the workspace, add its apps, a
tour of each tool.

## Project tabs

With a workspace open, the strip holds its apps and nothing else, in the order of its marker: a project of another
folder is added to it as an app. With no workspace open, the tabs are the Nuclear projects of the VS Code workspace
folders and the ones you opened with *Open a Project as a Tab* (`Ctrl+Alt+O`), which the editor remembers for every
folder. Each tab shows its platform's
glyph with the dialect's icon as a badge. `Ctrl+1` … `Ctrl+9` go to the first nine.

The pane of a project is its file tree, beside the strip, drawn like VS Code's explorer, with the icons of the
Chernobyl icon theme. It follows `files.exclude` and selects the file of the active editor. A click opens a file;
the keyboard walks it (arrows, Home, End, Enter).

### The right-click menu of the file tree

- **New File…**, **New Folder…**, **Rename…**, **Delete** (to the trash).
- **New with Synapsis**: the generators of the project's platform (`nuclear make` / `nuclear gen`). It lists only
  what fits the folder you clicked, for example only *New Use case* on a `usecases` folder. The items are *New
  Use case, Model, Service, Aggregate, Repository, Entity, Controller, Listener, Agent, Graph, Tools, State,
  Stateful widget, Stateless widget, State model, State manager, Shared widget, Guard, Event, Global component,
  Page, Integration test, Component, Screen, Config, Test* and *Resource (from fields)*.
- `build/`, `node_modules/` and the files that define a project have no menu items, so you cannot delete them
  from here.

### The actions of a project

The actions of the active project's platform are buttons in the editor title bar, the row of the editor tabs. Cursor
hides the title bar's: there, open the **Actions** section at the bottom of the workspace's files pane (collapsed at
first, like VS Code's npm scripts) and click an action:

| Platform | Buttons |
|---|---|
| mobile | ▷ Run, ◉ Debug, ↻ Hot Reload, ▭ Run on a Synapsis Device, ⚒ Build, ✓ Test, ☑ Check |
| backend | ▷ Serve, ◉ Debug, ✓ Test, ⚒ Build, ☑ Check, ⇄ Routes in HTTP Connections |
| web | ▷ Serve, ▭ Device, ◉ Debug, ↻ Reload, ⚒ Build, ✓ Test, ☑ Check |

| Key | Action |
|---|---|
| `Ctrl+Alt+R` | Run (mobile) / Serve (backend, web) |
| `Ctrl+Alt+G` | Debug |
| `Ctrl+Alt+L` | Hot Reload / Reload |
| `Ctrl+Alt+B` | Build |
| `Ctrl+Alt+T` | Test |
| `Ctrl+Alt+C` | Check |

Device and API have no key. *Nuclear: Run an Action of the Active Project* lists them all.

- Mobile ▷ Run and ◉ Debug build the app and launch it. ▷ Run, ◉ Debug and ▭ Device first ask which device to
  use: a Synapsis device (shown or hidden), a new one, *Other Flutter device…* or the Devices workspace.
- A mobile project opened as a tab is outside the VS Code workspace, and the Dart extension runs Flutter only
  inside it. So ▷ Run, ◉ Debug and ▭ Device add the folder first: the window reloads once, then the action goes on.
- Backend and web ▷ Serve, ⚒ Build, ✓ Test and ☑ Check run in a terminal named `<project> · <action>` (`nuclear
  run`, `build`, `test`, `check`). When the app has no packages yet, `nuclear install` runs first.
- Web ▭ Device, ◉ Debug and ↻ Reload use [the web device](../../../tools/nuclear-device-manager/docs/08-guides/README.md).
- Backend ⇄ opens the project's routes in HTTP Connections.

How a run and a debug session work: [run, debug and tasks](run-and-debug.md).

## Tool tabs

The tools are at the bottom of the strip, each an icon in its colour over a word; hover one (or reach it with Tab)
to see its name and key. The open one has a frame and a glowing bar; a dashed icon is a tool not built yet.

| Tool | Icon | Key | State | Guide |
|---|---|---|---|---|
| Nuclear Builder | a factory | `Ctrl+Alt+P` | built | [Nuclear Builder](../../../tools/nuclear-builder/docs/08-guides/README.md) |
| Your software company | three people | `Ctrl+Alt+E` | built: the teams, their members and the new-team wizard | [Make a team](../../../tools/nuclear-builder/docs/08-guides/make-a-team.md) |
| Reports | a bar chart with a coin | `Ctrl+Alt+K` | built: the bill of tokens and money and the reports of the factory's work | [Read the reports](../../../tools/nuclear-builder/docs/08-guides/read-the-reports.md) |
| Nuclear Atlas | a chat bubble | `Ctrl+Alt+A` | built | [Nuclear Atlas](../../../tools/nuclear-atlas/docs/08-guides/README.md) |
| HTTP Connections | a plug | `Ctrl+Alt+H` | built | [HTTP Connections](../../../tools/nuclear-http-connections/docs/08-guides/README.md) |
| Devices | a phone | `Ctrl+Alt+V` | built | [Devices](../../../tools/nuclear-device-manager/docs/08-guides/README.md) |
| Nuclear Monitor | a gauge | `Ctrl+Alt+F` | built | [Nuclear Monitor](../../../tools/nuclear-monitor/AGENTS.md) |
| Environments | three layers | `Ctrl+Alt+Y` | built: the variables of a project by environment, edited in place | [Environments](../../../tools/nuclear-environments/docs/08-guides/README.md) |
| UI designer | a pen's nib | `Ctrl+Alt+D` | a template page that lists what is planned | — |
| AI documenter | a page | `Ctrl+Alt+M` | a template page that lists what is planned | — |
| Settings and integrations | a gear | `Ctrl+Alt+S` | built | below |

The tools act on the last project you were in.

### Settings and integrations

Every setting of the AI services on one page, saved as the `nuclear.ai.*` settings:

- **Services**: the Smart Graph, with its state, and *Start* / *Restart*. The local models are on standby
  (ADR-platform-0013): the AI work is done by the agents and providers you choose, so there is no local model here.
- **MCP**: adds the Nuclear MCP server (`nuclear-mcp`) to Claude Code, Codex, Cursor or OpenCode in one click.
- **Connections**: the Smart Graph's clients and access requests (*Allow*, *Deny*, *Revoke*), Jira (its token is
  kept in VS Code's secret storage) and GitHub (`gh auth status`).
- **Pipeline**: Claude's model and the retry policy of Nuclear Builder.
- **Toolchains**: Python (included), Node.js and Flutter, each with where it was found (your setting, NuclearLang's
  own, the PATH, or not found) and *Browse…*, *Install NuclearLang's own*, *Use the one on PATH*.

The services are installed by *Nuclear: Set Up the AI Services*, a wizard in four steps
([Set up the AI services](../../../../installer/docs/08-guides/ai-setup.md)). It is offered once on a machine
that was never set up.

## Notifications

A chat answer or a Nuclear Builder run keeps working when you close its page or switch tabs. When a member of your
team answers you, mentions you (`@you`) or asks you something in Nuclear Chat, when a run waits for your approval,
and when a run passes or fails, a notification tells you, unless you are already looking at that conversation or
tool. *Open* takes you there: Nuclear Atlas on the conversation (the direct message with Askia, the team's
channel), the Builder on the run, or on the step that failed. Unread notices show as a badge on the Nuclear icon of
the activity bar, a badge on the tool's icon in the strip, and the list at the bottom of the column, where a click
goes to the same place. Opening the tool clears its badge. `nuclear.notifications` chooses what pops up: `all`,
`mentions-and-gates` (what is addressed to you and what waits for you) or `off` (only the badges and the list). Every `nuclear.ai.checkEveryMinutes` (5 by default) the extension
checks each connection. If one stops answering, or answers again, you get a notice in *Settings and
integrations*.

## The welcome page

`Ctrl+Alt+W` (at startup too, when no editor is open, only if you turn on `nuclear.workspace.welcome`; off by default since 0.73.2): the projects, the tools and
their keys. A click on a tab or an action also shows a short message with the key that does the same.
