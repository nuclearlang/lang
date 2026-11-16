---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [shelves.md, search.md, exact-facts.md, knowledge-base.md, integrations.md, ../05-standards/security.md]
---
# Architecture

## Context

```
 Claude Code / Codex / Cursor ──MCP (stdio)──┐
                                             ▼
 VS Code Loop tool ──HTTP──┐        nuclear-graph mcp ──► nuclear / dragonfly CLIs
                           ▼                 │        └─► Nuclear Developer (local 3B agents)
 Nuclear Developer ──HTTP──► nuclear-graph serve (127.0.0.1:7878, token)
                                     │
                                     ▼
              Chroma: one collection per shelf (encrypted documents) + EmbeddingGemma (Ollama)
```

One process (`nuclear-graph serve`) opens the store. Everything else reaches it over HTTP with a token:
[integrations.md](integrations.md).

## Written in Nuclear

The graph is a Nuclear project of the `python` dialect. The `.nuc` files at the root of this folder are the source.
`nuclear build .` writes the Python package `build/nuclear_graph`; `[project] package` of `nuclear.toml` names the
package the files are emitted into (imports between a project's files are relative to it). `pyproject.toml` only
packages that folder: the prompt files travel inside the package (`prompts` → `nuclear_graph/prompts`; a checkout
reads them from `prompts/`), and so does `py.typed` (a project that uses the package is type-checked against it).
`build/` is never edited and never committed. The set-up of the AI services builds before it installs.

## Parts

| File | What it is |
|---|---|
| `shelves.nuc` | the schema: the shelves, their row types, id prefixes and filters; the row format |
| `assets.nuc` | a row: its validation, what is embedded, what is stored |
| `extract.nuc`, `extract_docs.nuc`, `extract_examples.nuc`, `extract_language.nuc`, `extract_platforms.nuc`, `extract_tools.nuc` | the generated rows, each from its structured source |
| `knowledge.nuc` | the knowledge base as a folder: build, check, review |
| `store.nuc` | Chroma, the encryption of the documents, the embeddings |
| `retrieve.nuc` | the search |
| `facts.nuc` | the exact facts: the tables and their views |
| `planner.nuc` | the query planner |
| `ingest.nuc` | the folder → the store |
| `access.nuc`, `secrets_store.nuc`, `crypto.nuc` | the clients and their tokens; the keyring; the cipher |
| `server.nuc` | the HTTP API |
| `client.nuc` | `GraphClient`: what a program uses |
| `toolchain.nuc` | `Toolchain`: the compiler and the `dragonfly` commands for an agent |
| `workspace.nuc` | `Workspace`: a project's files for an agent (read-only, inside the project; the rename tool) |
| `web.nuc` | the internet tools (search, read a page) |
| `mcp_server.nuc` | the MCP server: the project [`tools/mcp`](../../../tools/mcp/AGENTS.md) |
| `paths.nuc` | the port, the URL, the data folder, the machine's `ai.env` |
| `cli.nuc` | the `nuclear-graph` command |
| `prompts/` | the prompt files: `prompts/<use case>.md` and `prompts/agents/<step>.md`, ingested into `prompts` |
| `tests/` | the tests, in Nuclear |
| `data/` | the knowledge base: [knowledge-base.md](knowledge-base.md), [`data/README.md`](../../data/README.md) |

## What the store holds

- **One collection per shelf** of the base ([shelves.md](shelves.md)): the cards, their vectors and their metadata.
- **`prompts`** and **`memory`**: not part of the base.
- **The exact facts**: a SQLite database in the memory of the server's process, made from the sealed cards
  ([exact-facts.md](exact-facts.md)).

The data folder is `$XDG_DATA_HOME/nuclear-graph` (`NUCLEAR_GRAPH_HOME`), mode `0700`, opened only by the server
process.

## Dependencies

| Dependency | Needed by | Use |
|---|---|---|
| Python 3.12+, uv, hatchling | everything | the built package and its environment |
| `httpx` | the client, the tools for agents, the command | the only dependency of a plain `pip install nuclear-graph` |
| `mcp` | extra `mcp` | the MCP server alone (a machine of remote agents only) |
| `chromadb`, `numpy`, `ollama`, `fastapi`, `uvicorn`, `cryptography`, `mcp` | extra `server` | the store, the exact search over the stored vectors, the embeddings, the HTTP API, the encryption |
| `pytest` | extra `test` | the tests |
| SQLite | the server | the exact facts; it is in the standard library of the target |
| Ollama with `embeddinggemma` | the server | the vectors of the rows and of each query |
| The `nuclear`, `dragonfly` and `nuclear-loop` commands on the `PATH` | `knowledge build`, `Toolchain`, the MCP server | their help is read into rows; the agents' checks run them |
| The desktop keyring (`secret-tool`, libsecret) | the server, `connect` | the documents' key, the owner token, each client's token |

## Quality attributes

| Attribute | How |
|---|---|
| Private | loopback only, a token on every route, documents encrypted at rest: [security](../05-standards/security.md) |
| Never behind the code | `knowledge check` fails when the base is not what the tree gives now; the end-of-turn hook runs it |
| Repeatable answers | the search compares every stored vector (no approximate index); lists come from the exact facts, never from a model |
| Valid or not built | a base with a broken link, a duplicated id or an undocumented diagnostic is refused |
