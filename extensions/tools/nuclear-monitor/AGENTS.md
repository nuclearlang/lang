# nuclear-monitor

**Nuclear Monitor** in the editors (spec 015 of the platform, `docs/04-specs/015-monitor/`): the report an app
built with `--monitor` writes (`.nuclear/monitor/report.json`), drawn as an accordion of bars: each Nuclear function
and method with its time, own time, calls, connections and memory, the hot spots marked; a click opens the `.nuc` at
the line. VS Code only (command `nuclear.monitor.open`, *Nuclear: Open Monitor*).

What measures is not here: the transpiler writes the wrapper (`nuclearlang/`, `Emitter::monitored`), each dialect
its runtime (`templates/monitor.tpl`), and `nuclear monitor --json` (`tools/cli/src/framework/monitor.rs`) reads the
report and finds the hot spots. This tool only draws what that command prints.

## Where the code is
In this folder; the VS Code extension compiles and bundles `src/` (`extensions/vscode/tsconfig.json`).

| File | What it is |
|---|---|
| `src/monitor.ts` | `readMonitor` (runs `nuclear monitor --json`), the texts in English and Spanish, the page's HTML (`page`, `rows`); no `vscode` import |
| `src/panel.ts` | the page (`MonitorPanel`), the command and the watcher of `**/.nuclear/monitor/report.json` (`activateMonitor`) |
| `test/monitor.test.ts` | the rows, the flags, the escaping, the page without a report (node:test) |

## Stack
- TypeScript; the page is plain HTML and CSS with VS Code's theme colours, a script only for the clicks
- The installed `nuclear` command (`toolEnv` of Nuclear Builder adds `~/.local/bin` to the PATH)

## Commands
Run in `extensions/vscode/`: `npm run compile`, `npm test` (`../tools/nuclear-monitor/test/monitor.test.ts`).

## Rules
- `monitor.ts` has no `vscode` import.
- The hot spots are the CLI's (`nuclear monitor`), never computed again here: the editor, the agents and the
  terminal see the same ones.
- The page never runs the app nor builds it: the user runs `nuclear run --monitor`.

## Documents (read by task)
| You need… | Read |
|---|---|
| How the report reaches the page | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| What a user reads | [docs/08-guides/README.md](docs/08-guides/README.md) |
| The pending work | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| The measurement, the report's format, the hot spots | [the spec](../../../docs/04-specs/015-monitor/design.md) |
