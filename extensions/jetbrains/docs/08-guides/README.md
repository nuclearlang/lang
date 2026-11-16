---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/overview.md, ../../../docs/08-guides/README.md, ../../../tools/nuclear-connector/docs/08-guides/README.md, ../../../tools/nuclear-builder/docs/08-guides/README.md]
---
# NuclearLang for Android Studio and IntelliJ

The plugin `dev.nuclearlang`, for Android Studio and IntelliJ (build 251 or newer). It includes the language
server, every dialect, the TextMate grammar of the VS Code extension and the Chernobyl themes. What the three
editors share: [the extensions](../../../docs/08-guides/README.md).

TODO(human): the plugin is compiled against Android Studio 2026.2 but was never loaded in a running IDE. Confirm
each step below in a real IDE before this guide is published.

## Install

1. Build the zip: `IDE_HOME=/opt/android-studio ./build.sh` in `extensions/jetbrains/` → `build/nuclearlang-<version>.zip`.
   It needs `extensions/vscode/` beside it, node and cargo.
2. *Settings → Plugins → ⚙ → Install Plugin from Disk…* → the zip, then restart the IDE.
3. *Settings → Appearance → Theme* → **Chernobyl** or **Chernobyl Soft**. This also sets the editor's color scheme.
   For the color scheme only: *Settings → Editor → Color Scheme → ⚙ → Import* → `Chernobyl.icls`.

The plugin needs the IDE's LSP support (`com.intellij.modules.lsp`) and the bundled TextMate plugin. For Synapsis
mobile projects it also needs the Flutter and Dart plugins.

## Writing Nuclear

- The language server starts when a `.nuc` opens: diagnostics with quick fixes, semantic highlighting, hover,
  completion, parameter info, go to declaration, find usages, rename and the structure view.
- Enter inside a `//` comment continues it with ` * `; Enter on an empty ` *` line ends it.
- **Code metrics**: a code lens above each function shows its complexity ("Complexity is 3 Everything is cool!"),
  with the details on click and a colored mark per level, also on the error stripe. *Tools → NuclearLang* has the
  two toggles: *Toggle code metrics* and *Toggle code lenses for arrow functions*.

## Settings

*Settings → Tools → NuclearLang*:

- **Dialect**: the dialect of `.nuc` files outside a project.
- **nuclear-lsp path**: empty uses the server bundled with the plugin, then `nuclear-lsp` on the `PATH`. Applying
  restarts the server.
- **Debugging a Synapsis app: show the .nuc line where it pauses**.
- **Dart run-time errors: mark their .nuc line and explain them (Nuclear Error window)**.

*Settings → Tools → NuclearLang → Code Metrics*: the costs and thresholds of the metrics. Only the values you
change are saved.

## A Synapsis mobile project

Open the project folder (*File → Open*). A Synapsis project is a folder with `build/<name>.code-workspace`, which
`nuclear build` writes.

- The plugin runs `nuclear build` when the project opens. The first time, it adds the app (`build/app`) as a module
  and offers *Reopen Project*. After the reopen, the Flutter plugin gives the device picker, the `main.dart`
  configuration, Run / Debug, hot reload and DevTools.
- **Run and Debug** run `nuclear build` first, with a progress dialog. If the build fails, a notice shows the end
  of its output.
- **Saving a `.nuc`** builds and hot reloads the running apps. A rejected hot reload becomes a hot restart.
- **Repair**: when the build fails, the app ends with an error you did not cause, or a reload gives a compile
  error, the plugin runs `nuclear repair` and runs the app again. It repairs at most once every 5 minutes.
- The IDE runs `flutter run` and the language server itself; the plugin starts neither.

Backend and web projects get the language server but no run integration in this plugin.

## Debugging a `.nuc`

- A breakpoint in a `.nuc` (type *Nuclear line breakpoints*) gets a mirror Dart breakpoint in the generated file.
- On a pause the `.nuc` opens with the line highlighted.
- A Dart error printed in the console is marked in red on its `.nuc` line. The **Nuclear Error** tool window (on
  the right, in Synapsis projects) explains it, with the stack in Nuclear and the Dart error.
- There is no stepping by Nuclear line: the steps are Dart's.

## The tool windows

| Tool window | Where | Shortcut | Guide |
|---|---|---|---|
| Nuclear Connector | left | `Alt+Shift+H` | [Nuclear Connector](../../../tools/nuclear-connector/docs/08-guides/README.md) |
| Nuclear Builder | bottom | `Alt+Shift+P` | [Nuclear Builder](../../../tools/nuclear-builder/docs/08-guides/README.md) |
| Nuclear Error | right | — | above |

Both shortcuts are also under *Tools → NuclearLang*. Nuclear Builder runs through the `nuclear-builder` command,
which the installer puts on the `PATH`.

## What it does not have

The Nuclear workspace, the platform and dialect in the status bar, *Show Generated Code*, the devices inside the
editor, the chat, *Settings and integrations*, the notifications and the *Retry* buttons of Nuclear Builder. They
are in [VS Code](../../../vscode/docs/08-guides/README.md).
