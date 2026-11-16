---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [evaluation.md, ../02-architecture/models.md, ../02-architecture/integrations.md]
---
# Run it

## With the set-up

The set-up of the AI services installs the Developer, with the Smart Graph and the models that fit the machine, and
starts it at every login ([Set up the AI services](../../../../installer/docs/08-guides/ai-setup.md)):

```sh
nuclear-loop setup            # or the installer's last step, or VS Code: Nuclear: Set Up the AI Services
nuclear-loop setup --status   # what is installed and running
```

From the working tree, `installer/install.sh --ai` installs the platform and then runs the same set-up: the
services are then this tree's own folders (the graph installed editable, the Developer built in place).

The set-up writes the models of the chosen profile in `~/.config/nuclearlang/ai.env`, and the `nuclear-developer`
command starts with them unless its caller gives others (the editor's *Settings and integrations* page does, with
the models chosen there). State and restart of the service on each system: the set-up's guide.

## By hand

In this folder (what the set-up does):

```sh
ollama pull qwen2.5-coder:3b && ollama pull gemma4:e2b
nuclear-graph serve &                                   # the Smart Graph
nuclear-graph connect nuclear-developer --scopes read,write
dragonfly install                                       # build/ from the .nuc files, and its environment
cd build && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 7879
```

The graph: [install, serve and ask](../../../../nuclear-graph-storage/docs/06-runbooks/install-and-serve.md).

## Try it

```sh
curl -s -X POST 127.0.0.1:7879/developer/code -H 'content-type: application/json' \
  -d '{"task": "A model NewTask with a title (string, at least 3 characters) and a priority (int, default 2).",
       "path": "components/tasks/domain/models/task_models.nuc", "kind": "model"}'
```

Every route: [integrations](../02-architecture/integrations.md#the-http-api).

## Settings

| Variable | Default | What |
|---|---|---|
| `CODER_MODEL` | `qwen2.5-coder:3b` | the model that writes code and tests |
| `ASSISTANT_MODEL` | `gemma4:e2b` | the model that plans, reviews, analyses and answers |
| `OLLAMA_URL` | `http://localhost:11434` | where Ollama listens |
| `CONTEXT_TOKENS` | `8192` | the context window of each model; the editor passes its `nuclear.ai.contextTokens` |
| `NUCLEAR_GRAPH_URL` | `http://127.0.0.1:7878` | where the graph listens |

Which models fit which machine: [the profiles](../02-architecture/models.md#the-models-a-profile-for-the-machine).

## After a change

```sh
nuclear check . && nuclear build .     # then restart the Developer
```

Never edit `build/`: change the `.nuc` files. The checks of the project: [testing](../05-standards/testing.md). A
change to an agent is measured: [evaluation.md](evaluation.md).

## When it fails

| What is seen | What to do |
|---|---|
| a caller says `the local developer is not running at ...` | `nuclear-loop setup --status` says what is missing; restart the service, or start it by hand as above |
| `'nuclear-developer' has no access to the Nuclear Smart Graph` | `nuclear-graph connect nuclear-developer --scopes read,write`, with the graph running |
| a call is answered 408, 425, 429 or 5xx, or the Developer is busy | a passing reason: the caller retries it with backoff (5 tries, 1–30 s by default) |
| every call waits and none answers | a model entered an answer without end: it holds the Developer and every call after it until the process is killed. Restart the Developer |
| a run of the Loop stops at a stage | the diagnoser says the kind of failure (transient, environment, code, test, spec), the evidence and the next step; the run goes on from the step that failed with a retry |
