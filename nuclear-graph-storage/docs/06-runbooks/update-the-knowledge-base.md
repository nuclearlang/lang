---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/knowledge-base.md, ../05-standards/testing.md, ../../data/README.md]
---
# Update the knowledge base

**After every change of the ecosystem**: build, review what it names, check, ingest. The end-of-turn hook of the
working tree (`.claude/hooks/context-check.sh stop`) runs the check and does not let a session finish while the
base is behind the tree. The same procedure is a row of the base: `playbook:update-the-knowledge-base`.

## The commands

| Command | What it does |
|---|---|
| `nuclear-graph knowledge build` | writes the generated assets, validates the whole base and raises the revision when a row changed |
| `nuclear-graph knowledge check` | fails when an asset is not what the tree gives now, a row is invalid, a curated row's source changed since its review, or the running graph holds another revision |
| `nuclear-graph knowledge review [id...]` | records that curated rows still hold after their sources changed (without ids: every row whose source changed) |
| `nuclear-graph knowledge ask [word...]` | asks the running graph the questions of `questions.toml` and fails when one does not find its row (`exact = true`: its exact query) |
| `nuclear-graph knowledge examples` | compiles every ```` ```nuclear ```` block of the hand-written rows |
| `nuclear-graph ingest [folder]` | makes the folder what the graph knows: only what changed is embedded again; what an agent wrote at run time is kept |

`knowledge` takes `--tree` (the working tree; default `$NUCLEAR_ROOT`, else this checkout's) and `--out` (the
knowledge folder: `nuclear-graph-storage/data` of the tree). `ingest` needs the graph running.

## The procedure

1. **Build.** `nuclear-graph knowledge build`. It prints the revision, the rows added, changed and removed, the
   size of each shelf, and a `review:` line for each curated row whose source changed. With a problem, nothing is
   versioned: fix what each line says.
2. **Review.** For each `review:` line, read the change: update the row, or confirm it with
   `nuclear-graph knowledge review <id>` when it still holds.
3. **Write what is new and has no structured source**: a capability, a limit, a failure, a procedure. A new tool,
   error, kind or version needs nothing: the build reads it.
4. **Add the question the change answers** to `data/questions.toml` (a question with one right answer: a row of
   `data/assets/queries/` and its `exact = true` entry).
5. **Check.** `nuclear-graph knowledge check`.
6. **Ingest.** `nuclear-graph ingest`, then `nuclear-graph stats` shows the revision the graph holds.
7. **Ask.** `nuclear-graph knowledge ask` (every question finds its row) and `nuclear-graph knowledge examples`
   (every Nuclear example compiles).

## Rules

- A generated row is never edited: change its source and build again.
- What is written by hand names its `sources`.
- A new shelf, row type or filter is added in `shelves.nuc`, with a test.
- A question with one right answer is a row of `data/assets/queries/` over the views of `facts.nuc`, never a card
  someone keeps in step by hand: a new kind of fact is a view, a new question a row with its parameters.
- What an agent knows is a row of the base, never a text inside the code or a prompt: a new rule, pitfall, limit or
  procedure is a row.
- `data/sections.toml` and `data/questions.toml` are edited by hand; `schema.json`, `manifest.json`,
  `revisions.json` and `INDEX.md` are written by the build.

## Before building

- The help of `nuclear`, `dragonfly` and `nuclear-loop` is read from the installed binaries: after changing a
  command, install it (`installer/install.sh`) first.
- Run `ingest` for the knowledge folder of this tree. An ingest removes only the sources of its own roots, so one
  run for another folder does not empty the graph.
