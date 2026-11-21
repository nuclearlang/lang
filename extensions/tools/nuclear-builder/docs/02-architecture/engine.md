---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [overview.md, providers.md, teams-and-vault.md, chat.md, ../00-context/domain.md, ../01-product/roadmap.md]
---
# The engine

The software factory's engine, in Nuclear (`factory.nuc`, `run.nuc`, `checks.nuc`, `preflight.nuc`, `ci.nuc`,
`line.nuc`), which `nuclear-builder run | retry | restart | runs | checks | ci | export` runs. The editors run it as a
process and draw its run file (the process contract below); the TypeScript engine they drove before is gone (spec 011
T3.6).

## The software factory (`factory.nuc`)

A run is started by the page (`run … --events`, its process the extension's) or apart (`run … --detach`, an agent's
`run_start`: no stdin, so it waits at its first question, which `run answer` answers). A question is answered on
stdin or through `.nuclear/builder/runs/<id>.answer.json`, which `run answer` and `run stop` write for the process
that waits on it (`eventAnswer`: stdin read by a thread, the file looked at twice a second). The spending is never
answered there: only the user's two confirmations ([actions.md](actions.md)). A spec started apart needs its
acceptance criteria.

A spec goes through the stations, each worked by a member of its role in the run's team.

### The team

One rule for a run and for Nuclear Chat (`runTeam`, `teamOfRun`): the team asked for, else the project's
`.nuclear/builder.json` `"team"`, else its workspace's (`assignedTeamId`: the folder above that holds
`.workspace/workspace.nuc`; a team assigned to a workspace works each of its apps, an app's own wins), else the
default team, else the only saved team; with no saved team a run takes the local team `local-team` (not saved),
which the chat never shows. Several saved teams and none of them the project's nor the default is a `TeamChoice`
(a `TeamError`): never the local team silently. `chat-host` answers it with `chooseTeam` (`[{ "id", "name" }]`), and
the editor asks once which team the project uses and saves it as the project's (`line set team=<id>`); in a terminal
the error says to run `line set team=<id>` or `team default <id>`.

### Who works a station

`memberFor(team, role, assign)` (teams.nuc, ADR-platform-0010): the member the tech lead assigned for the run (the
run's `assign`, `{ "<role>": "<member id>" }`, from `run --assign developer=<member>,…` or `run_start`'s `assign`,
checked against the team's members of that role), else the role's first member in the team's order; a role with no
member is the local Nuclear Developer's. The station and each of its steps name that `member` (beside `employee`,
`kind`, `provider`, `model`; a member without its own is worked by the team's `brain`, spec 023). The spending's
questions (`paidOf`) count only the members who work the run's stations, never every paid member of the team, and
only those paid by use (kind `api`) unless the confirmation is forced; a run's checks take the tasks of every member of the role. One member works
the whole station: splitting the Developer's pieces among several developers is in the roadmap.

| Station | Role | Its own steps | Documents in the spec's folder | Today's stages |
|---|---|---|---|---|
| `analysis` | Analyst | the role | `analysis.md`, `questions.md` | Specification |
| `design` | Architect | `nuclear gen resource … --from-spec` for each resource of the spec (and each call of the analysis), then the role | `design.md`, `plan.md` | Generate, Plan |
| `tests` | Developer | the role | `test-plan.md` | Tests first |
| `code` | Developer | the role, `nuclear gen usecase` for each use case it wrote, then `commands.check` with its repairs | `work-log.md` | Code |
| `quality` | QA | QA's plan (the checks) and its stop, `build` and `test` with their repair rounds, `security`, the acceptance criteria, the checks, the role | `qa-report.md` | Verification, Security |
| `delivery` | DevOps | the role, then, approved, the branch, the commit and the pull request | `definition-of-done.md`, `user-story.md`, `pr.md` | — |

Artifacts and Deploy are the line's commands (`nuclear-builder ci`, the exported CI), after Delivery. Each document
comes from its role's template (`templates/<name>.md`, another role's when its own has none), with `{{id}}`,
`{{title}}`, `{{date}}`, `{{platform}}`, `{{project}}` and `{{assignee}}` filled in. The line (`readLine`,
`.nuclear/builder.json` over the defaults): `commands`, `branches`, `gates` (`["analysis", "design", "delivery"]`),
`stations` (all six), `forceConfirm`, `minFreeMb`, `commandTimeoutMs`, `callTimeoutMs`, `stallSeconds` (90), `mcpCommand`,
`prices`, and optionally `developerUrl` and `ollamaUrl`.

