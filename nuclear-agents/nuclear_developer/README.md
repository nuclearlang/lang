# Nuclear Developer

Local AI agents for [NuclearLang](../../README.md) and Synapsis, on models of at most 3B parameters, that work as
the junior developer of a frontier model: **coder**, **tester**, **security reviewer**, **planner**, **analyst**,
**documenter**, **diagnoser**, **acceptor** and **assistant**. What a small model cannot hold in its head comes
from the [Nuclear Smart Graph](../../nuclear-graph-storage/README.md); what it writes is checked by the Nuclear
compiler before it answers.

## Why it exists

A frontier model that does all the work of a spec is paid for every token, and the code leaves the machine. A model
small enough for a developer's laptop cannot hold much context, chooses tools badly, and the machine has no GPU to
train one. So the work is split as a lead splits it with a junior: the lead (Claude, or you) makes the decisions
(the plan, the names, the review) and the local developer writes each piece. What the junior cannot fix, the lead
fixes and keeps as an example in the graph, so the junior gets it right next time.

What it leaves out: the agents write only Nuclear, for a platform (`backend`, `mobile`, `web`), never a dialect or
a target language; and a model writes nothing a tool can write.

## How we made it

- **The AI loop** ([ADR-platform-0003](../../docs/03-adr/0003-the-ai-loop.md)): models of at most 3B parameters,
  trained by retrieval and distillation, not by changing weights. A failure is fixed with a general rule or more
  knowledge in the graph, never with the answer; the agents' prompts are files of the graph. A LoRA of the
  coder is a [draft spec](docs/04-specs/README.md) waiting for the user's decisions.
- **Fixed steps, not a toolbox.** A small model follows steps better than it chooses tools, so each agent is a graph:

  ```
  recall ──► write ──► nuclear check ──ok──► answer
    │          ▲            │
    │          └── repair ◄─┘ errors (at most 3 attempts), each with the card of its code
    └─ from the Smart Graph: the kind's own card, the mistakes small models repeat with it,
       the closest rules, solved tasks and an example file
  ```

- **A strategy for each kind of request**
  ([ADR-developer-0001](docs/03-adr/0001-a-strategy-for-each-kind-of-request.md)): the analyst recognises what it is
  asked (a whole system, one screen, a rename, a failing test…) and follows the plan of that kind.
- **Tools before models** ([ADR-platform-0004](../../docs/03-adr/0004-products-are-made-with-the-tools.md)): a
  generator writes what is standard, the compiler's exact fixes come before any repair, a rename is done by a tool.
- **Written in Nuclear**: it is a Synapsis backend (platform `backend`, dialect `fastapi`), whose FastAPI +
  LangGraph application is generated from the `.nuc` files of this folder. Two models on Ollama:
  `qwen2.5-coder:3b` (the coder) and `gemma4:e2b`.
- **Measured, every change.** A bank of 45 tasks (42 single files of every platform and 3 features of several
  files, 18 of them held out) is answered once by Claude Sonnet and then by the local agents. In the last rounds the
  local developer passes 43 of the 45 (Sonnet 39): 41 or 42 of the 42 single files (Sonnet 36), and one or two of the
  three features, where Sonnet passes all three. That is why a feature goes through the generators first and, when
  it has a design of its own, under a lead ([testing](docs/05-standards/testing.md),
  [the rounds](docs/05-standards/evaluation-rounds.md)).

## Try it

The set-up of the AI services installs it, with the Smart Graph and the models that fit the machine, and starts it
at every login ([Set up the AI services](../../installer/docs/08-guides/ai-setup.md)):

```sh
nuclear-builder setup            # or the installer's last step, or VS Code: Nuclear: Set Up the AI Services
nuclear-builder setup --status   # what is installed and running
```

Then give the coder a task; it answers the `.nuc` it wrote, checked by `nuclear check`:

```sh
curl -s -X POST 127.0.0.1:7879/developer/code -H 'content-type: application/json' \
  -d '{"task": "A model NewTask with a title (string, at least 3 characters) and a priority (int, default 2).",
       "path": "components/tasks/domain/models/task_models.nuc", "kind": "model"}'
```

It also works from the Builder (`Ctrl+Alt+P`, `nuclear-builder run`), Nuclear Atlas (`Ctrl+Alt+A`) and any frontier
model over MCP (`nuclear-mcp`), which gives the local developer the task first and then validates and corrects it.
By hand, without the set-up: [run it](docs/06-runbooks/run.md).

## Where to read next

| | |
|---|---|
| What a task goes through, how to call it, what it needs, its limits | [docs/08-guides/README.md](docs/08-guides/README.md) |
| Each agent, its model and its route; the known limits | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| Who calls it and how | [docs/02-architecture/integrations.md](docs/02-architecture/integrations.md#where-it-works) |
| Which models fit which machine | [docs/02-architecture/models.md](docs/02-architecture/models.md) |
| The strategy of each kind of request | [docs/02-architecture/strategies.md](docs/02-architecture/strategies.md) |
| Why it is this way | [docs/03-adr/README.md](docs/03-adr/README.md) |
| What is pending | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| To change it | [AGENTS.md](AGENTS.md) |

## License

Apache-2.0.
