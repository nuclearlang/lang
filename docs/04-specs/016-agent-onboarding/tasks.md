---
status: in-progress
owner: Julian Molina
updated: 2026-11-18
related: [requirements.md, design.md]
---
# Spec 016: An agent learns Nuclear from the MCP server alone — Tasks

## Phases 1 to 4: done (2026-11-18)

- The CLI: `nuclear help start` and `nuclear help atlas [--json]` (`tools/cli/src/atlas.rs`): every topic by group,
  the tools' user guides embedded, the platforms' examples as `example/<name>` (staged by the release); every text
  printed has its links resolved (test `no_topic_links_into_the_source_tree`); `spec --platform <p>` is the sheet and
  the platform's topics (12 KB, was 280 KB); a word that is not a topic names the topics that explain it.
- The base brief: the ternary for a value inside an argument, a field always typed, a block as a named argument.
- `context-docs`: the standard in English (`tools/code_generator/docs/08-guides/context-docs.md`), and `nuclear new`
  writes the context documents of every platform, filled (`tools/code_generator/context/`, `context.rs`); the
  `AGENTS.md` section names `nuclear_start`.
- The MCP server: `nuclear_start`, `nuclear_doc`; the instructions only send to `nuclear_start`; `developer_task`
  with the developer down says why and what to do; `graph_strategy` names what to read first.
- The Smart Graph: `strategy:prototype` (the measured run's request now gets it; two requests in
  `questions.toml`); the rows that name the MCP server and the brief updated.
- The set-up's step `clients`: the MCP server added to every AI client found (Claude Code, Codex, Cursor, OpenCode,
  Gemini CLI), taken out by `--remove`.
- The release: staging stops when a file names the working tree or the staging machine's home.

## The clean machine (2026-11-18)

The release built from the tree (`package.sh` for musl, `ai-runtime.sh`) installed from a local mirror in the clean
container, profile `remote`: the `clients` step wrote OpenCode's and Gemini CLI's files; a real MCP client over stdio
got the instructions that send to `nuclear_start`, 18 tools, `nuclear_start` (13 KB with the atlas) and
`nuclear_doc`; `nuclear new` of a backend and of a mobile app wrote their context documents; `nuclear setup`
installed Flutter and `nuclear analyze` of the new app found no error. Fixed on the way: `nuclear` did not find the
Flutter that `nuclear setup` installs (`~/develop/flutter`) from a shell without it on its PATH, as an agent's;
`nuclear-builder setup --clients` for a client installed later. Found and left in the roadmaps: a backend or web
project needs Python or Node.js and nothing installs them (`tools/cli`); no release is published and the extension
is on no marketplace (`installer`).

## Phase 5: the measured run (2026-11-18)

The clean container, profile `remote`; OpenCode 2.2.7 installed after the set-up (`nuclear-builder setup --clients`
added the MCP server to it), the free model `opencode/deepseek-v4.1-flash-free`, `--auto`; the measured run's prompt
verbatim, the PDF in `~/Documents`. 19 minutes, 4,700 lines of Nuclear in 17 files, 5 sections and 14 interactive
detail screens.

- First calls: the installed `nuclear` skill, then `nuclear_start` (17 s), `nuclear help start`, the flutter brief,
  `nuclear help mobile`, `nuclear doctor`. No read of Nuclear outside the installation (there is no tree to find).
- Made with the tools: `nuclear new`, `make component`, `make screen`; words looked up with `nuclear help` and
  `nuclear defs show`; the project's `AGENTS.md` and a spec in `docs/04-specs/` kept.
- Compiler errors on the way: N0302 (a component's class used from `shared/`), N0013 (an `if ... then`), N0220
  (classes called before written); each fixed from its message.
- At the end: `nuclear check` `[]`, `nuclear analyze` 0 errors (60 infos and warnings), `nuclear test` 2 of 2.
- Found: named arguments to a method called without `this` passed `check` and broke `dart analyze` (fixed: they are
  reordered by position in every dialect, a name the callee lacks is N0219; `examples/semantics/named.nuc`);
  `nuclear new .` is refused and nothing shows a mobile screen without a display (`tools/cli` roadmap).

## Left

- [ ] Measured: which clients hand the MCP server's instructions to their model (Codex, Cursor and Gemini CLI never
      run here); a client that drops them gets a marked section in its global instructions file.
- [ ] The extension's first run on a machine where a client was installed after the set-up: it should offer the
      `clients` step (`nuclear-builder setup --clients`).
