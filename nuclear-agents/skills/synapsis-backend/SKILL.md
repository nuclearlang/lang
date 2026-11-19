---
name: synapsis-backend
description: Build a Synapsis backend (fastapi or nestjs dialect) with the tools: new project, components, resources, entities, migrations, run and test. Use when a task creates or changes an HTTP API, a database resource or a use case of a backend written in Nuclear.
title: Synapsis backend
title_es: Backend con Synapsis
description_es: Construir un backend Synapsis (dialecto fastapi o nestjs) con las herramientas: proyecto nuevo, componentes, recursos, entidades, migraciones, ejecutar y probar. Úsalo cuando una tarea crea o cambia una API HTTP, un recurso de base de datos o un caso de uso de un backend escrito en Nuclear.
kind: technology
tags: [backend, api, fastapi, nestjs, rest, entity, migrations, synapsis, server]
---
# Synapsis backend

## When to use

A task touches a project whose `config.nuc` says `synapsis(platform = "backend", ...)`, or asks for a new API. The
same `.nuc` builds with `fastapi` (Python) and `nestjs` (TypeScript): the dialect is one word of `config.nuc`, and
the Nuclear never changes with it.

## Steps

1. **Read first.** `nuclear spec --brief --dialect fastapi` (or `nestjs`), then `nuclear help backend` and
   `nuclear help onboarding-backend`. Look a word up instead of guessing: `nuclear help <word> --dialect fastapi`.
2. **Create the project** (only for a new one): `nuclear new <name> -p backend` (`-d nestjs` for TypeScript;
   `--websocket` adds the app's WebSocket, `--token <ENV_VAR>` its guards). It writes only `.nuc` files:
   `config.nuc`, `config/project_config.nuc` (SQLite by default) and `test/app_test.nuc`.
3. **Inspect.** `nuclear gen inspect` lists the components and every declaration by kind: never declare a name twice.
4. **Generate the resource.** `nuclear gen resource <component> <Name> --fields "id:int title:string done:boolean"`
   writes the entity, `New<Name>`, the repository, one use case per action, the facade's aliases, the controller and
   the tests. The fields can come from `--from-json <file|url>` or `--from-spec <spec.md>`. Add `--dry-run` to see
   the files first.
5. **Make the other pieces** where the platform puts them: `nuclear make <kind> <component> <Name>` with a kind of
   `agent, aggregate, appcomponent, config, controller, entity, listener, model, repository, service, state, tests,
   tools, usecase` (`nuclear help layout --platform backend` shows each folder).
6. **Write only the rules.** A use case with rules of its own is written by hand in Nuclear, then wired:
   `nuclear gen usecase <component> <Name> --route "POST orders/{id}/cancel"`. A use case that only calls a
   repository method is written by the command: `--calls <Repository>.<method>`.
7. **Enable what you use** in `plugins(...)` of `config.nuc` (`sqlite`, `postgres`, `mysql`, `mariadb`, `redis`,
   `kafka`, `events`, `websocket`, `ai`, `openai`, `ollama`, `chroma`, `telemetry`); a kind of a plugin not enabled
   is N0304, with the line to add.
8. **Check**: `nuclear check . --json` must print `[]`; `nuclear fix .` applies the exact fixes.
9. **Build, install, test, run**: `nuclear build`, `nuclear install` (a venv or `npm install`), `nuclear test`,
   `nuclear run` (FastAPI serves its docs at `/docs`).
10. **A database that keeps its data**: `nuclear migrate make "<message>"`, review the file, `nuclear migrate`;
    leave `createTables` out of the connection once the project has migrations (skill `sql-databases`).
11. Update the project's `AGENTS.md`, `docs/` and roadmap in the same change.

## The platform's tools

- Kinds: `entity`, `repository`, `model`, `usecase`, `appcomponent`, `service`, `aggregate`, `controller`,
  `config`, `appConfig`, `listener`, `tools`, `agent`, `state`, `graph`, `tests` (`nuclear help words --dialect fastapi`).
- Errors with a status: `NotFound` (404), `Invalid` (400), `Unauthorized` (401), `Forbidden` (403), `Conflict` (409).
- Guards: `Token(value = env("TOKEN"))`, `NoOrigin()` in `appConfig`, or per controller with
  `@controller("x", guards = [...])`.
- Packages the framework does not bring: `nuclear add <package>[@version]`, `nuclear remove <package>`.
- The build writes `.nuclear/contract.json` and `.nuclear/openapi.json` for the apps (skill `rest-contracts`).
- `nuclear explain` puts a run-time error or a test's output (stdin) on its `.nuc` lines.
- MCP: `project_inspect`, `generate_resource`, `generate_usecase`, `nuclear_check`, `nuclear_project`.
- Examples: `nuclear help example/todos_api`, `example/tasks_api`, `example/rick_api`.

## Pitfalls

- `nuclear test` or `nuclear migrate` before `nuclear install`: the virtual environment is missing
  (`.venv/bin/python: No such file or directory`). Install once after `new`, and after `nuclear add`.
- Calling a repository from a controller, or a use case from another component: N0301/N0302. Go through the
  component's `appcomponent`.
- Editing `build/`: it is rewritten on every build. Change the `.nuc` and build again.
- Writing a resource's CRUD by hand when `gen resource` writes it finished and tested.
- A browser on another origin cannot call the API: the platform has no CORS setting yet (roadmap). Do not patch
  the generated app; record the need.
- No user authentication kind yet (users, sessions, JWT): only header guards. Say so instead of improvising one in
  target code.
- A stored resource gets no `search`: which column is searched is a decision; write the query, then
  `nuclear gen usecase ... --calls`.

## Checklist

- [ ] Every file came from `nuclear new`, `gen` or `make`, or is Nuclear written for a rule no generator knows.
- [ ] `nuclear check . --json` prints `[]`.
- [ ] `nuclear install` ran, and `nuclear test` is green.
- [ ] No file under `build/` was edited; no `.py` or `.ts` was written for a feature.
- [ ] Every plugin used is enabled in `config.nuc`; secrets come from `env(...)`.
- [ ] A schema change has its reviewed migration in `migrations/`.
- [ ] The project's `AGENTS.md`, `docs/` and roadmap say what changed.
