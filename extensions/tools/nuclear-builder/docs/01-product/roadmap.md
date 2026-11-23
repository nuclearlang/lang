---
status: accepted
owner: Julian Molina
updated: 2026-11-19
related: [../02-architecture/engine.md, ../../../../vscode/docs/01-product/roadmap.md, ../../../../jetbrains/docs/01-product/roadmap.md]
---
# Roadmap of Nuclear Builder

What the agents, the strategies and the generators still lack is in their own projects
(`nuclear-agents/nuclear_developer/`, `nuclear-graph-storage/`, `tools/code_generator/`).

## Half done

- **Local models on standby, ADR-platform-0013** (the engine and the set-up): `localModels` false in `setup.json`;
  the set-up offers only `remote` (the Smart Graph and Nuclear Chat) and its step `standby` takes away what was local;
  a local member is converted on read; the chat's default is the first external agent or provider. Turning them on
  again requires: the switch true here and in the MCP server (`LOCAL_MODELS`), the profiles offered again by the
  installers, the tests that run with `localOn` reviewed on a machine with Ollama (the factory with the real
  Developer, the set-up's local steps), and `retireLocal` kept only for machines on `remote`. Untested: `retireLocal`
  on a real machine that had a local profile (macOS's launch agent, Windows's Startup script, Ollama's removal).

- **The local kind, OpenCode on Ollama** (`opencode-local`). Done: the pickers, the wizard, the Brain, the agents and
  models lists, the run's checks, the adapter. Left: the chat's setting of VS Code (`nuclear.builder.chat`) still
  offers agent and API only; no factory run measured end to end with a local model (only one `opencode run` with
  `ollama/qwen2.5-coder:7b`); the too-big dialog of the pickers with a local model untested in the editor.

- **The reports** ([spec 017](../../../../../docs/04-specs/017-productivity-reports/tasks.md), [reports.md](../02-architecture/reports.md)).
  Done: the usage of every provider at the source, the factory's ledger, `metrics` and its MCP tool, the VS Code page
  *Reports* and the member's numbers in their Summary. Left: the JetBrains tool window has no Reports page (the
  command serves it); an export of the ledger (CSV) and budgets with alerts over the reports (the requirements' open
  questions, for the user to decide); how long the ledger is kept (today: forever, one file a month); the token lines
  of OpenCode, Codex and Gemini CLI were read from their documentation and are checked with stubs, not with a real
  run (no paid call was made).
- **Skills in JetBrains** (spec 011 req. 34): the library, the team's and the members' skills, the preview and the skills editor are VS Code's company screen; the JetBrains tool window has none yet (the commands and MCP tools serve both).
- **Every action a command and a tool** (ADR-platform-0009, [actions.md](../02-architecture/actions.md)). Done:
  `nuclear-builder mcp` (55 tools), every agent given it, the chat's local member through the same tools, the user's
  decisions asked in the chat, the Builder's and the company screen's messages on commands. Left: the form's helpers
  (Jira and GitHub issues, the context suggested, the pieces the local Developer proposes) as commands; the JetBrains
  tool window answering a waiting run with `run answer` (it resumes and answers on stdin); a run answered through the
  answer file on Windows is stopped by `os.kill` without the undo of an interrupt (the next retry's recovery undoes
  it); the real Claude Code and OpenCode run of a member with both servers (prepared, not made: it costs money).

- **The software factory in Nuclear** ([spec 011](../../../../../docs/04-specs/011-software-factory/tasks.md),
  phases 2 and 3). Done: the teams, the vault, the adapters of every provider, the stations, the gates, the checks,
  the money, the delivery, today's safety (with the watch of a stalled call and a retry from one step), today's agent
  steps (the strategy, wiring, the repairs, the lead, the acceptance, the diagnosis, the journal), and
  `nuclear-builder run | retry | restart | runs | checks | ci | export` on it ([engine.md](../02-architecture/engine.md)),
  the specs by component and layer (`spec new | list | move | migrate | accept | discard`) and Nuclear Chat's members
  (`nuclear-builder member`, [chat.md](../02-architecture/chat.md)).
  Left in the engine: the copy of the artifacts after a run (the TypeScript engine's *Keep the output with the run*:
  `nuclear-builder ci artifacts` runs the command, nothing copies the output into `.nuclear/builder/artifacts/<id>`),
  the documenter's notes at the top of the journal (`run.notes`: only the Delivery's `/developer/document` today), and
  the lead's fixes kept as graph examples are only asked of the lead in its prompt (nothing checks them). The editors
  run it as a process and the TypeScript engine is gone; of its `test/engine.test.ts`, every case is in
  `tests/test_factory.nuc` and `tests/test_adapters.nuc`, or in `test/editors.test.ts` for the editors' own (the
  retries' arithmetic, the tools' `PATH`, the connections, Nuclear Atlas's templates and history, the 3B rule), but
  one: a run of the earlier engine restarted from scratch is tested only up to its refusal by `retry` (the restart
  itself runs *Check the connections* against the machine).

