---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [follow-a-run.md, pipeline-commands.md, ../../../../../installer/docs/08-guides/ai-setup.md]
---
# Write a spec and start the Builder

The Builder takes a spec to tested, reviewed code on your machine, with local agents; the same pipeline can run on a
server.

## 1. Set up once

```sh
curl -fsSL https://nuclearlang.github.io/install.sh | sh    # NuclearLang, then the set-up of the AI services
nuclear-builder setup                                           # the set-up alone, any time
```

The set-up reads your machine, suggests a set of models that fits it (`lite`, `medium` or `hard`, or remote agents
only), says how far each works, and installs what you choose: the Smart Graph, the Nuclear Developer, the models,
the knowledge base. Both services then start at every login. VS Code has the same set-up as a wizard (*Nuclear: Set
Up the AI Services*). Every step, the profiles and what to do when one fails:
[Set up the AI services](../../../../../installer/docs/08-guides/ai-setup.md).

```sh
nuclear-builder setup --status                              # what is installed and running
claude mcp add --scope user nuclear -- nuclear-mcp          # optional: Claude leads
```

No program can read the graph until you allow it with `connect` or `allow` (the set-up allows the Developer and the
MCP server). Its documents are encrypted on disk and it refuses web pages
([the Smart Graph](../../../../../nuclear-graph-storage/README.md)).

## 2. Write the spec in VS Code

Open the Nuclear workspace and press `Ctrl+Alt+P`. The first page is the spec:

1. **What you want to do**: a new feature, a refactor, a bug, tests, a security review, documentation or a diagram.
   Each choice gives the description a template.
2. **The spec**: write it, or import it from Jira (*Connect…* once: site, email, API token, kept in VS Code's
   secret storage; then a key such as `PROJ-123`, or *My open issues*) or from a GitHub issue (`123`,
   `owner/repo#123`). Add the **acceptance criteria**. The run checks them, and a spec needs at least one.
3. **Context for the agents**: files suggested from the project and your skills, by the words of the spec. The
   project's agent instructions (`AGENTS.md`) are always selected.
4. **Who leads**: *Claude leads, the local developer writes*, or *Local agents only*. *Preview the plan* shows the
   pieces the local planner would make, so you can edit them before starting.

Press **Start the loop**. The spec is written to `specs/<id>/spec.md`.

## 3. Without VS Code

A spec is a markdown file in the same shape:

```markdown
# Title

- Use case: feature
- Strategy: usecase
- Lead: claude

## Description

What is wanted.

## Acceptance criteria

- [ ] one line per criterion

## Context

- path/of/a/file.md

## Resources

- `the arguments of one nuclear gen resource call`

## Pieces

- `path/of/the/file.nuc` (its kind): what the piece does
```

- `- Use case:` is `feature`, `refactor`, `bug`, `docs`, `diagram`, `test` or `security`; `- Lead:` is `local` or
  `claude`.
- `- Strategy:`, `## Context`, `## Resources` and `## Pieces` are optional.

- **JetBrains** (Android Studio, IntelliJ): the *Nuclear Builder* tool window (`Alt+Shift+P`) lists every project's
  specs and runs. *New Spec* writes the file, *Run the Spec* (local agents or Claude leading) runs it, and each run
  unfolds into its stages and steps, with the trace, code and output of the selected step.
- **A terminal**: `nuclear-builder run specs/<id>/spec.md [--lead local|claude]`, `nuclear-builder runs`.
- **A frontier model over MCP**: the Nuclear MCP server tells every frontier model to generate first
  (`generate_resource`, `generate_usecase`) and to let the local developer work on what is left. `developer_task`
  runs this pipeline with the local agents and answers the journal; the frontier model validates (`nuclear_check`,
  `nuclear test`), corrects only what is wrong and records it with `developer_review`, whose corrected files
  become examples in the graph for the local developer ([the MCP server](../../../../../tools/mcp/AGENTS.md)).

Every run is kept in `.nuclear/builder/runs/<id>.json`, the same file each editor draws.

## 4. Name the resources and let the generators write them

*Generate* comes before any agent. `nuclear gen resource` writes, already compiling:

- every resource the spec names: a `## Resources` section with one `nuclear gen resource` argument line per item,
  or else each `GET <url>` line of the description (`GET https://rickandmortyapi.com/api/character` is
  `characters Character`);
- every resource the analysis read in plain words ("each supplier has a name and a phone; we add and list them").

Each call is tried with `--dry-run` first. The fields come from the spec's example answer or its `Key | Type`
table, or from the API's own answer. The planner then plans only what is left, often nothing.
