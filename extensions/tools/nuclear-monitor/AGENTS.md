# nuclear-monitor

**Nuclear Monitor** in the editors (spec 015 of the platform, `docs/04-specs/015-monitor/`): what the workspace's
selected project is doing while it runs. A **console** of its last run (every request with its method, path,
status and time; every error with its cause and its stack, a click opening the `.nuc` line; the app's own output;
start, reload, stop), filterable (all, requests, errors), and, when the project is measured, the **measurements**:
each Nuclear function and method with its time, own time, calls, connections and memory as an accordion of bars,
the hot spots marked. Not running, the page runs it itself, visibly (the terminal `<project> · monitor`, or a device
for a mobile app). VS Code only: the workspace strip's tool (`Ctrl+Alt+F`) and the command `nuclear.monitor.open
[root]` (*Nuclear: Open Monitor*).

What it reads is not here: the run log `nuclear run` and the editor's devices write (`<project>/.nuclear/logs/run.log`),
read by `nuclear monitor --json` (`tools/cli/src/framework/console.rs`: the state of the run and its lines by kind)
with the report an app built with the monitor writes (`.nuclear/monitor/report.json`: the transpiler's wrapper, each
dialect's `templates/monitor.tpl`, the hot spots of `monitor.rs`). This tool only draws what that command prints.

## Where the code is
In this folder; the VS Code extension compiles and bundles `src/` (`extensions/vscode/tsconfig.json`).

| File | What it is |
|---|---|
| `src/monitor.ts` | `readMonitor` (runs `nuclear monitor --json`), `explainPlace` (an error's `.nuc` line: the one it names, else `nuclear explain --json`), `projectAt`, the texts in English and Spanish, the page's states (`stateOf`) and HTML (`page`, `parts`, `consoleLine`, `rows`); no `vscode` import |
| `src/panel.ts` | the page (`MonitorPanel`: the project followed, the redraws, *Run and watch*, the toggle), the command and the watchers of the run logs and reports (`activateMonitor`) |
| `test/monitor.test.ts` | each state of the page in both languages (no path or command in its words), the console of a real run, the measurements, an old report (node:test) |
| `test/fixtures/` | `running-backend.json` (`nuclear monitor --json` of a real backend run: requests, 404s, a 500 with its stack, a measured report), `report-0.96.json` (what 0.96 printed: no console) |

## Stack
- TypeScript; the page is plain HTML and CSS with VS Code's theme colours, a script only for the clicks
- The installed `nuclear` command (`toolEnv` of Nuclear Builder adds `~/.local/bin` to the PATH)

## Commands
Run in `extensions/vscode/`: `npm run compile`, `npm test` (`../tools/nuclear-monitor/test/monitor.test.ts`).

## Rules
- `monitor.ts` has no `vscode` import.
- The hot spots and the console's lines are the CLI's (`nuclear monitor`), never computed again here: the editor,
  the agents (MCP `project_monitor`) and the terminal see the same ones.
- The page follows the workspace's selected project (`MonitorPanel.selected`, the strip passes it), never a
  workspace's own folder nor the first folder of VS Code.
- The page runs the app itself when it is not running (the user, 2026-11-23, overruling "the page never runs the
  app"), always visibly: once on its own per project and window, after that only by *Run and watch* / *Try again*;
  a running one is only shown. Measuring is turned on with it (`nuclear monitor --on`) where the platform can be
  measured (not a phone's or a browser's app yet).
- The page's own words never hold a path, a command, a backtick or a file name: those are only in *Details*. The
  console shows the app's output as it is.

## Documents (read by task)
| You need… | Read |
|---|---|
| How the run log and the report reach the page | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| What a user reads | [docs/08-guides/README.md](docs/08-guides/README.md) |
| The pending work | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| The measurement, the report's format, the hot spots | [the spec](../../../docs/04-specs/015-monitor/design.md) |
