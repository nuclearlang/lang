---
status: in-progress
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, design.md]
---
# Spec 021: Environments — Tasks

## Phase 1: environments that work (0.82.0)
- [x] ADR-platform-0012 (the decisions of the user).
- [x] Compiler: `env` of the contract; a diagnostic for a name that is not a literal; a diagnostic for a secret
      read by a client (both in diagnostics.md).
- [x] CLI: the dotenv parser, the precedence, the keyring, `--env`/`NUCLEAR_ENV`/active, `nuclear env`, run refuses
      missing required, build writes `.env` (backend) or the values module (web, mobile), check reports.
- [x] Dialects: `env()` in react and flutter; fastapi and nestjs keep the runtime's.
- [x] Runtimes: synapsis-py and synapsis-nest load the app's `.env` without overriding.
- [x] `nuclear new`: `.env` and the `.gitignore` lines.
- [x] MCP: `nuclear_env`.
- [x] VS Code: the Environments page (`extensions/tools/nuclear-environments`, `Ctrl+Alt+Y`).
- [ ] References, guides, skill, knowledge base; release. (Written: the platform references and briefs, the
      dialect references, projects.md, diagnostics.md, the CLI's guide and commands, the framework's guide, the
      skill, the MCP guide, the CHANGELOGs. Left: the knowledge base, the MCP server reinstalled, the install, the
      release.)
- [ ] The installed runtimes (synapsis-py, synapsis-nest) carry `.env` loading only after `installer/install.sh`.
- [x] The keyring's account carries a key of the project (`.nuclear/env-key`): two projects of one name never share
      a secret.
- [x] The tutorial's section on environments.
- [ ] The website's pages on environments (the website is a Nuclear project of its own: `website/`).

## Phase 2: simulation (later)
- [ ] `nuclear run --env <name> --simulate`.
