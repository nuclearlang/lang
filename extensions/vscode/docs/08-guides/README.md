---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [workspace.md, run-and-debug.md, ../../../docs/08-guides/README.md, ../02-architecture/client.md]
---
# NuclearLang for VS Code

The extension `nuclearlang` (VS Code 1.90 or newer). It includes the language server `nuclear-lsp`, every dialect
with its type definitions, the Chernobyl themes and the tools of the Nuclear workspace. What the three editors
share: [the extensions](../../../docs/08-guides/README.md).

More guides: [the Nuclear workspace](workspace.md) · [run, debug and tasks](run-and-debug.md).

## Install

- The NuclearLang installer installs the `.vsix` when `code` is on the `PATH`.
- By hand: `code --install-extension nuclearlang-<version>.vsix` (from a GitHub release, or built with
  `npm run package` in `extensions/vscode/`).
- Then *Preferences: Color Theme* → **Chernobyl** (or **Chernobyl Soft**), and *Preferences: File Icon Theme* →
  **Chernobyl Icons** (or **Chernobyl Soft Icons**). After a theme update, quit VS Code completely to see the
  change.

The extension starts when you open a `.nuc` file or a folder that has one. The commands it runs (`nuclear build`,
`nuclear repair`…) are those of the installed `nuclear`.

## Writing Nuclear

- **Diagnostics** show in the editor and in the Problems panel while you type. A diagnostic with an exact fix
  offers a quick fix (`Ctrl+.`).
- **Completion**, **hover** and **signature help** come from the dialect of the file's project and its type
  definitions.
- **Go to definition** (F12), **find references**, **rename** (F2), the **outline** and **folding** work across
  the files of a project.
- **Semantic colors** are on for `.nuc` files. The extension also sets, for `[nuclear]`: tab size 2, spaces,
  indentation guides and format on type.
- **Comments**: Enter inside a `//` comment continues it with ` * `; Enter on an empty ` *` line ends it. There is
  no *Format Document* for `.nuc`: run `nuclear fmt` in a terminal.
- **The status bar** shows the project's platform and dialect (`backend · fastapi`), read from
  `.nuclear/project.json`. For a file outside any project it shows the `nuclear.dialect` setting; a click picks
  another dialect.
- **Show Generated Code** (the button in the editor title bar of a `.nuc`) opens beside it the code the file
  generates.
- **Code metrics**: a code lens above each function shows its complexity; a click shows the details.

## Commands

All are in the Command Palette (`Ctrl+Shift+P`) under **Nuclear** unless the category says otherwise.

| Command | What it does | Key |
|---|---|---|
| Show the Nuclear Workspace | opens the *Nuclear* container of the activity bar | `Ctrl+Alt+N` |
| Go to Project Tab | goes to a project tab of the workspace | `Ctrl+1` … `Ctrl+9` |
| Open a Project as a Tab | adds a project folder as a tab, without changing the VS Code workspace | `Ctrl+Alt+O` |
| Open a Tool | opens a tool of the strip | see [the workspace](workspace.md) |
| Welcome Page | the projects, the tools and the keys | `Ctrl+Alt+W` |
| Run an Action of the Active Project | run, debug, build, test… of the active tab | see [the workspace](workspace.md) |
| Add the Active Project to the VS Code Workspace | adds the tab's folder to the explorer, search and git | |
| Run / Debug | builds and launches a Synapsis mobile app (shown when the folder has one) | |
| Show Generated Code | the generated code beside the `.nuc` | |
| Select Dialect | the dialect of files outside a project | |
| Restart Language Server | stops and starts `nuclear-lsp` | |
| Toggle code metrics · Toggle code lenses for arrow functions | turn the metrics lenses off or on | |
| Update Contracts (nuclear contracts update) | refreshes the contracts an app declares | |
| Set Up the AI Services | the set-up wizard of the Smart Graph, the Developer and the models | |
| Open the web device · Debug on the web device · Reload the web device | the [web device](../../../tools/nuclear-device-manager/docs/08-guides/README.md) of a web project | |
| *Synapsis:* Open Synapsis Device · Run on Synapsis Device | the [Synapsis device](../../../tools/nuclear-device-manager/docs/08-guides/README.md) | |
| *HTTP Connections:* Refresh · Select Environment · Edit Environments · Add an OpenAPI Document · Open Request | [HTTP Connections](../../../tools/nuclear-http-connections/docs/08-guides/README.md) | |
| Step Over (Nuclear Line) · Step Into (Nuclear Line) · Step Out (Nuclear) | step by `.nuc` line while debugging | `F10` · `F11` · `Shift+F11` |
| Go to the Same Line in Nuclear / Dart | jumps between the `.nuc` and the generated file while debugging | |

