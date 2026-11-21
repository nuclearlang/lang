---
status: approved
priority: high
owner: Julian Molina
updated: 2026-11-21
related: [../011-software-factory/requirements.md, ../023-teams-like-human-teams/requirements.md]
---
# Spec 024: Nuclear Builder for big work, told as a story — Requirements

The user, 2026-11-21: the factory is for big specs and several specs at once; small and medium tasks are an agent's
with the knowledge base and the MCP server. Its pipeline tells what it does to the people who asked for it (product
owners, stakeholders), level by level as the C4 model does, repairs what it can by itself, and posts every step in
the team's channel.

## Requirements

1. **The size of a task, measured before the work.** Asked for a task (a bug, a refactor, a change), the agent first
   counts what it would touch: the files, the lines, and whether it adds a feature (a new screen, endpoint, entity,
   component, or a change of a contract or a schema). The sizes, from code review practice (Google's ~100 lines as
   small, 400 to 1,000 as too big for one change):
   - **small**: ≤ 3 files, ≤ 100 lines, no feature: the agent does it;
   - **medium**: ≤ 10 files, ≤ 400 lines, no new feature: the agent does it, and says what it touched;
   - **large**: more, a new feature, or several specs: the agent proposes Nuclear Builder (a spec, or several), with
     its count as the reason; the user decides.
2. **Several specs in one run.** A run takes one spec or several (a feature in pieces, a sprint): the stations work
   them in order, each spec its own thread of the team's channel, one bill.
3. **The language of the specs, asked once.** Before the first spec of a project, the agent asks in which language the
   specs are written; the default offered is the editor's (Nuclear's language setting); the answer is kept for the
   project (`.nuclear/builder.json` `specLanguage`).
4. **Every step in the team's channel.** Each station started, passed, failed; each approval asked and given; each
   repair: a message of the team's member who did it, in the run's thread, with its log folded (an accordion: the
   message says what happened in one line, the log opens on click).
5. **The pipeline told as C4.** The first level of the diagram is for a product owner: what is being built and the
   business steps (*Understand the request*, *Design the solution*, *Build it*, *Check it*, *Deliver it*), each said
   in plain words with what it produced (the spec, the decisions, the screens and endpoints, the checks passed).
   Clicking a step zooms in: level 2 the stations and who works them; level 3 a station's steps and their outputs
   (files written, decisions); level 4, only on demand (*technical details*), the tool calls (`Glob`, `Read`,
   `Write`...) for debugging. A spec opens as a rendered preview first, its files second.
6. **A failure is diagnosed and repaired, with a measured budget.** When a station or a check fails, the loop gives
   the failure (its last lines, the check's findings) to one diagnosis call; when it says what is wrong and that it
   can be fixed, the failed station runs once more with the diagnosis; a second failure, or a diagnosis that cannot
   fix it, stops and asks the user. The diagnosis and the retry count in the run's budget and are said in the
   channel.
7. **The design cites only what exists.** A station cites the project's ADRs (`docs/03-adr/`) by their number, and the
   platform's rules by their name (a diagnostic code, the framework's rule), never as a project ADR; a check never
   fails a design for a path the factory itself chose.

## Validation

Five tasks run end to end in a workspace made for them: a REST backend (nestjs) with a SQLite database; a small
chatbot backend (fastapi); a web dashboard that reads and changes the REST backend's data; a mobile app that shows
the Rick and Morty API's characters; one more with a free weather API. Each run is looked at in the editor: the first
level of its diagram reads as a story to a product owner, every step is in the team's channel, a failure is repaired
or explained.

Sources of the sizes: Google's engineering practices (change size), the SmartBear/Cisco review study (~400 lines),
an npm pull-request study (5–15 files) — summarized in the agent's playbook, not quoted as law.
