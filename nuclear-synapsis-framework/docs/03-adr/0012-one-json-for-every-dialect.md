---
status: accepted
date: 2026-11-18
deciders: Julian Molina
---
# ADR-0012: A model's JSON has Nuclear's names in every dialect

## Context and problem
The `fastapi` dialect writes a model's fields in Python's case (`last_read`), and pydantic wrote them so in every
answer, event and `Json.encode`; `nestjs` writes Nuclear's (`lastRead`), and so does the contract
(ADR-synapsis-0006). The same backend answered two JSONs depending on its dialect, and a client generated from the
contract (Nuclear Chat's UI) read the fields of a `fastapi` service as missing. Root rule 3: a dialect only changes
the output, never what the program means, and the wire is what it means to its clients.

## Decision
1. **On the wire a model is Nuclear's names** (camelCase, `@key("name")` when the JSON says otherwise), in every
   dialect: answers, bodies, events, the app's WebSocket, `Json.encode`.
2. `fastapi`: a model extends the runtime's `Model` (pydantic with Nuclear's names as aliases: it reads either name
   and writes Nuclear's); an entity's schema the same. The `python` dialect's `Json.encode` writes a class's fields
   with Nuclear's names.
3. The language's own names inside the target stay the target's (`last_read` in Python code).

## Consequences
- Positive: one JSON per model, the contract's; a client works with any dialect of its backend.
- Negative: a client of an existing `fastapi` service that read `snake_case` keys must read Nuclear's.

## References
- Found by Nuclear Chat's UI (spec 013), 2026-11-18. The runtime: `platforms/backend/packages/synapsis-py/src/synapsis/models.py`.
