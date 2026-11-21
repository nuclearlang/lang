---
name: follow-the-adrs
description: Read the decisions the project already made (its ADRs) before designing, and propose a new ADR for each new decision.
title_es: Seguir los ADR
description_es: Leer las decisiones que el proyecto ya tomó (sus ADR) antes de diseñar, y proponer un ADR nuevo por cada decisión nueva.
---
# Follow the ADRs

1. Read the index of the project's decisions (`docs/03-adr/README.md`) and every ADR whose title touches the
   request; search the Smart Graph for the platform's decisions on the same subject (`graph_search`).
2. In `design.md`, list the ADRs the design follows, each with the line of the design that follows it. A project ADR
   is cited by its number only when its file is in `docs/03-adr/`; a rule of the platform (a framework rule, a
   diagnostic code such as N0301, a decision of NuclearLang such as ADR-synapsis-0004) is cited by its own name as
   the platform's rule, never as an ADR of the project.
3. A choice no ADR covers, that is costly to undo (a data model, a dependency, a boundary between components, a
   security rule), is a new decision: write it from `templates/adr.md` as `specs/<id>/adr-<n>.md`, status
   `proposed`, with the options considered and the consequences, good and bad.
4. A design that contradicts an accepted ADR is either changed, or proposes an ADR that replaces it and says so.

An accepted ADR is never edited. A decision is a sentence: "The orders keep their total in cents", not "Orders".
