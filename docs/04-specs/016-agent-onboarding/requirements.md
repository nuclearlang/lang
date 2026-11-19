---
status: in-progress
owner: Julian Molina
updated: 2026-11-18
related: [design.md, tasks.md, ../../03-adr/0004-products-are-made-with-the-tools.md, ../../../tools/mcp/AGENTS.md]
---
# Spec 016: An agent learns Nuclear from the MCP server alone — Requirements

## Goal

An agent with no context at all can make any product with Nuclear on a machine where the ecosystem was just
installed, knowing only that the `nuclear` MCP server exists. It never needs the source tree, its `.md` files or a
`grep`: the MCP server (and, behind it, the Smart Graph and the installed binary) gives it, organized and in order,
what Nuclear is, every rule of the syntax, the architecture of Synapsis, every tool and when to use it, and how a
project documents itself (root rule 14).

## The one use case of this spec

1. A new machine (Linux, macOS or Windows). The user installs the Nuclear ecosystem with the installer.
2. The user opens VS Code for the first time and installs the Nuclear extension.
3. In VS Code's chat or in a terminal, the user asks an agent (OpenCode, Codex, Gemini CLI, Claude Code, or any
   agent with MCP) to build whatever they want with Nuclear.

Other use cases (an agent without MCP, an existing project, a CI agent) are not evaluated here.

## The run that shows the gap (2026-11-18)

OpenCode, no context, asked for a visual Flutter proof of concept of a PDF:

1. The server's instructions said "call `graph_strategy` first" and listed tools; nothing said where to *learn*
   Nuclear. The agent learned it from `nuclear --help`, `nuclear spec --brief` and `nuclear help <word>`.
2. `nuclear spec --platform mobile` printed 280 KB (the base, dialect and platform documents joined), full of
   relative links (`../../../../../nuclear-synapsis-framework/...`) that only resolve inside the source tree. The
   agent found the tree with `grep` and read the references and the examples: the examples were its best source.
3. `nuclear help project`, `nuclear help shell`, `nuclear help assets`: not documented.
4. `graph_strategy` answered `strategy:system` (components, repositories) for a visual-only prototype.
5. Rules it learned from compiler errors were not in the sheet it read: `if` as an expression inside an argument
   list, a multi-line lambda as a named argument, a field initialized with a constructor needs its type.
6. `developer_task` failed (the local developer was not running) with a bare "Error executing tool".
7. The new project got an `AGENTS.md` section that names the `nuclear` command but not the MCP server, and no
   context documents of its own.

## Requirements

1. **One entry point.** The MCP server has a tool, `nuclear_start`, that a client with no context calls first.
   Its answer, in a few thousand tokens: what Nuclear and Synapsis are and why, the rules never broken, the
   platforms and dialects, the work cycle on this machine (local agents or remote only), how a project documents
   itself, and **the atlas**.
2. **The server's instructions point to it.** Their first sentence: nothing about Nuclear is in your training;
   before anything about Nuclear call `nuclear_start`. The long rules live in what the tools answer.
3. **The atlas.** An index of everything an agent may need, by group, each topic with one line and the call that
   reads it: the language, the standard library, each platform, each dialect, Synapsis, the tools (CLI commands,
   MCP tools, generators, the editor extension, Nuclear Builder, Atlas, Chat, the devices), the Smart Graph, the
   installer and its services, the context documents of a project, the diagnostics, the validated examples.
4. **Every topic is reachable whole and self-contained.** `nuclear_doc(topic)` returns one topic. No text an agent
   reads through the binary or the MCP server has a link that only resolves in the source tree: links name topics.
   A platform's documents are separate topics, never joined into one answer.
5. **Remote-only machines get the same knowledge.** The atlas and the topics come from the installed `nuclear`
   (embedded, or from the installation's documents); the Smart Graph adds search, strategies and examples.
6. **The sheet covers what failed.** Every rule an agent learned from a compiler error in the measured run is in
   the brief of its language, dialect or platform; `nuclear help` answers `project`, `shell` and `assets`.
7. **The strategy fits the request.** `graph_strategy` has a plan for a visual-only prototype (screens and mock
   data, no components or repositories); its plans name the atlas topics to read.
8. **A failing tool says why and what to do.** `developer_task` with the local developer down answers that it is
   not running, how to start it, and that the agent writes the code itself meanwhile.
9. **A new project documents itself by default.** `nuclear new` writes the standard context documents
   (`AGENTS.md`, `CLAUDE.md`, `docs/` in layers, specs in `docs/04-specs/`), filled with what it knows of the
   project (stack, commands, folders, the Synapsis architecture of its platform). They belong to the user: the
   project's `docs/README.md` is the rule its agents follow, and the user may change or extend it. `nuclear agent
   init` refreshes only the marked Nuclear section of `AGENTS.md`, never the user's documents. The language's
   reference is not copied: it comes from the MCP server, always of the installed version.
10. **The standard is taught.** The context-documents standard is an atlas topic (`context-docs`): how each file of
    `docs/` is written and organized, the frontmatter, the flow of a spec, ADRs, the roadmap.
11. **The client is ready with no step of its own.** The installer and the extension's first run register the MCP
    server in every client found (Claude Code, Codex, Cursor, OpenCode, Gemini CLI). A client is given a global
    instruction only when it is measured to drop the MCP server's instructions.
12. **Nothing installed names this tree or one machine.** A test of the release fails when an installed or
    generated file names a path of the source tree or of a user's home.
13. **Measured.** An evaluation repeats the measured run: a fresh agent in a clean container (the release
    installed, no source tree), the PDF prototype. It passes when the agent calls `nuclear_start` first, reads
    nothing outside the project and the MCP server, and `nuclear check` is clean; the compiler errors on the way are
    counted.

## Out of scope

- Teaching the target languages: Nuclear's documents only say what changes.
- Language features found missing by the run: they go to `nuclearlang/docs/01-product/roadmap.md`.
