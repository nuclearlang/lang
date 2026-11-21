# The size of a task: do it, or propose Nuclear Builder

Before any work on a request (a bug, a refactor, a change, a feature), measure it. Nuclear Builder, the software
factory, is for big work: a large spec or several specs at once. Small and medium work is an agent's, with the
knowledge base and the MCP server.

## Measure

Read the code the request touches (`project_inspect`, `nuclear_project` with `analyze`, the files) and count:

- **files**: how many files it would change or create (`.nuc` files and the project's own documents);
- **lines**: about how many lines it would add or change;
- **feature**: whether it adds one: a new screen, endpoint, entity, component or use case, or a changed contract
  (`contracts/`) or schema (an entity's fields, a migration).

## Decide

| Size | Measure | Who does it |
|---|---|---|
| small | ≤ 3 files, ≤ 100 lines, no feature | you, now |
| medium | ≤ 10 files, ≤ 400 lines, no new feature | you, and you say which files you touched |
| large | more than that, a new feature, or several specs | propose Nuclear Builder: a spec (or several) and one run, with your count as the reason; the user decides |

Say the count in one line before you start (`small: 2 files, ~40 lines, no feature`). When the work grows past its
size while you do it (a third component, a new endpoint), stop and say so: it may now be Builder's.

A proposal of Builder names what each spec would hold and why it is large (`large: a new entity, 2 endpoints and a
screen, ~14 files`); with the MCP server, `spec_create` writes each spec where Nuclear Builder shows it, after the
user's yes, and `run_start` starts the run.

## Where the numbers come from

They follow code review practice, not a law: Google's engineering practices call about 100 lines a reasonable change
and 1,000 usually too large; the SmartBear/Cisco review study saw reviews lose defects past about 400 lines; a study
of npm pull requests found the accepted ones mostly change 5 to 15 files
(https://arxiv.org/pdf/2003.01153, https://arxiv.org/pdf/2203.05045,
https://dev.to/bosepchuk/optimal-pull-request-size-600).
