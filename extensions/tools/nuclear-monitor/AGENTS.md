# nuclear-monitor

**Nuclear Monitor** in the editors (spec 015 of the platform, `docs/04-specs/015-monitor/`): what the workspace's
selected project is doing while it runs. A **console** of its last run (every request with its method, path,
status and time; every error with its cause and its stack, a click opening the `.nuc` line; the app's own output;
start, reload, stop), filterable (all, requests, errors), and, when the project is measured, the **measurements**:
each Nuclear function and method with its time, own time, calls, connections and memory as an accordion of bars,
the hot spots marked, for a backend, a web app and a mobile app alike. Not running, the page runs it itself,
visibly (the terminal `<project> · monitor` for a backend, the web device for a web app, the device picked for a
mobile app). VS Code only: the workspace strip's tool (`Ctrl+Alt+F`) and the command `nuclear.monitor.open
[root]` (*Nuclear: Open Monitor*).

What it reads is not here: the run log `nuclear run` and the editor's devices write (`<project>/.nuclear/logs/run.log`),
read by `nuclear monitor --json` (`tools/cli/src/framework/console.rs`: the state of the run and its lines by kind)
with the report an app built with the monitor writes (`.nuclear/monitor/report.json`: the transpiler's wrapper, each
dialect's `templates/monitor.tpl`, the hot spots of `monitor.rs`). An app in a browser or on a phone has no project
files: it posts its report to this tool's **collector** (`src/collector.ts`), which writes that file, and the devices
write the page's console into the run log (`../nuclear-device-manager/src/browser-log.ts`). This tool only draws what
that command prints.

## Where the code is
In this folder; the VS Code extension compiles and bundles `src/` (`extensions/vscode/tsconfig.json`).

| File | What it is |
|---|---|
| `src/monitor.ts` | `readMonitor` (runs `nuclear monitor --json`), `explainPlace` (an error's `.nuc` line: the one it names, else `nuclear explain --json`), `projectAt`, the texts in English and Spanish, the page's states (`stateOf`) and HTML (`page`, `parts`, `consoleLine`, `rows`); no `vscode` import |
| `src/panel.ts` | the page (`MonitorPanel`: the project followed, the redraws, *Run and watch*, the toggle), the command, the watchers of the run logs and reports and the window's collector (`activateMonitor`, `NUCLEAR_MONITOR_URL`) |
| `src/collector.ts` | the collector (spec 015 phase 2): 127.0.0.1, a random port, a token of the window, the project's key (`projectKey`, the CLI's), CORS only for the app's origin (`allowOrigin`, the devices'), the report written whole; no `vscode` import |
| `test/monitor.test.ts` | each state of the page in both languages (no path or command in its words), the console of a real run, a browser's console, the measurements, an old report (node:test) |
| `test/collector.test.ts` | the collector: the token, the project's key against the CLI's, the origins, a body that is not a report, a project of the registry (node:test) |
| `test/fixtures/` | `running-backend.json` (`nuclear monitor --json` of a real backend run: requests, 404s, a 500 with its stack, a measured report), `report-0.96.json` (what 0.96 printed: no console) |

## Stack
- TypeScript; the page is plain HTML and CSS with VS Code's theme colours, a script only for the clicks
- The installed `nuclear` command (`toolEnv` of Nuclear Builder adds `~/.local/bin` to the PATH)

## Commands
Run in `extensions/vscode/`: `npm run compile`, `npm test` (`../tools/nuclear-monitor/test/monitor.test.ts`, `collector.test.ts`).

## Rules
- `monitor.ts` has no `vscode` import.
- The hot spots and the console's lines are the CLI's (`nuclear monitor`), never computed again here: the editor,
  the agents (MCP `project_monitor`) and the terminal see the same ones.
- The page follows the workspace's selected project (`MonitorPanel.selected`, the strip passes it), never a
  workspace's own folder nor the first folder of VS Code.
- The page runs the app itself when it is not running (the user, 2026-11-23, overruling "the page never runs the
  app"), always visibly: once on its own per project and window, after that only by *Run and watch* / *Try again*;
  a running one is only shown. Measuring is turned on with it (`nuclear monitor --on`), for every platform: a web app
  runs on the web device (its page's console reaches the log), a mobile app on the device picked.
- The collector writes only `<project>/.nuclear/monitor/report.json` of a project it knows (told by the page or a
  device, or found in the registry of projects by its key), only with the window's token, only from the app's own
  origin (or none: a phone's app); it is never reachable from another machine.
- The page's own words never hold a path, a command, a backtick or a file name: those are only in *Details*. The
  console shows the app's output as it is.

## Documents (read by task)
| You need… | Read |
|---|---|
| How the run log and the report reach the page | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| What a user reads | [docs/08-guides/README.md](docs/08-guides/README.md) |
| The pending work | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| The measurement, the report's format, the hot spots | [the spec](../../../docs/04-specs/015-monitor/design.md) |
