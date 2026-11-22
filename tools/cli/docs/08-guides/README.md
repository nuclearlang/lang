---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [tools/cli/src/main.rs, tools/cli/src/framework/mod.rs, tools/cli/docs/08-guides/commands.md, tools/code_generator/docs/08-guides/README.md, docs/03-adr/0004-products-are-made-with-the-tools.md]
---
# The `nuclear` command

`nuclear` is the one command of NuclearLang. The same binary is the compiler (`build`, `check`, `fix`, `fmt`,
`spec`, `defs`, the documentation) and the framework, Synapsis (`new`, `make`, `gen`, `run`, `test`, `install`,
`migrate`, `add`, the devices). A person, an AI agent, an editor and the MCP server all run it, so what works in
one works in all of them ([ADR-cli-0003](../03-adr/0003-one-command-nuclear.md)).

You write only `.nuc` files. `nuclear` writes the target project (Python, TypeScript or Dart) into `build/` and
runs the target's own tools there for you: you never call `pip`, `npm` or `flutter` yourself.

## Install

```sh
curl -fsSL https://nuclearlang.github.io/install.sh | sh        # Linux, macOS
irm https://nuclearlang.github.io/install.ps1 | iex             # Windows (PowerShell)
```

What the installer puts on the machine, and the optional AI services it asks about at its end:
[the AI set-up guide](../../../../installer/docs/08-guides/ai-setup.md). Then `nuclear doctor` lists what the
platforms still need (the CLIs of each dialect, Flutter, VS Code).

## Five minutes: a backend

```sh
nuclear new demo -p backend                  # a project of the backend platform (dialect fastapi by default)
cd demo
nuclear gen resource books Book --fields "id:int title:string author:string?"
nuclear build                                # demo: 17 files → ./build
nuclear install                              # the runtime and the packages (a venv, for fastapi)
nuclear run                                  # Uvicorn running on http://127.0.0.1:8000
nuclear test                                 # 3 passed
nuclear check --json                         # every error, as JSON, for an agent or a script
nuclear fix .                                # apply every exact fix, then report what is left
```

Every `nuclear run` also writes its steps, the build's errors and the server's output to the project's
`.nuclear/logs/run.log` (with the time of each line): read it after a run that failed.