- **A role's step** (`work`) goes through its provider's adapter (providers.md) with the station's task, the spec,
  the documents before it and the client's answer at a gate. A station of the Nuclear Developer (`localStation`)
  uses today's routes: `/developer/analyze`, `/developer/plan` (the plan's pieces go to `spec.pieces`), `/developer/test`
  (the test file, refused when it does not compile), `/developer/code` a piece at a time (written when it compiles),
  `/developer/security`, `/developer/document`; the documents are written from its answers.
- **The strategy** (ADR-developer-0001): the local Analyst's answer is kept in `run.analysis` (`strategy`, `title`,
  `why`, `mode`, `stages`, `lead`, `source`, `generate`, `pieces`, `questions`, `limits`). Its `stages` (today's stage
  ids: `generate`/`plan` → Design, `test` → Tests first, `code` → Code, `verify`/`security` → Quality) skip the other
  stations with a step *Not part of this kind of request*; Analysis and Delivery always run. A strategy with no
  stages (a question, a command) fails the Analysis with where to take it. Its `questions` (`questions.md`) stop the
  run at the Analysis's gate even when it is not in `gates` (the ask carries `questions`); a `change` gives the
  answers to the Analyst again. Its `generate` calls join the Design's generators; its `pieces` are the plan, with no
  planner (a piece with `code`, a rename's file, is written as it is, by no model); a strategy whose pieces come from
  the project (`source` not `plan`) with none named plans nothing. A Developer without an analyst (404) leaves every
  station on.
- **The local plan and tests**: the planner gets the files the generators wrote and a piece that repeats one is
  dropped; a plan made again (a retry from Design) keeps only the pieces the user wrote. The tester gets the plan's
  names (what to inject); none is asked when the generators wrote every file; a test that injects a class neither
  the plan nor the project map declares fails Tests first, saying so.
- **Wiring** (Code's part `wire`): each use case the station wrote (`components/<c>/domain/usecases/*.nuc`) whose
  facade has no alias for it gets `nuclear gen usecase <c> <Name>`, on the backend with `--route` when its piece's task
  or the spec's only route gives one (and the plan has no controller of that component). Never a model; a refusal
  is a skipped step, the check decides.
- **Repairs**: Code's check that fails gets `nuclear fix .`, then each file with its errors (`nuclear check . --json`)
  to the Developer once (the tester for a test file, against the plan's names), then the lead; the check has the
  last word. Quality's `build` and `test` get up to three rounds: the failing output told in Nuclear (`nuclear explain
  --json`, kept in the step's `agent`), the files it names that the run wrote repaired (a `fix` strategy: any file but
  a test), then the lead. A failing command before a repair is a skipped step (*errors to repair*).
- **The lead**: when the member who works the Developer is local and the Architect's is not, the Architect's provider
  takes what the local Developer leaves: a piece with compiler errors, a project or tests still failing. Its steps
  are the Architect's, its cost the run's (it counts as a paid role for the spending's questions).
- **The acceptance** (Quality's part `accept`): each criterion held against the files of the run, the tests they
  declare and the commands that passed, by `/developer/accept` (a QA that is not local is asked for `<n> | met |
  <where>` lines); kept in `run.acceptance` (`criterion`, `met`, `evidence`); never fails the run: a criterion not
  shown met is left for the reviewer (the step is skipped).
- **The diagnosis**: a station that fails gets a step *Why it failed* (actor `diagnoser`, skipped) by
  `/developer/diagnose` with the failed step's output told in Nuclear, kept in `run.diagnosis`, when the team has a
  local role; a class the compiler does not know that the plan never had blames the plan.
- **The journal**: `.nuclear/builder/runs/<id>.md`, rewritten with the run file: the strategy, the diagnosis, the
  retries and interruptions, the files written, what is left for the reviewer, the acceptance, and every station's
  steps with who did them, their trace, decisions, what the agent read and the log of a failure.
- **A gate** after a station of `gates`: the user approves, asks for a change (the role works again with it), or
  stops. Delivery always asks before the branch.
- **The checks** (`checks.nuc`, `checks.json` in the spec's folder): every role's `checks.toml` and the team's tasks, with the
  user's own (`nuclear-builder checks <id> add`). A check of `by = "role"` runs at the end of its station: a
  `command` (a key of the line's `commands`; with `expect = "fail"` the project must compile (`check`) and the command
  must fail: the Developer's *each new test fails before the code* passes when the tests written before their code
  fail, and fails when they already pass) or a `prompt` for the role's provider (`CHECK_TASK`: it fixes in the
  station's documents what it finds and can fix from the sources, then answers `PASSED` or `FAILED` on its first line
  for the work after its fixes: a finding fixed is no failure, which would have stopped a run for what was already
  right; what only the user can decide, a tool's `needsUser` such as replacing their CI file, is no failure either:
  the check writes `NEEDS YOU: <question>` and the station's gate asks it after its own question, `toDecide`;
  skipped, and said, when the role is local). QA's plan is the list: the run stops there until the
  user goes on with every check of theirs that is on, of the stations up to Quality, marked (`checks <id> mark
  <check> passed|failed`); a check of the user's with `gate = true` (*the user approves the analysis*, the design, QA's
  plan, the push) is marked by the user's yes at its station's gate, never asked twice.
- **Delivery**, approved: `git switch -c factory/<id>`, `git add` of the files the run wrote and the spec's folder,
  `git commit` with git's own identity (the user's; no other author), `git push -u origin`, `gh pr create
  --body-file <the spec's folder>/pr.md`. Never a merge.
- **The money**: one budget per run (the team's `budgetUsd`, 5 USD by default). Only work paid by use through an
  API key (kind `api`) asks the spending (`asksSpending`, spec 023): an agent's subscription (Claude Code, Codex,
  Cursor, Gemini CLI, OpenCode, Grok Build) is not asked, unless the project's `"forceConfirm"` or `--force-confirm`
  asks it of every paid provider. Before the first such call two questions, as events: the providers and the roles, then the amount; both `yes` or the
  run waits. `--confirm-spending` answers them in advance (CI, the editor with `nuclear.spending.confirm` off), refused
  when the project's `"forceConfirm"` or `--force-confirm` (the editor's `nuclear.spending.forceConfirm`) is on. The
  confirmation is kept in the run (`spending`): a resumed run does not ask again. Each paid step gets what is left
  as its budget; a step that ends over it fails the run, and no paid call starts with nothing left.
- **Safety** (`run.nuc`, today's rules): the run file is written atomically on every change; every event goes to
  `<id>.log` (JSON lines); the process beats every 10 s (`owner`), a beat older than 45 s or a dead process on this
  machine is an orphaned run; every file a step changes goes to the ledger (`writes`: the text before, the digest
  after, the lines added and removed), found by comparing the project's files before and after the step; what a failed step wrote is undone, a
  file changed since is kept and named; an orphaned run is recovered (its running steps failed, their files undone,
  `interrupted`, with the `stepId` it was in) and goes on from that step; a retry from a station moves the steps from
  there to `previous` and undoes their files; a retry from a step (`--step <id>`) keeps the steps of its station
  before it (those that passed or were skipped) and the parts that ended before its part, and runs it and every step
  after it (`previous[].step` names it); step ids are never reused within a station; *Check the connections* (`preflight.nuc`) runs first: the Developer, the graph, Ollama and
  the local roles' models, each agent's `--version`, a key in the vault for each API provider, the MCP server, free
  disk. A command is killed with its process group after `commandTimeoutMs`.
- **Watching a call** (`adapter_local.nuc`): a call to the Developer runs in a thread of its own while it is watched:
  cut after `callTimeoutMs`, or when for `stallSeconds` the Developer's `/docs` stops answering or Ollama's `/api/ps`
  holds no model (nothing is working on it); a cut call is retried like a busy one, its reason in the retry's event
  (`stalled: …`), and each probe that finds nothing working is a `trace` event `watch`.
- **Resuming**: a station is made of parts (`phase`: generate, work, wire, check, checks, end; QA's plan, approve,
  commands, accept, checks, work, gate); a part that ended is kept in `stages[].phases`, so a run that waited goes on in its
  station after them.

### The specs by component and layer (`specs.nuc`, `spec_line.nuc`)

A spec folder is a folder of `specs/` with a `spec.md`: `specs/<component>/<id>/` by default,
`specs/<component>/<layer>/<id>/` (`presentation`, `domain`, `data`) when the spec touches one layer,
`specs/_global/<id>/` for the whole project; the spec says it too (`- Component:`, `- Layer:`, which `parseSpec`
keeps as `component` and `layer`). A spec of the earlier flat `specs/<id>/` still runs where it is. A run's id is the
spec's id, and the run names its spec's folder (`specPath`): the stations' documents, `checks.json`, the questions'
documents, the delivery's `git add` and `--body-file`, the journal's `- Spec:` line and a retry all follow it. `run`
with no file takes the `spec.md` changed last in any folder; a file given from elsewhere is copied into the folder of
its id, else of its `- Component:` and `- Layer:` (none: `_global`).

The editors' commands (one call each, JSON on stdout with `--json`, an error as `{"error": "…"}` with exit code 1):

- `spec new --title … --component <name>|_global [--layer …] [--use-case …] [--description …] [--criteria …]…
  [--language <en|es|…>] [--stdin] --json`: the language of the project's specs is asked once (spec 024): with none
  kept in `.nuclear/builder.json` (`specLanguage`) and no `--language`, the spec is refused with what to ask (the
  editor's language offered first); the one given is kept, and every spec carries `- Language: <name> (every
  document of this spec is written in <name>, its headings included)` after its component and layer, which the stations read with the spec.
  The spec's base (title, use case, `- Source: local`, component, layer, description, its
  acceptance criteria as `- [ ] …`, `- (none yet)` without them) in its folder, or with `--stdin` the whole markdown
  read there (from its `# title`), its id from
  the title and never one in use (a spec or a run: `-2`, `-3`…); prints `{id, path, spec}` (`spec` as `parseSpec`
  reads it). A component is a folder name (`[A-Za-z_][A-Za-z0-9_-]*`), a use case one of the editors' seven.
- `spec show <id> --json`: `{id, path, text, spec, draft, run}` (the draft's text or null, the run's status).
  `spec delete <id>`: the folder moved to `.nuclear/builder/deleted/<id>-<ms>/` (a running run refuses it).
- `spec update <id> --stdin --json`: the whole markdown on stdin (from its `# title`) over `spec.md`, at once; `{id, path, spec}`; refused while its run is running.
- `spec list --json`: `[{id, title, component, layer, path, updated, runs}]`, sorted by component, layer and title
  (`component` is `""` for a flat spec; `updated` in ms; `runs` the run ids of the spec).
- `spec move <id> --component … [--layer …] --json`: the folder renamed whole (nothing copied, nothing lost; a folder
  there already, a folder holding other specs or a run still running is refused), its `- Component:`/`- Layer:` lines
  set, the folders left empty removed, and its run's `specPath`, ledger paths and steps' `files` moved with it;
  prints `{id, from, path, spec}`.
- `spec migrate [--json]`: each flat spec to its component: its `- Component:` (and `- Layer:`), else the component
  most of its files touch (its run's ledger and its pieces, `components/<c>/…`; the layer when all of them are in
  one), else `_global`; prints `[{id, from, path, by}]` (`by`: `spec`, `files`, `nothing`), or `{id, from, error}`
  for one left where it is (exit code 1).

### Several specs in one run (spec 024 requirement 2)

`nuclear-builder run a.md b.md …` (and `run_start`'s `specs`) makes one run, `<first>-plus-<n>`, one bill and one
budget: `prepareRun` keeps each spec in its folder and lists them in `specs` (`{ id, title, specPath, spec, status }`,
`pending`, `running`, `passed`, `failed`); a spec named twice is refused. The specs go one after the other, each
through every station (the simplest order that keeps a spec's documents together and lets a gate stop one spec): the
run's `spec` and `specPath` are the one at work; when it passes, `nextSpec` keeps its stations in its entry
(`specs[].stages`), settles what its steps wrote (`writes[].step` becomes `<spec>:<step>`, which `passedSteps` keeps:
a later spec's failure never undoes it), gives the next spec fresh stations and seeds its checks. A failure stops the
run on that spec (its entry `failed`); a retry or a resume goes on with it, then the ones after it. The delivery makes
one branch per spec (`factory/<spec id>`). A run of one spec has no `specs`: the files of before load as they are.

### A failure diagnosed and repaired (spec 024 requirement 6)

A station that fails (a step, a check by prompt, QA's report) gets one diagnosis (`repair`; its verdict read through
any Markdown, `verdictOf`: a real one came back `**FIXABLE**`) by the provider of its own
role: its last failed step's summary and the tail of its log (a check's findings: 6,000 characters) after
`REPAIR_TASK`, capped at `REPAIR_BUDGET_USD` (0.50) of what the budget has left. Its first line `FIXABLE` readies the
station to run once more: what the failed steps wrote is undone, its parts run again but those of `REPAIR_KEEPS`
(the generators, QA's plan and the user's yes to it), and its task carries *A repair: …* with the diagnosis
(`run.repairing` while it runs). `NOT FIXABLE`, no answer, a local role, the budget spent or a second failure of the
same station in the process: the run fails as before, the diagnosis kept for the user. Each diagnosis is a step
*Why it failed, and the repair* (`skipped`: whatever it wrote is undone) and an entry of the run's `repairs`
(`station`, `spec`, `step`, `diagnosis`, `fixable`, `at`, `costUsd`), what the team's channel tells; its cost is the
run's. When it is Quality that failed, its findings are in the code: the diagnosis goes to the Code station, which
works once more with it, and Quality judges again.

### The run file

Today's format (`.nuclear/builder/runs/<id>.json`, read by the editors), `engine: 3`: `stages` are the stations, in
order (`id`, `title`, `about`, `actors`, `status`, `steps`, plus `role`, `provider`, `model` and `phases`); each step
keeps `id`, `title` (English; a step of a known kind also `key` and `args`, which the screens say in their language:
`preflight`, `work` [role, station], `repair` [file], `leadFixFile` [role, file], `leadFixProject` [role],
`leadFixTests` [role], `notThisKind`, `whereCause`, `acceptance`, `whyFailed`, `nothingToGenerate`, `check` [id,
title, Spanish title], `youApproved`, `youAskedChange`, `qaPlan`, `youWentOn`, `checksUnmarked`, `noPullRequest`,
`youApprovedDelivery`; a step named by a file or a command has none, and a run without them shows the English),
`actor`, `status`, `started`, `ended`, `summary`, `log`, `trace` (an item `{step, detail}`, with
`"kind": "tool"` when it is a tool call of an agent), `decisions`, `files`, and a
role's step `role`, `employee`, `kind`, `provider`, `model`, `costUsd`, `usage`, `phase`; every ended step `lines`;
the run `gates` (each question's `opened` and `answered`). Each ended step and each end of a run is also a line of the
factory's ledger ([reports.md](reports.md)). The actor of a role's step is the
role's id (`analyst`…), of a command `shell`, of the user's answer `you`. The run adds `team` (`{ id, name }`, the team that works it,
written when it is made and again when it starts: a retry with another team names that one; the page shows that
team's logo after the team changes), `factory` (`team`, `teamName`, `budgetUsd`), `spending`, `waiting` (the question it waits for, its `key` and `args`
for the chat and the notifications: `gate` and `gateQuestions` [station], `qaPlan`, `deliver` [run]) and the status `waiting`; and, from the agent steps,
`analysis`, `acceptance`, `diagnosis`, a step's `agent` (a failure told in Nuclear), `input`, `file` and `code`, the
actor `diagnoser`, `interrupted[].stepId` and `previous[].step`; `specPath`, the spec's folder (a run without it:
`specs/<id>`); `specs` (a run of several specs) and `repairs`, `repairing` (above). A run is read as the
project's where its file is (`root` given on read): one made before the project's folder moved works there. A run of the TypeScript
engine (`engine` 2) is only restarted (`restart`): its files are undone and today's stations run. A run again keeps
its team and its `assign`; one of the local team that was never saved (`local-team`) gets it again.

### The process contract

The editors run the line as a process, one per run: `nuclear-builder run <spec.md> --events [--team <id>]
[--confirm-spending] [--force-confirm]` (or `run --resume <id> --events`, `retry <id> [--from <station> | --step <step>] --events`,
`restart <id> --events`), in the project's folder.

- **stdout**: one JSON object per line. `{"type": "event", "step": "<step id>", "event": {…}}` for what a
  provider does (`text`, `tool`, `tool-result`, `cost`, `tokens`, `retry`, `trace`); `{"type": "ask", "id", "kind",
  "question", …}` when it needs the user (`kind`: `gate` with its `station` and `documents`, and at the Analysis's
  gate the analysis's open `questions`; `spending` with its `providers` and `budgetUsd`; `checks` with the `checks`
  file); `{"type": "done", "status", "costUsd"}` at the end.
  The run file changes with every step: the editors draw it, not the events.
- **stdin**: one JSON object per line, the answer to the last `ask`: `{"answer": "approve"}` (or `"yes"`),
  `{"answer": "change", "text": "…"}` at a gate, `{"answer": "no"}` / `{"answer": "stop"}`. stdin closed or an empty
  line: the run stops with `status: "waiting"` and `waiting` set; `run --resume <id>` asks again.
- **Exit code**: 0 passed, 1 failed, 2 a wrong call, 3 waiting for the user.
- Without `--events`, the same run in a terminal: a line per step that ended, the questions asked there (no terminal:
  the run waits).

A member of Nuclear Chat (`nuclear-builder member --events`) answers with the same shape of events, one process per
answer: [chat.md](chat.md).

### The editors' side

- **VS Code** (`src/runs.ts`, `src/panel.ts`): a spec is placed and written by `spec new … --stdin --json` (the
  form's whole markdown on stdin); the tree is `spec list --json` (overview.md, *The page*). `LineRun` is one run's process; `driveRun` keeps them by run id, at the
  extension's level (a closed page or another tool share them). The run file is watched by
  its `stat` (it is replaced atomically) and drawn at most ten times a second. A `spending` ask is answered by the
  editor's two modal questions (`vscode/src/spending.ts`), a `gate` or `checks` ask by the page; an answer given to a
  run that ended waiting starts `run --resume <id>` and is given again when the same question comes (`answerRun`).
  `resumeOrphans`, on activation, runs `retry <id>` for every run of this engine that was `running` with no live
  owner (`nuclear.builder.resumeInterrupted`). *Stop* closes the stdin of a run that waits (it keeps waiting) and
  sends SIGINT to one that works (its working steps fail, what they wrote is undone).
- **JetBrains** (`NuclearBuilder.java`): the same contract, its questions as dialogs.
