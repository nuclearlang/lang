---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [search.md, exact-facts.md, knowledge-base.md, ../03-adr/0001-a-library-of-typed-linked-versioned-rows.md]
---
# The library: shelves, cards, links

A **shelf** is a Chroma collection that answers one kind of question. A **row** is one card of it. The schema is
`shelves.nuc`; `nuclear-graph knowledge build` writes it into the base as `data/schema.json`.

## The shelves

| Shelf | The question it answers | What its rows are | Row types |
|---|---|---|---|
| `concepts` | What is it, why does it exist, how does it work? | the purpose, the advantages, the ideas, the parts of the ecosystem, the theory, the questions people ask | purpose, concept, theory, architecture, comparison, faq, term |
| `language` | How is it written in Nuclear? | the guide and the rules section by section; each base type's members | guide, rule, library, reference |
| `platforms` | What does a platform have, and where does each thing go? | every kind, decorator and plugin of `backend`, `mobile` and `web`; their layout and rules | platform, kind, decorator, layout, plugin, spec |
| `tools` | What can run, and how is it called? | each command of the command line tools (`nuclear`, `nuclear-builder`, `nuclear-graph`), each MCP tool, each HTTP route, the generators, the Builder's stages, the local agents, the editor's commands, each component's version | cli, mcp, http, generator, stage, agent, editor, service, component |
| `errors` | What went wrong, and how is it fixed? | each diagnostic of the compiler (linked to the ones it comes with), the habits of other languages, the failures of the tools and services, the mistakes small models repeat | diagnostic, habit, failure, pitfall |
| `capabilities` | Can it be done, by NuclearLang or by this agent? | what can be done, what cannot yet, the limits, the limits of the local agents | can, cannot, limit, agent-limit |
| `playbooks` | How is this task done, step by step, and by whom? | the strategy of each kind of request (how it is recognised, its plan, what it asks of a run); the procedure of each use case with the tool of each step; the roles and their skills | strategy, playbook, role, skill |
| `examples` | What does the code look like? | every `.nuc` of the example projects by kind and platform; solved tasks | file, solved |
| `docs` | What does the full document say? | the long form: the dialects underneath, the target languages, the runtimes, the decisions, the context files, the guides | spec, adr, context, guide, readme, changelog, status, doc |
| `queries` | Which, how many, what are: a question with one right answer | the catalogue of exact questions: each row is a question, its parameters and the query that answers it over the exact facts ([exact-facts.md](exact-facts.md)) | query |

A search of every shelf reads all but `queries`: that one is read by the planner of an answer.

Two more collections are not part of the base: `prompts` (the prompt files of this package: `prompts/<use case>.md`
and `prompts/agents/<step>.md`) and `memory` (what an agent keeps about a project while it works).

## A card

| Field | What it holds |
|---|---|
| `id` | `<prefix>:<name>`: `error:N0114`, `kind:backend.usecase`, `tool:nuclear.gen.resource`, `concept:mcp`. A prefix belongs to one shelf, so an id is fetched without a search |
| `type` | one of the shelf's row types |
| `title`, `summary` | the name of the card; the answer in a sentence or two |
| `body` | the whole card (in an asset, a list of lines) |
| `keys` | the exact names it is known by, in lower case |
| `asks` | the questions it answers, as people write them |
| `tags`, `platforms` | `platforms` left out means every platform |
| `agents` | whether the local agents read it |
| `links` | `{rel, to}`: typed links to rows that must exist |
| `sources` | the files (or `file#Heading`) it was written from |
| `meta` | the shelf's own filters (`code`, `family`, `kind`, `triggers`...) |
| `data` | structured fields: what the views of the exact facts read |

An example row, and the files of the base: [`data/README.md`](../../data/README.md).

## What is stored, and what is embedded

- **Metadata**, in clear (as the vectors are): `card`, `facet`, `type`, `title`, `agents`, `platforms` (`["all"]`
  when the row is of every platform: Chroma refuses an empty list), `keys`, `tags`, `links` (the ids it points to,
  so "who links to X" is a filter), `origin`, `source`, `hash`, `rev`, and the shelf's own filters.
- **The document**, encrypted: the card.
- **What is embedded is not the document.** The title goes in the embedding model's title slot, with the summary
  and the first 1200 characters of the body as its text. Each `ask` is one more entry of the collection
  (`facet: ask`) that points to its card: a question finds the card whose author wrote that question.

What Chroma gives, and what this design uses of it: collections with their own metadata that survives a restart;
rows with a vector, a document and metadata of texts, numbers, booleans and lists of texts; the filters `$eq $ne
$gt $gte $lt $lte $in $nin $and $or` and, on a list, `$contains`; a query restricted to given ids; lookup by id.
Its full-text filters read the document, which is stored encrypted, so they are of no use here; it has no keyword
index of its own.

## Two readers, one flag

`agents: false` marks what only frontier models and people read: the target languages, the dialects underneath, the
runtimes, the decisions, the state. A row the local agents read holds no code of a target language: document
sections lose those blocks, and a hand-written row that has one fails the build.

## What agents write at run time

`POST /v1/documents` writes only `memory` and `examples`, as rows of `origin: runtime` that an ingest keeps. The
rows of the knowledge base are written by ingest alone: a client cannot plant false documentation.
