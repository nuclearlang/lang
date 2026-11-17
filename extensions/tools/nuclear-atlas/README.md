# Nuclear Atlas

[![extension-vscode](https://github.com/nuclearlang/lang/actions/workflows/extension-vscode.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/extension-vscode.yml) · [Website](https://nuclearlang.github.io/tools/atlas)

A chat about your project, like Claude's or Cursor's, answered by local agents on your own machine from the
[Smart Graph](../../../nuclear-graph-storage/README.md). In VS Code (`Ctrl+Alt+A`): a message is a question,
`/task <what to do>` an order.

## Why

- Ask about your project and hand off small work without the code leaving the machine.
- No frontier model paid per token: questions go to the [Nuclear Developer](../../../nuclear-agents/nuclear_developer/README.md), orders run as a [Nuclear Builder](../nuclear-builder/README.md) run.
- Left out on purpose: it never calls a model by itself; VS Code only.

## How we made it

- Part of the AI loop: local models of at most 3B parameters ([ADR-platform-0003](../../../docs/03-adr/0003-the-ai-loop.md)).
- The work belongs to the extension: close the page and the answer still lands in its session (`.nuclear/chat/`).
- Every answer shows the agent's steps, time and tokens; a meter warns when the context is nearly full.
- TypeScript; `src/chat.ts` has no `vscode` import. Never yet opened in a live VS Code ([roadmap](docs/01-product/roadmap.md)).

## Try it

```sh
nuclear-builder setup    # the Developer, the Smart Graph and Ollama
```

Then open a Nuclear project in VS Code, press `Ctrl+Alt+A` and ask ([Set up the AI services](../../../installer/docs/08-guides/ai-setup.md)).

## Read next

- [The guide](docs/08-guides/README.md): questions, `/task`, sessions
- [How a question and an order travel](docs/02-architecture/overview.md)
- [Roadmap](docs/01-product/roadmap.md) · [AGENTS.md](AGENTS.md) to change it
