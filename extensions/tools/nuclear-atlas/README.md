# Nuclear Atlas

[![extension-vscode](https://github.com/nuclearlang/lang/actions/workflows/extension-vscode.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/extension-vscode.yml) · [Website](https://nuclearlang.github.io/tools/atlas)

Your direct message with the factory's general agent in [Nuclear Chat](../../../nuclear-chat/README.md), answered
by the agent or provider you pick (Claude Code by default) from the [Smart Graph](../../../nuclear-graph-storage/README.md). In VS Code (`Ctrl+Alt+A`): a message
is a question, `/task <what to do>` an order.

## Why

- Ask about your project and hand off small work from the editor.
- Questions go to the agent or provider of `nuclear.builder.chat`, orders run as a [Nuclear Builder](../nuclear-builder/README.md) run; the local models are on standby ([ADR-platform-0013](../../../docs/03-adr/0013-local-models-on-standby.md)).
- Left out on purpose: it never calls a model by itself; VS Code only.

## How we made it

- Part of the AI loop ([ADR-platform-0003](../../../docs/03-adr/0003-the-ai-loop.md)), answered by external agents and providers since ADR-platform-0013.
- One chat for every tool: the page is Nuclear Chat's own UI, the same as the Builder's dock; the conversation stays in the project (`.nuclear/chat/`).
- TypeScript around the chat's embedded bundle; `src/chat.ts` has no `vscode` import. Never yet opened in a live VS Code ([roadmap](docs/01-product/roadmap.md)).

## Try it

```sh
nuclear-builder setup    # the Smart Graph, the MCP server and Nuclear Chat
```

Then open a Nuclear project in VS Code, press `Ctrl+Alt+A` and ask ([Set up the AI services](../../../installer/docs/08-guides/ai-setup.md)).

## Read next

- [The guide](docs/08-guides/README.md): questions, `/task`, the templates
- [How a question and an order travel](docs/02-architecture/overview.md)
- [Roadmap](docs/01-product/roadmap.md) · [AGENTS.md](AGENTS.md) to change it