The keys of the tools and the actions are in [the workspace guide](workspace.md). The debug keys apply only while
the app is paused in code that comes from a `.nuc` ([run and debug](run-and-debug.md)).

## Settings

| Setting | Default | What it does |
|---|---|---|
| `nuclear.dialect` | `flutter` | the dialect of `.nuc` files outside a project (`flutter`, `fastapi`, `nestjs`, `react`, `dart`, `python`, `typescript`, or `base` for the base language only); a project uses the dialect of its `config.nuc` or `nuclear.toml` |
| `nuclear.dialectPaths` | `[]` | extra folders with dialects; `<workspace>/dialects` is always searched |
| `nuclear.server.path` | `""` | another `nuclear-lsp` binary; empty: the bundled one, then the `PATH` |
| `nuclear.trace.server` | `off` | traces the messages with the server (`off`, `messages`, `verbose`) |
| `nuclear.buildOnSave` | `true` | saving a `.nuc` of a backend or web project runs `nuclear build` |
| `nuclear.workspace.welcome` | `true` | the welcome page at startup when no editor is open |
| `nuclear.debug.followInNuclear` | `true` | on a pause, show and highlight the `.nuc` line |
| `nuclear.debug.explainErrors` | `true` | Dart run-time errors at their `.nuc` line, with an explanation |
| `nuclear.codemetrics.*` | (generated) | the costs and thresholds of the code metrics, the same names as CodeMetrics |

The `nuclear.ai.*` settings (the services' addresses, the local models, Claude, Codex, OpenCode, Cursor, GitHub,
Jira, retries, time limits) are edited in the *Settings and integrations* tool (`Ctrl+Alt+S`), where each one has
its default. The most used:

| Setting | Default |
|---|---|
| `nuclear.ai.developerUrl` · `nuclear.ai.graphUrl` · `nuclear.ai.ollamaUrl` | `http://127.0.0.1:7879` · `http://127.0.0.1:7878` · `http://localhost:11434` |
| `nuclear.ai.models.coder` · `.assistant` · `.embeddings` | `qwen2.5-coder:3b` · `gemma4:e2b` · `embeddinggemma` |
| `nuclear.ai.claudeModel` · `nuclear.ai.claude.maxBudgetUsd` | `sonnet` · `2` |
| `nuclear.ai.mcpCommand` · `nuclear.ai.graphCommand` | `nuclear-mcp` · `nuclear-graph` |
| `nuclear.ai.contextTokens` | `8192` |
| `nuclear.ai.checkEveryMinutes` | `5` |
| `nuclear.ai.resumeInterrupted` | `true` |

A project's `.nuclear/builder.json` wins over these settings for its own Nuclear Builder runs.

## Troubleshooting

| What you see | What to do |
|---|---|
| No diagnostics, no completion | *Nuclear: Restart Language Server*. If `nuclear.server.path` is set, check the path. Set `nuclear.trace.server` to `messages` and read the *Output* panel. |
| Diagnostics of the wrong dialect | the file is outside a project: set `nuclear.dialect`, or create the project's `config.nuc` / `nuclear.toml` |
| A dialect of your own is not found | add its folder to `nuclear.dialectPaths` |
| The server is gone after a while | normal: it stops 5 minutes after the last `.nuc` closes and starts again with the next one |
| After the first build of a mobile app, no devices in the picker | accept *Reload Window*: the Dart extension looks for apps only when the window opens |
| A build fails | read the *Synapsis* output panel; the extension runs `nuclear repair` once by itself |
| A new theme does not show | quit VS Code completely and open it again |
| Nuclear Atlas or the Builder says a service is down | open *Settings and integrations* (`Ctrl+Alt+S`) and *Start* it, or run the set-up ([Set up the AI services](../../../../installer/docs/08-guides/ai-setup.md)) |
