# `nuclear`, the command line tool

The one command of NuclearLang. The same binary is the compiler (`build`, `check`, `fix`, `fmt`, `spec`, `defs`,
the documentation) and the framework, Synapsis (`new`, `gen`, `make`, `run`, `test`, `install`, `migrate`, `add`,
the devices). You write only `.nuc` files; `nuclear` writes the target project (Python, TypeScript or Dart) into
`build/` and runs the target's own tools there for you.

## Why it exists

A person and an AI agent should not have to learn two tools, nor the package manager and framework commands of
every target. `nuclear` is what a person types, what an agent runs, what the editor calls and what the MCP server
wraps, so what works in one works in all of them. It also teaches: `nuclear spec --brief` is the short sheet an
agent reads before it writes, and `nuclear check --json` gives every error a code, a position and usually its exact
fix.

What it leaves out on purpose: it never reads target code, and it does not replace the target's tools (Flutter,
`pip`, `npm` still do the work; `nuclear` drives them).

## How we made it

- **One binary, two sets of commands.** There were two (`nuclear` and `dragonfly`), and an agent picked the wrong
  one. Now a command line is the framework's when its word is one only the framework has; `build` and `check`
  decide by their argument: with a path they transpile or check files, without one they work on the project they
  run in ([ADR-cli-0003](docs/03-adr/0003-one-command-nuclear.md)).
- **A project's commands come from its dialect's data.** How a generated project is installed, run, tested and
  debugged is the dialect's `[toolchain]`; nothing in the Rust names a port, a framework command or a package
  manager. A dialect's own commands go under its name (`nuclear flutter doctor`)
  ([ADR-cli-0001](docs/03-adr/0001-a-projects-commands-come-from-its-dialects-data.md)). The mobile path still calls
  Flutter directly: that is in [the roadmap](docs/01-product/roadmap.md).
- **Agents learn Nuclear from the command**: a short brief, one skill, the agent files `nuclear agent init` writes
  into a project and the compiler's errors
  ([ADR-cli-0002](docs/03-adr/0002-agents-learn-nuclear-from-a-brief-a-skill-and-the-compiler.md)).
- **The parser and the compiler are a library.** The command uses the language crates of
  [`nuclearlang/`](../../nuclearlang/AGENTS.md); `new`, `make` and `gen` call [the code generator](../code_generator/README.md),
  `device` and `terminal-device` call [the devices](../../device-emulators/README.md). The command only parses, calls
  and prints.
- **Written in Rust**, the crate `nuclear-cli`: a tool that cannot yet be written in Nuclear (the root
  `AGENTS.md`, rule 9).

## Try it

The compiler, on one file:

```sh
printf 'greet(name: string) string\n  return "Hello, ${name}"\n' > hello.nuc
nuclear build hello.nuc --dialect python     # def greet(name: str) -> str:  return f"Hello, {name}"
nuclear build hello.nuc --dialect dart       # String greet(String name) { return 'Hello, $name'; }
nuclear check hello.nuc --dialect python --json    # []
```

The framework, a backend project:

```sh
nuclear new demo -p backend                  # config.nuc, config/project_config.nuc, test/app_test.nuc, the agents' files
cd demo
nuclear gen resource books Book --fields "id:int title:string author:string?"
                                             # entity, repository, five use cases, controller, tests: finished code
nuclear build                                # demo: 17 files → ./build
nuclear check --json                         # []
nuclear doctor                               # what the platforms still need on this machine
```

`nuclear install`, `nuclear run` and `nuclear test` then install the runtime, start the server and run the tests
written in Nuclear ([the guide](docs/08-guides/README.md)).

## Where to read next

- [The user's guide](docs/08-guides/README.md): install, five minutes with a backend, the commands by job, how AI
  agents use it. [Every command and option](docs/08-guides/commands.md), as `nuclear help` prints them.
- [The Synapsis tutorial](../../nuclear-synapsis-framework/docs/08-guides/tutorial.md): an app from scratch.
- [The decisions](docs/03-adr/README.md) and [the roadmap](docs/01-product/roadmap.md).
- To change it: [AGENTS.md](AGENTS.md).
