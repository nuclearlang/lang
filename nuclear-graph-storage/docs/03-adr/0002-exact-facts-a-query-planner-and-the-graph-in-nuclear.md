---
status: accepted
date: 2026-11-13
deciders: Julian Molina
---
# ADR-0002: Questions with one right answer are answered from exact facts by a query planner; the Smart Graph is written in Nuclear

## Context and problem
The local assistant answered every question from the four cards closest to it by meaning. That is right for *what
is* and *how*, and wrong for *which*, *how many* and *what are*: the answer of "every tool of the MCP server" is 27
rows, and no search by meaning gives all of something. The model (2–4 B parameters) filled what was missing from
memory: a partial list, a command that does not exist. The knowledge was there: the generated rows of the base
(ADR-graph-0001) already carry each command, tool, parameter, kind and diagnostic as structured fields.

The Smart Graph itself was 6,000 lines of Python written by hand, in an ecosystem whose language transpiles to
Python.

## Decision
**The exact facts are a relational database** (SQLite, in the standard library of the target). Its tables are the
rows of the base without their bodies: `cards`, `platforms`, `keys`, `links`, `fields` and `items` (every value of
a row's `meta` and `data`, flattened), `about` (the revision). One view per thing a question can list (`commands`,
`mcp_tools`, `mcp_params`, `routes`, `kinds`, `diagnostics`, `strategies`...). The generated rows carry what the
views read as structured `data`.

**The database lives in memory only.** The store's rule is encryption at rest; a SQLite file would keep names and
summaries in clear. The graph's process makes the database from the cards the store keeps sealed, at the first
question after it starts and again at every ingest, marks it read-only, and writes nothing of it to disk. It holds
no body and nothing an agent kept at run time.

**The questions are data: the `queries` shelf.** A row is one question with one right answer: the ways people ask
it (English and Spanish), its parameters, and its SQL over the views. A parameter names the query that lists what
people write and the value it means: no word list lives in code. The build runs every query against empty tables
and refuses a base whose query does not run, names a parameter it does not declare, or declares one it never uses.

**The planner asks no model.** It matches the question to the catalogue by meaning and by the names it writes; a
query whose parameter the question names is run from further away than one it only resembles, with thresholds
measured on `questions.toml`. The shelves decide whether a question is exact at all: a query runs only when its
exact question is closer to what was asked than the closest card, because a name alone is a weak sign (the things
of the ecosystem share names). The question's own words fill the parameters; a follow-up that names nothing takes
them from the user's earlier messages. A needed parameter no word gives is not guessed: the query is answered
under `needs`. What is left of the question is searched in the shelves. The answer is `facts`, `knowledge` and
`needs`.

**The rows reach the reader as they are.** The chat calls the planner before the model; the prompt has an "Exact
facts" section above the documentation, left out whole with its instructions when no query ran (a 2B model copies
instructions about rows it was not given into its answer). The model explains the rows; the rows themselves end the
answer, put there by the assistant's code and never rewritten by the model (measured: a 2B model given 27 rows
retold them whole in one run and as six groups in the next). The step is in the trace.

**Acceptance.** `questions.toml` has `exact = true` entries: the planner's first query for the question must be
the expected one. An open question that reads like an exact one has `exact = false`: besides finding its card, the
planner must run no query for it. The entries with `says` are also asked to the assistant.

**The Smart Graph is a Nuclear project** of the `python` dialect. Its `.nuc` files are the source; `nuclear build`
writes the package `build/nuclear_graph` that `pyproject.toml` packages; the set-up builds before it installs; the
tests are `tests/*.nuc`. `[project] package` of `nuclear.toml` names the package the files are emitted into. This
came with the platform's rule "Nuclear and Dragonfly first" (the root `AGENTS.md`): what the language could not
express while the graph was written is a finding of the compiler, kept in the roadmap of the language
(`nuclearlang/docs/01-product/roadmap.md`), never a reason to write a piece in the target language.

## Options considered
1. More cards closer to the question: a search by meaning still gives the closest, never all.
2. A SQLite file on disk: it would keep names and summaries in clear beside an encrypted store.
3. Word lists and question patterns in code: every new question would be a change of code.
4. A database in memory made from the sealed cards, with the questions as rows of the base.

## Consequences
- Positive: "which tools does the MCP have", "the parameters of `generate_resource`", "how is a use case created",
  "what does N0114 mean", "the stages of the Loop" are answered with every row, the same on every run, whatever
  the model.
- Positive: a new kind of fact is a view; a new question is a row of the catalogue with an entry of
  `questions.toml`: no code.
- Negative: the facts are only as complete as the structured fields of the generated rows: what only a curated
  card's prose says is still found by meaning.
- Negative: a small model can still misread a question the rows answer (its explanation may dwell on the wrong
  rows); the rows under it are right and complete.
- Negative: an answer with exact facts is long: the model's explanation and then every row.
- Negative: a graph that starts makes its facts at the first question (a read of every card of the store, once).

## References
- Replaces: ADR-0107
- The library the facts are made from: ADR-graph-0001. The assistant that explains them: the Nuclear Developer
  (ADR-platform-0003).
- State: `../02-architecture/exact-facts.md`, `../02-architecture/overview.md`.
