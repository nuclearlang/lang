---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/overview.md, ../../../nuclear-builder/docs/08-guides/README.md, ../../../../vscode/docs/08-guides/workspace.md, ../../../../../installer/docs/08-guides/ai-setup.md]
---
# Nuclear Atlas

**Nuclear Atlas** is the local agent integrated with the RAG: a chat about your project, like the chats of Claude or
Cursor, but answered by local agents on your own machine from the Nuclear Smart Graph, the 100% local knowledge base
the agents also read through the MCP server. It is the tool **Nuclear Atlas** of the Nuclear workspace (`Ctrl+Alt+A`), in VS Code only. It works on the last
project you were in.

TODO(human): Nuclear Atlas was never opened in a running VS Code. Check this guide against it once.

## What it needs

Nuclear Atlas never calls a model by itself. It needs these services running:

| Service | Setting | Default |
|---|---|---|
| The Nuclear Developer (the local agents) | `nuclear.ai.developerUrl` | `http://127.0.0.1:7879` |
| The Smart Graph (the knowledge base) | `nuclear.ai.graphUrl` | `http://127.0.0.1:7878` |
| Ollama, with the assistant model | `nuclear.ai.ollamaUrl`, `nuclear.ai.models.assistant` | `http://localhost:11434`, `gemma4:e2b` |

The models are local and at most of the 3B class. The Developer writes code with `nuclear.ai.models.coder`
(`qwen2.5-coder:3b`), and the Smart Graph searches with `nuclear.ai.models.embeddings` (`embeddinggemma`). Install
them all with *Nuclear: Set Up the AI Services*
([Set up the AI services](../../../../../installer/docs/08-guides/ai-setup.md)), and start or restart them in
*Settings and integrations* (`Ctrl+Alt+S`). Before each question Nuclear Atlas checks that the Developer, the Smart
Graph, Ollama and the assistant model answer, and tells you which one does not.

## Ask a question

Type it and press Enter (Shift+Enter is a new line). The question goes to the Nuclear Developer with:

- your project's platform;
- its map, `.nuclear/map.md` (every declaration with its kind and members, written by the build), up to 12 000
  characters;
- the last 8 messages of the session.

The local assistant answers from the map and the Smart Graph. Under each answer, folded in grey, you see what the
agent did: its steps, how long it took and how many tokens it read.

## Give an order: `/task`

`/task <what to do>`, for example `/task Add a screen that lists the orders`. The order runs as a Nuclear Builder
run led by the local agents: they plan it, write the tests first, then the code, run the tests and the security
review. Each step shows as it ends, and the answer is the run's notes with *Open the journal of the run*. An order
that starts with "fix" becomes a bug; any other is a feature. How a run works:
[Nuclear Builder](../../../nuclear-builder/docs/08-guides/README.md).

## Templates, history and retry

- The templates above the input are built from your project's own components, use cases and controllers or
  screens.
- ↑ and ↓ in the input go through the questions you asked before.
- A question that failed has **↻ Retry**. An order that failed can be retried from the step that failed, and shows
  the diagnosis of why it failed.
- The context meter shows how full the local model's window is (`nuclear.ai.contextTokens`, 8192 by default). When
  it is nearly full, it tells you to start a new session.

## Sessions

Each conversation is a session, saved in the project as `.nuclear/chat/<id>.json` and listed on the left of the
page. **+ New session** starts another; each one can be deleted from the list.

The work does not belong to the page. Close it or switch tools and Nuclear Atlas goes on thinking. The answer is saved in
its session, and a notification tells you (a count on the *Nuclear Atlas* tab and the badge of the Nuclear icon).
