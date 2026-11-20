---
status: accepted
date: 2026-11-20
deciders: Julian Molina
---
# ADR-platform-0012: Environments are declared by `env()`, valued by dotenv files and the keyring

## Context and problem
A project read `env("NAME", "default")` only in a backend, from the process; there were no named environments, no
list of what a project needs, no secrets, nothing for web or mobile.

## Decision (the user, 2026-11-20)
- The code declares its variables implicitly: each `env("NAME"[, default])` the compiler sees, listed in the contract.
- Values are dotenv files of the project (`.env`, `.env.<environment>`, their `.local` versions ignored by git) and
  secrets in the system's keyring; the real process environment wins over all.
- Web and mobile resolve `env()` when they are built for an environment; a secret never reaches a client.
- The environment is a first-class name in every command and in the editor, so a later step can simulate an
  environment on this machine.

## Consequences
No new syntax. One resolver in the CLI serves run, build, test, check, `nuclear env`, the MCP server and the editor.
A client build carries only the values its code reads. Spec 021 holds the design.
