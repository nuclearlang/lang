# Nuclear Smart Graph

The private library of everything NuclearLang and Synapsis are, on the developer's machine (the RAG of the
platform): shelves of typed, linked, versioned cards, the exact facts of the base in a relational database, the
knowledge base those are made from (`data/`), and an HTTP server with access control. Agents (frontier models over
MCP, the local agents of the Nuclear Developer) ask it instead of guessing. ADR key: `graph`.

The platform's rules are the root [`AGENTS.md`](../AGENTS.md).

## Stack

- **Source:** Nuclear, the `python` dialect (`*.nuc` at the root of this folder, `nuclear.toml`). `nuclear build .`
  writes the Python package `build/nuclear_graph`, which `pyproject.toml` packages (Python 3.12+, uv, hatchling).
- **Store:** Chroma, one collection per shelf, documents encrypted (AES-256-GCM); vectors by `embeddinggemma` on
  Ollama; the exact facts in SQLite, in memory only.
- **Server:** FastAPI + uvicorn on `127.0.0.1:7878`, a token on every route. The client (`nuclear_graph.client`)
  needs only `httpx`.
- **The MCP server** is not here: it is the project [`tools/mcp`](../tools/mcp/AGENTS.md) (command `nuclear-mcp`),
  which imports this package; `knowledge build` reads its tools with `nuclear-mcp tools`.

## Commands

In this folder:

| | |
|---|---|
| Check and build | `nuclear check . && nuclear build .` |
| Environment | `uv sync --extra server --extra test` |
| Tests | `.venv/bin/python -m pytest -q` (the tests are `tests/*.nuc`; build first) |
| Install the command (from the tree's root) | `uv tool install --editable './nuclear-graph-storage[server]'` |
| Serve | `nuclear-graph serve` |
| The knowledge base | `nuclear-graph knowledge build`, `knowledge check`, `knowledge review [id...]`, `ingest`, `knowledge ask [word...]`, `knowledge examples` |
| Ask | `nuclear-graph search "<query>"`, `card <id>`, `answer "<question>"`, `strategy "<request>"`, `stats` |
| Access | `nuclear-graph connect <client> --scopes read,write`, `requests`, `allow <request>`, `deny <request>`, `revoke <client>` |
| The agents' search engine | `nuclear-graph web-key brave` |

## Folders

- `*.nuc`: the source ([what each file is](docs/02-architecture/overview.md#parts)); `nuclear.toml`,
  `pyproject.toml`.
- `tests/`: the tests, in Nuclear.
- `prompts/`: the prompt files every model reads (`<use case>.md`, `agents/<step>.md`).
- `data/`: the knowledge base ([`data/README.md`](data/README.md)): `assets/<shelf>/`, `sections.toml`,
  `questions.toml`, and what the build writes (`schema.json`, `manifest.json`, `revisions.json`, `INDEX.md`).
- `build/`, `.venv/`: generated. Never edited, never committed.
- `docs/`: the context documents (the table below).

## Rules

- **It is written in Nuclear.** The `.nuc` files are the source. After a change: `nuclear check .`,
  `nuclear build .`, the tests. What Nuclear cannot express is a finding of the compiler for the language's roadmap
  (`../nuclearlang/docs/01-product/roadmap.md`), never a `.py` file written by hand.
- **Never weaken a security rule** (a token on every route, no `Origin`, encryption at rest, only ingest writes the
  shelves of the base) to make something easier: build the access the right way (`connect`, a request the user
  allows). The exact facts are never written to disk: the database is made in memory from the sealed cards
  (`facts.nuc`).
- **The knowledge base is rows, not copied documents.** What has a structured source is generated (the
  `extract_*.nuc` modules), never written by hand; what is written by hand names its sources. `shelves.nuc` is the
  schema: a new shelf, type or filter is added there, with a test.
- **A question with one right answer** (which, how many, what are) is a row of `data/assets/queries/` over the
  views of `facts.nuc`, never a card someone keeps in step by hand: a new kind of fact is a view, a new question a
  row with its parameters, and an entry of `data/questions.toml` with `exact = true`.
- **After any change here or in the tree:** `nuclear-graph knowledge build`, `knowledge check`, `ingest`,
  `knowledge ask` (every question finds its row) and `knowledge examples` (every Nuclear example compiles).
- **The prompts in `prompts/` are measured** by the evaluation of the Nuclear Developer
  (`../nuclear-agents/nuclear_developer/eval`): a change is a new round, recorded in its report.
- A change to a route, to the client or to a setting updates `docs/02-architecture/integrations.md`. A structural
  decision is a new ADR in `docs/03-adr/`. What cannot be read from the code or the documents is asked, not
  invented.

## Documents (open the one the task needs)

| Read when you… | Document |
|---|---|
| need what the graph is for, who reads it and what it is not | [docs/00-context/vision.md](docs/00-context/vision.md) |
| meet a word: shelf, row, asset, overlay, revision, query, planner, strategy | [docs/00-context/glossary.md](docs/00-context/glossary.md) |
| look for what is pending, half done or untested | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| need the shape of the system, what each `.nuc` file is, the dependencies | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| add or change a shelf, a row type, a field of a card, what is embedded | [docs/02-architecture/shelves.md](docs/02-architecture/shelves.md) |
| change the search, its ranking, or how a strategy is chosen | [docs/02-architecture/search.md](docs/02-architecture/search.md) |
| add a view, an exact question, or change the query planner | [docs/02-architecture/exact-facts.md](docs/02-architecture/exact-facts.md) |
| change what the base is generated from, its validation or its versions | [docs/02-architecture/knowledge-base.md](docs/02-architecture/knowledge-base.md) |
| change an HTTP route, the client package, or what calls the graph | [docs/02-architecture/integrations.md](docs/02-architecture/integrations.md) |
| ask why something was decided | [docs/03-adr/README.md](docs/03-adr/README.md) |
| touch access, tokens, encryption or what is stored in clear | [docs/05-standards/security.md](docs/05-standards/security.md) |
| write a test, or add a question to `questions.toml` | [docs/05-standards/testing.md](docs/05-standards/testing.md) |
| install, serve, connect a client, set a variable, or see a failure | [docs/06-runbooks/install-and-serve.md](docs/06-runbooks/install-and-serve.md) |
| need what a user reads: what the graph holds, how to ask it, how it is kept current | [docs/08-guides/README.md](docs/08-guides/README.md) |
| changed the ecosystem and must bring the base up to date | [docs/06-runbooks/update-the-knowledge-base.md](docs/06-runbooks/update-the-knowledge-base.md) |
