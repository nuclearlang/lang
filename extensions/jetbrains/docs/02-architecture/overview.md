---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../01-product/roadmap.md, ../../../docs/02-architecture/overview.md, ../../../docs/02-architecture/language-server.md]
---
# The JetBrains plugin: its classes

The plugin's own classes are in `src/dev/nuclearlang/editor/`; the tool windows' classes are in
`../tools/<tool>/jetbrains/src/dev/nuclearlang/editor/`, compiled with them by `build.sh`. The plugin is built into a zip by `build.sh` and installed unpacked
in `~/.local/share/Google/AndroidStudio2026.2.1/nuclearlang`.

## The base

| Class | What it does |
|---|---|
| `NuclearLspServerSupportProvider`, `NuclearLspServerDescriptor` | start `nuclear-lsp` when a `.nuc` opens; the server finds the dialects shipped next to its binary |
| `NuclearSettings`, `NuclearConfigurable` | the application's settings and the files the plugin ships (server, dialects, TextMate bundle); *Settings → Tools → NuclearLang*: dialect and server path (applying restarts the server) |
| `NuclearTextMateBundleProvider` | registers the TextMate grammar of the VS Code extension (shipped in `textmate/nuclear`) |
| `NuclearFileIconProvider` | the `.nuc` icon, also as an `IconProvider` ordered `first` (`$Psi`: tabs, search, navigation) and a project view decorator ordered `last` (`$Tree`), so it beats icon plugins such as Atom Material Icons, which maps `.nuc` to Nuclide |
| `NuclearCommentEnter` | Enter inside a `//` comment continues it with ` * `; Enter on an empty ` *` line ends the comment |
| `NuclearCodeMetrics`, `NuclearCodeLensSupport`, `NuclearCodeMetricsMarkers`, `NuclearCodeMetricsConfigurable`, `NuclearCodeMetricsActions` | the code metrics the server computes: the code lens and its list of entries, the colored mark per level and on the error stripe, *Settings → Tools → NuclearLang → Code Metrics*, the two toggles; only the values the user changed are stored |

## Synapsis projects (`NuclearSynapsis.java`)

A Synapsis project is a folder with `build/<name>.code-workspace`. *File → Open* → the project folder.

- `Startup` runs `nuclear build` and, if the app is not a module yet, loads
  `build/app/<name>_flutter_app.iml` and offers *Reopen Project*. On reopening, the Flutter plugin gives the device
  picker, the `main.dart` configuration, Run / Debug, hot reload and DevTools.
- `OnSave` of a `.nuc` → build + `Flutter.Toolbar.ReloadAllAction`.
- `BeforeRun` (an `ExecutionListener`) → `nuclear build` with a modal progress; `repair` if it failed with a code
  other than 2.
- `processTerminated` with a code other than 0 and without `TERMINATION_REQUESTED`, or a compile error after a
  reload → `repairAndRestart` (at most once per 5 minutes).
- `Hot reload was rejected` → `Flutter.Toolbar.RestartAllAction`.

## Debugging a `.nuc` (`NuclearDebug.java`)

On top of the Dart plugin, with the line map `build/app/.dart_tool/nuclear_lines.json`:

- a `BreakpointType` (`nuclear-line`) with `Dart` mirrors in the generated file (`Breakpoints`, `MapWatcher`);
- `Sessions`: a pause shows the `.nuc` line with `EXECUTIONPOINT_ATTRIBUTES`;
- `OutputErrors`: a Dart error in the console → `nuclear explain --json` → a red line at the `.nuc` and the tool
  window *Nuclear Error*.

Mixed stepping is not done here.

## The tool windows

| Tool window | Class | Shortcut | Project |
|---|---|---|---|
| *Nuclear Connector* (left) | `../tools/nuclear-connector/jetbrains/src/…/NuclearConnector.java` | `Alt+Shift+H` | [`tools/nuclear-connector`](../../../tools/nuclear-connector/docs/02-architecture/overview.md) |
| *Nuclear Builder* (bottom) | `../tools/nuclear-builder/jetbrains/src/…/NuclearBuilder.java` | `Alt+Shift+P` | [`tools/nuclear-builder`](../../../tools/nuclear-builder/docs/02-architecture/overview.md) |
| *Nuclear Error* (right) | `NuclearDebug.java` | — | above |

## What the build changes

`build.sh` packs the grammar without the patterns of `@example` (JetBrains cannot dim code by context: there it
stays comment gray) and the `language-configuration.json` without `onEnterRules` (the Enter inside comments is
`NuclearCommentEnter`'s, so they never apply twice).

## What the plugin does not have

- The Nuclear workspace: it has tool windows and actions with shortcuts instead (ADR-extensions-0002).
- The project card in the status bar: only the tool windows read `.nuclear/project.json`, to find the projects.
- The devices inside the editor: the Synapsis device is a Flutter custom device of VS Code only.
- The chat, the settings page, the notifications and the Retry buttons of Nuclear Builder.

A decision cited by its old platform-wide number (`ADR-00NN`, in code or commits before 2026-11-16): see
[the table of old numbers](../../../../docs/03-adr/old-numbers.md).
