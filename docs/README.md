---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [05-standards/agent-context-docs-implementation.md]
---
# Context documentation

The source of truth of the platform for people and AI agents. This folder holds only what is about the **whole
platform**. Each project documents itself, in its own folder, the same way.

## How to read

1. The root `AGENTS.md` is always loaded: the hard rules and the map of projects.
2. Open the `AGENTS.md` of the one project the task touches. It lists that project's documents.
3. Open a document only when its line in that list matches the task. Never read a folder "to be safe".

## The projects

| Project | Folder | ADR key |
|---|---|---|
| The platform (this folder) | `docs/` | `platform` |
| The language, the compiler, the language server | `nuclearlang/` | `lang` |
| A language dialect and its frameworks | `nuclearlang/dialects/{python,typescript,dart,nodejs}/` | `python` `typescript` `dart` `nodejs` |
| The framework | `nuclear-synapsis-framework/` | `synapsis` |
| A platform of the framework | `nuclear-synapsis-framework/platforms/{mobile,backend,web}/` | `mobile` `backend` `web` |
| The `nuclear` command | `tools/cli/` | `cli` |
| The code generator | `tools/code_generator/` | `codegen` |
| The MCP server | `tools/mcp/` | `mcp` |
| The installers and the release | `installer/` | `installer` |
| The devices | `device-emulators/` | `devices` |
| The editor extensions | `extensions/`, `extensions/{vscode,jetbrains,zed}/` | `extensions` |
| A tool of the editors | `extensions/tools/<tool>/` | — |
| The Smart Graph (the RAG) | `nuclear-graph-storage/` | `graph` |
| The agents | `nuclear-agents/`, `nuclear-agents/nuclear_developer/` | `developer` |

## What every project has

`AGENTS.md` at its root: what the project is, its stack, its commands, its folders, its own rules and the list of
its documents with one line each saying when to read it. Under 150 lines. A `CLAUDE.md` beside it holds only
`@AGENTS.md`.

`docs/`, with these layers. A layer with nothing to say has no file; no file is a template waiting to be filled.

| Folder | Holds | Changes |
|---|---|---|
| `00-context/` | `vision.md` (the problem, the users, what it does not do), `glossary.md`, `domain.md` | updated |
| `01-product/` | `prd.md` (requirements), `roadmap.md` (**the project's pending work**) | updated |
| `02-architecture/` | `overview.md`, `dependencies.md`, `integrations.md`, and one file per part worth its own | updated |
| `03-adr/` | decisions: `README.md` (the index), `NNNN-title.md` | never edited: replaced by a new one |
| `04-specs/` | one folder per change being built: `requirements.md`, `design.md`, `tasks.md` | `draft → approved → in-progress → done` |
| `05-standards/` | `coding.md`, `testing.md`, `security.md` | updated |
| `06-runbooks/` | how to release, run and repair | updated |
| `07-reference/` | the normative text: a language's rules, a dialect's equivalences, a platform's kinds, the briefs | updated |
| `08-guides/` | what a user reads: tutorials, how-tos | updated |

## Rules

- **One fact, one file, one project.** Another file links to it. A project never describes another project: it
  links to it.
- **Short files.** A document is read in one go: over about 200 lines it is split by topic.
- **English** (the chat with the user is in Spanish).
- **Front-matter** on every document: `status` (`draft`, `accepted`, `deprecated`, `superseded`), `owner`,
  `updated` (a date), `related` (paths).
- **Nothing invented.** What cannot be read from the code or the existing documents is written
  `TODO(human): <the question>`.
- **Pending work** of a project is `docs/01-product/roadmap.md` of that project, with the sections it needs of:
  *Half done*, *Untested*, *To decide with the user*, *Pending*. A done item is deleted. No file lists the pending
  work of the whole platform.
- **Decisions.** Each project numbers its ADRs from 0001, in the format of `03-adr/0000-template.md`. An ADR is
  cited with its project's key: `ADR-lang-0007`, `ADR-mobile-0002`. A change to a decision is a new ADR; the old
  one is marked `superseded by ADR-<key>-NNNN`.
- **A feature** starts as a spec in the `04-specs/` of the project it changes; one that changes several projects
  is here.

The layout is the user's (`05-standards/agent-context-docs-implementation.md`), with two layers added for a
language: `07-reference` and `08-guides`.