- **Nuclear Chat's host** (spec 013 T3.2, [chat.md](../02-architecture/chat.md)): the page has no chat (Nuclear Atlas
  has it, opened on a member's or a team's conversation), a run is told as a thread with its buttons, a spec's draft is accepted or not. Left:
  - **`/poc <what>`**: the factory runs only on a project's own code; a proof of concept needs `nuclear-builder run`
    on a scratch project made in `.nuclear/poc/<id>/` (`nuclear new` there, the run's writes kept inside it). Today
    the chat says it is not available.
  - The host file gives one team, the run's: a run of another team is told in `general` as `system`.
  - A run's thread is found again by the chat's search (`run:<id>`); the buttons' answers say what was chosen only for
    the questions this window posted (a restarted editor takes the buttons away and leaves the text).

- **JetBrains and the money's settings**: the tool window always asks the two questions (as `nuclear.spending.confirm`
  on); it has no settings of its own for them yet (spec 011 T4.7), only the project's `"forceConfirm"`, which the
  engine reads.

- **The workbench** (spec 011 T4.9, T4.10) is VS Code's; the JetBrains window still lists only the flat
  `specs/<id>/` and writes its new specs there, and has no chat (its roadmap). The
  diagram is fitted when its level changes, not when a column is resized (its fit button does it).

- **Teams of any size** (ADR-platform-0010): one member works a whole station. Left: split the Developer's pieces
  among several developers of the team (today the role's first member, or the one `--assign` names, works the whole
  station); the tech lead assigns who works a station from the chat (a tool that sets the run's `assign`; today only
  `run --assign` and `run_start`'s `assign` set it, when the run starts).

- Nuclear Builder's form in the editor has no field for the strategy (the spec file's `- Strategy:` line and
  `nuclear-builder run` read it).

## Untested

- **Several specs in one run and the repair of a failure (spec 024, 0.88)**: tested in Nuclear with a fake Claude Code
  (a check that fails once, a FIXABLE and a NOT FIXABLE diagnosis, two specs through two stations); never with a real
  provider: whether a real diagnosis starts with `FIXABLE`/`NOT FIXABLE` as asked (anything else stops the run), a
  run of several specs in the editor (the page and the chat draw `specs` per spec: the C4 and notification work), the
  delivery of several specs (one branch and pull request each). `tools/mcp`'s `run_start` takes one spec still.

- **Every step of a run in its thread (0.88, spec 024 requirement 4)**: `runPosts` and `stationDetails` are tested
  (`test/chat.test.ts`); never seen in a run: the *started* posts, the logs folded, a repair told from the engine's
  `repairs` (the engine writes it in the same release), a run of several specs.

