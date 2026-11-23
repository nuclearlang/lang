---
status: done
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

## Phase 2 — the names and the one command (done 2026-11-16)

- [x] T2.1 `ADR-cli-0003`: one command, `nuclear`; `build` / `check` with a path are the compiler's, without one the
      project's; `agent init` inside a project reads its manifest.
- [x] T2.2 The `dragonfly` crate is the module `framework/` of `nuclear-cli`; `nuclear-synapsis-framework/cli/` gone;
      the installers build and link only `nuclear` (and remove the old `dragonfly` and `nuclear-loop` links).
- [x] T2.3 Dragonfly → Synapsis in code, data, packages (`synapsis`, `synapsis_genkit`, `synapsis-py`, `synapsis-nest`,
      `synapsis-web`), type definitions, `synapsis(platform, dialect)` of `config.nuc`, generated files, docs
      (`work/rename.py`).
- [x] T2.4 The Loop → Nuclear Builder (`nuclear-builder`, `.nuclear/builder/`, `.nuclear/builder.json`); Nuclear HTTP →
      HTTP Connections (`work/rename2.py`). The graph's command stays `nuclear-graph` (only its folder was named).
- [x] T2.5 The user's projects in `~/Documents/projects/nuc/` follow the new words (a copy before:
      `~/Documents/projects/nuc-backup-2026-11-16-before-synapsis.tar.gz`). `python/nuclear_langgraph_agent` still
      has the two errors it had before (`@generated`, a variable named `tools`): the user's code, not changed.

## Phase 4 — the projects that were inside another (done 2026-11-16)

- [x] T4.1 `device-emulators/`: the crate `nuclear-devices`.
- [x] T4.2 `tools/code_generator/`: the crate `nuclear-codegen`; its data in `platforms/<platform>/generators.toml`
      (out of each `platform.toml`); the loader reads it (`Home.generators`, `Loader::generators_file`).
- [x] T4.3 `tools/mcp/`: a Nuclear project of its own, command `nuclear-mcp`; the MCP tool `dragonfly` is
      `nuclear_project`; the editor's settings `nuclear.ai.mcpCommand` / `nuclear.ai.graphCommand`.
- [x] T4.4 `extensions/tools/<tool>/`: the code of the builder, HTTP Connections, Nuclear Atlas and the device manager (their
      JetBrains parts in `jetbrains/src/`).
- [x] T4.5 `website/`: moved into the tree (from `~/Documents/projects/nuc/react/nuclearlang_website`, a copy with
      its git history is in the backup above); its pages come from every project's reference and guides; CI
      `.github/workflows/website.yml`.

## Found on the way

Moved to the roadmaps of their projects on 2026-11-17 (the language, the web and mobile platforms, the platform's
own for the workflows); the framework's changelog is `tools/cli/CHANGELOG.md`, the command's.

## Phase 5 — outside the tree (each needs the user's go)

- [x] T5.1 Reinstalled from the tree (`installer/install.sh`); the AI services run on the renamed code. The VS Code
      extension was built and packaged, not installed: its version must be raised first.
- [x] T5.2 Publish the website from this repository: the `nuclearlang.github.io` repository holds only the
      workflow that builds `website/` of `nuclearlang/nuclearlang` (its roadmap in `website/`).
- [x] T5.3 The repositories that are now folders are archived (2026-11-16): `dragonfly`, `dragonfly-web`,
      `dragonfly-mobile`, `dragonfly-backend`, `nuclear-vscode`, `nuclear-jetbrains`, `nuclear-developer`,
      `nuclear-knowledge`, `nuclear-graph`. Not archived: `nuclear-zed` (the grammar `extensions/zed/extension.toml`
      loads) and `nuclearlang.github.io` (it publishes the site).
- [x] T5.4 The AI set-up written by the old installer (2026-11-17): the set-up ran again (the `nuclear-developer`
      launcher of `ai/nuclear-agents/nuclear_developer`), the editors' MCP registrations name `nuclear-mcp`, and
      `nuclear-graph mcp` and the installers' removal of the old `dragonfly` and `nuclear-loop` links are gone.
