---
name: check-the-definition-of-done
description: Check every item of the definition of done against the run's documents and the project, each with the evidence that shows it.
title_es: Comprobar la definición de terminado
description_es: Comprobar cada punto de la definición de terminado contra los documentos de la ejecución y el proyecto, cada uno con la evidencia que lo muestra.
---
# Check the definition of done

1. Take the items of the definition of done (`role.md` of DevOps) and the project's own, if it has one.
2. For each item, find its evidence in what the run left: the QA report's line, the command and its output
   (`nuclear check .`, the tests), the checks list, the file and its change. Run the command again when its result
   is older than the last change.
3. Write each item as `met` with the evidence, or `not met` with what is missing and which role it goes back to.
4. Done only when every item is met. Otherwise the run stops with the list of what is missing; nothing is pushed.

An item without evidence is `not met`, whatever anyone said.
