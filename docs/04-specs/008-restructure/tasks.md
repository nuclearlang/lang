---
status: in-progress
owner: Julian Molina
updated: 2026-11-16
---
# Spec 008: restructure the tree — Tasks

Each phase ends with `cargo test` and `cargo clippy --all-targets` green. Nothing is committed until the user asks.

## Phase 1 — the folders (done 2026-11-16)

- [x] T1.1 Every folder in its place (`design.md`, "Where each old folder goes"); the nested `.git` folders removed.
- [x] T1.2 One Cargo workspace at the root.
- [x] T1.3 The loader reads the new layout (frameworks under a language, `platforms/`, `defs/` under a language).
- [x] T1.4 Every path in Rust, tests, scripts, CI and the hooks names the new folders. The workflows of
      `.github/workflows/` were rewritten for one repository and have not run.
- [x] T1.5 The Nuclear projects and the extensions from their new folders: the three extensions build (the VS Code
      tests pass, its bundled server loads every dialect), the graph and the Developer build, the backend and web
      platform checks pass (`fastapi-check`, `nestjs-check`, `react-check`). Not run: `analyze-flutter.sh`, the
      Dart runtimes' tests, the graph's own tests (they wait for T3.5).
- [x] T1.6 Comments in code and scripts name the new folders (`sweep.py` of this session; documents: phase 3).

## Phase 3 — the docs (done 2026-11-16)

`work/` keeps what the phase used: `docs-brief.md` (the brief every project's writer followed),
`agents/<name>/adr-map.tsv` and `status-taken.txt` (what each handed back), `sweep.py` (old folder names → new, in
text), `links.py [--fix]` (relative links), `adr-cites.py` (old ADR numbers → `ADR-<key>-NNNN`), `kb-sources.py`
(the knowledge base's sources → the new files and headings).

- [x] T3.1 Root: `AGENTS.md` as the map, `docs/` with the platform's layers, three platform ADRs.
- [x] T3.2 Each project: `AGENTS.md` + `docs/` (17 projects, each with its roadmap).
- [x] T3.3 The 108 ADRs consolidated into 44, numbered per project; every citation of the tree rewritten;
      `nuclearlang/docs/07-reference/decisions.md` is the index of all of them; `docs/adr/` deleted.
- [x] T3.4 `STATUS.md` distributed into the roadmaps (every bullet checked against the hand-backs) and deleted,
      with `docs/context/` and `docs/ai/`; `CLAUDE.md` is `@AGENTS.md`.
- [x] T3.5 The knowledge base: `sections.toml` and the rows' sources name the new tree; built (revision 60),
      reviewed, checked, ingested.
- [x] T3.6 No broken relative link (one left in the user's guideline `docs/05-standards/agent-context-docs-
      implementation.md`: a template's example link, kept as the user wrote it).

Open questions the writers left for the user are written `TODO(human)` in the documents (`rg "TODO\(human\)"`).

## Phase 2 — the names and the one CLI

- [ ] T2.1 ADR in `tools/cli`: which command of `dragonfly` becomes which command of `nuclear`.
- [ ] T2.2 The `dragonfly` crate merged into `tools/cli`; `nuclear-synapsis-framework/cli/` removed.
- [ ] T2.3 Dragonfly → Synapsis: packages (`synapsis`, `synapsis_genkit`, `synapsis-py`, `synapsis-nest`,
      `synapsis-web`), the `synapsis(platform, dialect)` word of `config.nuc`, generated file names, docs.
- [ ] T2.4 The Loop → `nuclear-builder`; Nuclear HTTP → `nuclear-connector`; `nuclear-graph` →
      `nuclear-graph-storage`.
- [ ] T2.5 The user's projects outside the tree (`~/Documents/projects/nuc/`) follow the new words.

## Phase 4 — the projects that are still inside another

- [ ] T4.1 `device-emulators/` out of the CLI crate.
- [ ] T4.2 `tools/code_generator/` out of the CLI crate and the platform files.
- [ ] T4.3 `tools/mcp/` out of the graph.
- [ ] T4.4 `extensions/tools/<tool>/` out of the VS Code extension's `src/`.

## Found on the way (not done)

- The website reads this tree by the old paths (`site.toml`, `tools/content.mjs` of
  `~/Documents/projects/nuc/react/nuclearlang_website`): it does not build until T5.2.
- `nuclearlang/docs/07-reference/projects.md` §1.2 says only a url contract keeps `contracts/<name>/contract.json`;
  the code writes it for a path contract too.
- The five `gen.js` commands of the web type definitions are in no script (`platforms/web` runbook).
- The installed AI services were repaired by hand (the links of `~/.local/share/nuclearlang/ai/` and the graph's
  editable path point at the new folders, under the OLD names the installed extension expects); `installer/install.sh`
  now writes `ai/nuclear-graph-storage` and `ai/nuclear-agents`: reinstall the extension with it (T5.1).
- `nuclear-synapsis-framework/CHANGELOG.md` is the `dragonfly` command's: it moves with the crate (T2.2).
- Not run after the move: `analyze-flutter.sh`, the Dart runtimes' tests, the workflows of `.github/`.

## Phase 5 — outside the tree (each needs the user's go)

- [ ] T5.1 Reinstall (`installer/install.sh`), the extension's version raised and installed.
- [ ] T5.2 The website follows the new paths and names.
- [ ] T5.3 The nine GitHub repositories that are now folders: archived.
