---
status: done
owner: Julian Molina
updated: 2026-11-16
---
# Spec 008: restructure the tree — Requirements

## Goal

Every project of NuclearLang is readable alone. An agent reads the root map, is routed to one project, and finds
there that project's code, its `AGENTS.md` and its `docs/`, laid out the same way in every project. Asked by the
user on 2026-11-16: the context of all the projects sat in one documentation tree, and features came out wrong.

## Acceptance criteria (EARS)

- [ ] THE SYSTEM SHALL keep each project in the folder of the target tree (`design.md`) and nowhere else.
- [ ] THE SYSTEM SHALL give each project an `AGENTS.md` and a `docs/` in the layout of
      `agent-context-docs-implementation.md`, describing that project only.
- [ ] THE SYSTEM SHALL keep at the root only what is about the whole platform, and a map to each project.
- [ ] THE SYSTEM SHALL number each project's ADRs from 0001 and consolidate them by theme.
- [ ] THE SYSTEM SHALL keep no state file that every session loads whole; a project's pending work is in its docs.
- [ ] WHEN a file of context is written THE SYSTEM SHALL keep it short enough to read at once.
- [ ] THE SYSTEM SHALL name the framework Synapsis (`nuclear-synapsis-framework`), the pipeline tool
      `nuclear-builder` and the protocol client `nuclear-http-connections`, everywhere.
- [ ] THE SYSTEM SHALL have one command line tool, `nuclear`; the `dragonfly` command does not exist.
- [ ] WHEN a phase of `tasks.md` ends THE SYSTEM SHALL pass `cargo test` and `cargo clippy --all-targets`.

## Decided by the user (2026-11-16)

One git repository for the whole tree. One CLI, `nuclear`, with the framework's commands; runtime packages are
`synapsis-*`. The language server lives in `nuclearlang/`. ADRs are renumbered per project and consolidated.

## Out of scope

Building the tools that are only named: `nuclear-documentor`, `nuclear-ui-designer`, `nuclear-backend-designer`,
`nuclear-storage-connector`, and the protocols of `nuclear-http-connections` other than HTTP. Each gets its folder and a
page saying it is not built.
