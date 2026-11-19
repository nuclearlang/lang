# Decisions of the Nuclear Developer

Key: `developer`. Cite as `ADR-developer-NNNN`. The format is the platform's
[`0000-template.md`](../../../../docs/03-adr/0000-template.md). An accepted ADR is not edited: a new one replaces
it. The founding decision (the AI loop: local agents of at most 3B parameters that write only Nuclear, trained by
retrieval and distillation) is the platform's (ADR-platform-0003).

| ADR | Decision | Status |
|---|---|---|
| [ADR-developer-0001](0001-a-strategy-for-each-kind-of-request.md) | A strategy for each kind of request: the agent recognises what it is asked and follows the plan of that kind | accepted |
| [ADR-developer-0002](0002-a-role-is-a-folder.md) | A role is a folder (`nuclear-agents/roles/<role>/`), read by the local agents and every provider | accepted |
| [ADR-developer-0003](0003-painted-faces-by-a-local-model.md) | The roster's faces are painted by a local image model (FLUX.1-schnell, stable-diffusion.cpp), not drawn as SVG | accepted |

Decisions of the Smart Graph the agents depend on (the library of cards, the exact facts):
[`nuclear-graph-storage/docs/03-adr/`](../../../../nuclear-graph-storage/docs/03-adr/README.md).

A decision cited by its old platform-wide number (`ADR-00NN`, in code or commits before 2026-11-16): see
[the table of old numbers](../../../../docs/03-adr/old-numbers.md).
