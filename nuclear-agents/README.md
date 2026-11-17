# The agents

[Website](https://nuclearlang.github.io/tools/developer)

The AI agents of NuclearLang that run on your machine, one project per folder. Today there is one: the
[Nuclear Developer](nuclear_developer/README.md), the junior developer of a frontier model.

## Why

- Spec-driven work with AI without paying a frontier model for every token.
- The code never leaves the machine: small local models write, a lead (Claude, or you) decides.

## How we made it

- The AI loop: models of at most 3B parameters that write only Nuclear and learn by retrieval and distillation ([ADR-platform-0003](../docs/03-adr/0003-the-ai-loop.md)).
- What an agent knows, and every prompt, is a row or file of the [Smart Graph](../nuclear-graph-storage/README.md).
- Written in Nuclear: the Nuclear Developer is a Synapsis backend ([rule 9](../AGENTS.md)).
- Tools before models: an agent writes only what no generator can ([ADR-platform-0004](../docs/03-adr/0004-products-are-made-with-the-tools.md)).

## Try it

```sh
nuclear-builder setup            # the Smart Graph, the Nuclear Developer and the models that fit the machine
nuclear-builder setup --status   # what is installed and running
```

## Read next

- [The Nuclear Developer](nuclear_developer/README.md) · [the Smart Graph](../nuclear-graph-storage/README.md)
- [Nuclear Builder](../extensions/tools/nuclear-builder/README.md) · [Nuclear Atlas](../extensions/tools/nuclear-atlas/README.md)
- [Set up the AI services](../installer/docs/08-guides/ai-setup.md)
- [AGENTS.md](AGENTS.md) to add or change an agent
