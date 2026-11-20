---
status: in-progress
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, design.md]
---
# Spec 021: Environments — Tasks

## Phase 1: environments that work (0.82.0)
- [ ] ADR-platform-0012 (the decisions of the user).
- [ ] Compiler: `env` of the contract; a diagnostic for a name that is not a literal; a diagnostic for a secret
      read by a client (both in diagnostics.md).
- [ ] CLI: the dotenv parser, the precedence, the keyring, `--env`/`NUCLEAR_ENV`/active, `nuclear env`, run refuses
      missing required, build writes `.env` (backend) or the values module (web, mobile), check reports.
- [ ] Dialects: `env()` in react and flutter; fastapi and nestjs keep the runtime's.
- [ ] Runtimes: synapsis-py and synapsis-nest load the app's `.env` without overriding.
- [ ] `nuclear new`: `.env` and the `.gitignore` lines.
- [ ] MCP: `nuclear_env`.
- [ ] VS Code: the Environments page.
- [ ] References, guides, skill, knowledge base; release.

## Phase 2: simulation (later)
- [ ] `nuclear run --env <name> --simulate`.
