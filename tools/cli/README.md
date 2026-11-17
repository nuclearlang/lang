# `nuclear`, the command line tool

[![ci](https://github.com/nuclearlang/lang/actions/workflows/ci.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/ci.yml) · [Website](https://nuclearlang.github.io/tools/cli)

The one command of NuclearLang: the compiler (`build`, `check`, `fix`, `fmt`, `spec`) and the framework, Synapsis
(`new`, `gen`, `make`, `run`, `test`, `add`, the devices). You write `.nuc`; it writes the target project into `build/`.

## Why

- One tool for a person, an agent, the editor and the MCP server: what works in one works in all.
- No need to learn every target's package manager and framework commands; `nuclear` drives them.
- It teaches: `nuclear spec --brief` for agents, `nuclear check --json` with a code and usually the exact fix.
- It never reads target code and never replaces the target's tools.

## How we made it

- **One binary, two sets of commands**, told apart by the word or the argument
  ([ADR-cli-0003](docs/03-adr/0003-one-command-nuclear.md)).
- **A project's commands come from its dialect's data**: no port or package manager in the Rust
  ([ADR-cli-0001](docs/03-adr/0001-a-projects-commands-come-from-its-dialects-data.md)).
- **Agents learn Nuclear from the command**: a brief, a skill and the compiler's errors
  ([ADR-cli-0002](docs/03-adr/0002-agents-learn-nuclear-from-a-brief-a-skill-and-the-compiler.md)).
- **Written in Rust** (`nuclear-cli`): it only parses, calls the language crates and the code generator, and prints.

## Try it

```sh
nuclear new demo -p backend && cd demo
nuclear gen resource books Book --fields "id:int title:string author:string?"
nuclear build                                # demo: 17 files → ./build
nuclear check --json                         # []
```

## Read next

- [The user's guide](docs/08-guides/README.md) and [every command](docs/08-guides/commands.md)
- [The Synapsis tutorial](../../nuclear-synapsis-framework/docs/08-guides/tutorial.md): an app from scratch
- [The decisions](docs/03-adr/README.md), [the roadmap](docs/01-product/roadmap.md)
- To change it: [AGENTS.md](AGENTS.md)
