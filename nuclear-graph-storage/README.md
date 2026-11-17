# Nuclear Smart Graph

[Website](https://nuclearlang.github.io/tools/graph)

The local, private library of everything NuclearLang and Synapsis are. Agents (Claude, Codex, Cursor, the local
Nuclear Developer) ask it instead of guessing: every kind, tool, error and its fix, and validated code.

## Why

- Chunked markdown gives the closest pieces, never *all* of something; a model fills the rest from memory.
- Here each card answers one question and links to its neighbours; a question with one right answer gets every row, every run.
- Left out on purpose: not a copy of the docs, not a model (only embeddings are computed), not shared.

## How we made it

- The knowledge base of the AI loop, read through [the MCP server](../tools/mcp/AGENTS.md) and by the local agents ([ADR-platform-0003](../docs/03-adr/0003-the-ai-loop.md)).
- Typed, linked, versioned rows generated from the tree, searched by meaning and exact name ([ADR-graph-0001](docs/03-adr/0001-a-library-of-typed-linked-versioned-rows.md)).
- Exact facts in in-memory SQLite and a query planner with no model ([ADR-graph-0002](docs/03-adr/0002-exact-facts-a-query-planner-and-the-graph-in-nuclear.md)).
- Private by construction: `127.0.0.1:7878`, a token on every route, AES-256-GCM on disk ([security](docs/05-standards/security.md)).
- Written in Nuclear (`python` dialect): `nuclear build` writes the FastAPI package.

## Try it

```sh
nuclear-builder setup                                  # installs, loads and starts it
nuclear-graph answer "which tools does the MCP have"   # the exact rows, then the cards
nuclear-graph card error:N0114                         # one card and what it links to
```

## Read next

- [The guide](docs/08-guides/README.md) · [Install and serve](docs/06-runbooks/install-and-serve.md)
- [The shelves](docs/02-architecture/shelves.md) · [The search](docs/02-architecture/search.md)
- [Why it is this way](docs/03-adr/README.md)
- [Roadmap](docs/01-product/roadmap.md) · [AGENTS.md](AGENTS.md) to change it

## License

Apache-2.0.
