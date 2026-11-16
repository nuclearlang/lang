# Brief: write the context docs of your project(s) — spec 008, phase 3

Tree root: `/home/julian/Documents/projects/nuclearlang` (ONE git repository since 2026-11-16).

## Read first (in this order)

1. `docs/README.md` — the documentation standard. Follow it exactly: layers, short files, front-matter, English,
   nothing invented (`TODO(human): <question>`), ADR citation `ADR-<key>-NNNN`.
2. `docs/04-specs/008-restructure/design.md` — the new tree and the table "Where each old folder goes". Every
   existing document still names OLD paths (`crates/`, `spec/`, `dragonfly-mobile/`, `tools/defs`, `nuclear-vscode/`,
   `docs/context/...`, `install.sh`, "repository", "plan 006"): translate each to the new tree when you carry a
   sentence over. If you are not sure a path exists, check it on disk.
3. `docs/05-standards/agent-context-docs-implementation.md` §4 — the templates of each file (they are in Spanish;
   write in English).

## What you produce, for each project assigned to you

1. **`AGENTS.md`** at the project's root (template §4.1): what it is, stack, real commands (check them in the
   scripts/manifests), folders, the project's own rules, and the table of its documents with a "read when" line each.
   Under 150 lines. Merge what an existing `AGENTS.md`, `README.md` or `CONTEXT.md` says. `CLAUDE.md` beside it
   holds exactly `@AGENTS.md`.
2. **`docs/`** in the layers of the standard. You MOVE and RESHAPE what exists: keep every fact, split a long file
   by topic (aim under 200 lines each), fix paths and links. Do not pad: a layer with nothing real has no file.
   `README.md` of a project stays the user-facing introduction (short; fix its paths), not a copy of the docs.
3. **ADRs**: the old ADRs assigned to you are in `docs/adr/NNNN-*.md` (read-only). Consolidate them BY THEME into
   few ADRs in your project's `docs/03-adr/`, numbered from 0001, in the format of `docs/03-adr/0000-template.md`.
   Write each decision as it stands today (apply later amendments), keep the reasons and the consequences that
   still hold, drop history and dates of discussion. End each with `- Replaces: ADR-00NN, ADR-00MM` (the OLD
   numbers). Inside your new ADRs cite other decisions by their OLD number written as `old ADR-00NN` — they are
   rewritten to the new ids afterwards by a script. Write `docs/03-adr/README.md` (the index table).
4. **`docs/01-product/roadmap.md`**: the pending work of the project, from the bullets of `STATUS.md` (root,
   read-only) that are about it. Reshape into the sections *Half done*, *Untested*, *To decide with the user*,
   *Pending* (only those with content); keep every fact of a bullet, fix its paths. Short bullets.
5. **Clean up inside your folders**: once a source file inside your project folder is fully distributed (an old
   `CONTEXT.md`, a `docs/context/...` file that was moved in), delete it.

## Names

Write the names the code has TODAY: "Dragonfly", the `dragonfly` command, the packages `dragonfly`, `dragonfly-py`,
`dragonfly-nest`, `dragonfly-web`, `nuclear-loop`, `nuclear-graph`, "the Loop", "Nuclear HTTP". They are renamed
later by a script (to Synapsis, `nuclear`, `nuclear-builder`, `nuclear-connector`). Only FOLDER PATHS are the new
ones. Do not describe the rename.

## Hard limits

- Touch ONLY files inside the folders assigned to you. Never edit or delete: `docs/adr/`, `STATUS.md`,
  `docs/context/`, `docs/ai/`, the root `AGENTS.md`/`README.md`, or another project's folder.
- Never change code, tests, scripts, `*.toml`, `*.nuc`, generated folders, or anything under `docs/07-reference/`
  and `docs/08-guides/` (normative and user texts: they are checked by tools and embedded in binaries). You may
  link to them.
- Do not run cargo, npm, installers or git commands that change anything. No commits.
- English only. No history ("we used to", dates of sessions), no log of what you did inside the docs.

## What you hand back (files in the scratchpad, then a short report)

Scratchpad: `/tmp/claude-1000/-home-julian-Documents-projects-nuclearlang/a3a09f48-fbef-4916-aba6-82253de09de2/scratchpad/out/<your agent name>/`

- `adr-map.tsv`: one line per OLD ADR assigned to you: `<old number>\t<key>\t<new number>\t<path of the new file from the tree root>`.
- `status-taken.txt`: one line per `STATUS.md` bullet you carried into a roadmap: its first 60 characters, exactly
  as in `STATUS.md` (without the leading "- ").
- Your final message: the files created/removed (counts per folder), every `TODO(human)` you wrote, and anything
  you could not place or found contradictory. No prose beyond that.
