<div align="center">

<img src="https://nuclearlang.github.io/favicon.svg" alt="NuclearLang" width="96" height="96">

# NuclearLang

**Write only the logic.** A minimal language made to be written by AI agents and read by people. One codebase
becomes TypeScript, Dart or Python, and its framework, **Synapsis**, builds mobile apps, backends and web apps from
it.

[Website](https://nuclearlang.github.io) · [Tutorial](nuclear-synapsis-framework/docs/08-guides/tutorial.md) ·
[VS Code extension](https://marketplace.visualstudio.com/items?itemName=nuclearlang.nuclearlang) ·
[Español](README.es.md)

[![ci](https://github.com/nuclearlang/lang/actions/workflows/ci.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/nuclearlang/lang?color=a7ff00&label=release)](https://github.com/nuclearlang/lang/releases/latest)
[![license](https://img.shields.io/badge/license-Apache--2.0-a7ff00)](LICENSE)

</div>

## Install

```sh
curl -fsSL https://nuclearlang.github.io/install.sh | sh     # Linux and macOS
irm https://nuclearlang.github.io/install.ps1 | iex          # Windows (PowerShell)
```

One command installs the compiler, the language server, the editor extension (VS Code, Cursor, VSCodium, Windsurf,
Zed), the MCP server and the Smart Graph for your AI agents. `nuclear update` keeps every part at one version.

## Thirty seconds

```sh
nuclear new todos_api -p backend && cd todos_api            # a backend: only .nuc files
nuclear gen resource todos Todo --fields "id:int title:string completed:boolean"
nuclear run                                                 # FastAPI at http://localhost:8000/openapi.json
```

What `nuclear gen` wrote, and what you would change, is short Nuclear (`components/todos/`):

```nuc
// Changes a todo; NotFound (404) when there is none.
usecase UpdateTodo(repository: TodoRepository)
  exec(id: int, input: NewTodo) Result<Error, Todo>
    found = ~repository.find(id)
    found.title = input.title
    found.completed = input.completed
    Ok(~repository.save(found))
```

The same Nuclear builds a NestJS backend instead (`dialect = "nestjs"`); a Flutter app with `-p mobile`; a React
app with `-p web`.

## Why

- **Agents spend their tokens on code that is always the same.** In Nuclear only the business logic is written:
  imports, boilerplate and wiring come from the dialect.
- **One way to write each thing**, errors that come with their fix, and type definitions of every library, so an
  agent checks names instead of inventing them.
- **Made for agents from the start:** an MCP server, a skill for Claude Code, Codex and Cursor, `llms.txt`, and a
  local knowledge base (the Smart Graph) that answers what Nuclear is and how to use it.
- **The output is what an expert would write**: plain FastAPI, NestJS, Flutter or React, readable and fast; Nuclear
  never replaces the target's own tools.

## What is inside

| Folder | What it is |
|---|---|
| [nuclearlang/](nuclearlang/README.md) | the language: the compiler (Rust), the language server, the dialects |
| [nuclear-synapsis-framework/](nuclear-synapsis-framework/README.md) | Synapsis: the framework and its three platforms (mobile, backend, web) |
| [tools/](tools/README.md) | the `nuclear` command, the code generator, the MCP server |
| [extensions/](extensions/README.md) | the editors (VS Code, Cursor, Android Studio, IntelliJ, Zed) and their tools |
| [device-emulators/](device-emulators/README.md) | the devices that run your app inside the editor |
| [nuclear-graph-storage/](nuclear-graph-storage/README.md) · [nuclear-agents/](nuclear-agents/README.md) | the private knowledge base and the local agents |
| [installer/](installer/README.md) · [website/](website/README.md) | the installers and the website |

## Learn

- [The tutorial](nuclear-synapsis-framework/docs/08-guides/tutorial.md): an app from scratch.
- [The language guide](nuclearlang/docs/08-guides/README.md) and [the dialects](nuclearlang/dialects/README.md).
- [The platforms](nuclear-synapsis-framework/platforms/README.md).
- [AGENTS.md](AGENTS.md) and [docs/README.md](docs/README.md): the map and the rules, for contributors and agents.

## Community

Questions and ideas: [GitHub Discussions](https://github.com/nuclearlang/lang/discussions). How to contribute:
[CONTRIBUTING.md](CONTRIBUTING.md). Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Security:
[SECURITY.md](SECURITY.md). How decisions are made: [GOVERNANCE.md](GOVERNANCE.md).

Free and open source under the [Apache License 2.0](LICENSE).
