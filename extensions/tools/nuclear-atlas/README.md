# Nuclear Atlas

**Nuclear Atlas** is the local agent integrated with the RAG: a chat about your project, like the chats of Claude or
Cursor, answered by the local agents on your own machine from the
[Nuclear Smart Graph](../../../nuclear-graph-storage/README.md), the 100% local knowledge base the agents also read
through the MCP server. It is a tool of the Nuclear workspace in VS Code (`Ctrl+Alt+A`). A message is a question;
`/task <what to do>` is an order.

## Why it exists

A developer wants to ask about the project in front of them and to hand small work to an agent, without the code leaving the machine and without paying a
frontier model for every token. Nuclear Atlas sends a question to the local assistant of the
[Nuclear Developer](../../../nuclear-agents/nuclear_developer/README.md) with the project's map
(`.nuclear/map.md`, written by the build) and the last messages of the session; the assistant answers from that map
and the [Smart Graph](../../../nuclear-graph-storage/README.md). An order runs as a
[Nuclear Builder](../nuclear-builder/README.md) run by the local agents: plan, tests first, code, tests, security
review; its journal is the answer.

What it leaves out: Nuclear Atlas never calls a model by itself (questions go to the Developer, orders to the Builder),
and it is VS Code only.

## How we made it

- **Part of the AI loop** ([ADR-platform-0003](../../../docs/03-adr/0003-the-ai-loop.md)): local models of at most
  3B parameters, which write only Nuclear, with what they know in the Smart Graph.
- **The work belongs to the extension, not to the page**: closing the page or switching tools leaves a question
  thinking; the answer is saved in its session and a notification says so.
- **Sessions live in the project**: `.nuclear/chat/<id>.json`, listed on the left.
- **What the agent did is shown**: its steps, how long, how many tokens it read, folded under each answer; a
  context meter warns when the local model's window is nearly full.
- **Written in TypeScript**, bundled by the VS Code extension; `src/chat.ts` has no `vscode` import, so the tests
  drive it without the editor.

**State:** the panel was never opened in a running VS Code (only headless renders, node checks and HTTP calls)
([roadmap](docs/01-product/roadmap.md)).

## Try it

It needs the Nuclear Developer, the Smart Graph and Ollama with the assistant model running:
*Nuclear: Set Up the AI Services* in VS Code, or `nuclear-builder setup`
([Set up the AI services](../../../installer/docs/08-guides/ai-setup.md)). Then open a Nuclear project, press
`Ctrl+Alt+A` and ask a question, or write `/task <what to do>`. Before each question Nuclear Atlas checks that every
service answers and names the one that does not.

## Where to read next

| | |
|---|---|
| What Nuclear Atlas needs, questions, `/task`, sessions | [docs/08-guides/README.md](docs/08-guides/README.md) |
| How a question and an order travel | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| What is pending | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| To change it | [AGENTS.md](AGENTS.md) |
