---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [tools/cli/src/agent.rs, tools/cli/agent-files/, tools/cli/docs/03-adr/0002-agents-learn-nuclear-from-a-brief-a-skill-and-the-compiler.md]
---
# What a project and a machine get for AI agents

Why it is built this way: [ADR-cli-0002](../03-adr/0002-agents-learn-nuclear-from-a-brief-a-skill-and-the-compiler.md).

## The pieces

| Piece | Where | Who puts it there |
|---|---|---|
| The brief: the short sheet of what changes from TypeScript / Dart / Python | `docs/07-reference/brief/` of the language, of each language dialect and of each platform | Written by hand; printed by `nuclear spec --brief` ([nuclear-command.md](nuclear-command.md)) |
| The `nuclear` skill | `tools/cli/agent-files/skills/nuclear/SKILL.md` → `~/.claude/skills`, `~/.agents/skills`, `~/.codex/skills` | [The installers](../../../../installer/AGENTS.md) (`--no-agent` skips it); the installation keeps it in `agents/skills/` |
| The project's `AGENTS.md` section and the Cursor rule | `tools/cli/agent-files/project/AGENTS.md`, `nuclear.mdc`, embedded in the binary | `nuclear agent init` |
| The check hook | `.claude/settings.json` of the project | `nuclear agent init`; it runs `nuclear agent hook` |

The skill does not copy the brief: it asks the installed binary for it, so it is never out of date.

The skill, the project section and the Cursor rule all say that a product is made with the tools (`gen`, `make`,
the MCP server, `add`), never by writing target code or translating native code by hand
([ADR-platform-0004](../../../../docs/03-adr/0004-products-are-made-with-the-tools.md)).

## `nuclear agent init [--dialect <d>]` (`agent::init`)

Run in a project folder; `nuclear agent init` and every `nuclear new` call it. Inside a project of the framework
(`framework::agent_init`) it runs in the same process: starting `nuclear agent init` again there would be claimed by
the framework again, a loop. It writes four things and keeps
everything else of the project's files:

1. **`AGENTS.md`**: the NuclearLang section between the markers `<!-- nuclearlang -->` and `<!-- /nuclearlang -->`.
   A file that has the markers gets the section replaced; one without them gets it appended; a missing one is
   created.
2. **`CLAUDE.md`**: `@AGENTS.md`, added once.
3. **`.cursor/rules/nuclear.mdc`**: the Cursor rule for `*.nuc`.
4. **`.claude/settings.json`**: a `PostToolUse` hook with the matcher `Edit|Write|MultiEdit` and the command
   `nuclear agent hook`, added once; the other hooks and settings stay.

The dialect: `--dialect`, else the one of `nuclear.toml`, else the one `config.nuc` names, else (a `main.nuc` alone,
or a `config.nuc` without the `synapsis(...)` line) the mobile platform's default dialect; with none of them it asks
for `--dialect`.

The templates have five placeholders:

| Placeholder | Filled with |
|---|---|
| `{dialect}` | the dialect |
| `{check}` | `nuclear check --json` (a project with `config.nuc` or `main.nuc`), `nuclear check . --json` (a `nuclear.toml`), else `nuclear check <file>.nuc --dialect <d> --json` |
| `{synapsis}` | in a Synapsis project: create each piece with `nuclear make`, then `nuclear analyze` and `nuclear test` |
| `{packages}` | in a Synapsis project: a missing library is `nuclear add <package>`, never installed by hand in `build/` |
| `{generated}` | what is never edited: `build/` (and, outside Synapsis, the `.ts` / `.dart` / `.py` built from the `.nuc`) |

Running it twice changes nothing (test `init_keeps_the_project_files_and_runs_twice`).

## `nuclear agent hook` (`agent::hook`)

Claude Code runs it after each edit and gives it the tool call on stdin. When the edited file ends in `.nuc`:

- the file's project is found (`Manifest::find` over every dialect) and built with its own type definitions
  (`project::with_project_defs`: `<project>/defs`), so architecture rules count too; a file outside a project is
  checked alone;
- each error is one line, `path:line:col CODE message [fix: replace "…" with "…"]`, without source excerpts, at
  most 20 lines, on stderr with exit code 2, which Claude Code gives back to the agent in the same turn.

No error, or a file that is not `.nuc`: exit 0 and no output.

## The MCP server

The files above tell an agent to use the shell commands. The tools an MCP client gets, and the rule that every
project created with Nuclear also gets their documentation, are [the MCP server's](../../../mcp/AGENTS.md).
