---
status: approved
priority: high
owner: Julian Molina
updated: 2026-11-20
related: [design.md, tasks.md, apps.md, ../019-launch-and-growth/requirements.md, ../016-agent-onboarding/requirements.md, ../../../nuclear-agents/nuclear_developer/eval/README.md]
---
# Spec 020: The benchmark — does Nuclear make AI agents build better software for less? — Requirements

**Priority: high** (the user, 2026-11-20). NuclearLang claims that an AI agent writing Nuclear builds working
software with fewer tokens and fewer mistakes than writing the target directly, and that this matters most for
cheap models. This spec proves it or disproves it, publicly and reproducibly. A result against Nuclear is published
too, and becomes the roadmap.

## The question

> For the same specification, does an agent with Nuclear (the installer, the MCP server, the skill) deliver a
> complex application that passes more hidden acceptance tests, at a lower cost, than the same agent writing the
> native stack (Flutter, FastAPI, NestJS, React) without Nuclear? And does the gap grow as the model gets cheaper?

## Hypotheses (pre-registered before the first run)

| | Hypothesis | Measured by |
|---|---|---|
| H1 | Cheap models pass more acceptance tests with Nuclear than without | pass rate per cell |
| H2 | The cost of a passing application is lower with Nuclear | dollars per passed test, per app |
| H3 | Nuclear needs fewer tokens and fewer turns | tokens in/out, turns, wall time |
| H4 | The gap between a cheap and a frontier model is smaller with Nuclear | pass(frontier) − pass(cheap), per condition |
| H5 | Code from Nuclear is as fast and as secure as the native code (the golden rule) | latency/throughput under load, security findings |
| H6 | Changing an existing app (maintenance) is cheaper with Nuclear | cost and pass rate of the change tasks |
| H7 | One Nuclear codebase yields the other stack cheaply (FastAPI → NestJS) | cost of the port vs rewriting natively |

## The matrix

**Agents and models** (the user's list, 2026-11-20; the exact model ids are frozen in `design.md` on the day of the
run):

| Harness | Models | Tier |
|---|---|---|
| Claude Code | Sonnet, Haiku | mid, cheap |
| OpenCode | DeepSeek (chat and reasoner), a "flash" model (Gemini Flash; others as found) | cheap |
| Cursor (its agent CLI) | Grok, Composer | mid, cheap |
| Claude Code | Opus (one cell per app) | ceiling: the frontier reference for H4 |
| The local Nuclear Developer | the 3B models (one cell per app) | floor: what runs on a laptop |

**Conditions:**

| | Condition | The agent has |
|---|---|---|
| N | **Nuclear** | a clean machine with the public installer (MCP server, skill, Smart Graph), nothing of this tree (root rule 14) |
| B | **Baseline (native)** | the same machine with the native toolchain (Python + FastAPI, Node + NestJS, Flutter, React + Vite) and the stack's official docs reachable on the web |
| N0 | **Nuclear without the MCP server** (ablation) | the compiler and the skill only: what part of the gain is the language and what part the MCP server |

**Applications**: eight, from medium to hard, in [apps.md](apps.md); each specified once, in prose, the same text for
every condition.

**Repetitions**: 5 runs per cell (model × condition × app); 3 for the ceiling and the floor.

## Requirements

1. **Same task, same budget.** Every cell gets the same specification text, the same hidden tests, the same caps
   (tokens, dollars, wall time, turns), the same tools (a shell, files, the web). Only the condition changes.
2. **Hidden, black-box acceptance tests.** The agent never sees them. They test behaviour, not code: HTTP calls
   against the running backend, a browser driving the web app (Playwright), the mobile app driven on a device
   (Flutter integration driver or the Synapsis device) — so the same tests judge N and B.
3. **Fresh and isolated.** Each run in a new container from the same image, no network but the model's API and the
   allowed docs/registries, no memory between runs (no `CLAUDE.md` of the user, no Cursor rules of another
   project).
4. **Everything recorded.** The transcript, every tool call, the tokens and dollars as each provider reports them
   (never estimated: "not reported" when a provider gives none, as spec 017), the final code, the test report, the
   load-test report, the security scan.
5. **Pre-registered.** The prompts, the apps, the tests, the metrics and the analysis are committed before the
   first measured run; a change after it is a new round, written in the report.
6. **Fair to the baseline.** The baseline prompt is written by someone fluent in that stack and reviewed so it is not
   weakened; the baseline may use its stack's generators (FastAPI templates, `nest new`, `flutter create`, `npm
   create vite`); the specification says the expected architecture in stack-neutral words.
7. **Reproducible by anyone.** The harness, the image, the apps, the tests and the raw results are public
   (a `benchmark/` project of this tree); one command reruns a cell with the reader's own API keys.
8. **Statistics, not anecdotes.** Pass rate with 95% bootstrap confidence intervals; a paired comparison per model
   (N vs B on the same app); effect sizes; every failed run classified (did not compile, wrong behaviour, timeout,
   budget out, gave up).
9. **Honest.** Threats to validity are written next to the results (design.md); a result against Nuclear is
   published with the same prominence, and each failure becomes a roadmap item of the project at fault.
10. **Written in Nuclear** where Nuclear can (root rule 9): the harness is a Nuclear project (python dialect);
    the hidden tests may be in the stack each test drives (Playwright, pytest for HTTP), being the measure, not a
    product.

## Results published

- A report per round (`benchmark/results/<round>/REPORT.md`) and a page on the website with the charts (cost per
  passed app, pass rate by model and condition, tokens, the gap of H4) and the leaderboard (spec 019, T5.4).
- The headline numbers in the READMEs, the press kit and the launch posts only after a round is complete.

## Out of scope

- Judging code style by a model (an LLM judge only as an extra signal, never in the headline).
- Apps that need paid third-party services (payments, maps with keys): mocks only.
