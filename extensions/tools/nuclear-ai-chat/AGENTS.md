# nuclear-ai-chat

The chat of the editor. The code calls it **Nuclear agent** today (the tool `agent` of the Nuclear workspace,
`Ctrl+Alt+A`): a chat with the local agents of the Nuclear Developer over the active project, on the developer's
machine, like the chats of Claude or Cursor. A message is a question, answered from the project's map and the Smart
Graph; `/task <what to do>` is an order, run as a Nuclear Builder run by the local agents. VS Code only.

## Where the code is
In this folder; the VS Code extension compiles and bundles `src/` (`extensions/vscode/tsconfig.json`).

| File | What it is |
|---|---|
| `src/chat.ts` | the chat without the editor: sessions on disk, the history the assistant reads, the templates |
| `src/panel.ts` | the page and its jobs |

The rule of the local models (`extensions/vscode/src/localModels.ts`) stays with
[the settings page](../../vscode/docs/02-architecture/ai-services.md), its only importer.

## Stack
- TypeScript; the page is plain HTML and script and renders the answers' markdown itself
- The Nuclear Developer over HTTP (`POST /developer/chat`); Nuclear Builder's engine for `/task`

## Commands
Run in `extensions/vscode/`: `npm run compile`, `npm test` (`../tools/nuclear-builder/test/engine.test.ts` covers the
templates, the history and the token estimate).

## Rules
- `chat.ts` has no `vscode` import.
- The work does not belong to the page: a question or an order is a job of the extension (`jobs`, module-level).
  Closing the page or switching tools leaves it thinking; the answer is saved in its session and a notice says so.
- Sessions are kept in the project: `.nuclear/chat/<id>.json`.
- The chat never calls a model by itself: questions go to the Developer, orders to Nuclear Builder.
- The decision: ADR-platform-0003

## Documents (read by task)
| You need… | Read |
|---|---|
| How a question and an order travel, the sessions, what the page draws | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| What a user reads: what the chat needs, questions, `/task`, sessions | [docs/08-guides/README.md](docs/08-guides/README.md) |
| The pending work | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| The Nuclear Builder run behind `/task` | [`nuclear-builder`](../nuclear-builder/AGENTS.md) |
| The notices, the checked connections, the context setting | [the VS Code extension](../../vscode/docs/02-architecture/ai-services.md) |
| The assistant that answers | `nuclear-agents/nuclear_developer/` |
