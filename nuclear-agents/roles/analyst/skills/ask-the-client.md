---
name: ask-the-client
description: Ask the user only the questions whose answer changes what is built, each with the default the run takes.
title_es: Preguntar al cliente
description_es: Preguntar al usuario solo lo que cambia lo que se construye, cada pregunta con el valor por defecto que toma la ejecución.
---
# Ask the client

1. Read the spec, the project card and what the Smart Graph says of the request (`read-the-graph`) first: never ask
   what the project or the graph already answers.
2. Write down every assumption the request forces. Each one is a question when two reasonable answers build two
   different things (a field, a rule, who may do it, what happens on an error, how many, how fast).
3. Keep only the questions that change the result. Order them by how much they change it.
4. Give each one: the question in one sentence, why it matters (what changes with each answer), and the default the
   run takes if the user does not answer. A question with no safe default stops the run at the gate.
5. Ask in the language the user writes in; the documents stay in English.

Never ask the user to design ("which database?", "which pattern?"): ask what they need, the Architect chooses how.
