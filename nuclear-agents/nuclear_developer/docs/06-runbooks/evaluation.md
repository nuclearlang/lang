---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../05-standards/testing.md, ../05-standards/evaluation-rounds.md, ../02-architecture/models.md, run.md]
---
# Run the evaluation

What it measures and how an answer passes: [testing](../05-standards/testing.md#evaluation-how-it-was-trained).

## Before

- The Smart Graph, the Developer and Ollama with the two models are running ([run.md](run.md)).
- The `nuclear` and `dragonfly` commands are on the `PATH`: every answer is checked with `nuclear check`, a feature
  as a fresh `dragonfly new` project.
- `run.py` uses the graph's package (`nuclear_graph.toolchain`): run it with the Python of the graph's environment.

## The commands

```sh
cd eval
../../../nuclear-graph-storage/.venv/bin/python run.py reference   # paid: Claude, cached in results/reference.json
../../../nuclear-graph-storage/.venv/bin/python run.py distill     # the validated train answers become graph examples
../../../nuclear-graph-storage/.venv/bin/python run.py local       # the local developer answers every task
../../../nuclear-graph-storage/.venv/bin/python run.py analyze     # the analyst: the strategy and the generator calls of each request
../../../nuclear-graph-storage/.venv/bin/python run.py chat        # the assistant: the questions with `says`
../../../nuclear-graph-storage/.venv/bin/python run.py report      # results/REPORT.md (the default)
```

| Command | Asks | Writes |
|---|---|---|
| `reference` | Claude Sonnet, once per task; an answer already in the cache is not asked again. It stops at a budget of USD 18 (the user approved up to USD 20 for the references) | `results/reference.json` |
| `distill` | nobody: the passing `train` answers go to the graph's `examples` | the graph |
| `local [word]` | the Developer (`/developer/code`, and `/developer/plan` for a feature); with a word, only the tasks that match | `results/local.json`, the round's totals in `results/history.json` |
| `analyze [word]` | `/developer/analyze`, in a fresh backend project that has an `orders Order` resource | `results/analysis.json` |
| `chat [word]` | `/developer/chat` | nothing: it prints each answer's result |
| `report` | nobody: every stored answer is scored again with the current `must` of its task | `results/REPORT.md` |

The tasks are `eval/tasks.toml`: `[[task]]` (one file), `[[feature]]` (several files), `[[analysis]]` (a request
for the analyst) and `[context]`. The Developer's address is `NUCLEAR_DEVELOPER_URL` (default
`http://127.0.0.1:7879`).

## A round

1. Change one thing: a rule of the guide, a row of the knowledge base, a prompt file, an agent.
2. When the knowledge base or a prompt changed: `nuclear-graph knowledge build`, `check`, `ingest`
   ([the graph's runbook](../../../../nuclear-graph-storage/docs/06-runbooks/update-the-knowledge-base.md)).
3. When an agent changed: `nuclear check . && nuclear build .` and restart the Developer.
4. `run.py local`, then `run.py report`.
5. Study each failure and fix it with a general rule or more knowledge, never with the answer.
6. Add the round to [evaluation-rounds.md](../05-standards/evaluation-rounds.md): what changed, the totals.

## Another model

Start a second Developer with `CODER_MODEL` or `ASSISTANT_MODEL` set to the model, on another port, and give its
address in `NUCLEAR_DEVELOPER_URL`. Record the result in
[models.md](../02-architecture/models.md#models-measured).

## What goes wrong

- **The graph is empty or is another revision**: the round measures nothing (`nuclear-graph stats`). An ingest for
  the wrong folder once emptied the graph; an ingest now removes only the sources of its own roots.
- **The temporary folder fills up** during the run: every feature is a fresh project there.
- **Another program holds Ollama**: the calls wait and the round stops.
- **A call never ends**: the evaluation has no watch on a call that stalls; a model that enters an answer without
  end holds the Developer until its process is killed
  ([the limits](../02-architecture/overview.md#known-limits)).

`run.py` reads the graph's prompts (`nuclear-graph-storage/prompts/`) and the chat questions
(`nuclear-graph-storage/data/questions.toml`) by path from the tree; `config.nuc` names the graph package as
`dependencies(nuclear_graph = "../../nuclear-graph-storage")`.
