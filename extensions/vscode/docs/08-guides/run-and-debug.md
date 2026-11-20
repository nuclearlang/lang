---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [README.md, workspace.md, ../02-architecture/client.md, ../02-architecture/debugging.md]
---
# Run, debug and tasks in VS Code

Every `nuclear build` writes `build/<name>.code-workspace` for a Synapsis project. That file holds two folders
(the `.nuc` sources and the generated app), the `nuclear` tasks and the debug launch of the project's dialect.
`nuclear code` opens it. If you open only the project folder (`code .`), the extension still reads it. Each build
rewrites the file, so changes you make to it by hand are lost.

## Tasks

*Terminal → Run Task…* lists the tasks of the workspace file. The project's folder is their working folder.

| Task | When it is there | What it runs |
|---|---|---|
| `nuclear: build` | always; the default build task (`Ctrl+Shift+B`) | `nuclear build` |
| `nuclear: watch` | mobile; starts by itself when the folder opens | `nuclear watch`: transpiles each saved `.nuc` |
| `nuclear: install` | when the dialect has an install step | `nuclear install` |
| `nuclear: run` | when the dialect serves an app (backend, web) | `nuclear run`, until stopped |
| `nuclear: test` | always; the default test task | `nuclear test` |
| `nuclear: test --integration` | mobile | `nuclear test --integration` |
| `nuclear: analyze` | mobile | `nuclear analyze` |
| `nuclear: check` | always | `nuclear check` |

The errors of the `.nuc` files show in the Problems panel through the language server. The tasks do not repeat
them.

## Mobile

- **▷ Run / ◉ Debug** (the project's actions, `Ctrl+Alt+R` / `Ctrl+Alt+G`), *Nuclear: Run* / *Nuclear: Debug*, or
  **F5 with no `launch.json`** (the debugger *Synapsis (Flutter app)*). Each one runs `nuclear build` and launches
  the `<project> (debug)` configuration on the device you pick. The build's output goes to the *Synapsis* output
  panel.
- **Hot reload on save**: with the app running, `Ctrl+S` on a `.nuc` builds and hot reloads it. If Flutter rejects
  the reload, the extension does a hot restart.
- **Repair**: when the build fails, the app ends before it starts (and you did not stop it), or a reload gives a
  Dart compile error, the extension runs `nuclear repair` and launches the app again. It does this once per launch;
  after that it only reports the failure.
- The first time the app is created with the window already open, accept **Reload Window**, so the Dart
  extension finds the app.
- To run the app inside the editor, pick a Synapsis device
  ([the devices](../../../tools/nuclear-device-manager/docs/08-guides/README.md)).

## Backend and web

- **The scripts of a backend project**, like npm's: the explorer's **Nuclear Scripts** view lists each backend
  project with a ▷ per command (`run`, `test`, `build`, `check`, `install`, and `migrate` once the project has a
  `migrations/` folder). The same are tasks of *Terminal → Run Task…* (`nuclear: <project>: run`), there before the
  first build too. Each runs `nuclear <command>` in the project's folder, in a terminal of its own.
- **A project that never built cleanly** (no `build/<name>.code-workspace`): ◉ Debug builds it first; if it has
  errors, the notification says so and *Show Output* shows them.

- **◉ Debug** builds the project and starts its debug launch: debugpy for `fastapi`, node with source maps for
  `nestjs`, Chrome for `react`. A `react` app's dev server starts first, in its own terminal.
- **Build on save** (`nuclear.buildOnSave`, on by default): saving a `.nuc` runs `nuclear build`, and the running
  server or page reloads by itself (uvicorn `--reload`, `node --watch`, Vite).
- A web project's ◉ Debug attaches to [the web device](../../../tools/nuclear-device-manager/docs/08-guides/README.md).

## Debugging a `.nuc`

This works under each dialect's debugger: Dart, node, debugpy and Chrome.

- **Breakpoints in the `.nuc`**: click the gutter of a `.nuc`. The extension puts a mirror breakpoint on the
  matching line of the generated file, which is the one the debugger stops on. The `.nuc` breakpoint can stay
  "unverified": that is expected. Conditions and logpoints work too. The mirrors move after each build.
- **The paused line**: on each pause the `.nuc` opens with the line highlighted, to the left of the generated
  file (`nuclear.debug.followInNuclear`).
- **Step by Nuclear line**: `F10`, `F11` and `Shift+F11` step until the pause is on another `.nuc` line or in
  another call. They apply when the pause is in code that comes from a `.nuc` and the focus is on a `.nuc` (or the
  pause came from a `.nuc` breakpoint). The debug toolbar has a *Step Over (Nuclear Line)* button, and the usual
  buttons still step in the generated code.
- **Values**: hover a name in the `.nuc` to see its value. With `debug.inlineValues` on, each local variable's
  value shows at the end of its line.
- **Nuclear Call Stack**: a view in the Run and Debug panel while paused in a `.nuc`. Each frame opens at its
  `.nuc` line, or at the generated file for library code.
- **Go to the Same Line in Nuclear / Dart** (the editor's context menu while debugging): jumps from the `.nuc` to
  the generated file and back.
- **Run-time errors (Dart only)**: an exception, or an error Flutter prints, is marked on its `.nuc` line in the
  Problems panel. A panel *Nuclear: runtime error* opens beside it with the explanation of `nuclear explain`, the
  stack in Nuclear and the original Dart error (`nuclear.debug.explainErrors`). The next build clears the mark.

Some names Dart writes differently cannot be seen by their Nuclear name: the parameters of a `stateful` are
`widget.x`, and Dart's reserved words are escaped.

## The Synapsis debugger without a workspace file

If `build/<name>.code-workspace` does not exist yet, *Run* and *Debug* are not offered. Run `nuclear build` once
(the task, or ⚒ Build), and they appear.
