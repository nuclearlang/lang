# The context documents of a project

How a project made with Nuclear documents itself for people and AI agents, by default. `nuclear new` writes these
files, filled with what it knows (the platform, the dialect, the commands, the folders, where each kind goes); what it
cannot know is a `TODO(user):` line. From then on they are the project's: **the project's own `docs/README.md` wins
over this default**. When the user wants another way, follow the user and write it in that file.

## The files

```
AGENTS.md                 the index: what it is, stack, commands, structure, rules, the map of docs/ (< 150 lines)
CLAUDE.md                 only `@AGENTS.md` (Claude Code reads CLAUDE.md; the other agents read AGENTS.md)
docs/
  README.md               the project's rules for its documents (this default, or the user's)
  00-context/             vision.md, glossary.md, domain.md
  01-product/             prd.md, roadmap.md
  02-architecture/        overview.md, dependencies.md, integrations.md
  03-adr/                 README.md, 0000-template.md, 0001-record-architecture-decisions.md
  04-specs/               README.md, _template/{requirements,design,tasks}.md, NNN-feature/
  05-standards/           coding.md, testing.md, security.md
  06-runbooks/            deploy.md, incidents.md
```

## The rules

- **State** (how the system is today): `00-context`, `01-product`, `02-architecture`, `05-standards`,
  `06-runbooks`. Kept true: a change that makes one of them wrong updates it in the same change.
- **Decisions** (why it is so): `03-adr`, MADR format. An accepted ADR is never edited: a new ADR replaces it and the
  old one is marked `superseded by ADR-XXXX`.
- **Changes** (what is being built): `04-specs/NNN-feature/` with `requirements.md` (what and why),
  `design.md` (how) and `tasks.md` (small, verifiable tasks); life cycle `draft → approved → in-progress → done`,
  listed in `04-specs/README.md`. This is how spec-driven development works (as in Spec Kit and OpenSpec): the
  spec of a change is written and reviewed before its code, and the state documents are the current truth.
- The prefixes `00-` … `06-` only fix the reading order, from the general to the concrete.
- Acceptance criteria are written in **EARS**: `WHEN <trigger> THE SYSTEM SHALL <response>`,
  `IF <unwanted condition> THEN THE SYSTEM SHALL <response>`, `WHILE <state> ...`, `WHERE <feature> ...`.
- Every document starts with the frontmatter `status`, `owner`, `updated` (YYYY-MM-DD), `related`.
- Short files, one subject each. A document that grows past a few hundred lines is split by subject.
- Never invent: what cannot be read from the code or the user's words is a `TODO(user): <concrete question>`.
- Never overwrite a document that exists: merge what is missing into it.

## A new feature

1. Copy `docs/04-specs/_template/` to `docs/04-specs/NNN-feature-name/`.
2. Write `requirements.md`: the goal, the user stories, their criteria in EARS. A person reviews it.
3. Write `design.md`: the pieces (each a kind of the platform, made with `nuclear gen` or `nuclear make`), the data,
   the contracts, the tests of each criterion. A structural decision is also an ADR. A person reviews it.
4. Write `tasks.md` and build task by task, marking the progress.
5. To close it: the state documents it touched say what changed, the spec is `done` in `04-specs/README.md`, the
   roadmap loses the item.

## What a Nuclear project adds

- `AGENTS.md` ends with a section between `<!-- nuclearlang -->` and `<!-- /nuclearlang -->`: how an agent learns
  Nuclear (the MCP server's `nuclear_start`) and checks its work. `nuclear agent init` refreshes only that section.
- `02-architecture/overview.md` holds the platform's layout: where each kind of piece goes. The meaning of each
  kind is the platform's topic (`nuclear help <platform>`), never copied into the project: it always comes from the
  installed version.
- `02-architecture/dependencies.md`: the libraries are in `config.nuc` (`nuclear add <package>`).
