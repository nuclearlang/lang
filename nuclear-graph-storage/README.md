# Nuclear Smart Graph

The local, private library of everything NuclearLang and Synapsis are. Agents (Claude, Codex, Cursor, the local
Nuclear Developer) ask it instead of guessing: what Nuclear is for, how each thing is written, every kind and
decorator, every tool, every error and its fix, what can and cannot be done, how a task is done step by step, and
validated code.

## Why it exists

An agent that writes Nuclear guesses what it does not know. Cutting every markdown file of the tree into pieces does
not stop that: a piece knows its file and little else, and a search by meaning gives the closest pieces, never *all*
of something. Asked for every tool of the MCP server, it gives four and a model fills in the rest from memory.

The Smart Graph is a library of cards on shelves instead: each card answers one question and links to the cards it
has to do with. A question with one right answer (which, how many, what are) gets every row, the same on every run,
whatever the model.

What it is not, on purpose:

- **Not a copy of the documentation**, and not the teaching material nor the projects' pending work.
- **Not a model.** The search, the choice of a strategy and the query planner ask no model; only the embeddings are
  computed.
- **Not shared.** It runs on the developer's machine for one OS user, and no program reads it until the user allows
  it.

## How we made it

- **Part of the AI loop** ([ADR-platform-0003](../docs/03-adr/0003-the-ai-loop.md)): the knowledge base of the
  platform, read by frontier models through [the MCP server](../tools/mcp/AGENTS.md) and by the local agents of the
  [Nuclear Developer](../nuclear-agents/nuclear_developer/README.md) over HTTP. The agents' prompts are files of
  the graph (`prompts/`), never text inside their code.
- **A library of typed, linked, versioned rows**
  ([ADR-graph-0001](docs/03-adr/0001-a-library-of-typed-linked-versioned-rows.md)): one Chroma collection per kind
  of question; a search by meaning and by exact name (a code, a command or a kind reaches its card whatever the rest
  of the sentence says); rows with a structured source generated from the tree, never written by hand; a base that
  is valid or is not built, and a check that fails when it falls behind the code. The local agents read only the
  rows written for them, which hold no code of a target language.
- **Exact facts and a query planner**
  ([ADR-graph-0002](docs/03-adr/0002-exact-facts-a-query-planner-and-the-graph-in-nuclear.md)): the facts of the
  base in an SQLite database that lives in memory only, the questions with one right answer as rows of SQL, and a
  planner that matches a question to them without a model.
- **Private by construction**: only its server opens the store, it listens on `127.0.0.1:7878`, every route needs
  a token, and the documents are encrypted on disk (AES-256-GCM) ([security](docs/05-standards/security.md)).
- **Written in Nuclear**, the `python` dialect: `nuclear build` writes the Python package `build/nuclear_graph`
  (FastAPI, Chroma, embeddings by `embeddinggemma` on Ollama). Its tests are `tests/*.nuc`. What the language could
  not express is a finding for the language's roadmap, never a hand-written `.py`.

## Try it

The set-up of the AI services installs it, loads the knowledge base and starts it at every login:
`nuclear-builder setup`, the installer's last step, or the wizard of VS Code
([Set up the AI services](../installer/docs/08-guides/ai-setup.md)). By hand, from the root of the tree:

```sh
ollama pull embeddinggemma
nuclear build nuclear-graph-storage                            # the graph is written in Nuclear: its Python package
uv tool install --editable './nuclear-graph-storage[server]'  # nuclear-graph on the PATH
nuclear-graph serve &                                          # on 127.0.0.1:7878
nuclear-graph knowledge build && nuclear-graph ingest          # the knowledge base, learnt by the graph
nuclear-graph stats                                            # the rows of each shelf and the revision it holds
```

Then ask it:

```sh
nuclear-graph search "how does the MCP server work"   # the cards that answer, from every shelf
nuclear-graph card error:N0114                        # one card and what it links to
nuclear-graph answer "which tools does the MCP have"  # the exact rows, then the cards
nuclear-graph strategy "rename Book to Title"         # which kind of request it is, and why
nuclear-graph connect mcp --scopes read,write         # give a program access (here the MCP server)
```

## Where to read next

| | |
|---|---|
| What the graph holds, how to ask it, how it is kept current | [docs/08-guides/README.md](docs/08-guides/README.md) |
| Install, serve, connect a client, the settings | [docs/06-runbooks/install-and-serve.md](docs/06-runbooks/install-and-serve.md) |
| The shelves and what a card is | [docs/02-architecture/shelves.md](docs/02-architecture/shelves.md) |
| The search, exact facts and the planner | [docs/02-architecture/search.md](docs/02-architecture/search.md), [docs/02-architecture/exact-facts.md](docs/02-architecture/exact-facts.md) |
| The knowledge base (`data/`) and how it stays current | [docs/02-architecture/knowledge-base.md](docs/02-architecture/knowledge-base.md), [the runbook](docs/06-runbooks/update-the-knowledge-base.md) |
| The HTTP API and the client package | [docs/02-architecture/integrations.md](docs/02-architecture/integrations.md) |
| Why it is this way | [docs/03-adr/README.md](docs/03-adr/README.md) |
| What is pending | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| To change it | [AGENTS.md](AGENTS.md) |

## License

Apache-2.0.
