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

## The software factory's line

`nuclear-builder run` (in a terminal, a CI job or the JetBrains window) runs the software factory: the spec through
Analysis, Design, Tests first, Code, Quality and Delivery, each station worked by a member of its role in your team (the one `--assign` names, else the role's first)
(`nuclear-builder team list`). The same `.nuclear/builder.json` holds the rest of the line:

```json
{
  "team": "night-shift",
  "gates": ["analysis", "design", "delivery"],
  "stations": ["analysis", "design", "tests", "code", "quality", "delivery"],
  "forceConfirm": false,
  "prices": { "openai/<model>": [1.25, 10] }
}
```

- A gate stops the run for you: approve, ask for a change, or stop; `nuclear-builder run --resume <id>` asks again.
- Paid providers (an agent's command line, an API model) are confirmed twice before the first call, or in advance
  with `--confirm-spending`, which `"forceConfirm": true` refuses. The team's budget (5 USD by default) holds for
  the whole run.
- QA's plan is the run's checks: `nuclear-builder checks <id>` lists them; `add --title … --station …`, `on`/`off`
  and `mark <check> passed|failed` change them.
- DevOps, at the Delivery station, opens the pull request only when you approve it, from the branch `factory/<id>`, with your git identity.
