# Nuclear Builder

[![extension-vscode](https://github.com/nuclearlang/nuclearlang/actions/workflows/extension-vscode.yml/badge.svg)](https://github.com/nuclearlang/nuclearlang/actions/workflows/extension-vscode.yml) · [Website](https://nuclearlang.github.io/tools/builder)

The pipeline of the editors: a spec goes through plan, tests first, code, verification, security and deploy, and
every step shows who did it. In VS Code (`Ctrl+Alt+P`), JetBrains (`Alt+Shift+P`) and as `nuclear-builder` in a terminal or CI.

## Why

- Work with AI starts from a spec and ends in tested, reviewed code, every step visible.
- Claude leads (plan, names, review); the local Nuclear Developer writes each piece, on your machine.
- The same pipeline runs on a server; the shell runs only what `.nuclear/builder.json` allows.

## How we made it

- One of the four projects of the AI loop ([ADR-platform-0003](../../../docs/03-adr/0003-the-ai-loop.md)).
- A strategy per kind of request decides the stages ([ADR-developer-0001](../../../nuclear-agents/nuclear_developer/docs/03-adr/0001-a-strategy-for-each-kind-of-request.md)).
- The generators write first, the agents only what is left ([ADR-codegen-0001](../../../tools/code_generator/docs/03-adr/0001-the-generators-write-finished-code-the-agent-only-what-is-not-standard.md), [ADR-platform-0004](../../../docs/03-adr/0004-products-are-made-with-the-tools.md)).
- Claude leads by default: the local developer passes 41 or 42 of 42 single files (Sonnet 36) but one or two of three features (Sonnet three) ([the rounds](../../../nuclear-agents/nuclear_developer/docs/05-standards/testing.md)).
- A run is a file that survives a crash; one engine in TypeScript with no editor inside it.

## Try it

```sh
nuclear-builder setup                                  # installs the services and the models
nuclear-builder run specs/<component>/<id>/spec.md    # one line per step; the journal in .nuclear/builder/runs/
```

## Read next

- [Write a spec and start a run](docs/08-guides/write-a-spec.md) · [Follow a run](docs/08-guides/follow-a-run.md)
- [The commands of each stage](docs/08-guides/pipeline-commands.md)
- [How the engine works](docs/02-architecture/engine.md)
- [Roadmap](docs/01-product/roadmap.md) · [AGENTS.md](AGENTS.md) to change it