- **The diagram told as C4 for a product owner (spec 024 requirement 5)**: `storyOf` is tested (editors.test.ts) and the
  diagram type-checks; never seen in a window: the five business steps of a real run, their states and lines, *⤢
  Inside* to the stations, *⚙ Technical details* hiding and showing the tool calls, a spec opened as a preview.

- **Nuclear's base skills in every team (0.87)**: `baseSkillIds`, `sharedSkills` and the screen's `libraryGroups` /
  `memberSkills` are tested; never seen in a window: the locked *Nuclear base* chip and its tooltip in the team's skills
  and the wizard's step 2, the picker without the base skills, a member's *Skills* tab marking them *Nuclear base*, a
  team of before 0.87 that lists one.
- **The Builder without its chat, the roster only while adding** (2026-11-20): tested (`editors.test.ts`: the page,
  the squad's clicks), never opened in a running VS Code. A member or a team other than the project's run team opens
  a channel Nuclear Chat did not register (`chatHost` registers only that team): Atlas shows the chat without it.
  The opening needs the editor's `nuclear.atlas.open` command (root, channel).
- **Grok Build in the step `clients`** (`grok mcp list|add|remove`, from xAI's documentation of 2026-11-20): tested with
  its command stubbed, never against a real `grok`.

- **The workbench in a running VS Code** (0.59.0): its page was checked rendered standalone in a headless browser
  (English and Spanish, an empty project, two runs at once, the form, folded columns) and its clicks
  there (the accordion picks the node, the tree opens a spec, the form saves with its component). Never opened in VS
  Code itself. Nuclear Chat in the dock (2026-11-18) was rendered in headless Brave with a fake bridge answering from
  what the real service said for a throwaway workspace (a run's thread, a gate with its buttons, the members' faces),
  English and Spanish; the connection itself ran end to end from Node against the installed service (registered, a
  message said, its events received, `dm-atlas` answered by the local agent). A button clicked in the chat answering
  a real run, a spec's draft accepted from the chat, and the tab were never tried in VS Code. Its second
  version (spec 011 T5.2-T5.4: the node as a tree, the log with the team's logo, the specs and runs in the
  Workspace's column, the company screen) was rendered standalone in Firefox headless with a sample failed run (Claude
  Code haiku and local roles), English and Spanish; the column's clicks driving the page (`BuilderPanel.drive`), the
  tree's keyboard and `team logo` from the editor were never tried in VS Code.

- **A member with a real provider**: `nuclear-builder member` ran only with its providers stubbed (the local
  assistant as an httpx stub, Claude Code as a fake command); `chat-host` and `team logo` ran installed against a
  scratch `XDG_CONFIG_HOME`.

- **The chat with a paid provider**: Claude Code tested with its command stubbed only, no real paid call; with the
  real local assistant (gemma4:e2b) a spec's base was written through `spec_new` (2026-11-18).

- **The company screen** (`src/teams/`, the HUD of spec 011 req. 30-31, 2026-11-18): rendered standalone in headless
  Brave with the real roster and temperaments (English and Spanish, a dark and a light theme: the company, a team,
  a candidate's profile, the *Who works* tab); its `nuclear-builder team` calls run against the real command (a
  scratch `NUCLEAR_FACTORY_HOME`). Never opened in a running VS Code: the hover inspector, a drag onto a slot and the
  keyboard were not tried there. The profile's LinkedIn fields (`headline`, `experience`, `recommendations`…) were
  rendered from a fixture until the roster carries them; its *Activity* shows the run's steps only (a member's chat
  messages are not given to the page yet). The member panel (header, Brain, Overview … Profile, 2026-11-18) was
  rendered the same way in Spanish, dark and light, with the real `agents --json`; never in a running VS Code. Its load (2026-11-18, one
  `team screen`, thumbnails, the skeleton) was timed in headless Brave against the real command, not in a webview,
  whose files come slower than from a local server.
- **The temperaments in a real chat**: each member's prompt carries its temperament's voice (`member.nuc`, tested with
  the provider stubbed); how well a small local model keeps a voice (and never bends a fact) is not measured yet, (the
  chat's page draws each member's face since 2026-11-18).
- **The agent adapters with a real call**: Claude Code and OpenCode were checked against their `--help` (2.1.327,
  2.2.7) and tested with their commands stubbed; no paid call was made. OpenCode's `--format json` lines and Codex's
  and Gemini CLI's whole adapters (`adapter_codex.nuc`, `adapter_gemini_cli.nuc`: not installed on the machine they
  were written on) follow their documentation only.
