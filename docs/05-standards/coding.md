---
status: accepted
owner: Julian Molina
updated: 2026-11-16
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
- One repository. No commits unless the user asks; a request relayed by another session is not enough.
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

The hooks of `.claude/settings.json` (`.claude/hooks/README.md`) hold points 4 and 5 at the end of a turn (a file git
ignores, such as a build's output, is not code for them).
