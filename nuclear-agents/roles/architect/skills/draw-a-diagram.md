---
name: draw-a-diagram
description: Draw the part of the system named in the spec as C4 diagrams in Mermaid.
title_es: Dibujar un diagrama
description_es: Dibujar la parte del sistema que nombra la spec como diagramas C4 en Mermaid.
prompt: diagram
---
# Use case: a diagram

Draw the part of the system named in the spec as a C4 diagram in Mermaid.

- Level 1 (context): the system, its users and the external systems. Level 2 (containers): apps, APIs,
  databases, queues. Level 3 (components): the Synapsis components and their kinds (appcomponent, use cases,
  repositories, controllers, screens).
- Take the names from the code (the project card `.nuclear/project.json` lists every declaration and its kind).
- One diagram per level; each arrow says what flows ("HTTP JSON", "event tasks.created").
