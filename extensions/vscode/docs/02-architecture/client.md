---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [overview.md, debugging.md, ../../../docs/02-architecture/language-server.md]
---
# The client and Synapsis projects (`src/extension.ts`, `src/card.ts`)

## The client

`extension.ts` starts the server ([where it finds it](../../../docs/02-architecture/language-server.md)) and adds:

- **The status bar**: the project's platform and dialect (`backend · fastapi`), read from the project card
  `.nuclear/project.json` (`projectCard`). A file outside a project shows `nuclear.dialect`, and a click opens the
  picker of dialects.
- **Show Generated Code**: the code the file generates, beside it (`nuclear/transpile`).
- `watchIdle`: stops the server 5 minutes after the last `.nuc` closes.

`card.ts` reads the card (`readCard(root)`, `projectCard(file)`, `appDir`, `isInstalled`): the platform, the
dialect, the output folder and the toolchain of a project, so the client never assumes a path, a port or a command
of a dialect.

The toolchains' settings (`nuclear.toolchains.*`) are in the environment of every process the extension starts and
every terminal: `NUCLEAR_PYTHON`, `NUCLEAR_NODE`, `FLUTTER_ROOT`/`FLUTTER`, which `nuclear` reads before its own and
the PATH ([ai-services.md](ai-services.md#the-toolchains-toolchainsts-toolchainhostts)); with no Flutter setting and no
Flutter variable, the Dart extension's `dart.flutterSdkPath` (or `dart.flutterSdkPaths`) is `FLUTTER_ROOT`.

The language server (`serverCandidates`, `toolchains.ts`): `nuclear.server.path`, else the installer's
`<installation>/bin/nuclear-lsp` (this system's own build), the PATH, the build bundled in `server/` (a Linux x86_64
build: only on Linux x86_64), a build of the repository.

Settings: `nuclear.dialect` (`flutter` by default; `base` checks only the base language), `nuclear.dialectPaths`,
`nuclear.server.path`, `nuclear.trace.server`.

## A Synapsis project

`findSynapsis(root?)` reads `build/<name>.code-workspace`, which `nuclear build` writes; it works with the
workspace file open (`nuclear code`) and with only the folder open (`code .`). It takes a project's root, so a tab
of the Nuclear workspace runs its own project; `synapsisOf(file)` walks up from a file for the hot reload on save.

### Mobile

- **▷ Run / Debug** (`editor/title/run`, context `nuclear.canRun`) and **F5 without `launch.json`** (the debugger
  `synapsis` resolves to a `dart` configuration): both run `nuclear build` first (the queue `buildQueue`, the
  output panel *Synapsis*) and launch the `<project> (debug)` configuration of the workspace file.
  `runApp(noDebug, deviceId, extra, root)`.
- **Ctrl+S on a `.nuc`** → build + `flutter.hotReload` when a `dart` session is running.
- *Reload Window* is offered when the app appears with the window already open: the Dart extension ignores a new
  app inside `build/` until the window opens again.
- **Repair**, only when something fails:
  - a build that exits with a code other than 0 and 2 → `nuclear repair`;
  - `watchSession` (a `DebugAdapterTracker` of `dart`) marks `flutter.appStarted` and the user's stops, and reads the
    output: `Hot reload was rejected` → `flutter.hotRestart`; a compile error → `repairAndRelaunch`;
  - a session that ends without starting and without Stop → repair, then launch again.
  - Once per launch (`synapsisRepaired`). A relaunch from `repairAndRelaunch` is a new launch
    (`synapsisToolArgs`).

### Backend and web

`extension.ts` reads any `(debug)` launch of `build/<name>.code-workspace`: the CLI writes debugpy for fastapi, node
with source maps for nestjs and chrome for react (`tools/cli/src/framework/vscode.rs`, `write`).
`runPlatformApp` builds and starts it (a react app's dev server first, in its terminal). Saving a `.nuc` of a
backend or web project runs `nuclear build` (`nuclear.buildOnSave`), and the server or the page reloads by itself
(uvicorn `--reload`, `node --watch`, Vite).

The buttons of each platform and their shortcuts are the workspace's: [workspace.md](workspace.md).
