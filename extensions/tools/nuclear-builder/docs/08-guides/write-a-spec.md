---
status: accepted
owner: Julian Molina
updated: 2026-11-25
related: [follow-a-run.md, pipeline-commands.md, ../../../../../installer/docs/08-guides/ai-setup.md]
---
# Write a spec and start the Builder

The Builder takes a spec through the stations of the software factory (Analysis, Design, Tests first, Code, Quality,
Delivery) on your machine, each worked by a role of your team; the deterministic part of the line can run on a
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
nuclear-builder team list --json                            # your teams (the company screen makes them)
```

No program can read the graph until you allow it with `connect` or `allow` (the set-up allows the Developer and the
MCP server). Its documents are encrypted on disk and it refuses web pages
([the Smart Graph](../../../../../nuclear-graph-storage/README.md)).

The first spec of a project asks once in which language its specs are written (the editor's language first); every
document the stations write for a spec is in that language. It is kept in `.nuclear/builder.json` (`specLanguage`).

## 2. Write the spec in VS Code

Open the Nuclear workspace and press `Ctrl+Alt+P`: the Builder's workbench, the specs and the runs on the left, the
run's diagram in the middle with Nuclear Chat under it (the team's channel), the node and the team on the right.
Press **New spec** (or ask in the chat, `@atlas` or the team's tech lead, to write a spec's base from a few lines: the
spec it writes appears in the tree). The form opens in the middle:

0. **Where it belongs**: the business component (one of the project's `components/`, or *Whole project*, `_global`)
   and, when the spec touches only one, its layer (presentation, domain, data).
1. **What you want to do**: a new feature, a refactor, a bug, tests, a security review, documentation or a diagram.
   Each choice gives the description a template.
2. **The spec**: write it, or import it from Jira (*Connect…* once: site, email, API token, kept in VS Code's
   secret storage; then a key such as `PROJ-123`, or *My open issues*) or from a GitHub issue (`123`,
   `owner/repo#123`). Add the **acceptance criteria**. The run checks them, and a spec needs at least one.
3. **Context for the agents**: files suggested from the project and your skills, by the words of the spec. The
   project's agent instructions (`AGENTS.md`) are always selected.
4. **The team**: the team that works the run, one of yours (the project's `.nuclear/builder.json` `"team"`, else the
   setting `nuclear.builder.team`, else your default team is chosen first). The form shows its members: each employee's
   funny name and avatar, the role and who does its work (a paid provider in amber: Claude Code, Codex, Gemini CLI, OpenCode, Cursor, Grok Build, an API). *Team…* opens the company screen, where teams are made ([make a team](make-a-team.md)) and
   changed; *Budget* opens the Spending section of *Settings and integrations* (the team's budget per run and the
   confirmations). When a role is paid, the run asks you twice before its first paid call, the second time with the
   amount.

Press **Save the spec** to keep it for later, or **Start the run**. The spec is placed by `nuclear-builder spec new`
in `specs/<component>/[<layer>/]<id>/spec.md` and appears in the tree; the run starts as `nuclear-builder run
<that file> --team <id> --events`, a process of the editor: closing the page leaves it working ([follow a
run](follow-a-run.md)). A spec saved earlier opens from the tree, with *Start the run*.

To delete a spec, open it and press **Delete** (also in the head of its run, when nothing runs): the editor asks first,
then its folder, with the documents the agents wrote and its checks, moves to `.nuclear/builder/deleted/`, where it can
be brought back; its run stays in the runs' list. In a terminal: `nuclear-builder spec delete <id>`.

## 3. Without VS Code

A spec is a markdown file in the same shape, in the folder of its business component:
`specs/<component>/<id>/spec.md`, `specs/<component>/<layer>/<id>/spec.md` when it touches one layer
(`presentation`, `domain`, `data`), `specs/_global/<id>/spec.md` for the whole project. `nuclear-builder spec new`
writes its base there:

```sh
nuclear-builder spec new --title "Book a room" --component booking --layer domain --description "A guest books a free room."
nuclear-builder spec list                         # the specs by component and layer
nuclear-builder spec move <id> --component rooms  # a spec to another component or layer, its run with it
nuclear-builder spec migrate                      # the specs of the earlier flat specs/<id>/ to their component
nuclear-builder spec accept <id>                  # a member's draft (spec.draft.md) over the spec; discard <id> drops it
```

```markdown
# Title

- Use case: feature
- Component: booking
- Layer: domain
- Strategy: usecase

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

- `- Use case:` is `feature`, `refactor`, `bug`, `docs`, `diagram`, `test` or `security`.
- `- Component:` and `- Layer:` say where the spec belongs (the folder says it too: `spec move` changes both).
- `- Strategy:`, `## Context`, `## Resources` and `## Pieces` are optional.

- **JetBrains** (Android Studio, IntelliJ): the *Nuclear Builder* tool window (`Alt+Shift+P`) lists every project's
  specs and runs. *New Spec* writes the file, *Run the Spec with a Team…* runs it with the team you choose, and each
  run unfolds into its stations and steps (the role, the employee, the provider and model), with the trace, files and
  output of the selected step. What a station asks comes as a dialog.
- **A terminal**: `nuclear-builder run specs/<component>/<id>/spec.md [--team <id>]` (no file: the spec changed last) (the questions are asked there),
  `nuclear-builder runs`.
- **A frontier model over MCP**: the Nuclear MCP server tells every frontier model to generate first
  (`generate_resource`, `generate_usecase`) and to let the local developer work on what is left. `developer_task`
  runs this pipeline with the local agents and answers the journal; the frontier model validates (`nuclear_check`,
  `nuclear test`), corrects only what is wrong and records it with `developer_review`, whose corrected files
  become examples in the graph for the local developer ([the MCP server](../../../../../tools/mcp/AGENTS.md)).

Every run is kept in `.nuclear/builder/runs/<id>.json`, the same file each editor draws.

## 4. Name the resources and let the generators write them

In *Design*, the generators come before the Architect. `nuclear gen resource` writes, already compiling:

- every resource the spec names: a `## Resources` section with one `nuclear gen resource` argument line per item,
  or else each `GET <url>` line of the description (`GET https://rickandmortyapi.com/api/character` is
  `characters Character`);
- every resource the analysis read in plain words ("each supplier has a name and a phone; we add and list them").

Each call is tried with `--dry-run` first. The fields come from the spec's example answer or its `Key | Type`
table, or from the API's own answer. The Architect then plans only what is left, often nothing.

## Polish a spec in the chat

On a spec, **Polish in the chat** opens its own thread in the team's channel: the tech lead posts the spec, and you
talk about it there (`@qa` brings the QA in). When a member proposes a change, it comes as a difference with
**Accept** and **Discard**: the spec is written only when you accept it (`nuclear-builder spec accept <id>`).

