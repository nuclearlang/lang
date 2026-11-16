# Nuclear Smart Graph

The local, private library of everything NuclearLang and Synapsis are. Agents (Claude, Codex, Cursor, the local
Nuclear Developer) ask it instead of guessing: what Nuclear is for, how each thing is written, every kind and
decorator, every tool, every error and its fix, what can and cannot be done, how a task is done step by step, and
validated code.

It is a library of cards on shelves, not a copy of the documentation. It finds a card by meaning and by exact name,
answers a question that has one right answer (which, how many, what are) with every row, and says which kind of
request a text is. It asks no model to do any of that. Nothing reads it until you allow it, and what it stores is
encrypted.

```
 Claude Code / Codex / Cursor ──MCP (stdio)──┐
                                             ▼
 VS Code Builder tool ──HTTP──┐        nuclear-mcp (tools/mcp) ──► nuclear, nuclear-builder
                           ▼                 │        └─► Nuclear Developer (local 3B agents)
 Nuclear Developer ──HTTP──► nuclear-graph serve (127.0.0.1:7878, token)
                                     │
                                     ▼
              Chroma: one collection per shelf (encrypted documents) + EmbeddingGemma (Ollama)
```

## Install

The set-up of the AI services installs it, loads the knowledge base and starts it at every login:
`nuclear-builder setup`, the installer's last step, or the wizard of VS Code
([Set up the AI services](../installer/docs/08-guides/ai-setup.md)). By hand:
[install, serve and ask](docs/06-runbooks/install-and-serve.md).

## Use it

```sh
nuclear-graph search "como funciona el MCP"        # the cards that answer, from every shelf
nuclear-graph card error:N0114                     # one card and what it links to
nuclear-graph answer "which tools does the MCP have"   # the exact rows, then the cards
nuclear-graph strategy "renombra Book a Title"     # which kind of request it is, and why
```

## Use it from an AI agent (MCP)

The MCP server of NuclearLang is `nuclear-mcp`, a project of its own ([`tools/mcp`](../tools/mcp/AGENTS.md)): it
offers the graph, the compiler, the `nuclear` commands and the local developer as tools. `nuclear-graph mcp` still
runs it.

```sh
claude mcp add nuclear -- nuclear-mcp       # Claude Code
codex mcp add nuclear -- nuclear-mcp        # Codex
```

Its tools and the set-up of each client: the project [`tools/mcp`](../tools/mcp/AGENTS.md).

## Who may read it

Nothing reaches the graph without a token, and no token exists until you allow it:

```sh
nuclear-graph connect mcp --scopes read,write                 # the MCP server
nuclear-graph connect nuclear-developer --scopes read,write   # the local agents
```

The access commands, how it is protected and its limits: [security](docs/05-standards/security.md).

## More

| | |
|---|---|
| The shelves and what a card is | [docs/02-architecture/shelves.md](docs/02-architecture/shelves.md) |
| The search, and the strategy of a request | [docs/02-architecture/search.md](docs/02-architecture/search.md) |
| Exact facts and the query planner | [docs/02-architecture/exact-facts.md](docs/02-architecture/exact-facts.md) |
| The knowledge base (`data/`) and how it stays current | [docs/02-architecture/knowledge-base.md](docs/02-architecture/knowledge-base.md), [the runbook](docs/06-runbooks/update-the-knowledge-base.md) |
| The HTTP API and the client package for programs | [docs/02-architecture/integrations.md](docs/02-architecture/integrations.md) |
| The settings | [docs/06-runbooks/install-and-serve.md](docs/06-runbooks/install-and-serve.md#settings) |
| How it is built and tested | [AGENTS.md](AGENTS.md), [docs/05-standards/testing.md](docs/05-standards/testing.md) |
| Why it is this way | [docs/03-adr/README.md](docs/03-adr/README.md) |

## License

Apache-2.0.
