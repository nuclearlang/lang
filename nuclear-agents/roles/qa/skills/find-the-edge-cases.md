---
name: find-the-edge-cases
description: List the inputs and states that break code - empty, missing, repeated, too big, wrong type, concurrent, unauthorised.
title_es: Encontrar los casos límite
description_es: Listar las entradas y estados que rompen el código: vacío, ausente, repetido, demasiado grande, de tipo equivocado, concurrente, sin autorización.
---
# Find the edge cases

For each action the change adds (a route, a use case, a screen), try:

- **Empty and missing**: an empty string, an empty list, a missing field, `null` where a value is expected, an empty
  database.
- **Repeated**: the same item twice, the same request twice (is it idempotent?), a name that differs only in case
  or spaces.
- **Limits**: zero, one, the maximum and one past it; a negative number; a very long text; a unicode name; a date
  at midnight, at the end of a month, in another time zone.
- **Wrong**: the wrong type, an unknown id, a malformed body, a field the model does not have.
- **Who**: no user, another user's item, a user without the right (`@acl`).
- **When**: two requests at once on the same item, a dependency that is down or slow, a retry after a timeout.

Each case becomes a check with the input and the expected answer (a status, a message, nothing changed), and a test
when the Developer can write one (`tests`, `@test`).
