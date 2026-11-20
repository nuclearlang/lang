# nuclear-atlas

**Nuclear Atlas**, the general agent over the RAG (the tool `atlas` of the Nuclear workspace, `Ctrl+Alt+A`): Nuclear
Chat (spec 013) mounted as the page, on the direct message with the general agent (`dm-atlas`, answered by the
external agent or provider of `nuclear.builder.chat`, Claude Code by default, over the Nuclear Smart Graph; the local
models are on standby, ADR-platform-0013). Atlas informs and runs no task (spec 023): a task goes to a team's tech
lead, and `/task` there is answered with the leads to ask. VS Code only.

## Where the code is
In this folder; the VS Code extension compiles and bundles `src/` (`extensions/vscode/tsconfig.json`).

| File | What it is |
|---|---|
| `src/chat.ts` | the templates from the project's map, the answer to `/task` (`noTaskText`); no `vscode` import |
| `src/panel.ts` | the page (the templates over the mounted chat; when `agents --json` has no agent available, a line that says how to pick one, linked to Settings and integrations → Nuclear Builder) and the answer to `/task` (Atlas's host listens to `dm-atlas`: the tech leads as links) |
| `src/l10n.ts` | the texts of the page and of what Atlas posts, English and Spanish |

## Stack
- TypeScript; the page is plain HTML and script around Nuclear Chat's embedded UI (`out/chat-embed.js`)
- Nuclear Chat through the window's one connection (`vscode/src/chatHost.ts`, `chatView.ts`)

## Commands
Run in `extensions/vscode/`: `npm run compile`, `npm test` (`../tools/nuclear-builder/test/editors.test.ts` covers the
templates; `test/chat.test.ts` the chat's host).

## Rules
- `chat.ts` has no `vscode` import.
- The work does not belong to the page: the members answer through the chat service, and an order is a run of the
  extension; closing the page leaves both going, and a notice says when an order ends.
- The conversation is Nuclear Chat's (`.nuclear/chat/` of the project); the page never holds the service's token.
- Nuclear Atlas never calls a model by itself: questions go to the general agent, orders to Nuclear Builder.
- The decisions: ADR-platform-0003, ADR-platform-0013 (the local models on standby)

## Documents (read by task)
| You need… | Read |
|---|---|
| How a question and an order travel, what the page draws | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| What a user reads: what Nuclear Atlas needs, questions, tasks (to a tech lead), the templates | [docs/08-guides/README.md](docs/08-guides/README.md) |
| The pending work | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| How a tech lead runs a task | [`nuclear-builder`](../nuclear-builder/AGENTS.md) |
| The notices, the checked connections, the context setting | [the VS Code extension](../../vscode/docs/02-architecture/ai-services.md) |
| The assistant that answers | the Builder's `member --role chat` ([chat.md](../nuclear-builder/docs/02-architecture/chat.md)) |
