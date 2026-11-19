---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/strategies.md, ../02-architecture/overview.md, ../05-standards/evaluation-rounds.md, ../04-specs/007-lora-nuclear-coder/plan.md]
---
# Roadmap

The pending work of the Nuclear Developer. A done item is deleted. What is pending of the knowledge base and the
query planner is in [the Smart Graph's roadmap](../../../../nuclear-graph-storage/docs/01-product/roadmap.md).

## Half done

**Two tasks lost in round 24** (spec 011, T1.4: the prompts moved into the roles with the same text): the knowledge
base had changed since round 23. `web-manager` copies `@state(...State.full)` from the website's state managers
(examples of the same kind) instead of the state the task writes (`loaded`); `graph-summary` copies the graph of the
example `Assistant` and leaves out the `state` the task declares. Left: a general fix (the coder held to the state
names and the declarations the task writes, or examples ranked by how close their names are to the task's), never
the answer; then a new round with nothing lost against round 23 (43 / 39).

**The agent as a tool executor** (the strategies, `ADR-developer-0001`). Left:

- **What the strategies still do by a model or by hand, each a missing tool:**
  - relations in `gen resource --source db`;
  - a search of a stored resource (refused now: which column is searched is a decision);
  - a field added to a resource that exists (the files are kept: `strategy:member` gives its declaring files to
    the coder);
  - tests for a backend REST resource (needs `@mock` in the backend platform);
  - on mobile and web, what a screen shows of a use case;
  - the Builder writes files and never deletes or moves one (`strategy:remove` is by hand; a renamed declaration's
    file keeps its path);
  - a rename covers declarations, not fields or methods.
- **The planner is still asked when the generators wrote everything**, twice (no pieces → `plan-again`): two long
  answers of the 2B model, 15 minutes on a machine short of memory. A strategy whose generator calls cover the
  request could skip it, but only a model can tell that nothing is left.
- **The Builder's form in the editor has no field for the strategy** (the spec file's `- Strategy:` line and
  `nuclear-builder run` read it).
- **The internet tools** (`web.nuc` of the graph) wired into the local planner: today only over MCP.
- **The frontier model as manager**: `graph_strategy` gives it the plan of each kind of request; the Builder's
  Claude-led plan still pastes context.
- **The planner still names a component in the singular** (the analyst corrects it in a generator call).
- **The local security reviewer stops a backend run that changes data.** It reports "missing authorization check"
  as a high finding on every use case that saves (also on generated ones, seen when a rename rewrote them: a rename
  now runs no security review) and proposes `@acl`, which the backend platform does not have yet
  (`limit:backend-not-yet`). What the platform cannot express should be told as a limit, not fail the run.
- **The analyst's model drops a field of a list now and then** (the count check turns that into a question to the
  user).
- **The local tester's test of a use case did not compile** (it read `NewVendor.id` and never created the row): the
  run stops at *Code* until the test is corrected.
- **The evaluation:** the feature `new-reader` (a field declared twice in its entity, or a declaration written in
  two files) and `function-label` (passes in one round, not in the next); no watch on a stalled call.

## Untested

- **The strategies end to end**: only on a fastapi project. No run on a mobile or a web project, none with nestjs,
  none led by Claude.
- The bug strategies: never against a project with a real bug.
- `data-migration`, `configuration`, `document`, `tests`, `security-review` and `operate`: only as classifications.

## To decide with the user

**Weight training (LoRA)**: what it needs is [spec 007](../04-specs/007-lora-nuclear-coder/plan.md).

- Where the training answers come from: self-distillation validated by the compiler, or Claude's answers (check
  Anthropic's terms on training models with outputs first; the budget approved so far is USD 20).
- The license of the base model (`qwen2.5-coder:3b`).
- A GPU: none here; a rented one is about USD 5–15 per run.

## Pending

- **The local agents after rounds 22–23**: 43 / 45 (Sonnet 39), held out 16 / 18 (Sonnet 17), features 2 of 3
  (Sonnet 3). Left: `function-label` (passes in one round, not in the next), the feature `new-reader`, and the
  local tester's tests (they read an empty database or copy a close example).
- **The local tester copies a solved graph example close to its task** (a models-only spec got an appcomponent
  test): such a local-only run now fails at *Tests first* with the diagnosis. The tester's retrieval needs examples
  filtered by what the plan declares.
- **The local planner on a spec in plain words** (no Synapsis words: "an author has a name; POST /authors adds
  one") planned two pieces in a component named `data` (`components/data/data/entities/author.nuc` and a test);
  Sonnet then wrote the rest (two MCP runs). Specs written with the platform's words plan well (rounds 10–11 of the
  evaluation).
- **The chat with exact facts** (`ADR-graph-0002`; measured 2026-11-13 with `gemma4:e2b`): the rows under an answer
  are always right and whole, the model's explanation above them is not always (asked for "a repository that calls
  an endpoint" it explained routes; given 27 tools it named six groups). An answer with facts is long (the
  explanation, then every row): the chat's panel could fold the rows.
- **`eval/run.py` is Python**, not Nuclear ("Nuclear and Synapsis first" of the root `AGENTS.md`): decided by the
  user to stay as it is for now.
