---
name: write-acceptance-criteria
description: Turn a request into numbered acceptance criteria that a test, a command or a person can check.
title_es: Escribir los criterios de aceptación
description_es: Convertir un pedido en criterios de aceptación numerados que un test, un comando o una persona puedan comprobar.
---
# Write acceptance criteria

Each criterion is one line, numbered, in the form *given / when / then* or a plain sentence that says:

- **what is checked**: the behaviour, with the exact names the request uses (a path, a field, a status);
- **how it is checked**: a test (`tests`), a command (`nuclear check`, a load test), or a person's look (a screen);
- **the numbers**: "fast" becomes "answers in under 200 ms for 100 requests a second"; "many" becomes a count.

Cover, for each action the request asks: the normal case, the empty and missing cases, the repeated case, each error
the user can cause (404, 409, 422) and who may do it. A criterion nobody can check is rewritten or becomes a
question for the user. Nothing the request did not ask for becomes a criterion.

Example. Request: "Authors have a name; POST /authors adds one, a repeated name is refused."

    1. Given no author, when POST /authors with name "Ursula", then it answers 201 and GET /authors lists "Ursula". (test)
    2. Given an author "Ursula", when POST /authors with name "Ursula", then it answers 409. (test)
    3. When POST /authors with an empty name, then it answers 422. (test)
