# NuclearLang for VS Code

**NuclearLang** (`.nuc`) is a minimal language, made to be written by AI agents and read by people. A transpiler
written in Rust turns it into the code an expert would write in the target: Dart/Flutter, TypeScript, Python. This
extension brings the language server (`nuclear-lsp`), the dialects (`flutter`, `fastapi`, `nestjs`, `react`, and
the base `dart`, `python`, `typescript`) with their type definitions, the **Nuclear workspace** with the platform's
tools, and the **Chernobyl** themes.

## Why it exists

Agents write better when there is less to write and one single way to write it. Nuclear removes the noise of the
target (imports, boilerplate, `super.key`, `setState(() { })`) and keeps the logic. This `.nuc`:

```nuclear
stateful Counter
  count: int = 0

  increment() void
    setState()
      count = count + 1

  build(context: BuildContext) Widget
    Scaffold(
      body = Center(child = Text('Clicks: ${count}')),
      floatingActionButton = FloatingActionButton(
        onPressed = increment,
        child = Icon(Icons.add),
      ),
    )
```

becomes this Dart (the transpiler's real output):

```dart
import 'package:flutter/material.dart';

class Counter extends StatefulWidget {
  const Counter({super.key});

  @override
  State<Counter> createState() => _CounterState();
}

class _CounterState extends State<Counter> {
  int count = 0;

  void increment() {
    setState(() {
      count = count + 1;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(child: Text('Clicks: $count')),
      floatingActionButton: FloatingActionButton(onPressed: increment, child: Icon(Icons.add)),
    );
  }
}
```

The extension puts everything around that code in one window: writing it, running and debugging the app, calling
its API and handing work to the local agents. It is not the language: completion, hover and diagnostics come from
the language server, and what a dialect means comes from the dialect.

## What it brings

- **The language server**: live diagnostics with the transpiler's codes (`N0106`) and a quick fix when the fix is
  exact; completion of members, named arguments, overrides and decorators; hover and signature help from the type
  definitions; go to definition, references, rename, outline, folding; semantic colors; multi-file projects with the
  architecture rules of their platform. The status bar shows the project's platform and dialect (`backend · fastapi`).
- **Show Generated Code**: the Dart, TypeScript or Python a `.nuc` generates, beside it.
- **Code metrics**: a complexity code lens above each function, like CodeMetrics.
- **The Nuclear workspace** (`Ctrl+Alt+N`): a strip of tabs, the projects at the top and the tools at the bottom.
  Every tab is a workspace of its own; a project's tab shows its files and puts its platform's actions (run, debug,
  device, build, test, check…) in the editor title bar, each with a key.
- **Run, debug and reload on save** for every platform: breakpoints in the `.nuc`, the paused line in the `.nuc`,
  stepping by Nuclear line, under the Dart debugger, node, debugpy and Chrome; saving a `.nuc` rebuilds and the
  running app, server or page takes it.
- **The devices** (`Ctrl+Alt+V`): a mobile app or a web app running inside the editor, beside its code.
- **HTTP Connections** (`Ctrl+Alt+H`): an HTTP client like Bruno that already knows every endpoint of your
  projects, read from the contract the compiler writes.
- **Nuclear Builder** (`Ctrl+Alt+P`): a spec taken through plan, tests first, code, verification, security and
  deploy by Claude and the local agents, every step visible. The same engine is the `nuclear-builder` command.
- **Nuclear Atlas** (`Ctrl+Alt+A`): the local agent integrated with the RAG, a chat with the local agents about the
  active project, answered from the Nuclear Smart Graph (100% local, the knowledge base the MCP serves too); `/task <order>` runs it
  as a Builder run.
- **Set up the AI services** and **Settings and integrations** (`Ctrl+Alt+S`): a wizard that installs the Smart
  Graph, the Nuclear Developer and the local models that fit the machine, and one page for every `nuclear.ai.*`
  setting, the MCP server and the connections.
- **The Chernobyl and Chernobyl Soft themes**, with their file icons.

Every command, key and setting is in [the guide](docs/08-guides/README.md).

## How we made it

- **One language server and one base extension per editor**
  ([ADR-extensions-0001](../docs/03-adr/0001-one-base-extension-per-editor.md)): the same `nuclear-lsp` serves
  VS Code, Android Studio and Zed, and the extension knows a dialect only as data. A project's dialect comes from its
  manifest (`config.nuc` or `nuclear.toml`), so a backend project never sees Flutter's kinds.
- **The Nuclear workspace** ([ADR-extensions-0002](../docs/03-adr/0002-the-nuclear-workspace.md)): one container,
  one thing on screen at a time, keyboard first, the devices beside the code like emulators.
- **A page is only a view**: a Builder run or a chat question belongs to the extension, so closing its page or
  switching tools leaves the work running, and a notification says when it ends.
- **The tools come first** ([ADR-platform-0004](../../docs/03-adr/0004-products-are-made-with-the-tools.md)): the
  generators of the file tree's *New with Synapsis* menu are `nuclear make` and `nuclear gen`, and the Builder runs
  `nuclear gen` before any agent writes.
- **Written in TypeScript**, bundled with esbuild, the panels in plain HTML and script with no framework. The tools'
  code lives in their own projects ([`../tools/`](../tools/)), bundled here.

Done and never tried in a running VS Code (only headless renders and node checks): the workspace, the AI pages and
the web device panel among them ([roadmap](docs/01-product/roadmap.md)).

## Try it

```sh
code --install-extension nuclearlang-<version>.vsix   # from a GitHub release, or built below
cd extensions/vscode && npm install && npm run package # → nuclearlang-<version>.vsix
```

The NuclearLang installer installs the `.vsix` by itself when `code` is on the `PATH`. Then open a `.nuc` file:
diagnostics appear while you type. *Preferences: Color Theme* → **Chernobyl**; `Ctrl+Alt+N` opens the workspace,
`Ctrl+Alt+W` its welcome page with the projects, the tools and the keys.

## Where to read next

| | |
|---|---|
| Install, every command, key and setting, troubleshooting | [docs/08-guides/README.md](docs/08-guides/README.md) |
| The strip, the actions, the file tree, the settings page | [docs/08-guides/workspace.md](docs/08-guides/workspace.md) |
| The tasks, run, hot reload and `.nuc` debugging | [docs/08-guides/run-and-debug.md](docs/08-guides/run-and-debug.md) |
| The tools | [Nuclear Builder](../tools/nuclear-builder/README.md), [HTTP Connections](../tools/nuclear-http-connections/README.md), [Nuclear Atlas](../tools/nuclear-atlas/README.md), [the devices](../tools/nuclear-device-manager/README.md) |
| Set up the AI services | [the set-up guide](../../installer/docs/08-guides/ai-setup.md) |
| What the three editors share | [the extensions](../README.md) |
| What changed | [CHANGELOG.md](CHANGELOG.md) |
| To change it | [AGENTS.md](AGENTS.md) |
