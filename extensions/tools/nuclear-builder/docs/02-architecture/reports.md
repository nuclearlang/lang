---
status: accepted
owner: Julian Molina
updated: 2026-11-24
related: [../../../../../docs/04-specs/017-productivity-reports/design.md, providers.md, engine.md, actions.md]
---
# The reports: the usage, the factory's ledger, `metrics` (spec 017)

What the factory spent and made, as a project manager reads a team's sprint next to the bill of tokens and money.
Three parts, one way: the usage is measured at the source, appended to the factory's ledger, and read by
`nuclear-builder metrics` (the page *Reports* and the MCP tool `metrics` are two clients of it, ADR-platform-0009).

## The usage at the source (`adapter.nuc`)

Every provider's call gives its `Outcome.usage`: `{inTokens, outTokens, costUsd, ms, provider, model}`. `runAdapter`
stamps the time, the provider and the model (the one the provider said, else the one asked for); each adapter gives
the tokens its provider reports. A count the provider did not report is `null` ("not reported"), never a guess.

The usage also says the context of the call (spec 025), from its events: `turns` (the model's turns: OpenCode's
`step_finish`es, Claude Code's distinct assistant messages, the API loop's turns; `null` for the others),
`toolCalls`, `handReads` (the calls of the tools that find their way file by file: `read`, `glob`, `grep`, `list`…),
`repeatedReads` (one of those again with the same input), `resultChars` (the tools' results as the adapter kept them,
each at most 20 000) and `promptChars` (what the factory sent: the role and the station's prompt; the agent's own
harness adds to it).

| Provider | Tokens in | Tokens out | Model |
|---|---|---|---|
| `claude-code` | the result's `usage`: `input_tokens` + `cache_creation_input_tokens` + `cache_read_input_tokens` | `output_tokens` | the `system`/`init` line's `model` |
| `opencode` | each `step_finish`'s `tokens.input` + `cache.read` + `cache.write`, summed | `tokens.output` + `tokens.reasoning` | asked |
| `codex` | each `turn.completed`'s `usage.input_tokens`, summed | `output_tokens` | asked |
| `gemini-cli` | the result's `stats.input_tokens` | `stats.output_tokens` | asked |
| `cursor` | not reported (its `stream-json` has no tokens) | not reported | the `system`/`init` line's `model` |
| `grok` | not reported (its `streaming-json` is not documented) | not reported | asked |
| the APIs | each turn's tokens (the loop of `adapter_api.nuc`), summed | each turn's, summed | asked |
| `nuclear-developer` | the reply's `usage.inTokens` (Ollama's `prompt_eval_count`, summed over the request's model calls) | `usage.outTokens` (`eval_count`) | `usage.model` |

The Nuclear Developer counts per request (its `TALLY`, a context variable each request sets and every model call adds
to; `nuclear-agents/nuclear_developer`); an older Developer gives no `usage`: not reported.

A step keeps the sum of its calls as `usage` (`sumUsage`) and the lines it changed as `lines: {added, removed}` (from
the run's `writes`: each write has `added` and `removed`, counted per line as a diff's stat counts them, a moved line
neither). A gate keeps its times in `run.gates` (`{id, kind, station, opened, answered, answer}`). A chat's answer sums
its provider's calls the same way. A run file without these fields (an earlier version) still loads: its steps have no
usage nor lines, and the reports say so.

## The factory's ledger (`usage.nuc`)

`<factoryDir>/ledger/<yyyy-mm>.jsonl` (`~/.config/nuclearlang/factory/ledger/`; `NUCLEAR_FACTORY_HOME` in the tests),
across every project of the machine, one JSON line appended per event, never rewritten:

| `kind` | When | What it says |
|---|---|---|
| `step` | a step ends (`Factory.end`) | `project`, `root`, `spec`, `specTitle`, `run`, `team`, `teamName`, `station`, `step`, `title`, `key`, `actor`, `role`, `member`, `employee`, `agentKind` (local, agent, api), `usage` (null: no provider), `lines` (null: not reported), `result`, `started`, `ended` |
| `run` | a run ends or waits | `result`, `created`, `ended`, `stations` (each `{id, status, started, ended, steps, failed}`), `gates`, `retries`, `costUsd`, `budgetUsd`; the newest line of a run says what it is now |
| `chat` | a chat answer ends (`Chat.done`) | `project`, `root`, `chat`, `team`, `member`, `employee`, `role` (`chat`: the general agent), `channel`, `agentKind`, `usage`, `result` (answered, failed, stopped), `started`, `ended` |

Every line has `v` (1) and `at`. A line that cannot be written never stops a run. The runs a project made before the
ledger are copied into it once (`backfill`, at the first run or `metrics` in that project; `ledger/backfilled.json`
lists the projects copied), with what their files have and `"backfilled": true`. The ledger is the user's: outside the
editors' storage, never sent anywhere.

## The reports (`metrics.nuc`)

`metrics [--project <name|dir>] [--team <id>] [--member <id>] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--by day|week]
[--view <view>] --json`; the MCP tool `metrics(view, project, team, member, since, until, by)` (`since`/`until`:
`from` is a reserved word of Nuclear). It answers `{filter, lines, runs, <view>…}`, every view when none is asked:

| View | What it computes |
|---|---|
| `bill` | `total`, `local`, `paid` (`{inTokens, outTokens, costUsd, ms, calls, notReported}`), `byPeriod`, `byModel`, `byTeam`, `byMember`, `byProject` (by cost), `budget` (`{runs, spentUsd, budgetUsd, used}`), `runs` (each run's cost against its budget) |
| `throughput` | the specs delivered (runs passed) by period and by team; `velocity` per team (delivered, per period) |
| `cycle` | each spec from its run's start to its end, the delivered ones' distribution (`count, min, median, p85, max`), the time per station |
| `burndown` | the runs started in the period (the scope); at the end of each period how many were delivered and how many are left |
| `flow` | the cumulative flow: at the end of each period, the specs at each column (`pending`, the six stations, `delivered`, `stopped`) |
| `waiting` | the gates open now (the run files of every project the ledger names, and the asked one) and how long; the answered ones' distribution, by station |
| `quality` | per station: steps, passed, failed, retried (the same kind of step again in a run's station), the first-try pass rate (a station that passed with no failed step, in a run never retried) |
| `people` | per member (`<team>-<member>`): steps, answers, lines added and removed, passed, failed, pass rate, tokens, money; `members` by cost and `byResult` |
| `context` | per station (`chat` for the answers), provider and model: the steps and the distribution of `turns`, `promptChars`, `toolCalls`, `handReads`, `repeatedReads`, `resultChars` and `inTokens` over those that reported them (spec 025) |
| `indicators` | cost per delivered spec, tokens per useful line (the tokens of the delivered runs' steps over the lines added by their passed steps), the local share of the tokens, the local and paid money, retries per station |

## The page (VS Code)

The strip's tool *Reports* (`reports`, `Ctrl+Alt+K`, the command `nuclear.builder.reports`), in `src/reports/`:
`panel.ts` its panel, `host.ts` its messages (`reports:ready`, `reports:load` → `metrics --json`; the teams' names
from `team list`), `page.ts` the HUD page, `charts.ts` the numbers and the inline SVG charts (tested), `l10n.ts` its
texts, `metrics.ts` the command's call and its types. The member panel's Summary shows the member's numbers (`metrics
--team <id> --view people`, asked after the company screen is drawn) and opens the page filtered to them. The
JetBrains tool window has no Reports page yet ([roadmap](../01-product/roadmap.md)).
