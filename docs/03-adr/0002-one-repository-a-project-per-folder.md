---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0002: One repository; each project in its folder, with its own documents

## Context and problem
The platform was split into eleven repositories checked out inside one another, while the context of all of them
was written in one tree at the root: a map in layers (`docs/context/`), one numbering for every decision (108
ADRs), a single state file loaded whole in every session, a folder `spec/` beside a folder `specs/`. Code crossed
the repositories' borders (a framework dialect depends on the compiler, the CLI on both), and an agent that touched
one project read the documents of all. Features came out wrong.

## Decision
1. **One git repository** holds the whole tree. A project is a folder: `nuclearlang/` (the language, with each
   dialect under `dialects/<language>/`), `nuclear-synapsis-framework/` (with `platforms/<platform>/`), `tools/`
   (`cli/`, `code_generator/`, `mcp/`), `extensions/`, `device-emulators/`, `nuclear-agents/`,
   `nuclear-graph-storage/`, `installer/`. One Cargo workspace builds every Rust crate.
2. **Each project documents itself**: an `AGENTS.md` and a `docs/` laid out the same way in every project
   (`docs/README.md` is the standard). A project's documents, decisions and pending work describe that project only.
3. **The root holds only what is about the whole platform** and the map that routes to each project.
4. **Decisions are numbered per project** and cited with the project's key (`ADR-lang-0007`).
5. **No file lists the state of the whole platform.** A project's pending work is its `docs/01-product/roadmap.md`.
6. **Documents are short**: one is read in one go, or it is split.

## Options considered
1. A repository per project, checked out inside one another: the borders did not match what depends on what, and
   every check needed the whole tree anyway.
2. One repository with one documentation tree in layers: every agent loaded the context of every project.
3. One repository, a project per folder, documents inside each project.

## Consequences
- Positive: a task needs the root map and one project's documents; a change and its documents are in one commit.
- Negative: the nine public repositories that are now folders are archived, and their links change; a release
  builds from one tree.

## References
- Replaces: ADR-0083, ADR-0084
- The work: `04-specs/008-restructure/`
