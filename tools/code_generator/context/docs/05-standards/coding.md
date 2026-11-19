---
status: draft
owner: TODO(user): who owns this document
updated: {{date}}
related: []
---
# Code conventions

## NuclearLang

- The syntax and the rules: `nuclear spec --brief --dialect {{dialect}}` (MCP `nuclear_brief`), `nuclear help atlas`.
- Names: `PascalCase` for types and constructors, `camelCase` for the rest, files in `snake_case`.
- Every piece is made with its generator (`nuclear make`, `nuclear gen`) where the platform puts it.
- Only Nuclear's standard library on strings, lists and maps (`nuclear help library`).
- `nuclear check --json` prints `[]` and `nuclear fmt .` leaves nothing to change before a change is done.

## Project conventions

- Error handling: TODO(user)
- Logs: TODO(user): what is logged and what never is

## Git

- Branches: TODO(user)
- Commits: TODO(user): e.g. Conventional Commits
- Pull requests name their spec (`04-specs/NNN-...`)