- **Cursor and Grok Build with a real call** (`adapter_cursor.nuc`, `adapter_grok.nuc`, 2026-11-19): written from
  their documentation and tested with their commands stubbed; neither CLI was installed. Not tried against the real
  ones: that `agent -p` loads a `--plugin-dir` plugin's `mcp.json` and runs its `beforeShellExecution` hook (the
  shell's denial) in a headless run; that `agent`'s real path names Cursor on macOS and Windows as on Linux; Grok's
  `streaming-json` events (undocumented: read defensively, providers.md says what was assumed) and whether they
  carry tokens (not reported until they are known); that Grok reads the run's `GROK_HOME` with the user's entries
  linked (its login among them: a login refreshed by a rename during the run would be lost with the temporary
  folder; `XAI_API_KEY` has no such risk; on Windows without the right to link, only `XAI_API_KEY` works). Neither
  lists its models here yet (Cursor has `agent --list-models`).
- **The API adapters with a real call** (Anthropic, OpenAI, Google, OpenRouter): HTTP stubbed only. OpenAI's and
  Google's prices are the project's (`.nuclear/builder.json` `"prices"`); a model without one is refused.
- **The vault on macOS and Windows** (`security`, the password vault through PowerShell): written, never ran.
- **The models' lists and the memory guard** (`models.nuc`, spec 011 req. 35): the API providers' list endpoints were
  tested with HTTP stubbed only (no key on the machine it was written on); macOS's and Windows's memory reads
  (`sysctl`/`vm_stat`, `Win32_OperatingSystem`) are written, never ran; the guard counts the machine's memory, not a
  GPU's own (a model that fits in a GPU may be marked too big); Codex and Gemini CLI list no models (their default,
  or one typed); the MCP tools' `needsUser` for a too-big model is tested through `memoryWarnings`, not through a
  real server call.
