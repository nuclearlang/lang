---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [shelves.md, exact-facts.md, integrations.md, ../03-adr/0001-a-library-of-typed-linked-versioned-rows.md]
---
# The search, and the choice of a strategy

Neither asks a model. Only the embedding of the query is computed.

## Search

**Search** is by meaning and by exact name at once, over several shelves (`retrieve.nuc`):

- The query is embedded once and each shelf asked answers its closest cards.
- The runs of one to four words of the query are looked up in the cards' `keys` (`$contains`). A card that carries
  one is brought in and moves up: 0.12 for a word, 0.22 for a longer name or a code. So `N0114`, `gen resource`,
  `usecase` or `mcp` reach their card whatever the rest of the sentence says, in any language.
- A card is also found by the questions its author wrote for it (`asks`).
- Entries are ranked together, each card once. A `docs` row yields to a card (0.04), and a document gives at most
  two sections.
- `expand` adds to each card the title and summary of the rows it links to.
- Filters: `agents`, `platform`, and any metadata (`type`, `kind`, `code`).
- A result's `distance` is the closest the card came by meaning, by its text or by any question it answers.

**The search is exact.** The stored vector of every item a filter matches is compared with the query's
(`Store.near`, `Store.measure`); the store's own index (HNSW) is approximate and is not asked. Once rows were
replaced that index did not reach every item it held: after an ingest 3 cards of 2 617 could not be found, and
which ones changed at every start. A shelf holds hundreds of items, so comparing them all costs milliseconds (173
questions in 42 s, the embedding of each included).

A card is read directly by its id, with a line for each card it links to (`GET /v1/cards/{id}`, `nuclear-graph
card`, MCP `graph_card`).

```sh
nuclear-graph search "como funciona el MCP"                # every shelf
nuclear-graph search "how do I declare an entity" -c platforms -p backend --agents
nuclear-graph card error:N0114                             # one card and what it links to
```

Limit: keys are exact. A name written with a typo is found by meaning only.

## What of a spec applies

`POST /v1/applies` answers the `capabilities` rows whose trigger words a text writes (`meta.triggers`): what the
platform cannot do yet, limits, parts never run for real. It is exact, never by meaning.

## A strategy

**A strategy** is the row of one kind of request a user makes (`strategy:resource-db`, `strategy:refactor-rename`,
`strategy:bug-failing-test`...: 31 of them, on the `playbooks` shelf). What a strategy row says and what a run
does with it is `ADR-developer-0001` of the
[Nuclear Developer](../../../nuclear-agents/nuclear_developer/docs/03-adr/0001-a-strategy-for-each-kind-of-request.md).

`POST /v1/strategy` (`nuclear-graph strategy`, MCP `graph_strategy`) says which one a request is, and why:

- An exact sign of the request (`data.signals`: a diagnostic code, a test's output, `rename A to B`, a `GET <url>`
  line) outweighs any closeness of meaning.
- Meaning decides between strategies with no exact sign, or the same ones.
- Whether the project has the names the request writes moves the score (`existing`, `new` against the row's
  `data.target`).
- A run of the Loop cannot follow a strategy without stages (a question, a command): with `runnable`, such a
  strategy comes first only when an exact sign chose it.
- `only` is the strategy a spec names itself (`- Strategy: usecase`).

The answer is at most three strategies, best first, each with the signs that chose it (`why`).

```sh
nuclear-graph strategy "renombra Book a Title"             # → strategy:refactor-rename (it writes "renombra"; ...)
nuclear-graph strategy "un CRUD de pedidos" -p backend --full   # with the plan of the strategy
```

Limit: the selection reads words. A request that names its kind in an unusual way is classified by meaning alone,
which a small embedding model does less well than an exact sign; a wrong reading is fixed by a sign or a question
in the row. How it is tested: [testing](../05-standards/testing.md).