`new` writes only `.nuc` files: for a backend, `config.nuc`, `config/project_config.nuc` and `test/app_test.nuc`.
`gen resource` writes the entity, the input model, the repository, a use case per action, the component's facade,
the controller and the tests, as finished code ([the generators' guide](../../../code_generator/docs/08-guides/README.md)).
The other platforms start the same way: `nuclear new shop -p web` (dialect `react`) and `nuclear new shop -p mobile`
(dialect `flutter`; it also creates the Flutter app in `build/app`). Pick another dialect with `-d`, for example
`-d nestjs`. The Nuclear of a project does not change with its dialect.

`nuclear check` prints an error the way a compiler does:

```text
error[N0106]: 'undefinedThing' is not defined
 --> components/books/domain/usecases/broken.nuc:3:9
  |
3 |     x = undefinedThing
  |         ^^^^^^^^^^^^^^
```

and `nuclear check --json` prints the same error with its code, position, explanation and, when there is one, the
exact `fix` (every code: [the diagnostics](../../../../nuclearlang/docs/07-reference/diagnostics.md)):

```json
{
  "code": "N0106",
  "col": 9, "end_col": 23, "line": 3, "end_line": 3,
  "explanation-context": "Line 3, column 9: The name is not a variable, parameter, member, declaration or import of this file.",
  "file": "components/books/domain/usecases/broken.nuc",
  "fix": null,
  "message": "'undefinedThing' is not defined",
  "severity": "error"
}
```

## The commands, by job

`nuclear help` prints every one; the exact usage text is in [commands.md](commands.md).

| Job | Command | What it does |
|---|---|---|
| Start | `workspace new <path>` / `workspace add <app> --platform <p>` | a workspace (the folder of a business project and its apps) and an app in it ([workspaces](workspace.md)) |
| | `new <name> -p <platform> [-d <dialect>]` | a new project of `mobile`, `backend` or `web`, only `.nuc` files (inside a workspace: in its folder, and registered) |
| | `agent init` | `AGENTS.md`, `CLAUDE.md`, a Cursor rule and a check hook for AI agents |
| | `code` | open the project in VS Code (run, debug, devices, hot reload) |
| Write code | `gen resource <component> <Name>` | finished models, repository, use cases, controller or screen, tests |
| | `gen usecase <component> <Name>` | a use case wired into its component (and its route, `--route`) |
| | `make <kind> <component> <Name>` (`g`) | one skeleton of a kind, at the platform's place, to fill in |
| | `gen inspect` | what the project has: components and declarations, as JSON |
| Libraries | `add <package>[@version]` | install a package of the target, write it in `config.nuc`, generate its type definitions |
| | `remove <package>` | the reverse |
| | `defs list` / `defs show` / `defs search` | read the type definitions of a library |
| Correct | `check [--json]` | the errors and the architecture rules of every `.nuc` |
| | `fix <folder\|file.nuc>` | apply every exact fix of the errors (the editor's quick fixes) |
| | `fmt <file.nuc\|folder> [--check]` | rewrite the files in the canonical layout |
| Environments | `env list` / `env set NAME value [--env e]` / `env set NAME --secret` / `env use e` | the variables the code reads (`env("NAME", "default")`) by environment: `.env` files beside `config.nuc`, secrets in the system's keyring |
| | `run\|build\|test\|check --env <e>` | the environment of the command (else `NUCLEAR_ENV`, else the active one, else `development`; `test` for tests) |
| Build and run | `build` | transpile the project into `build/` (mobile: also `build apk`, `web`, `ios`...) |
| | `install` | the runtime and the app's packages (backend, web) |
| | `run` | the server (backend, web) or the app on a device (mobile) |
| | `test [--integration]` | the tests written in Nuclear |
| | `watch` | transpile each time a `.nuc` changes |
| | `migrate make <message>` / `migrate [--to <migration>]` / `migrate down [--to <migration>]` / `migrate status` | the database migrations (backend) |
| Mobile | `device [<device>]`, `terminal-device` | a test device in its own window, or in this terminal |
| | `analyze`, `repair`, `clean`, `explain` | the generated app's analysis, repair from scratch, a run-time error at its `.nuc` lines |
| Learn | `help [<topic>]`, `spec [--brief]` | the documentation embedded in the binary; the language for agents |
| Machine | `doctor`, `setup` | what is missing; install Flutter step by step |

`nuclear help <topic>` prints a chapter of the guide or a reference: `nuclear help generators`, `nuclear help
backend`, `nuclear help tutorial`, `nuclear help diagnostics`. `nuclear help <word> --dialect <name>` explains a
kind or decorator of a dialect, and `nuclear help layout --platform <p>` where each kind's file goes.

## How AI agents use it

An agent learns Nuclear from the command, not from guessing
([ADR-cli-0002](../03-adr/0002-agents-learn-nuclear-from-a-brief-a-skill-and-the-compiler.md)):

1. **Read the short sheet**: `nuclear spec --brief --platform backend` (or `--dialect <name>`): only what
   differs from TypeScript and Dart, then the platform's brief.
2. **Generate before writing**: `nuclear gen` and `nuclear make` write the standard code; the agent writes by hand
   only what they leave. A product is made with the tools, never by writing or porting target code by hand
   ([ADR-platform-0004](../../../../docs/03-adr/0004-products-are-made-with-the-tools.md)).
3. **Use a library through its definitions**: `nuclear add <package>` installs it and generates its definitions;
   `nuclear defs show <Name|Name.member> --dialect <name> [--json]` prints its API, for example
   `nuclear defs show FastAPI --dialect fastapi`.
4. **Check every file**: `nuclear check --json` after each change, `nuclear fix` for the exact fixes, then
   `nuclear fmt`.
5. **Set the project up once**: `nuclear agent init` writes the agents' files and a hook (`nuclear agent hook`)
   that checks each `.nuc` an agent edits ([what it writes](../02-architecture/agent-support.md)).

## Go deeper

- [Workspaces](workspace.md): the folder of a business project and its apps, the marker, `nuclear workspace`.
- [Every command and option](commands.md), verbatim from `nuclear help`.
- [The generators' guide](../../../code_generator/docs/08-guides/README.md): what `new`, `make` and `gen` write.
- [The Synapsis tutorial](../../../../nuclear-synapsis-framework/docs/08-guides/tutorial.md): an app from scratch.
- How the command is built: [the overview](../02-architecture/overview.md) and
  [the compiler's commands](../02-architecture/nuclear-command.md).
