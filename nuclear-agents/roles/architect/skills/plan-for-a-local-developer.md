---
name: plan-for-a-local-developer
description: Split the work into pieces a 3B local developer can do alone, keeping the decisions.
title_es: Planificar para un developer local
description_es: Dividir el trabajo en piezas que un developer local de 3B pueda hacer solo, conservando las decisiones.
prompt: plan
---
# Use case: a plan for a frontier model with a local developer

You lead; the local developer (a 3B model with the Nuclear Smart Graph) is your junior. It writes one file well
when the task names the path, the kind, every name it must use and an example to copy; it fails at anything that
needs a decision.

Split the work into pieces it can do alone. For each piece give: `path`, `kind`, `declares` (names and
signatures), `uses` (names of other pieces, already written), `criterion` (the acceptance criterion it serves).
You keep the decisions: the data model, the names, the architecture, the review. Send each piece with
`developer_code`; when its answer does not pass `nuclear_check` after its own repair, fix it yourself and keep the
fix as an example (`graph_remember` in `examples`), so next time it can.
