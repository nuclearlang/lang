# Nuclear Builder (`nuclear-builder`)

The pipeline tool of the editors, **Nuclear Builder**: a spec goes through specification, generate,
plan, tests first, code, verification, security, artifacts and deploy on the developer's machine, and every step
shows who did it (you, Claude, a local agent, the shell). It is a tool of the Nuclear workspace in VS Code
(`Ctrl+Alt+P`), a tool window in Android Studio / IntelliJ (`Alt+Shift+P`) and the `nuclear-builder` command in a
terminal or a CI job. It needs the Smart Graph and the Nuclear Developer running.

## Where the code is
All of it is in this folder, in two parts while spec 009's phase 3 moves the engine to Nuclear:
- **Nuclear** (`python` dialect, `nuclear.toml`): the set-up of the AI services and the `nuclear-builder` command.
  `nuclear build .` writes `build/nuclear_builder`, packaged by `pyproject.toml` and installed in the AI archive
  (`installer/release/ai-runtime.sh`). Its pipeline commands still run the TypeScript engine with node.
- **TypeScript**: the pipeline's engine and the VS Code page, compiled and bundled by the VS Code extension (`src/`,
  `test/`, `extensions/vscode/tsconfig.json`); the JetBrains `build.sh` compiles `jetbrains/src/` with the plugin.

| File | What it is |
|---|---|
| `setup.nuc` | the set-up: this machine, the profiles and how each sits on it, the ports, the services at login, the steps (the commands they run say each line as it comes, a Python one too: `PYTHONUNBUFFERED`); no editor |
| `cli.nuc` | the `nuclear-builder` command: `setup` in a terminal and for the editors (`--plan --json`, `--events`, `--status --json`, `--restart`, `--set`), the rest given to the engine of `bin/nuclear-builder.js` |
| `setup.json` | the data of the set-up: the requirements, the embeddings model, the profiles |
| `tests/test_setup.nuc` | the set-up's tests (pytest), with `tests/support.nuc` |
| `src/engine.ts` | the engine; no `vscode` import |
| `src/safety.ts` | what keeps a run safe when something breaks; no `vscode` import |
| `src/panel.ts` | the page of VS Code: the runs, the spec form, a run as a graph |
| `src/cli.ts` | the pipeline's commands (bundled to `extensions/vscode/out/nuclear-builder.js`, which `cli.nuc` runs) |
| `test/engine.test.ts` | the engine's tests (also Nuclear Atlas's templates and history, the 3B rule) |
| `jetbrains/src/dev/nuclearlang/editor/NuclearBuilder.java` | the *Nuclear Builder* tool window, which runs `nuclear-builder` |

## Stack
- Nuclear, `python` dialect (Python 3.12+, httpx) for the set-up and the command
- TypeScript, bundled with esbuild for node 18, for the engine; the page is plain HTML and script
- The agents: the Nuclear Developer over HTTP; Claude through `claude -p` with the Nuclear MCP server
- Java (Swing) for the JetBrains tool window

## Commands
Run here:
```sh
nuclear check . --json && nuclear build .     # the set-up and the command, into build/nuclear_builder
cd build && pytest nuclear_builder/tests && pyright nuclear_builder   # its tests and types (httpx, pytest installed)
```
Run in `extensions/vscode/`:
```sh
npm run builder     # out/nuclear-builder.js (the engine)
npm test            # ../tools/nuclear-builder/test/engine.test.ts (node:test)
npm run compile     # the types, the extension (with src/panel.ts) and the engine
```
The tool window: in `extensions/jetbrains/`, `IDE_HOME=/opt/android-studio ./build.sh`.
`installer/install.sh` rebuilds the engine into the installation's `bin/nuclear-builder.js` with a `node` wrapper
(`installer/release/stage.sh`), builds this project and installs it editable with uv as `~/.local/bin/nuclear-builder`;
a release brings it in the AI archive (`ai/bin/nuclear-builder`).

## Rules
- The editors run the set-up as a process (`nuclear-builder setup ...`), one call per action: no process of it stays
  alive (decided by the user: the least memory and the fewest problems of compatibility). Its JSON is the contract
  of the pages.
- `engine.ts` and `safety.ts` never import `vscode`: the page, `nuclear-builder`, Nuclear Atlas and the tests drive
  the same engine.
- The page only draws. A run belongs to the extension (`engines`, module-level): closing the page or switching tools
  leaves it running.
- A run is `.nuclear/builder/runs/<id>.json`, saved on every step: every editor and the command draw that same file.
- Commands are data (`.nuclear/builder.json`): the shell runs nothing that is not there.
- The local agents only ever see Nuclear and the platform, never a dialect's language.
- No Nuclear Builder for Zed (decided by the user).
- The decision behind the pipeline is ADR-platform-0003; the strategies, ADR-developer-0001; the generators, ADR-codegen-0001.

## Documents (read by task)
| You need… | Read |
|---|---|
| What the tool is for, who leads and why | [docs/00-context/vision.md](docs/00-context/vision.md) |
| The words: spec, run, stage, step, actor, journal, ledger, strategy | [docs/00-context/domain.md](docs/00-context/domain.md) |
| The files, the agents it calls, what it writes in a project, the JetBrains window, the command | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| How the engine runs, retries, undoes and survives a crash | [docs/02-architecture/engine.md](docs/02-architecture/engine.md) |
| The index of the user's guides | [docs/08-guides/README.md](docs/08-guides/README.md) |
| To write a spec (VS Code, JetBrains, a terminal) | [docs/08-guides/write-a-spec.md](docs/08-guides/write-a-spec.md) |
| To follow a run, run something again, read a failure | [docs/08-guides/follow-a-run.md](docs/08-guides/follow-a-run.md) |
| The commands of each stage, the CI export | [docs/08-guides/pipeline-commands.md](docs/08-guides/pipeline-commands.md) |
| The pending work of the tool | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| The settings page, the set-up, the notifications | [the VS Code extension](../../vscode/docs/02-architecture/ai-services.md) |
| The agents, the graph, the MCP server | `nuclear-agents/nuclear_developer/`, `nuclear-graph-storage/`, `tools/mcp/` |
