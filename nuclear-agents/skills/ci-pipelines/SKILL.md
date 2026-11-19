---
name: ci-pipelines
description: Set up continuous integration for a Nuclear project with nuclear-builder export github, gitlab or bitbucket and nuclear-builder ci check, test, security and artifacts, with nuclear check and nuclear fmt --check as gates. Use when a project needs CI, a pipeline fails, or a stage must be added.
title: CI pipelines
title_es: Pipelines de CI
description_es: Montar integración continua en un proyecto Nuclear con nuclear-builder export github, gitlab o bitbucket y nuclear-builder ci check, test, security y artifacts, con nuclear check y nuclear fmt --check como puertas. Úsalo cuando un proyecto necesita CI, falla un pipeline o hay que añadir una etapa.
kind: technology
tags: [ci, pipeline, github actions, gitlab, bitbucket, continuous integration, nuclear-builder, checks]
---
# CI pipelines

## When to use

A project needs a server that checks every push, a pipeline fails, or a stage (formatting, an audit, a deploy) must
be added. The CI file is written by the tools from the project's line, `.nuclear/builder.json`; it is never written
by hand. Read `nuclear help builder-commands`.

## Steps

1. **See the line**: `nuclear-builder line show`. The defaults come from the platform: `check`
   (`nuclear check . --json`), `build` (`nuclear build`, plus `nuclear install` on backend and web), `test`
   (`nuclear test`), `security` (empty: the check runs again), `artifacts` (`nuclear build`; `nuclear build web` on
   mobile), `seed`, `integration`, `deploy` (empty).
2. **Run it locally first**: `nuclear-builder ci check test security` runs those stages where you are, exactly as
   the server will.
3. **Add what the project needs** with `nuclear-builder line set KEY=<json>`; `commands` is merged with the
   defaults:
   `nuclear-builder line set 'commands={"security":["nuclear check . --json","nuclear fmt --check ."]}'`.
   `branches` picks the branches the CI runs on (default `main` and `feature/**`).
4. **Export the CI file**: `nuclear-builder export github` (`.github/workflows/nuclear-builder.yml`),
   `nuclear-builder export gitlab` (`.gitlab-ci.yml`) or `nuclear-builder export bitbucket`
   (`bitbucket-pipelines.yml`). Each job installs NuclearLang and runs the stage's commands; `artifacts` uploads
   `build/`. Export again after every change of the line.
5. **Read the file** before committing it, and commit it with `.nuclear/builder.json`.
6. **When a stage fails**, run the same stage locally (`nuclear-builder ci test`), fix the `.nuc`, never the CI file.
7. **Several projects in one repository** (a backend and its apps): run the line in each project folder; an app
   with `contracts(name = "../backend")` regenerates its client at build, so the backend's change and the app's
   build fail together, as intended.

## The stages and their order

| Stage | Runs (defaults) | Fails when |
|---|---|---|
| `check` | `nuclear check . --json` | any compiler or architecture error |
| `test` | the `build` commands, then `nuclear test` | a build or a test fails |
| `security` | the `security` commands, else the check again | a command exits non-zero |
| `artifacts` | `nuclear build` (mobile: `nuclear build web`), uploads `build/` | the build fails |
| `deploy` | `seed`, `integration`, `deploy` commands | any of them fails |

## The platform's tools

- `nuclear check . --json`: exit 1 with the errors as JSON; `[]` and exit 0 when clean.
- `nuclear fmt --check .`: lists the files that would change, exit 1; `nuclear fmt .` rewrites them.
- `nuclear test`, `nuclear build`, `nuclear install`; `nuclear migrate` as a `seed` command for a database.
- `nuclear-builder ci [check|test|security|artifacts|deploy ...]`, `nuclear-builder export github|gitlab|bitbucket`,
  `nuclear-builder line show | set KEY=<json>`.
- Seed, integration and deploy commands run in the `deploy` stage, in that order:
  `{"seed": ["nuclear migrate"], "integration": ["nuclear test -- -m integration"], "deploy": [...]}`.

## Pitfalls

- Editing the exported YAML by hand: the next export overwrites it. Change the line, export again.
- The default `security` stage only re-runs the check: the platform has no dependency audit. Add the target's audit
  tool as a `security` command run inside `build/` (it names a dialect's tool, so say so in the project's docs), or
  record the gap.
- `nuclear fmt --check` is not in the defaults: add it, or formatting drifts.
- A mobile project's stages need Flutter on the runner; confirm the exported file provides it before relying on it.
- Secrets for `deploy` belong in the CI service's secret store, read as environment variables; never in
  `.nuclear/builder.json`, which is committed.
- The agent stations of the software factory run on your machine; the server only checks their result.

## Checklist

- [ ] `.nuclear/builder.json` holds the project's commands and is committed.
- [ ] `nuclear-builder ci check test security` passes locally.
- [ ] The CI file was produced by `nuclear-builder export ...` after the last change of the line.
- [ ] The pipeline runs `nuclear check . --json`, `nuclear fmt --check .` and `nuclear test`.
- [ ] No secret appears in the line or the CI file.
- [ ] The project's docs say how its CI runs and what each stage does.
