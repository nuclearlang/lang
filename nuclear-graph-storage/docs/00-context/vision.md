---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [glossary.md, ../02-architecture/overview.md, ../03-adr/0001-a-library-of-typed-linked-versioned-rows.md]
---
# Vision

## Problem

An agent that writes Nuclear guesses what it does not know. A knowledge base made by cutting every markdown file of
the tree into pieces does not stop that: a piece knows its file and little else, so nothing says what the ecosystem
is for, what it can and cannot do, which tool does what, how a task is done or what an error has to do with another.
And a search by meaning gives the closest cards, never *all* of something: asked for every tool of the MCP server,
it gives four and a model fills in the rest from memory.

The Smart Graph is the local, private library of everything NuclearLang and Synapsis are. Agents ask it instead of
guessing: what Nuclear is for, how each thing is written, every kind and decorator, every tool, every error and its
fix, what can and cannot be done, how a task is done step by step, and validated code.

## Who reads it

- **Frontier models** (Claude Code, Codex, Cursor) through the MCP server: every row.
- **The local agents** of the Nuclear Developer, over HTTP: only the rows written for them (`agents: true`), which
  hold no code of a target language.
- **People**, from a terminal (`nuclear-graph search`, `card`, `answer`, `strategy`) and through the chat of the
  editor, whose assistant is one of the local agents.

The Builder of the editors reads it through those two: the Developer and the MCP server.

## What it must be

- A library that knows the theory, the documentation, the rules, the purpose and every tool; what Nuclear can and
  cannot do; every error and how errors relate.
- JSON assets with their metadata, in Chroma collections designed for what Chroma can do.
- Versioned, and updated with every feature: the base never stays behind the code.
- Tested with the questions people ask ("how does the MCP work", "what is nuclear", "advantages"), in English and
  Spanish.
- Good enough to replace the markdown files one day.
- A question with one right answer (which, how many, what are) gets every row, the same on every run, whatever the
  model.

## What it is not

- **Not a copy of the documentation.** It is rows, each one a card that answers one question, on the shelf of its
  kind of question, linked to the cards it has to do with.
- **Not a model.** The search, the choice of a strategy and the query planner ask no model; only the embeddings
  are computed.
- **Not shared.** It runs on the developer's machine, for one OS user; no program reads it until the user allows it.
- The teaching material (`docs/aprende`) and the pending work of the projects are never part of the base. What
  matters of the pending work for a reader of the graph (what cannot be done yet, what was never run for real) is
  in `capabilities` rows that name its sections as their sources.
