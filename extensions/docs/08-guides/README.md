---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../00-context/vision.md, ../02-architecture/language-server.md, ../../vscode/docs/08-guides/README.md, ../../jetbrains/docs/08-guides/README.md, ../../zed/docs/08-guides/README.md, ../../../docs/03-adr/0004-products-are-made-with-the-tools.md]
---
# The editor extensions

NuclearLang has one extension for each of three editors: VS Code, Android Studio / IntelliJ (JetBrains) and Zed.
All three use the same language server, `nuclear-lsp`, so a `.nuc` file gets the same diagnostics, completion and
colors in every editor. On top of that, each extension lets you use the platform's tools from the editor: the
`nuclear` command, Nuclear Builder, HTTP Connections and the devices. You make a product with those tools
([ADR-platform-0004](../../../docs/03-adr/0004-products-are-made-with-the-tools.md)), and the extension is where
you run them.

## What they give

- **The language server**, the same in every editor:
  - live diagnostics, with the codes of `nuclear check` (`N0106`…), and a quick fix when the fix is exact;
  - completion: variables in scope, members of external classes (`Colors.`), named arguments (the required ones
    first), methods to override, decorators and their arguments, kinds at the start of a line;
  - hover and signature help, taken from the type definitions of the dialect;
  - go to definition, find references, highlight uses, rename, outline and folding;
  - semantic colors: kinds, modules, enums, parameters and library names (a deprecated name is struck through);
  - code metrics: a complexity code lens above each function, like the CodeMetrics extension;
  - projects with several files: a file sees the names of the other files of its project, and the architecture
    rules of its platform apply.
- **Formatting while you type**: Enter inside a `//` comment continues it with ` * `, and Enter on an empty ` *`
  line ends it. The editors have no "Format Document" for Nuclear: format a whole file with `nuclear fmt` in a
  terminal.
- **The Chernobyl themes**: *Chernobyl* and *Chernobyl Soft*, with their file icons.
- **Run, debug and devices** for Synapsis projects. How much you get depends on the editor (see the table).
- **The tools**: HTTP Connections (an HTTP client like Postman), Nuclear Builder (the pipeline from a spec to
  code), Nuclear Atlas (the local agent integrated with the RAG: the chat with the local agents over the Smart Graph), and the devices. VS Code has all of them in the *Nuclear workspace*.

## Which editor has what

| | VS Code | Android Studio / IntelliJ | Zed |
|---|---|---|---|
| Language server (diagnostics, fixes, completion, hover, navigation, rename) | yes | yes | yes |
| Semantic colors, outline, folding | yes | yes | yes, once turned on in `settings.json` |
| Code metrics | code lens and colors | code lens and colored marks | code lens; the details come as a message |
| Chernobyl themes and icons | yes | yes (UI theme and color scheme) | yes |
| Platform and dialect in the status bar | yes | no | no |
| Generated code beside the `.nuc` | *Show Generated Code* | no | a task prints it in a terminal |
| The Nuclear workspace (projects and tools as tabs) | yes | no: tool windows with shortcuts | no |
| Run, build on save, automatic repair | every platform | mobile (the Flutter plugin runs the app) | tasks and ▷ in the gutter |
| `.nuc` breakpoints and the paused `.nuc` line | every platform, with stepping by Nuclear line | mobile | no |
| Devices inside the editor | the Synapsis device (mobile) and the web device | no | no (`nuclear device` opens its own window) |
| HTTP Connections | `Ctrl+Alt+H` | `Alt+Shift+H` | no |
| Nuclear Builder | `Ctrl+Alt+P` | `Alt+Shift+P` (runs `nuclear-builder`) | no |
| Nuclear Atlas, *Settings and integrations*, notifications | yes | no | no |

Zed lets an extension add no panels, views, keybindings or actions on save, so the devices, `.nuc` debugging and
the workspace cannot be built there.

## Install

The installer installs the extensions it can, together with `nuclear` and `nuclear-lsp`:

- **The public installer** (the one-line install of the website) installs the VS Code extension (`.vsix`) when
  VS Code is on the `PATH`. `--no-vscode` (`-NoVSCode` on Windows) skips it.
- **From the source tree**, `installer/install.sh` installs the newest `extensions/vscode/nuclearlang-*.vsix`
  when `code` is on the `PATH` (`--no-vscode` skips it), and builds and installs the Zed extension when Zed is
  installed and the Rust target `wasm32-wasip2` is present (`--no-zed` skips it).
- **VS Code by hand**: `code --install-extension nuclearlang-<version>.vsix`. The `.vsix` is attached to each
  GitHub release, or you build it with `npm run package` in `extensions/vscode/`.
- **Android Studio / IntelliJ**: build the plugin zip with `IDE_HOME=/opt/android-studio ./build.sh` in
  `extensions/jetbrains/`, then *Settings → Plugins → ⚙ → Install Plugin from Disk…*. The release does not ship
  the zip.
- **Zed**: `./build.sh` in `extensions/zed/` builds the extension and installs it into Zed. The server comes from
  the installer (`~/.local/bin/nuclear-lsp`).

The details are in each editor's guide.

## The guides

| Guide | Read it to… |
|---|---|
| [VS Code](../../vscode/docs/08-guides/README.md) | install, every command, key and setting, troubleshooting |
| [VS Code: the Nuclear workspace](../../vscode/docs/08-guides/workspace.md) | use the strip of projects and tools, the actions, the file tree |
| [VS Code: run, debug and tasks](../../vscode/docs/08-guides/run-and-debug.md) | run a project, reload it on save, debug a `.nuc` |
| [Android Studio / IntelliJ](../../jetbrains/docs/08-guides/README.md) | install the plugin and use it on a Synapsis project |
| [Zed](../../zed/docs/08-guides/README.md) | install the extension, turn on its features, use the tasks |
| [HTTP Connections](../../tools/nuclear-http-connections/docs/08-guides/README.md) | call the endpoints of your projects, environments, OpenAPI |
| [Devices](../../tools/nuclear-device-manager/docs/08-guides/README.md) | run a mobile app or a web app inside VS Code |
| [Nuclear Atlas](../../tools/nuclear-atlas/docs/08-guides/README.md) | ask about your project and give orders to the local agents |
| [Nuclear Builder](../../tools/nuclear-builder/docs/08-guides/README.md) | take a spec through plan, tests, code and deploy |
| [Set up the AI services](../../../installer/docs/08-guides/ai-setup.md) | install the Smart Graph, the Nuclear Developer and the models Nuclear Atlas and the Builder need |
