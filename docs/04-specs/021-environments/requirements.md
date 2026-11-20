---
status: approved
priority: high
owner: Julian Molina
updated: 2026-11-20
related: [design.md, tasks.md, ../../03-adr/0012-environments.md]
---
# Spec 021: Environments — Requirements

**Priority: high** (the user, 2026-11-20). A project of every platform (backend, web, mobile) reads its settings
from named environments (`development`, `staging`, `production`, any name), as `dotenv` does in Node.js and
`flutter_dotenv` in Flutter, with nothing to learn: `env("NAME", "default")` in Nuclear, `.env` files beside
`config.nuc`, secrets in the system's keyring, and a page of the editor that edits them without opening a file.

## Decisions of the user (2026-11-20)
1. The code declares what it needs **implicitly**: every `env("NAME")` / `env("NAME", "default")` the compiler
   sees is a variable of the project (required when it has no default). No new syntax.
2. Values live in **files and the keyring**: `.env`, `.env.<environment>`, and their `.local` versions (ignored by
   git) in the project; a secret in the system's keyring.
3. **Web and mobile use `env()` too**, resolved when the app is built for an environment; a secret never reaches a
   client build.
4. The environments are ready for a later step: **simulating an environment on this machine** (its services and
   connections started locally), so the environment is a first-class name in every command and in the editor.

## Requirements
1. `env("NAME", "default")` works in every platform and dialect; `env("NAME")` is required.
2. The compiler lists every variable of a project in `.nuclear/contract.json` (`env`): its name, its default, where
   it is used (file and line), and whether a client reads it. A name that is not a string literal is a diagnostic.
3. Files of a project, by precedence (lowest first): `.env` < `.env.<environment>` < `.env.local` <
   `.env.<environment>.local` < the keyring's secrets < the real process environment. `.env.local` is not read in
   the environment `test` (tests are the same on every machine); `testEnv(...)` of `config.nuc` wins in tests.
4. The format is dotenv's: `NAME=value`, `export NAME=value`, `#` comments, single quotes (literal), double quotes
   (escapes `\n`, `\"`, multi-line), `${OTHER}` expansion.
5. The environment of a command: `--env <name>` on `nuclear run`, `build`, `test`, `check`; else `NUCLEAR_ENV`; else
   the project's active one (`nuclear env use <name>`); else `development` (`test` for `nuclear test`).
6. `nuclear run` refuses to start when a required variable has no value, and lists each with where it is used.
   `nuclear check --env <name>` reports the same as a diagnostic.
7. A backend reads its variables at run time: `nuclear run` passes them to the process; a build for an environment
   writes the non-secret values into the app's `.env`, which the Synapsis runtime loads at start without replacing
   a variable the process already has (production sets secrets in the real environment).
8. A web or mobile app gets the values its code reads when it is built (no file read at run time, no lookup cost);
   a variable stored as a secret read by a client is a build error.
9. `nuclear env` manages them without opening a file: list (with `--json`), set, unset, secret, the environments,
   the active one. An agent does it through the MCP server.
10. The editor has an **Environments** page: per project, the variables (from the code and from the files) as rows
    and the environments as columns; edit a value, mark it secret (keyring), add an environment, pick the active
    one, see required variables without a value and variables no code reads, jump to where a variable is used;
    open a file only when the user asks.
11. `nuclear new` writes a `.env` with the defaults the generated code uses and the `.gitignore` lines for
    `.env*.local`.
12. Nothing changes for a project that has no `.env` file: `env()` keeps reading the process environment.

## Out of scope (later phase, kept in mind by the design)
- Simulating an environment locally (`nuclear run --env staging --simulate`: local stand-ins for its connections).
- Synchronizing secrets with a cloud secret manager.
