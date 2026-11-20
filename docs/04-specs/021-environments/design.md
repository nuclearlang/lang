---
status: approved
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, tasks.md, ../../03-adr/0012-environments.md]
---
# Spec 021: Environments — Design

## Where each part lives
| Part | Project | What |
|---|---|---|
| `env()` collected, contract `env` | `nuclearlang/crates/nuclear-transpile` | a walk over calls named `env` with a literal first argument |
| How `env()` is emitted per dialect | `nuclearlang/dialects/*` (TOML, templates) | backend: the runtime's `env`; web/mobile: the generated values module |
| Files, precedence, dotenv parser, keyring | `tools/cli` (`src/env.rs` or `src/framework/env.rs`) | one resolver used by run, build, test, check and `nuclear env` |
| Runtime loading of `<app>/.env` | `nuclear-synapsis-framework/platforms/backend/packages/synapsis-py`, `synapsis-nest` | at start, never overriding the process |
| MCP tool | `tools/mcp` | `nuclear_env` (list, set, unset, use) |
| Page | `extensions/vscode` (a tool of the Nuclear workspace) | rows × environments, through `nuclear env … --json` only |

## The contract
```json
"env": [
  { "name": "DATABASE", "default": "tasks.sqlite", "required": false, "client": false,
    "uses": [{ "file": "config/project_config.nuc", "line": 5 }] },
  { "name": "TASKS_TOKEN", "required": true, "client": false, "uses": [...] }
]
```

## `nuclear env`
```
nuclear env list [--env <name>] [--json]       # every variable × every environment
nuclear env set <NAME> <value> [--env <name>] [--local] [--secret]
nuclear env unset <NAME> [--env <name>] [--local] [--secret]
nuclear env envs [--json]                      # the environments: from the files, the keyring and the active one
nuclear env use <name>                         # the project's active environment (.nuclear/env)
```
All take `--project <dir>` (default: the project of the current folder). `--env` absent: the shared `.env`
(`set`/`unset`) or the active environment (`list`). `--secret` writes the system's keyring (service
`nuclearlang-env`, account `<project name>-<key>/<environment>/<NAME>`, the key a random one of the project kept in `.nuclear/env-key`, so two projects of one name never share a secret); without a keyring it writes
`.env.<environment>.local` and says so.

`list --json`:
```json
{ "project": "tasks_api", "active": "development", "environments": ["development", "staging", "production"],
  "variables": [
    { "name": "DATABASE", "declared": true, "required": false, "default": "tasks.sqlite", "client": false,
      "uses": [{ "file": "config/project_config.nuc", "line": 5 }],
      "values": { "development": { "value": "tasks.sqlite", "source": ".env" },
                  "production": { "value": "/data/tasks.sqlite", "source": ".env.production" } } },
    { "name": "TASKS_TOKEN", "declared": true, "required": true, "client": false, "uses": [...],
      "values": { "development": { "secret": true, "source": "keyring" }, "production": null } }
  ] }
```
Each variable also has `"shared"`: its value in `.env` itself (`{ "value": "…", "source": ".env" }`, or `null`), the
page's column for the shared file. A secret's value is never printed (`"secret": true`, no `value`). `null`: no value (missing when `required`).
`declared: false`: a variable of a file no code reads.
A value's `source` is the file it comes from, `keyring`, `process` (the variable is in the environment of the
`nuclear` that answers) or `default` (no file gives one: the code's default). `--env <name>` lists that environment
alone. The keys of every object are sorted.

`envs --json`: `{ "active": "development", "environments": ["development", "staging"] }` (`development` first, then
the names of the `.env.<name>` files, the secrets and the active one, sorted).

`set --secret` without `--env` writes the secret of the active environment (a secret belongs to one environment:
its account names it). Which variables are secrets is kept in `.nuclear/secrets.json` (environment → name → `keyring`
or the `.local` file), names only. `NUCLEAR_KEYRING=off` uses the `.local` file on a machine with a keyring too.
Without a value argument `set` reads the value from stdin (all of it, without the last newline).

## Backend
`nuclear run --env X` resolves and passes the variables to the app's process (the runtime's `env()` reads the
process, as today). `nuclear build --env X` writes `<output>/.env` with the resolved non-secret values; the runtime
(`synapsis.config`, `@synapsis/nest` config) loads `.env` of the app's folder at import, without overriding.

## Web and mobile
The CLI writes, before the dialect's build, a values module with only the variables the client code reads
(`client: true` in the contract); `env("NAME", "d")` reads it, so the value is a constant of the build:
- `react`: `src/nuclear_env.ts`: a `values` record and `export function env(name, fallback = '')`.
- `flutter`: `lib/nuclear_env.dart`: a `const Map<String, String>` and `String env(String name, [String fallback])`.
Both are `[project.files]` of the dialect (`names = ["env"]`, so `env` is imported where the code calls it), written
only when the code calls `env`. The CLI gives the build every non-secret value (`Manifest::env`, the process
environment too) and the compiler keeps only the names the code reads. A secret read by a client: N0311, at the
`env()` that reads it. A required variable without a value: N0312 in `check --env` and `build --env` (a warning in a
backend's build: where it runs the real environment gives it); `nuclear run` refuses to start.

## The page (VS Code)
A tool of the Nuclear workspace, **Environments** (key `Ctrl+Alt+E` if free), plain HTML and script like the other
pages, with the floating update button. It runs `nuclear env list --json` per project and `nuclear env set/unset/use`
for every change (never writes a file itself). Badges: required, missing, secret, client, unused; a click on a use
opens the file at the line. Secrets are typed in a masked field and sent to `nuclear env set --secret` on stdin, never
on the command line. *Open file* opens the `.env` file of the column.

## The later phase: simulation
The environment name reaches every command and the page now, so `--simulate` can later start local stand-ins for
the connections an environment names (containers, mocks) with the same values.
