---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/shelves.md, ../02-architecture/knowledge-base.md, ../02-architecture/exact-facts.md]
---
# Glossary

Use these words in the code, the documents and the conversations.

| Term | Meaning | Not to be confused with | In the code |
|---|---|---|---|
| Shelf | A Chroma collection that answers one kind of question | a folder of documents | `shelves.nuc` (`SHELVES`) |
| Row, card | One entry of a shelf: a card that answers one question. "Row" in the base, "card" when it is read | a piece of a document | `assets.nuc` |
| Id | `<prefix>:<name>` (`error:N0114`, `kind:backend.usecase`). A prefix belongs to one shelf, so an id is read without a search | | `shelfOf` in `shelves.nuc` |
| Keys | The exact names a row is known by, in lower case: what a query may write | tags | a row's `keys` |
| Asks | The questions a row answers, as people write them; each is searched as a question | | a row's `asks`, `facet: ask` |
| Link | A typed pointer `{rel, to}` to a row that must exist | a markdown link | a row's `links` |
| `agents` | Whether the local agents read a row. `false`: only frontier models and people | | a row's `agents` |
| Knowledge base | The folder `data/`: everything the graph ingests | the store | `knowledge.nuc` |
| Asset | A file `data/assets/<shelf>/<name>.json`: `{shelf, origin, about, rows}` | | `assets.nuc` |
| Generated row | A row read from a structured source by `knowledge build`; never edited by hand | | `extract*.nuc` |
| Curated row | A row written by hand, which names its `sources` | | `origin: curated` |
| Overlay | `<name>.overlay.json`: hand-written fields merged into generated rows by id | | `assets.nuc` |
| Runtime row | What an agent wrote while working (`memory`, `examples`); an ingest keeps it | | `origin: runtime` |
| Section | An entry of `data/sections.toml`: which markdown files the base holds, on which shelf, and who reads them | a heading | `extract_docs.nuc` |
| Schema | The row format; it changes only when an old row could no longer be read | | `SCHEMA` in `shelves.nuc`, `data/schema.json` |
| Revision | A number that grows whenever any row changes, is added or is removed | the package's version | `data/manifest.json` |
| Ingest | Making the knowledge base folder what the running graph knows | build | `ingest.nuc` |
| Store | Chroma with encrypted documents and the embeddings | the knowledge base | `store.nuc` |
| Exact facts | The rows of the base without their bodies, in a SQLite database kept in memory | the shelves | `facts.nuc` |
| View | One table of the exact facts per thing a question can list (`commands`, `mcp_tools`, `kinds`...) | | `facts.nuc` |
| Query | A row of the `queries` shelf: one question with one right answer, its parameters and its SQL | a search | `data/assets/queries/exact.json` |
| Planner | The query planner: matches a question to the catalogue of queries and runs them. No model | the planner agent of the Nuclear Developer | `planner.nuc` |
| Strategy | The row of one kind of request a user makes (`strategy:<name>`, on the `playbooks` shelf) | a playbook | `data/assets/playbooks/strategies.json` |
| Client | A program that was given access, with its scopes | a user | `access.nuc` |
| Scope | `read`, `write` or `admin` | | `access.nuc` |
| Owner token | The token of the machine's user: the only one with `admin` | a client's token | `secrets_store.nuc` |
| `prompts`, `memory` | Two collections that are not part of the base: the prompt files of this package, and what an agent keeps about a project | shelves | `RUNTIME` in `shelves.nuc` |
