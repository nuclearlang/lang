---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [shelves.md, search.md, ../05-standards/testing.md, ../03-adr/0002-exact-facts-a-query-planner-and-the-graph-in-nuclear.md]
---
# Exact facts and the query planner

A search by meaning gives the closest cards, never *all* of something: asked for every tool of the MCP server, it
gives four cards and a model fills in the rest. So the graph also holds **the exact facts** of the base in a
relational database, and a planner that answers from them without a model.

## The facts

`facts.nuc`. A SQLite database with the rows of the base without their bodies:

| Table | Holds |
|---|---|
| `cards` | id, shelf, type, title, summary |
| `platforms`, `keys`, `links` | a row's platforms, exact names and links |
| `fields`, `items` | every value of a row's `meta` and `data`, flattened |
| `about` | the revision |

One **view** per thing a question can list: `commands`, `mcp_tools`, `mcp_params`, `routes`, `kinds`, `kind_names`,
`decorators`, `plugins`, `dialects`, `generator_pieces`, `layout`, `diagnostics`, `habits`, `library`, `stages`,
`agents`, `components`, `editor_commands`, `editor_settings`, `strategies`, `capabilities`. The generated rows carry
what the views read as structured `data` (a tool's parameters, a command's usage, a generator's pieces).

**The database lives in memory only.** The store's rule is encryption at rest, and a SQLite file would keep names
and summaries in clear. The graph's process makes the database from the cards the store keeps sealed, at the first
question after it starts (a read of every card of the store, once) and again at every ingest, marks it read-only
(`PRAGMA query_only`) and writes nothing of it to disk. It holds no row's body and nothing an agent kept at run
time.

## The catalogue: the `queries` shelf

`data/assets/queries/exact.json`, a shelf like every other. A row is one question with one right answer
(`query:mcp.tools`, `query:mcp.group`, `query:kind.create`, `query:cli.commands`, `query:diagnostic`...):

- the ways people ask it, in English and Spanish;
- its parameters. Each names the query that lists *what people write* and *the value it means* (`generadores` →
  `generate`, `caso de uso` → `usecase`, `generate resource` → `generate_resource`): no word list lives in code;
- its SQL, one `SELECT` over the views, and the heading of each column.

The build runs every query against empty tables and refuses a base whose query does not run, names a parameter it
does not declare, or declares one it never uses.

## The planner

`planner.nuc`; `POST /v1/answer`, `nuclear-graph answer "<question>"`, MCP `graph_answer`. It asks no model:

1. It matches the question to the catalogue by meaning (the same embeddings) and by the names it writes. A query
   whose parameter the question names is run from further away (`NAMED`) than one it only resembles (`NEAR`); the
   thresholds were measured with `questions.toml`.
2. **The shelves decide whether a question is exact at all.** A query runs only when its exact question is closer
   to what was asked than the closest card. A name alone is a weak sign, because the things of the ecosystem share
   names: "what is nuclear" writes the name of a tool and of a component, and must get the card of the language,
   not the commands of the tool. Measured: before this rule 57 of the 107 open questions of `questions.toml` ran a
   query; after it 17 (the ones that name one thing, such as a diagnostic's code or where a kind's file goes), and
   none of the exact ones lost its query.
3. The question's own words fill the parameters. A follow-up that names nothing ("describe each of them") takes the
   names from the user's earlier messages (`history`).
4. A needed parameter no word gives is not guessed: the query is answered under `needs`.
5. What is left of the question is searched in the shelves as always.

It answers `facts` (the rows, whole, with their columns), `knowledge` (the cards) and `needs` (an exact question it
is close to that lacks a name).

## How an answer reaches a person

The rows reach the reader as they are. The assistant of the Nuclear Developer calls the planner before its model;
its prompt has an "Exact facts" section above the documentation, left out whole when no query ran. The model
explains the rows, and the rows themselves end the answer, put there by code: a list never depends on a model.

## Consequences

- "Which tools does the MCP have", "the parameters of `generate_resource`", "how is a use case created", "what does
  N0114 mean", "the stages of the Builder" are answered with every row, the same on every run, whatever the model.
- A new kind of fact is a view; a new question is a row of the catalogue with an entry of `questions.toml`
  (`exact = true`): no code.
- The facts are only as complete as the structured fields of the generated rows: what only a curated card's prose
  says is still found by meaning.
- An answer with exact facts is long: the explanation, then every row.
