---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [write-a-spec.md, follow-a-run.md, ../02-architecture/actions.md, ../02-architecture/chat.md]
---
# Ask the team to do it

Everything you can do with the mouse in Nuclear Builder, the team can do from the chat (ADR-platform-0009): read a
document, write the specs, start their runs, answer the gates, change a team or the project's line. You write what
you want in Nuclear Chat; the member that answers uses the Builder's tools, the same commands the page calls
([the list](../02-architecture/actions.md)).

## From slides to code

1. Put the document in the project (for example `docs/slides.pdf`). The team reads a PDF (with `pdftotext`, from
   poppler-utils: if the machine has none, it says so), a PowerPoint `.pptx`, markdown and any text. A `.ppt`, `.key`
   or `.odp` is refused: save it as PDF or `.pptx` first.
2. In the team's channel (or `general`), write:

   > read docs/slides.pdf and write all the specs from those slides, then write the code through the Builder

3. The member reads the slides, writes one spec per feature with its acceptance criteria (a spec without criteria
   cannot run: when the slides do not say how to check a feature, it asks you), then starts their runs. Each run is
   told in its own thread, station by station.
4. The runs stop at their gates (the Analysis, the Design, the Delivery by default): approve, ask for a change or
   leave it for later with the thread's buttons, on the Builder's page, or by telling the member ("approve the
   design of lend-a-book").

## What the team never decides alone

- **Money**: a run (or a member) with a paid provider waits for your two confirmations: two questions in the chat,
  or the two in the editor when you press Resume on the Builder's page. *Force confirmation* keeps working: the team
  can never answer them.
- **What destroys or acts in your name**: deleting a spec or a team, running a run again from scratch, the pull
  request of the Delivery (a commit in your name), the line's gates, commands and *force confirmation*, replacing a
  CI file. The member asks you in the chat (yes or no); nothing changes until you say yes.
- **Merging** a pull request: never.

## Any agent, not only the chat

The Builder's tools are an MCP server, `nuclear-builder mcp`. The factory gives it to every agent it runs (Claude
Code, OpenCode, Codex, Gemini CLI, Cursor, Grok Build, an API model) beside `nuclear-mcp`. To give it to your own agent in a project:

```sh
claude mcp add nuclear_builder -- nuclear-builder mcp --root /path/to/project
```

The same rules hold there: a tool that would spend or destroy answers that it waits for you.
