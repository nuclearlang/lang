---
status: in-progress
owner: Julian Molina
updated: 2026-11-24
related: [requirements.md, tasks.md]
---
# Spec 015: Nuclear Monitor — Design

## 1. Why not the debugger

The debugger stops the program and is heavy; the target's profilers see the generated code and its libraries, not
the `.nuc`. A wrapper written by the transpiler knows each Nuclear name and line at build time, costs two clock reads
per call and runs with the app at full speed. The debugger keeps its job (ADR-0011): stopping and reading values.

## 2. Who does what (root rule 2)

| Part | Where | What |
|---|---|---|
| The switch | `Manifest.monitor` (project), `transpile_monitored` (one file) | set by the CLI's `--monitor` |
| What a template knows | the compiler, generic | `monitor` (flag) and `site` (`label`, `path`, `line`, `component`, `kind`) in the `function` and `method` templates |
| The runtime | the dialect's `monitor_runtime` template | written once to `nuclear/monitor.<ext>` of a project (like the `Result` runtime), inline in a file built alone; imported as `NuclearMonitor` by each file that measures |
| The wrapper | the dialect's `function` / `method` templates | `{{#monitor}}...{{/monitor}}`: TypeScript and Dart wrap the body in `try/finally`, Python writes the decorator `@NuclearMonitor.wrap(...)` |
| The report | the runtime | `NUCLEAR_MONITOR_FILE` (set by `nuclear run`, `--monitor` or not, and by a measured build), else the collector the build was given (an app without the project's files), else `.nuclear/monitor/report.json` of the working folder |
| The collector | the editor's Monitor; `nuclear run --monitor` without the editor | §8: receives the report of an app in a browser or on a phone and writes it to the project |
| The browser's part | the dialect's optional `monitor_runtime_web` | written beside the runtime to `nuclear/monitor_web` where the target cannot import the browser's API everywhere (Dart: a conditional import) |
| The switch kept | `.nuclear/monitor/on` | `nuclear monitor --on` / `--off`: every build, watch and run of the project measured until it is removed |
| The tree as text | `nuclear monitor` | reads the report, prints the tree and the hot spots |
| The view | `extensions/tools/nuclear-monitor/` | the VS Code panel: the console of the last run (`console` of `nuclear monitor --json`, read from the run log) and the measurements |

Generators (a body with `yield`) and abstract methods get no wrapper.

## 3. The call tree

A node is `(parent node, site)`. Entering a function finds or creates the child of the current node for its site and
opens a span (start time, memory, connections); leaving closes it into the node. The current node follows the
async flow where the target can do it cheaply:

| Target | Current node | Clock | Memory | Connections |
|---|---|---|---|---|
| Node.js | `AsyncLocalStorage.enterWith` | `performance.now()` | `process.memoryUsage().heapUsed` | `net.Socket.prototype.connect` |
| Browser | a variable (concurrent async calls may land on another parent) | `performance.now()` | `performance.memory` (Chromium) | `fetch`, `XMLHttpRequest.open`, `WebSocket` |
| Python | `contextvars.ContextVar` | `time.perf_counter_ns()` | `tracemalloc` (slows allocation: documented in the report) | `socket.socket.connect` |
| Dart | a variable (as the browser) | `Stopwatch` | `ProcessInfo.currentRss` | `IOOverrides.socketConnect` / `socketStartConnect` |
| Dart in a browser | a variable | `Stopwatch` | `performance.memory` (Chromium) | `fetch`, `XMLHttpRequest.open` |

Memory is the heap grown during the calls (net: garbage not yet collected counts); a connection is a new socket
(a pooled connection reused counts once).

## 4. The report (`format = 1`)

```json
{
  "format": 1, "app": "chat_app", "dialect": "fastapi", "started": "2026-11-18T10:00:00Z", "updated": "...",
  "wall_ms": 5000.0, "notes": ["memory measured with tracemalloc: times include its cost"],
  "roots": [
    { "label": "ChatComponent.build", "path": "components/chat/chat_component.nuc", "line": 12, "async": false,
      "calls": 1, "total_ms": 2320.0, "self_ms": 100.0, "max_ms": 2320.0, "connections": 0, "memory_bytes": 1024,
      "children": [ ... ] }
  ]
}
```

`path` is the `.nuc` file relative to the project; `self_ms` = `total_ms` minus the children's, never below zero;
`calls / parent.calls` is the calls per call of the parent.

## 5. Hot spots (`nuclear monitor`)

Sorted by own time; a node is flagged:

- `slow`: its own time is 20% or more of the root's;
- `loop`: async and called 5 or more times per call of its parent (awaits in series: gather them);
- `connections`: 10 or more connections per call;
- `memory`: 10 MB or more grown per call.

## 6. The editor

A webview opened by `Nuclear: Open Monitor` (and the workspace's tool strip): rows of the tree with a disclosure
triangle, the label, a horizontal bar of `total_ms` relative to the root (own time darker), calls, connections and
memory; the hot spots marked; a click on a row opens its `.nuc` at its line. Beside it, the console of the project's
last run (requests, errors with their stack, output), which needs no measuring. It watches the report and the run
log (`extensions/tools/nuclear-monitor/docs/02-architecture/overview.md`).

## 7. The agents

`nuclear monitor --json` gives the hot spots, the tree and the console of the last run; the MCP tool
`project_monitor` calls it; `nuclear monitor
--remember` stores the hot spots as a card of the project in the Smart Graph (`graph_remember`), so the next agent
knows where the app was slow and on which `.nuc` lines.

## 8. An app without the project's files

An app in a browser (a web app; a mobile app on the Synapsis device, which is Flutter web) or on a phone cannot write
`report.json`. Its runtime posts the report every two seconds, with the page's own `fetch` (not counted), to a
collector at `http://127.0.0.1:<port>/<token>/<key>`: `NUCLEAR_MONITOR_URL` (`http://127.0.0.1:<port>/<token>`,
given by the editor to every process of its window, or by `nuclear run --monitor` that starts one) plus the
project's key (FNV-1a, 64 bits, of the project's canonical folder, in hex), written by a measured build into the
runtime (`Manifest.monitor_url`, the template variable `url`; an address that is not of 127.0.0.1 or holds a
character a string would need to escape is not written). The collector takes a POST only with its token, for a
project it knows by its key, and from the app's origin (a device's page, or the project's port of the registry on
`127.0.0.1`, `localhost` or `[::1]`; a request without an origin is not a browser's: a phone's app); CORS answers that
origin only; a body that is not a report (`format`, `roots`) is 400, over 8 MB 413; the report is written whole to
`<project>/.nuclear/monitor/report.json`. The console of such an app is its page's: the devices write its requests,
prints and errors into the run log (`extensions/tools/nuclear-monitor/docs/02-architecture/overview.md`).
