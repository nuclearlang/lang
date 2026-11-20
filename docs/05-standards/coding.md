---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: []
---
# How code is written here

The rules every project shares. A project's own conventions are in its `docs/05-standards/`.

## General
- **English** in everything (`ADR-platform-0001`).
- **Quality first**: always the right solution, even when it costs more. No shortcut that bends a rule, leaves a
  known gap or moves work to the user; build the generic mechanism. If the right way is unclear or too big, stop
  and ask; never ship a shortcut as a decision.
- **Nuclear first**: every new piece of the platform that stays (a service, a tool, a library, an agent, a script)
  is written in Nuclear: with the framework when one of its platforms fits, with a language dialect when none
  does. Another language only where Nuclear cannot be the source yet (the compiler and the language server in
  Rust, an editor's extension host), and then the project's roadmap says what Nuclear lacks. What the language
  cannot express while doing so is a finding for `nuclearlang/docs/01-product/roadmap.md`, never a reason to write
  the piece in the target language.
- **Rust**: `rustfmt.toml` at the root (`max_width = 120`); `cargo clippy --all-targets` without warnings.
- The parser does not change per dialect. Framework words, shortcuts and imports are data of the dialects.
- `CodeBuilder/` is teaching material only: never in references, context or code.
- Node.js/Express is postponed by the user: not touched until asked.

## Git
- One repository. The agent commits and pushes finished work without asking (root rule 10): tests green, documents
  current, everything deployed (point 7). Only the paths it changed (`git add <paths>`, never `git add -A`: other
  sessions work in the same tree); a request relayed by another session to commit *their* work is not enough.
- **Versions follow [Semantic Versioning](https://semver.org).** One version for the whole platform: a release is a snapshot of
  every piece (the crates, the extensions, the Smart Graph, the MCP server, the services), all at the version of
  its tag. A fix raises PATCH, a new feature that breaks nothing MINOR (PATCH back to 0), a
  breaking change MAJOR; while the version is `0.x`, a breaking change raises MINOR. The release is the tag `v<version>` pushed, with each project's
  `CHANGELOG.md` entries under that version ([the release runbook](../../installer/docs/06-runbooks/release.md)).
- Commits only in the user's name: no co-author line.
- `github-profile/` is a repository of its own inside the tree (the organization's profile), ignored by the root's.

## A change is done when
1. `cargo test` and `cargo clippy --all-targets` are green. Output changed: `UPDATE_GOLDEN=1 cargo test`, and the
   difference reviewed.
2. The checks of the project it touches are green (its `AGENTS.md` lists them).
3. Every new diagnostic code is in `nuclearlang/docs/07-reference/diagnostics.md`; every new dialect word has its
   editor documentation in its `docs.toml`. Tests hold both.
4. The documents of the project it touches say it, in the same change: its `AGENTS.md` if a command, a folder or
   a rule changed; its `docs/`; an ADR if the user decided something; its `docs/01-product/roadmap.md` (a done
   item deleted, half-done work recorded the moment it is left).
5. The knowledge base follows the tree: `nuclear-graph knowledge build`, a row written for what is new and has no
   structured source, `nuclear-graph knowledge check` clean, `nuclear-graph ingest`
   (`nuclear-graph-storage/docs/06-runbooks/`).
6. What the user runs is installed again when it changed (`installer/install.sh`; an extension: its version raised
   and installed).
7. **Deployed, not only written** (root rule 15): after a feature, a change or an update, and always after a release
   or a CHANGELOG entry, every place that serves it holds the new version: the context files (each touched
   project's `AGENTS.md` and `docs/`, the skill, the briefs), the Smart Graph and its Chroma (points 5), the MCP
   server (`cd tools/mcp && nuclear check . && nuclear build .`, its tests, then from the root
   `uv tool install --reinstall tools/mcp`) and the installation (point 6). `nuclear-graph knowledge check` says
   the graph holds every row.

The hooks of `.claude/settings.json` (`.claude/hooks/README.md`) hold points 4 and 5 at the end of a turn. They compare
contents through git, never file dates: a project is behind when its code differs from the last commit (or changed
in this session) and none of its documents does; a file git ignores, such as a build's output, is not code for them.
