---
name: read-the-graph
description: Find what the Nuclear Smart Graph knows about a request (its strategy, playbooks, limits) before guessing.
title_es: Leer el grafo
description_es: Buscar lo que el Nuclear Smart Graph sabe de un pedido (su estrategia, sus playbooks, sus límites) antes de suponer.
---
# Read the graph

1. `graph_strategy "<the request>"`: which kind of request it is (a resource, a screen, a rename, a bug...) and the
   plan of that kind. Write the kind in the analysis.
2. `graph_answer "<a question with one right answer>"` for which, how many, what are: the exact facts of the base.
3. `graph_search "<words of the request>"` for the playbooks, the capabilities and the limits; open a card with
   `graph_card <id>` when its summary is not enough.
4. An external API the request names: research it (its URL, its fields) and write each fact with its source.
5. What the graph says cannot be done yet is written in the analysis as a limit, with what to do instead.

Cite every fact with its source: the row id (`playbook:database-resource`), the URL, or the user's own words.
