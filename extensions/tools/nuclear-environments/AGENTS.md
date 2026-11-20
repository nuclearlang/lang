# nuclear-environments

**Environments** in the editors (spec 021 of the platform, `docs/04-specs/021-environments/`): per project, the
variables the code reads with `env()` and the ones of its `.env` files as rows, the environments as columns (and the
shared `.env`), each value with where it comes from; edited in place, secrets in the system's keyring. VS Code only
(command `nuclear.environments.open`, a tool of the Nuclear workspace's strip, `Ctrl+Alt+Y`).

What resolves is not here: the files, the precedence, the dotenv parser and the keyring are the CLI's
(`nuclear env`, `tools/cli`). This tool only draws what `nuclear env list --json` prints and runs
`nuclear env set/unset/use` for every change.

## Where the code is
In this folder; the VS Code extension compiles and bundles `src/` (`extensions/vscode/tsconfig.json`).

| File | What it is |
|---|---|
| `src/env.ts` | the list's format, the grid (`toGrid`: columns, cells, badges), `filterRows`, the commands (`setCommand`, `unsetCommand`, `useCommand`), the runner (`nuclearRunner`, injected) and `failureOf`; no `vscode` import |
| `src/panel.ts` | the page (`EnvironmentsPanel`), the command and the watchers of `**/.env*`, `**/.nuclear/contract.json`, `**/.nuclear/env` (`activateEnvironments`) |
| `src/page.ts` | the HTML and CSS (strict CSP with a nonce, the theme's colours) |
| `src/pageScript.ts` | the page's script, inlined by its source: the bar, the grid, inline editing, the keyboard |
| `src/l10n.ts`, `src/icons.ts` | the texts (English, Spanish), the icons (the stroke style of HTTP Connections) |
| `test/environments.test.ts` | the grid, the badges, the commands (a secret never in the arguments), the failures, a fake runner (node:test) |

## Stack
- TypeScript; the page is plain HTML and script, no framework, no dependency
- The installed `nuclear` command (`toolEnv` of Nuclear Builder adds `~/.local/bin` to the PATH)

## Commands
Run in `extensions/vscode/`: `npm run compile`, `npm test` (`../tools/nuclear-environments/test/environments.test.ts`).

## Rules
- `env.ts` has no `vscode` import.
- The page never writes a file: every change is a `nuclear env` command. It opens a `.env` file only when asked.
- A secret's value goes on the command's stdin (`nuclear env set NAME --secret`), never in its arguments, and is
  never shown (the list never prints it).
- An error of a command is shown on the page, never swallowed; a `nuclear` without `env` (its usage printed) says
  to run `nuclear update` in a terminal.

## Documents (read by task)
| You need… | Read |
|---|---|
| How the list reaches the page and a change reaches the files | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| What a user reads | [docs/08-guides/README.md](docs/08-guides/README.md) |
| The pending work | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| The files, the precedence, `nuclear env` and its JSON | [the spec](../../../docs/04-specs/021-environments/design.md) |
