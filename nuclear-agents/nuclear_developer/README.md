# Nuclear Developer

[Website](https://nuclearlang.github.io/tools/developer)

Local AI agents on models of at most 3B parameters (coder, tester, security reviewer, planner and more) that work
as the junior developer of a frontier model. Their knowledge comes from the
[Smart Graph](../../nuclear-graph-storage/README.md); the compiler checks what they write before they answer.

## Why

- A frontier model doing a whole spec is paid per token, and the code leaves the machine.
- So the lead (Claude, or you) decides; the local developer writes each piece; what it cannot fix becomes an example in the graph.
- Left out on purpose: only Nuclear for a platform, never a dialect; nothing a tool can write.

## How we made it

- The AI loop: retrieval and distillation, not weight training; prompts are files of the graph ([ADR-platform-0003](../../docs/03-adr/0003-the-ai-loop.md)).
- Fixed steps, not a toolbox: recall → write → `nuclear check` → repair (at most 3 attempts) → answer.
- A strategy for each kind of request ([ADR-developer-0001](docs/03-adr/0001-a-strategy-for-each-kind-of-request.md)); tools before models ([ADR-platform-0004](../../docs/03-adr/0004-products-are-made-with-the-tools.md)).
- Written in Nuclear: a Synapsis backend (`fastapi`), on `qwen2.5-coder:3b` and `gemma4:e2b`.
- Measured every change on 45 tasks: it passes 43 (Sonnet 39); 41 or 42 of the 42 single files (Sonnet 36), one or two of three features (Sonnet three) ([the rounds](docs/05-standards/evaluation-rounds.md)).

## Try it

```sh
nuclear-builder setup
curl -s -X POST 127.0.0.1:7879/developer/code -H 'content-type: application/json' \
  -d '{"task": "A model NewTask with a title (string, at least 3 characters) and a priority (int, default 2).",
       "path": "components/tasks/domain/models/task_models.nuc", "kind": "model"}'
```

## Read next

- [The guide](docs/08-guides/README.md) · [Run it by hand](docs/06-runbooks/run.md)
- [Each agent and its model](docs/02-architecture/overview.md) · [Which models fit](docs/02-architecture/models.md)
- [Why it is this way](docs/03-adr/README.md)
- [Roadmap](docs/01-product/roadmap.md) · [AGENTS.md](AGENTS.md) to change it

## License

Apache-2.0.
