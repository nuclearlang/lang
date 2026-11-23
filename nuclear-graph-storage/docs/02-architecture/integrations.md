---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, search.md, exact-facts.md, ../05-standards/security.md, ../06-runbooks/install-and-serve.md]
---
# Integrations and contracts

## Who calls the graph

| Caller | How | Scopes |
|---|---|---|
| The MCP server (`nuclear-mcp`, [`tools/mcp`](../../../tools/mcp/AGENTS.md)) | `GraphClient("mcp")` over HTTP | read, write |
| The [Nuclear Developer](../../../nuclear-agents/nuclear_developer/AGENTS.md) | `GraphClient("nuclear-developer")` over HTTP | read, write |
| The Builder and the settings page of the editor ([`extensions/`](../../../extensions/AGENTS.md)) | `GET /v1/health`: the check of the connections before a run (a run reads the graph through the Developer and the MCP server) | none |
| The `nuclear-graph` command | HTTP with the owner token | admin |

## HTTP API

On `127.0.0.1` only. All routes need `Authorization: Bearer <token>` except `GET /v1/health`, `POST /v1/access` and
`GET /v1/access/{id}`.

| Route | Scope | Body / answer |
|---|---|---|
| `GET /v1/health` | — | `{status: "ok", version}` |
| `POST /v1/search` | read | `{query, collection \| shelves, k = 5, platform, agents, where, expand}` → `{items: [{id, shelf, text, meta, distance, score, via, card, related}]}`; without a collection, every shelf of the base; `where` filters by metadata (`{"type": "kind"}`, `{"kinds": "usecase"}`) |
| `GET /v1/cards/{id}` | read | one card by its id, with the title and summary of the rows it links to |
| `POST /v1/answer` | read | `{question, platform, history, agents, k}` → `{exact, needs, cards, facts, knowledge}`: what a question needs before a model answers it. `exact`: the exact queries it is, each with its parameters and its rows; `needs`: the ones it is close to that lack a name; `cards`: the shelves' answer by meaning; `facts` and `knowledge`: both as the text a prompt gets. No model is asked |
| `POST /v1/strategy` | read | `{text, platform, existing, new, runnable, only}` → the strategies that fit a request, best first (at most three): `{id, title, summary, score, why, data, text}`. `existing` and `new`: the declarations the request names that a project has, and the ones it has not; `runnable`: for a run of the Builder; `only`: the strategy the request itself names |
| `POST /v1/applies` | read | `{text, platform}` → the capabilities rows whose trigger words a spec writes: what the platform cannot do yet, limits, parts never run for real (exact, never by meaning) |
| `GET /v1/kinds/{platform}` | read | every way a kind of the platform is written (`use case`, `application component`) and the kind it means |
| `GET /v1/prompts/{use_case}` | read | the prompt document |
| `POST /v1/documents` | write | `{collection: "memory" \| "examples", id, text, meta}`: what an agent keeps at run time |
| `DELETE /v1/documents/{collection}/{id}` | write | |
| `GET /v1/stats` | read | the rows of each collection; the schema and revision of the base the graph holds |
| `POST /v1/ingest` | admin | `{roots: [<knowledge folder>]}` |
| `POST /v1/access` | — | `{client, scopes, reason}` → `{request}` |
| `GET /v1/access/{request}` | — | `{status}`; once allowed, the token, a single time |
| `GET /v1/access`, `POST /v1/access/{request}/allow\|deny` | admin | manage requests |

## For programs: the client package

`pip install nuclear-graph` (without `[server]`) needs only `httpx`:

```python
from nuclear_graph.client import GraphClient
from nuclear_graph.toolchain import Toolchain

graph = GraphClient("my-tool")               # token: NUCLEAR_GRAPH_TOKEN or `nuclear-graph connect my-tool`
text = await graph.search("repository query with where", shelves="platforms,errors", platform="backend", agents=True)
card = await graph.card("kind:backend.repository")
errors = await Toolchain().check(code, "backend")   # "ok" or one line per error; a platform or a dialect
limits = await graph.applies(spec, "backend")       # what of a spec the platform cannot do yet
chosen = await graph.strategy(request, "backend")   # which kind of request it is: id, why, plan, stages, needs...

from nuclear_graph.workspace import Workspace       # a project's files for an agent: read-only, inside the project
files = Workspace("/path/to/project")
context = files.context("A use case BooksOfAuthor(books: BookRepository)")   # the files that declare those names
files.read("config.nuc"); files.list("components"); files.find("**/*_repository.nuc"); files.grep("byAuthor")
files.renamed("Book", "Title")                      # a rename by a tool: every file that writes the name, rewritten
```

`GraphClient` also has `answer`, `kinds`, `prompt`, `remember`, `examples`, `pitfalls`, `brief` and `stats`
(`client.nuc`). The type definitions of `nuclear_graph.client`, `nuclear_graph.toolchain` and
`nuclear_graph.workspace` that a Nuclear project uses are generated with `nuclearlang/tools/defs/python/gen.py`.

## The MCP server

`nuclear-mcp` speaks the Model Context Protocol over stdio. It is not in this folder:
it is a Nuclear project of its own that imports this package (its `defs/python/nuclear_graph/`); its tools, its instructions and how a client adds it are documented by the project
[`tools/mcp`](../../../tools/mcp/AGENTS.md). What its `graph_*` tools call here:

| MCP tool | Client call | Route |
|---|---|---|
| `graph_strategy` | `strategy` | `POST /v1/strategy` |
| `graph_answer` | `answer` (with `agents = false`) | `POST /v1/answer` |
| `graph_search` | `search` (with `expand`) | `POST /v1/search` |
| `graph_card` | `card` | `GET /v1/cards/{id}` |
| `graph_prompt` | `prompt` | `GET /v1/prompts/{use_case}` |
| `graph_remember` | `remember` | `POST /v1/documents` |

`developer_review` also writes here: each corrected file becomes a row of `examples`.

## What the graph consumes

| Service | Use | Setting |
|---|---|---|
| Hugging Face | EmbeddingGemma's ONNX files, downloaded once (`nuclear-graph model`, else the first search) into the data folder's `models/` | `NUCLEAR_GRAPH_EMBED_FILE` (another export of the same model, `onnx/<file>.onnx`) |
| The desktop keyring | the documents' key, the tokens | — |
| `nuclear`, `nuclear-builder`, `nuclear-mcp` | their help and `nuclear-mcp tools` (rows); `Toolchain` runs `nuclear` (`Toolchain.project(root, args)` runs `nuclear <args>` in a project) | on the `PATH` |
| The internet (`web.nuc`) | `web_search`, `web_read` for the agents: your own SearXNG, Brave, else Wikipedia; the User-Agent names `github.com/nuclearlang/nuclearlang` | `NUCLEAR_SEARXNG_URL`, `nuclear-graph web-key brave` |

Every setting: [the runbook](../06-runbooks/install-and-serve.md#settings).
