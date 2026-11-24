# Context documents

The source of truth of {{name}} for people and AI agents. **These documents and this file are the project's own:
when they differ from NuclearLang's default (`nuclear help context-docs`), they win.** Change or extend them as the
project needs.

The numbered prefixes only fix the reading order, from the general to the concrete.

<!-- nuclearlang -->
## What is not written here: the oracle

NuclearLang's knowledge is never copied into these documents: what Nuclear is, its syntax, kinds, words, commands
and how-tos, what the platform means, the factory's specs, runs and teams, and this project's map are answered by
the `nuclear` MCP server, the oracle (`nuclear_start`, `nuclear_doc`, `project_inspect`; without it, `nuclear help`),
always for the installed version. These documents hold what only this project has: **its architecture** (its
components and the layers of each as its platform lays them out, for example presentation, domain and data; where
each piece goes; its C4 context and containers; its critical flows: `02-architecture/`), its business and domain,
its product, its decisions and its conventions.
<!-- /nuclearlang -->

| Folder | Kind | What it holds | Changes? |
|---|---|---|---|
| `00-context/` | State | Vision, glossary, domain | Updated |
| `01-product/` | State | PRD, roadmap | Updated |
| `02-architecture/` | State | Architecture, dependencies, integrations | Updated |
| `03-adr/` | Decisions | Architecture Decision Records | Never edited: a new ADR replaces one |
| `04-specs/` | Changes | A folder per feature: requirements, design, tasks | Its own life cycle |
| `05-standards/` | State | Code, test and security conventions | Updated |
| `06-runbooks/` | State | Deploy, incidents | Updated |

## Common frontmatter

Each document starts with:

```yaml
---
status: draft | accepted | deprecated | superseded
owner: <person or team>
updated: YYYY-MM-DD
related: []
---
```

## A new feature

1. Copy `04-specs/_template/` to `04-specs/NNN-feature-name/`.
2. Write `requirements.md` (what and why, acceptance criteria in EARS). A person reviews it.
3. Write `design.md` (how). A structural decision is also an ADR. A person reviews it.
4. Write `tasks.md` (small tasks, each verifiable).
5. Build task by task, marking the progress.
6. To close it: update the state documents it touched and mark the spec `done` in `04-specs/README.md`.
