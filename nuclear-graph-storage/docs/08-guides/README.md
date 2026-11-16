---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../00-context/vision.md, ../02-architecture/shelves.md, ../02-architecture/integrations.md, ../06-runbooks/install-and-serve.md, ../06-runbooks/update-the-knowledge-base.md, ../../../installer/docs/08-guides/ai-setup.md]
---
# The Smart Graph

The Nuclear Smart Graph is the library of everything NuclearLang and Synapsis are, kept on your machine. An agent
that writes Nuclear asks it instead of guessing: what a kind means, how a task is done step by step, which tool
does it, what an error means and how it is fixed, what the platform cannot do yet.

- **Private and local.** It runs on `127.0.0.1:7878` for one user of the machine. The cards are encrypted at rest,
  every route but the health check needs a token, and no program reads it until you allow that program.
- **Cards, not copied pages.** Each row is a card that answers one question, on the shelf of its kind of question,
  linked to the cards it has to do with.
- **Exact when the question has one answer.** "Every tool of the MCP server" gives every tool, the same on every
  run: those questions are answered from a database of facts, not by a search by meaning. No model is asked.

Why it exists and what it is not: [the vision](../00-context/vision.md).

## Set it up

The set-up of the AI services installs the graph, loads its knowledge base and starts it at every login:
[Set up the AI services](../../../installer/docs/08-guides/ai-setup.md). By hand, and every setting:
[install, serve and ask](../06-runbooks/install-and-serve.md).

Check that it runs:

```sh
$ curl -s 127.0.0.1:7878/v1/health
{"status":"ok","version":"0.2.0"}
```

## What it holds

| Shelf | The question it answers | Its rows |
|---|---|---|
| `concepts` | What is it, why does it exist? | the purpose, the advantages, the theory, the questions people ask |
| `language` | How is it written in Nuclear? | the guide and the rules; the members of each base type |
| `platforms` | What does a platform have, and where does each thing go? | every kind, decorator and plugin of `backend`, `mobile` and `web` |
| `tools` | What can run, and how is it called? | each command of `nuclear`, `nuclear-builder` and `nuclear-graph`, each MCP tool, each HTTP route, the generators |
| `errors` | What went wrong, and how is it fixed? | each diagnostic of the compiler, the failures of the tools, the mistakes small models repeat |
| `capabilities` | Can it be done? | what can be done, what cannot yet, the limits |
| `playbooks` | How is this task done, step by step? | the strategy of each kind of request, the procedure of each use case |
| `examples` | What does the code look like? | the `.nuc` files of the example projects; solved tasks |
| `docs` | What does the full document say? | the long form: dialects, decisions, guides |
| `queries` | Which, how many, what are? | the questions with one right answer and the query that answers each |

Every card has an id `<prefix>:<name>` (`error:N0114`, `kind:backend.usecase`, `playbook:add-a-screen`), so one
can be fetched without a search. The shelves in full: [shelves](../02-architecture/shelves.md); the words:
[glossary](../00-context/glossary.md).

`nuclear-graph stats` shows how many rows each shelf holds and the revision of the base:

```sh
$ nuclear-graph stats
{
  "collections": {
    "concepts": 288,
    "language": 239,
    "platforms": 257,
    "tools": 235,
    "errors": 147,
    "capabilities": 119,
    "playbooks": 352,
    "examples": 229,
    "docs": 2231,
    "queries": 303,
    "prompts": 22,
    "memory": 0
  },
  "knowledge": {
    "schema": 1,
    "revision": 67
  },
  "client": "owner"
}
```

`prompts` (the prompt files the models read) and `memory` (what an agent keeps about a project) are not part of
the base.

## Ask it

### From a terminal

| Command | What it gives |
|---|---|
| `nuclear-graph answer "<question>" [-p <platform>] [--history "you: ..."]` | what the graph gives for a question before a model answers it: the exact facts, then the cards |
| `nuclear-graph search "<query>" [-c <shelf>] [-k 5] [-p <platform>] [--agents] [--full]` | the cards that answer a query, by meaning and by exact name |
| `nuclear-graph card <id>` | one card by its id, with the cards it links to |
| `nuclear-graph strategy "<request>" [-p <platform>] [--full]` | which kind of request a text is; `--full` adds its plan |