- **A whole run of the factory with the local agents**: five stations ran through `nuclear-builder run --events`
  against the real Nuclear Developer (from the editor's process code: Quality failed on the fault above); Delivery and
  the six together only with the Developer stubbed.

- **The set-up in Nuclear on macOS and Windows** (launch agents, the Startup script, `Get-CimInstance` for the memory
  and the processor, the `.cmd` launchers): written, never ran. On Linux it ran from a working tree and on the clean
  machine.

- **The Nuclear Builder page was never opened in a running VS Code**: its process logic (`LineRun`, the gate left
  waiting and resumed with its answer, QA's checks listed, added and marked through `nuclear-builder checks`) drove a
  real `nuclear-builder run --events` with a team of local roles through five stations; the page itself was seen only
  in a headless browser (the form with the team, the four levels of the diagram, a gate, QA's plan and its console, a
  station working; English and Spanish) with that run's file, and its clicks checked there. Not seen: the two modal
  questions of the spending against a real paid team, an interrupted run resumed after a real restart of VS Code,
  *Stop* (SIGINT) on a real run.
- The JetBrains *Nuclear Builder* tool window in a running IDE (only compiled): its dialogs for a gate, QA's plan and
  the spending, *Go On* and *Run a Station Again…*. It draws a run as a tree: no diagram, no avatars.
- A Jira import against a real site, a GitHub issue import (`gh`), an exported CI file run on GitHub / GitLab /
  Bitbucket, the deploy stage with real `seed` / `integration` / `deploy` commands, the keyring on macOS and
  Windows (ADR-platform-0003).

## Pending
- **The `delivery` role alias goes** (spec 011's amendment, DevOps since 2026-11-18): `--role delivery`,
  `--assign delivery=…` and a tool's `role: "delivery"` are still read as `devops` for one release; in the release
  after it, only the files' conversion on read (`roles.nuc`'s `OLD_ROLES`: teams, runs) stays, and the commands
  refuse the old id with its new one.

- **The other agents' answers as they are written** (spec 013 requirement 17): only Claude Code streams a chat's
  text (`--include-partial-messages`); OpenCode's `--format json`, Codex's and Gemini CLI's JSON lines, the API
  loop (the providers' streaming endpoints) and the local Nuclear Developer (`/developer/chat` answers whole) give
  their text at the end. Claude Code's streamed lines are tested against a fake command only (no paid call).

- **The factory's tools as tools**: a member gets `spec_new`, `spec_list`, `runs`, `run_file`, `checks` and `spec_draft` from every
  provider as text (`--- tool: <name> ---` blocks), because the agents' command lines take only MCP servers and the
  local assistant has no tools. Wanted: a factory MCP server (`nuclear-builder mcp`) beside `nuclear-mcp` for the
  agents and the API loop. Until then a chat's agent also keeps its file tools: a change of the project's files is
  said (a `files` trace), not refused; only the roles' folder is put back.
- **The local chat's own guide**: the chat reaches the local assistant by `POST /developer/chat`, whose prompt is the
  analyst's `answer-a-question` skill (Nuclear Atlas's): it tells the model to answer orders with `/task …`, so a 3B
  model wrote `/task spec_new {…}` instead of a tool block (taken now by `toolCalls`). Wanted: a skill of the chat
  (the general agent's own `prompt`), sent by the Builder, measured by an evaluation round.

- **The old ledgers** (runs of Nuclear Builder before `ENGINE = 2`): a from-scratch restart removes a file the ledger says
  "was" what an earlier attempt wrote, only when that text is a step's `code` of the run; an older run whose steps
  kept no code still gets such a file back.
- **The disk check** holds the temporary folder to the same 500 MB as the project. With `/tmp` (a 7.7 GB tmpfs) full
  of other sessions' scratch and of `flutter_tools.*` folders, every run stopped at *Check the connections*. The
  message names the folder and the diagnoser has the kind `disk`; nothing cleans the temporary folders the tools
  leave (`nuclear-lsp-backend-*`, `nuclear-web-device-*`).
- **A project without a platform and the local Developer**: the Developer refuses a request without `backend`,
  `mobile` or `web` with 400 (no longer a 500); a project without a project card's platform (a `nuclear.toml`
  project) fails its first local station with that answer, and *Check the connections* does not say it first.
- **A team's behaviours and tasks** (the squad screen writes them, `teams.nuc` validates and keeps them): the engine
  does not act on them yet (`askBeforeWriting`, `explainDecisions`, `stopAtFirstFailure`, a task added to a station).
- **What the Spanish interface still reads in English** (2026-11-18): what the engine and the agents write as free
  text, not as a kind with arguments: a step's `summary`, its decisions, its trace (the agents' own steps, `plan`,
  `classify`…), its log and a command's output; the analysis's open questions inside a gate's question; the
  documents the stations write (`analysis.md`, `qa-report.md`…); a member's prompt and the temperaments' `voice` (the
  agents', English by rule; the screens show the temperament's `description`). They need the engine to say each
  sentence as a kind with arguments, or the agents to write in the run's language.
- **The keys of the API providers in CI**: the vault is the system's keyring; a CI job has none, so a run with an
  `api` role cannot run there (an agent's own login neither).

What Android Studio's tool window lacks: [the plugin's roadmap](../../../../jetbrains/docs/01-product/roadmap.md).
