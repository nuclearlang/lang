# Nuclear Developer

Local AI agents for [NuclearLang](../../README.md) and Dragonfly, on models of at most 3B parameters, as the junior
developer of a frontier model: **coder**, **tester**, **security reviewer**, **planner**, **analyst**,
**documenter**, **diagnoser**, **acceptor** and **assistant**. What a small model cannot hold in its head comes
from the [Nuclear Smart Graph](../../nuclear-graph-storage/README.md) (the ecosystem's private knowledge base);
what it writes is checked by the Nuclear compiler before it answers.

It is itself a Dragonfly backend written in Nuclear (platform `backend`, dialect `fastapi`): FastAPI + LangGraph,
generated from the `.nuc` files of this folder.

## How an agent works

A small model follows fixed steps better than it chooses tools, so each agent is a graph with fixed steps:

```
recall ──► write ──► nuclear check ──ok──► answer
  │          ▲            │
  │          └── repair ◄─┘ errors (at most 3 attempts), each with the card of its code
  └─ from the Smart Graph, for the kind it is about to write: the kind's own card, the mistakes
     small models repeat with that kind, the closest rules, solved tasks and an example file
```

The agents write only Nuclear, for a platform (`backend`, `mobile`, `web`). Each agent, its model and its route:
[the architecture](docs/02-architecture/overview.md).

## Run it

The set-up of the AI services installs it, with the Smart Graph and the models that fit the machine, and starts it
at every login ([Set up the AI services](../../installer/docs/08-guides/ai-setup.md)):

```sh
nuclear-loop setup            # or the installer's last step, or VS Code: Nuclear: Set Up the AI Services
nuclear-loop setup --status   # what is installed and running
```

By hand, the models and the settings: [run it](docs/06-runbooks/run.md),
[the models](docs/02-architecture/models.md).

## Where it works

- **The Loop** (VS Code `Ctrl+Alt+P`, Android Studio *Nuclear Loop*, `nuclear-loop run`): a spec goes through plan,
  tests first, code, verification, security and artifacts, each step by a local agent.
- **The chat** (VS Code `Ctrl+Alt+A`, *Nuclear agent*): a question about the project, or `/task <order>`.
- **A frontier model over MCP** (Claude Code, Codex, Cursor: `nuclear-graph mcp`): the local developer does the
  whole task first, the frontier model validates and corrects.

Every run is documented in `.nuclear/loop/runs/<id>.md`. The details:
[integrations](docs/02-architecture/integrations.md#where-it-works).

## How good is it

It is measured against Claude Sonnet on a bank of 45 tasks, 18 of them held out: 42 single files and 3 features of
several files. The local developer passes 43 of the 45 (Sonnet 39): every single file or all but one, and one or
two of the three features, where Sonnet passes all three. That is why a feature goes through the generators first and, when it has a design of its own,
under a lead. The method, every round and other models measured:
[testing](docs/05-standards/testing.md), [the rounds](docs/05-standards/evaluation-rounds.md),
[the models](docs/02-architecture/models.md#models-measured).

## More

| | |
|---|---|
| What it knows | the knowledge base of the Smart Graph: [`nuclear-graph-storage/data`](../../nuclear-graph-storage/data/README.md) |
| The strategy of each kind of request | [docs/02-architecture/strategies.md](docs/02-architecture/strategies.md) |
| Known limits | [docs/02-architecture/overview.md](docs/02-architecture/overview.md#known-limits) |
| What is pending | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| Working on it | [AGENTS.md](AGENTS.md) |

## License

Apache-2.0.