A question with one right answer gets its exact rows:

```sh
$ nuclear-graph answer "what are the tools of the MCP server"
── exact: query:mcp.tools () · 27 rows · 0 of its names are in the question; 0.1721 from it by meaning
...
### Exact: every tool of the Nuclear MCP server: 27 rows
columns: group | tool | what it does | command it runs
- api | api_inspect | Fetches a public API's url and answers the shape of its JSON (keys, types, nested objects, a paged answer). |
...
```

A question about how to do something gets the cards that answer it:

```sh
$ nuclear-graph answer "how do I create a screen"
── card: playbooks  playbook:add-a-screen
── card: tools  mcp:generate_screen
── card: platforms  decorator:mobile.screen
── card: platforms  decorator:web.screen
```

Then read one of them whole:

```sh
$ nuclear-graph card playbook:add-a-screen
[playbooks/playbook] Playbook: add a screen (mobile and web)

A screen is three files in `presentation/<screen>/`: the state model (its states), the state manager (methods
that emit them) and the view with `@screen(route, providers)`. `nuclear gen resource --screen` writes a
resource's list screen; `nuclear make screen` writes an empty one.
...
```

A diagnostic code is found by its exact name:

```sh
$ nuclear-graph search "N0114" -k 3
── 0.174 (0.494 key)  errors  error:N0114
[errors/diagnostic] N0114 — not a member of Nuclear's standard library
...
```

### From an agent, over MCP

Claude Code, Codex and Cursor reach the graph through the MCP server `nuclear-mcp` (`nuclear-graph mcp` runs it).
Its `graph_*` tools are the same questions:

| MCP tool | What it asks |
|---|---|
| `graph_strategy` | which kind of request this is, and its plan step by step |
| `graph_answer` | the exact answer, then the cards |
| `graph_search` | a search by meaning and by exact name |
| `graph_card` | one card by its id |
| `graph_prompt` | the validated prompt of a use case |
| `graph_remember` | keep a decision or a solved example for later sessions |

How a client adds the server, and its other tools: [the MCP server's guide](../../../tools/mcp/docs/08-guides/mcp.md).

### From a program, over HTTP

Every route, and the Python client package (`nuclear_graph.client.GraphClient`, which needs only `httpx`):
[integrations](../02-architecture/integrations.md). A program needs a token first:

```sh
nuclear-graph connect my-tool --scopes read,write     # with the graph running; the token goes to the keyring
nuclear-graph requests                                # pending requests and the allowed clients
nuclear-graph revoke my-tool                          # take the access away
```

A program can also ask for access itself (`POST /v1/access`); it gets its token once you `allow` the request.
`--print` prints the token instead of keeping it. Who may read what: [security](../05-standards/security.md).

## How it is kept current

The knowledge base is the folder `nuclear-graph-storage/data/`. Most of it is read from the tree itself (the help
of the commands, the tools of the MCP server, the diagnostics, the kinds, the examples); the rest is written by
hand and names its sources. After a change of the ecosystem:

```sh
nuclear-graph knowledge build      # write the generated rows, validate the base, raise the revision
nuclear-graph knowledge check      # fails when the base is behind the tree or the graph holds another revision
nuclear-graph ingest               # the running graph learns it (only what changed is embedded again)
nuclear-graph knowledge ask        # every question people ask finds its row
nuclear-graph knowledge examples   # every Nuclear example of the hand-written rows compiles
```

`knowledge review [id...]` records that a hand-written row still holds after its source changed. The whole
procedure: [update the knowledge base](../06-runbooks/update-the-knowledge-base.md).

## When it fails

| What you see | What to do |
|---|---|
| `the graph is not running at <url>: start it with nuclear-graph serve` | start it; a machine set up by the installer starts it at login |
| `'<client>' has no access to the Nuclear Smart Graph` | `nuclear-graph connect <client> --scopes read,write`, with the graph running |
| `the graph holds revision N and the knowledge base is revision M` | `nuclear-graph ingest` |

More: [install, serve and ask](../06-runbooks/install-and-serve.md#when-it-fails).
