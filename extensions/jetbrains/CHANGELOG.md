# Changelog

All notable changes to nuclear-jetbrains are written here; versions follow [Semantic Versioning](https://semver.org).

## Unreleased

- 0.77.0: no change of its own (VS Code finds the machine's Flutter; Nuclear Builder's Cursor and Grok Build providers).

- 0.76.0 (fix): the language server is the installer's own `nuclear-lsp` first, then the PATH, and the one bundled in the plugin last (it may be another system's build).

- 0.74.0: no change of its own (`nuclear run` writes the project's run log; the VS Code devices' and Serve's steps).
- 0.73.2: no change of its own (the VS Code devices' launch log).
- 0.73.1: no change of its own (the VS Code launch of a mobile app).
- 0.73.0: the version of VS Code's Reports page (spec 017); the Builder's command records every step's usage in the factory's ledger, and `nuclear-builder metrics` reads it here too (no Reports window yet).
- 0.72.0: the language server's new diagnostics (a Result is always handled, N0117, N0118, N0220, N0224) and the Python dialect's lazy imports.
- 0.71.0: the version of VS Code's chat, toolchains and light local chat; nothing changes in this extension.
- 0.70.0: the version of VS Code's skills, models, notifications and DevOps; nothing changes in this extension.
- 0.69.0: the version of VS Code's member panel, faster company screen and tool icons; nothing changes in this extension.
- 0.68.0: the version of VS Code's language button; nothing changes in this extension.
- 0.67.0: the version of VS Code's team wizard follow-ups; nothing changes in this extension.
- 0.66.0: the version of VS Code's team wizard; nothing changes in this extension.
- 0.65.0: the version of VS Code's portraits and profiles; nothing changes in this extension.
- 0.64.0: the version of VS Code's chat agent picker; nothing changes in this extension.
- 0.63.0: the version of the Builder's MCP server and VS Code's per-folder workspace; nothing changes in this extension.
- 0.62.0: the version of VS Code's company screen; nothing changes in this extension.
- 0.61.0: the version of VS Code's Nuclear Chat, faces and Nuclear Monitor; nothing changes in this extension.
- 0.60.0: the *HTTP Connections* tool window speaks WebSockets: a **WS** mark on what a backend's contract serves over WebSockets, its events, ws:// urls of the environment (*Add a WebSocket Url*), and a socket panel (`java.net.http.WebSocket`) with the url, headers, the message and its history, and a filtered log.
- 0.59.0: the version of VS Code's Builder workbench and chat; nothing changes in this extension.
- 0.58.0: the *Nuclear Builder* tool window runs the software factory: *Run the Spec with a Team…* (a team of `nuclear-builder team list`) runs `nuclear-builder run … --events`, and each run shows its stations and steps with the role, the employee, the provider and the model. What a station asks is a dialog, answered on the run's stdin, instead of hanging at the first gate: a gate (*Approve*, *Ask for a Change…*, *Later*, its documents opened), QA's plan (each of your checks marked *Done* or *Failed*, then *Go On*), the spending (two dialogs, the second with the amount and the providers). *Go On* resumes a run that waits (`run --resume`), *Run a Station Again…* runs `retry --from` (or `restart`), *Stop* leaves a waiting run waiting and interrupts a working one. `--lead` is gone.
- 0.57.0: the version of VS Code's workspace tree and first Spanish texts; nothing changes in this extension.
- 0.56.0: the version of VS Code's Nuclear Builder diagram; nothing changes in this extension.
- 0.55.0: the version of VS Code's native file tree in the Nuclear workspace; nothing changes in this extension.
- 0.54.0: the version of VS Code's Nuclear Builder team view and Claude settings; nothing changes in this extension.
- 0.53.1: the bundled dialects write what a target binds otherwise as the program says it in every target: a name of the program that a function of Python has (`sorted`, `len`, `max`) never hides it; a lambda made in a loop keeps its turn's values; a default list is a new one at every call (Python and Dart); a static field is the class's in Python; `~/` goes toward zero in Python; a chain after `?.` waits for it in Python; a function may change a variable of its file; `m[k] += 1` on a map in Dart; a list of nullable values in TypeScript and of functions in Dart. `==` of two lists, maps or sets compares what they hold (TypeScript, Dart); TypeScript prints a decimal with its `.0` and a missing value as `null`, Python writes `null` and `true` in a text; named arguments to `{ }` parameters reach them in TypeScript; a function type of types only (`(int) => void`).
- 0.53.0: the bundled dialects: Python's `print` with named arguments, a `for` over `m ?? {}` (also Dart), a conditional spread, `a?.b ?? c`; a typed value at the top of a file is a value, not a declaration; a local or a member no longer imports another file of the project.
- 0.52.2: the AI set-up checks that the Smart Graph's and the Nuclear Developer's ports can be listened on and takes the next free one when another program holds 7878 or 7879, written to `ai.env`, which the editor, the graph and the MCP server read (ADR-installer-0003).
- 0.52.1: the repository is `nuclearlang/lang` (was `nuclearlang/nuclear`): the extension's `repository` and `bugs`, and the installer address Nuclear Builder suggests.
- 0.52.0: the tool window Nuclear Connector is now HTTP Connections (its code in `extensions/tools/nuclear-http-connections/jetbrains/`, the class `HttpConnections`).
- 0.51.0: the version of the three extensions (one repository; the tool windows Nuclear Builder and HTTP Connections, their code in `extensions/tools/<tool>/jetbrains/`; Synapsis; the framework's commands are `nuclear <command>`).
- First public version.
- 0.46.0: the version of the three extensions (the Builder's analysis step is in `nuclear-builder`, ADR-developer-0001).
- 0.48.0: the version of the three extensions (the set-up of the AI services is `nuclear-builder setup`, ADR-installer-0002).
- 0.49.0: the version of the three extensions (the Builder's graph of a run, any step run again and a run from scratch are in VS Code and `nuclear-builder`; the language server reads `[project] package` of `nuclear.toml`).
