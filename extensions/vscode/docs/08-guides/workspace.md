---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [README.md, run-and-debug.md, ../02-architecture/workspace.md, ../../../docs/03-adr/0002-the-nuclear-workspace.md]
---
# The Nuclear workspace

The Nuclear icon of the activity bar (`Ctrl+Alt+N`) opens one view, **Workspace**: a vertical strip of tabs and a
pane beside it. Each tab is a workspace of its own, either a project or a tool. Switching tabs swaps the editor
area: the editors of the tab you leave are saved and closed, and those of the tab you enter are opened again. An
unsaved editor stays open (you never get a save prompt), and the devices stay beside the code.

## Project tabs

The projects are at the top of the strip. They are the Nuclear projects of the VS Code workspace folders, plus
the ones you opened with *Open a Project as a Tab* (`Ctrl+Alt+O`). That command remembers the folder without
adding it to the VS Code workspace. Each tab shows its platform's glyph with the dialect's icon as a badge.
`Ctrl+1` … `Ctrl+9` go to the first nine projects. `+` opens another one.

The pane of a project is its file tree, with the icons of the Chernobyl icon theme. It follows `files.exclude`.
A click opens a file.

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

The actions of the active project's platform are buttons in the editor title bar, the row of the editor tabs:

| Platform | Buttons |
|---|---|
| mobile | ▷ Run, ◉ Debug, ↻ Hot Reload, ▭ Run on a Synapsis Device, ⚒ Build, ✓ Test, ☑ Check |
| backend | ▷ Serve, ◉ Debug, ✓ Test, ⚒ Build, ☑ Check, ⇄ Routes in Nuclear Connector |
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
- Backend ⇄ opens the project's routes in Nuclear Connector.

How a run and a debug session work: [run, debug and tasks](run-and-debug.md).

## Tool tabs

The tools are at the bottom of the strip.

| Tool | Key | State | Guide |
|---|---|---|---|
| Nuclear Connector | `Ctrl+Alt+H` | built | [Nuclear Connector](../../../tools/nuclear-connector/docs/08-guides/README.md) |
| Devices | `Ctrl+Alt+V` | built | [Devices](../../../tools/nuclear-device-manager/docs/08-guides/README.md) |
| Nuclear Builder | `Ctrl+Alt+P` | built | [Nuclear Builder](../../../tools/nuclear-builder/docs/08-guides/README.md) |
| UI designer | `Ctrl+Alt+D` | a template page that lists what is planned | — |
| AI documenter | `Ctrl+Alt+M` | a template page that lists what is planned | — |
| Nuclear agent | `Ctrl+Alt+A` | built | [The chat](../../../tools/nuclear-ai-chat/docs/08-guides/README.md) |
| Settings and integrations | `Ctrl+Alt+S` | built | below |

The tools act on the last project you were in.

### Settings and integrations

Every setting of the AI services on one page, saved as the `nuclear.ai.*` settings:

- **Services**: the Smart Graph, the Nuclear Developer and Ollama, each with its state, and *Start* / *Restart*
  with the chosen models.
- **Models**: the models Ollama has, with their size. A model over the 3B class gets a warning. *Pull* downloads
  a model.
- **MCP**: adds the Nuclear MCP server (`nuclear-mcp`) to Claude Code, Codex, Cursor or OpenCode in one click.
- **Connections**: the Smart Graph's clients and access requests (*Allow*, *Deny*, *Revoke*), Jira (its token is
  kept in VS Code's secret storage) and GitHub (`gh auth status`).
- **Pipeline**: Claude's model and the retry policy of Nuclear Builder.

The services are installed by *Nuclear: Set Up the AI Services*, a wizard in four steps
([Set up the AI services](../../../../installer/docs/08-guides/ai-setup.md)). It is offered once on a machine
that was never set up.

## Notifications

A chat answer or a Nuclear Builder run keeps working when you close its page or switch tabs. When it ends, a
notification with *Open* tells you, unless you are already looking at it. Unread notices show as a badge on the
Nuclear icon of the activity bar, a count on the tab of *Nuclear agent*, *Nuclear Builder* or *Settings and
integrations*, and a list in that tool's pane. Every `nuclear.ai.checkEveryMinutes` (5 by default) the extension
checks each connection. If one stops answering, or answers again, you get a notice in *Settings and
integrations*.

## The welcome page

`Ctrl+Alt+W`, and at startup when no editor is open (`nuclear.workspace.welcome`): the projects, the tools and
their keys. A click on a tab or an action also shows a short message with the key that does the same.
