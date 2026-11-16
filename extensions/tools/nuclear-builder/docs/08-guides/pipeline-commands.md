---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [follow-a-run.md, ../02-architecture/engine.md]
---
# The pipeline's commands, locally and on a server

*Pipeline settings* opens `.nuclear/builder.json`, the commands of each stage. The defaults come from the platform's
CLI (`nuclear check`, `nuclear build`, `install`, `test`). Add `seed`, `integration` and `deploy` commands for the
deploy stage:

```json
{
  "commands": {
    "seed": ["nuclear migrate", "python seed.py"],
    "integration": ["nuclear test -- -m integration"],
    "deploy": ["docker compose up -d --build"]
  },
  "branches": ["main", "feature/**"]
}
```

A project's `.nuclear/builder.json` wins over the editor's `nuclear.ai.*` settings for its own pipeline: it is shared
with CI.

## On a server

*Export CI* (or `nuclear-builder export github|gitlab|bitbucket`) writes the same commands as
`.github/workflows/nuclear-builder.yml`, `.gitlab-ci.yml` or `bitbucket-pipelines.yml`.

The agent stages run on your machine; the server checks their result on every push of a feature branch.

```sh
nuclear-builder ci [stage...]     # runs those server stages where you are
```

Run it to see what the server will see before you push.
