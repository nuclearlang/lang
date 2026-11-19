---
status: in-progress
owner: Julian Molina
updated: 2026-11-18
related: [requirements.md, tasks.md]
---
# Spec 016: An agent learns Nuclear from the MCP server alone — Design

## The topics of the binary are the one source

`nuclear help <topic>` already reads two sets: the language's documents embedded in the binary (`TOPICS`,
`tools/cli/src/main.rs`) and the reference and guide documents of the installation found at run time
(`platform_topics`: the framework's, each platform's, each dialect's `docs/07-reference` and `docs/08-guides`, which
the release stages). This spec builds on both:

- **Groups.** Each topic gets a group (`start`, `language`, `library`, `platform`, `dialect`, `framework`, `tools`,
  `project`, `examples`); `nuclear help atlas [--json]` prints them by group with one line each. A found document
  takes its group from where it lives.
- **New topics**: `start` (the onboarding text), `context-docs` (the standard), the tools documents (each tool's own
  `docs/08-guides/` file for its users, staged by the release), `examples/<platform>` (the examples the CI builds).
- **Links are resolved when a topic is printed.** A link to another topic's document becomes `` `nuclear help
  <topic>` ``; any other relative link keeps its text and loses its target. A test prints every topic and fails on
  a relative link left.
- `nuclear spec --platform <p>` prints the platform's brief and the atlas lines of that platform instead of 280 KB.

## The MCP server

- `nuclear_start(project = "")`: `nuclear help start` + the atlas + the work cycle of this machine's mode; with a
  project folder, its platform, dialect and the brief of that dialect.
- `nuclear_doc(topic)`: `nuclear help <topic>`.
- `nuclear_brief`, `nuclear_help` stay; `nuclear_start` names them.
- Instructions: first sentence → `nuclear_start`; today's work cycle moves into `nuclear_start`'s answer.

## The project's context documents

`nuclear new` writes, through the code generator's templates (data, `tools/code_generator/context/`): `AGENTS.md`
(with the marked Nuclear section that names the MCP server and `nuclear_start`), `CLAUDE.md`, `docs/README.md`
(the project's own rules: it wins over the default), `docs/00-context/vision.md`, `docs/02-architecture/overview.md`
(the platform's Synapsis layers with this project's folders), `docs/01-product/roadmap.md`, `docs/03-adr/README.md`,
`docs/04-specs/README.md` and `docs/04-specs/_template/`. Only layers with something to say: what the generator
cannot know is a `TODO(user):` line, never an invented fact. A file that exists is kept.

## The clients

The extension's first run (its onboarding) and the AI set-up register the MCP server in each client found, with
the code the extension's *Settings and integrations* already has (Claude Code, Codex, Cursor, OpenCode), plus Gemini
CLI (`~/.gemini/settings.json`, `mcpServers`). Whether each client hands the server's instructions to its model is
measured; only a client that drops them gets a marked section in its global instructions file.

## The evaluation

The clean-machine container of the installer (`installer/release/clean-machine/`, never `--privileged`) with the
release installed and an agent CLI; the measured run's prompt. The transcript is checked for the first tool call,
any read outside the project, and the last `nuclear check`.
