---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../00-context/vision.md, ../02-architecture/integrations.md, ../02-architecture/models.md, ../01-product/roadmap.md, ../06-runbooks/run.md, ../../../../docs/03-adr/0004-products-are-made-with-the-tools.md]
---
# The Nuclear Developer

The Nuclear Developer is a team of small local agents (at most 3B parameters, on Ollama) that work as **the junior
developer of a frontier model**. A lead (Claude, another frontier model, or you) makes the decisions: the plan, the
names, the review. The local agents write each piece. What a small model cannot hold in its head comes from the
[Smart Graph](../../../../nuclear-graph-storage/docs/08-guides/README.md); what it writes is checked by the Nuclear
compiler before it answers. Your code stays on your machine, and the lead spends tokens only on leading and
correcting.

**Tools before models.** A product is made with the platform's tools
([ADR-platform-0004](../../../../docs/03-adr/0004-products-are-made-with-the-tools.md)): `nuclear new`, `gen` and
`make` write what is standard, `nuclear fix` applies the compiler's exact fixes, a rename is done by a tool. The
Developer writes only what those leave, and only in Nuclear: it names a platform (`backend`, `mobile`, `web`),
never a dialect, and never writes target code.

## What a task goes through

A task (a spec) is a run of the Builder with the local agents:

1. **Analysis.** Which kind of request it is (a resource, a screen, a rename, a failing test...), which generator
   calls cover it, and what the platform cannot do yet. It asks you when the request lacks a name or a field.
2. **Plan.** The planner splits the spec into pieces, one file each, and says what is beyond the agents (`limits`).
3. **Tests first.** The tester writes the Nuclear tests.
4. **Code.** The coder writes each piece, checks it with `nuclear check` and repairs it with the card of each error
   (at most three attempts), and with the failing tests told in Nuclear (`nuclear explain`).
5. **Verification.** The project is checked and its tests run.
6. **Security.** The security reviewer reads each new file.
7. **Journal.** The documenter writes what was built, how it was checked and what is left. When a stage fails, the
   diagnoser says why (transient, environment, code, test, spec) and what to do next.

Every run is written to `.nuclear/builder/runs/<id>.md` in the project, beside a `.json` with every log whole; a
lead's review is `<id>.review.md`.

## Set it up

The set-up of the AI services installs the Developer with the graph and the models that fit your machine, and
starts it at every login: [Set up the AI services](../../../../installer/docs/08-guides/ai-setup.md).

```sh
nuclear-builder setup            # or the installer's last step, or VS Code: Nuclear: Set Up the AI Services
nuclear-builder setup --status   # what is installed and running
```

It needs:

- **Ollama** with the models of your profile:

  | Profile | Models | Memory |
  |---|---|---|
  | `lite` | `qwen2.5-coder:1.5b` | 8 GB (4 GB at least) |
  | `medium` | `qwen2.5-coder:3b` | 12 GB (8 GB at least) |
  | `hard` | `qwen2.5-coder:3b` + `gemma4:e2b` | 24 GB (16 GB at least) |

  Every profile also downloads `embeddinggemma` for the graph. Details: [the models](../02-architecture/models.md).
- **The Smart Graph** running on `127.0.0.1:7878`, with access for the Developer
  (`nuclear-graph connect nuclear-developer --scopes read,write`).
- **The `nuclear` command** on the `PATH`.

The Developer listens on `127.0.0.1:7879`. By hand, the settings (`CODER_MODEL`, `ASSISTANT_MODEL`, `OLLAMA_URL`,
`CONTEXT_TOKENS`, `NUCLEAR_GRAPH_URL`) and what to do when it fails: [run it](../06-runbooks/run.md).

## Call it

### From a frontier model, over MCP

Claude Code, Codex or Cursor with the MCP server `nuclear-mcp`
([its guide](../../../../tools/mcp/docs/08-guides/mcp.md)):

| MCP tool | When |
|---|---|
| `developer_task(project, title, description, criteria, use_case)` | **first**, for every task that writes `.nuc`: the local agents do the whole task in the project and answer the run's journal. `use_case`: `feature`, `bug`, `refactor`, `test` |
| `developer_retry(project, run, from_stage, from_step, scratch)` | after a failure: from the step that failed (every step that passed is kept), from a stage, from one step, or from scratch |
| `developer_review(project, run, notes, files)` | **last**: what the lead corrected and why; each corrected file becomes an example in the graph, so the junior gets it right next time |
| `developer_code`, `developer_test`, `developer_security` | one `.nuc` file, the tests of a piece of code, or its security findings, outside a task |

The lead's loop is: generators first, `developer_task` for what they leave, validate and correct, then
`developer_review`.

### From the editor and the command line

| Where | How |
|---|---|
| The Builder | VS Code `Ctrl+Alt+P`, Android Studio *Nuclear Builder*, or `nuclear-builder run`; a failed run goes on with *↻ Retry* or `nuclear-builder retry <run>` |
| Nuclear Atlas | VS Code `Ctrl+Alt+A`: a question about the project, or `/task <order>` for a Builder run. The assistant answers; it never changes a file itself |

The Builder and Nuclear Atlas: [the extensions](../../../../extensions/AGENTS.md).

### Over HTTP

Every route is `POST 127.0.0.1:7879/developer/<name>`: `code`, `test`, `security`, `document`, `diagnose`,
`accept`, `chat`, `plan`, `analyze`. The requests and answers:
[integrations](../02-architecture/integrations.md#the-http-api). One file, by hand:

```sh
curl -s -X POST 127.0.0.1:7879/developer/code -H 'content-type: application/json' \
  -d '{"task": "A model NewTask with a title (string, at least 3 characters) and a priority (int, default 2).",
       "path": "components/tasks/domain/models/task_models.nuc", "kind": "model"}'
```

The answer is `{code, report, check, attempts, trace, usage}`: the file, what the compiler said, how many attempts it
took, the steps the agent followed and the tokens its models used.

## How well it does

Measured by the project's evaluation (`eval/run.py`, rounds 22–23; Claude Sonnet answers the same tasks as the
reference): [testing](../05-standards/testing.md#where-it-stands).

| | Local agents | Claude Sonnet |
|---|---|---|
| Tasks of one file and features, all 45 | 43 | 39 |
| Held out (never seen by the graph), 18 | 16 | 17 |
| Features of several files, 3 | 1 or 2, depending on the round | 3 |
| Requests to the analyst, 11 | 10 | — |

Each local answer takes 1.5–10 s on the CPU, a feature 1–1.5 min.

## What it cannot do yet

From [the roadmap](../01-product/roadmap.md):

- It does not choose names, data or architecture: the order gives them.
- Some requests still need a model or your hand because no tool covers them yet: relations in
  `gen resource --source db`, a search of a stored resource, a field added to a resource that exists, tests for a
  backend REST resource, what a screen shows of a use case. The Builder never deletes or moves a file, and a rename
  covers declarations, not fields or methods.
- The security reviewer stops a backend run that changes data with a "missing authorization check" the platform
  cannot express yet.
- A spec in plain words plans worse than one written with the platform's words (`use case`, `repository`...).
- The strategies ran end to end only on a `fastapi` project: never on a mobile or web project, never with
  `nestjs`, never led by Claude.
- When a model enters an answer without end, every call waits: restart the Developer
  ([run it](../06-runbooks/run.md#when-it-fails)).
