---
status: approved
owner: Julian Molina
updated: 2026-11-18
related: [requirements.md, design.md, ../009-self-contained-ai-services/tasks.md]
---
# Spec 011 — Tasks

Each phase ends with its tests green and its projects' documents saying it (AGENTS.md rule 7).

Three tracks run side by side, each owning its folders: **R** (roles: `nuclear-agents/`, the prompts of
`nuclear-graph-storage/prompts/`, `docs/03-adr/`), **E** (the engine in Nuclear: the `.nuc` files of
`extensions/tools/nuclear-builder/`), **U** (the editors: `extensions/vscode/`, `extensions/tools/nuclear-builder/src/`,
`extensions/jetbrains/`). The contracts between them are in [design.md](design.md): the role folder, the roster,
the team file, the `nuclear-builder team|run --json` commands and the run file.

## Phase 0: the decisions (R)

- [x] T0.1 ADR-platform-0005: the software factory (stations, roles as files, providers as assignments, teams);
      it amends ADR-platform-0003 (the AI loop).
- [x] T0.2 ADR in `nuclear-agents`: a role is a folder, read by the local agents and every provider.
- [x] T0.3 Spec 009's T3.1b (the engine in Nuclear) is done by this spec: written there.

## Phase 1: the roles as files (R)

- [x] T1.1 `nuclear-agents/roles/{analyst,architect,developer,qa,delivery}/` with `role.md`, `skills/`, `templates/`,
      `checks.toml`, and a check that every role folder is complete and every template is used.
- [x] T1.2 The roster: 40 satirical employees per role, `roster/en.json` and `roster/es.json`, the same ids.
- [x] T1.3 Today's prompts move into the roles; the Nuclear Developer reads them from there (its graphs unchanged).
- [ ] T1.4 An evaluation round of the Developer with the moved prompts: no task lost against the last round.
      Round 24 measured (2026-11-17): the prompts the graph serves are the same text byte for byte, and two tasks
      were lost (41 / 39 against 43 / 39) to examples the knowledge base gained since round 23, not to the move.
      Left: their general fix and a round with nothing lost (the Developer's roadmap, *Half done*).

## Phase 2: teams, the vault and the providers (E)

- [x] T2.1 Teams: the file, its atomic write and `.bak`, `nuclear-builder team list|show|save|delete|default|export|
      import|roster|new [--json]`, the default team of each preset, with tests (`teams.nuc`, `tests/test_teams.nuc`).
- [x] T2.2 The vault: `nuclear-builder vault set|remove|list <provider>` on the system's keyring, with tests
      (`vault.nuc`; Linux tested with a fake `secret-tool`, macOS and Windows written, untested).
- [x] T2.3 The adapter interface and the `local` adapter (the Developer over HTTP) (`adapter.nuc`,
      `adapter_local.nuc`).
- [x] T2.4 Agent adapters: Claude Code, Codex, Gemini CLI, OpenCode (the role rendered in each one's format, the
      Nuclear MCP server, the cost when the agent reports it), each tested against its command line stubbed; the
      flags of Claude Code 2.1.327 and OpenCode 2.2.7 checked against their `--help`; Codex and Gemini CLI are not
      installed: written from their documented headless modes, untested (the tool's roadmap). No real paid call.
- [x] T2.5 API adapters: Anthropic, OpenAI, Google, OpenRouter, through the factory's loop with the MCP tools
      (`adapter_api.nuc`, `api_*.nuc`; HTTP stubbed, no real call).

## Phase 3: the factory's engine in Nuclear (E)

- [x] T3.1 The stations, the team of the run, the gates, the run file (today's format extended with the role, the
      employee, the provider and the model of every step) (`factory.nuc`, `run.nuc`).
- [x] T3.2 The documents of each station from the templates; the checks list and the QA plan that stops for the
      user (`checks.nuc`, `nuclear-builder checks`).
- [x] T3.3 Delivery: the definition of done, the user stories, the branch, the commit in the user's name and the
      pull request with `gh`, only after approval.
- [x] T3.4 The money: one budget per run, the two confirmations as events of the run, `--confirm-spending`, the
      project's `forceConfirm` (the engine; the editor's side is T4.5).
- [x] T3.5 Today's safety: undo of a failed step, resume of a crashed run (from the step it was in), the connections
      checked first, the watch of a stalled call (`callTimeoutMs`, `stallSeconds`), a retry from one step (`retry
      <id> --step <step>`); today's agent steps in the stations: the analysis's strategy (stations skipped, its
      questions stopping the run at the Analysis's gate, a rename's pieces with their code, its generator calls),
      `nuclear gen usecase` wiring, the repairs (`nuclear fix`, the project's errors, three rounds told by `nuclear
      explain`), the lead taking what the local coder leaves, `/developer/accept` and `/developer/diagnose`, the
      journal `.md`; the cases of `test/engine.test.ts` carried over (`tests/test_factory.nuc`; Nuclear Atlas's and
      the 3B rule's stay with the editors). The artifacts' copy is the tool's roadmap.
- [x] T3.6 `nuclear-builder run|runs|ci|export` run this engine; the editors run it as a process; the TypeScript
      engine is removed: the command (`line.nuc`: also `retry`, `restart`, `checks`), the process contract in
      the tool's `docs/02-architecture/engine.md`; the VS Code page (`src/runs.ts`, `src/panel.ts`), Nuclear Atlas's
      `/task` and the JetBrains window run it as a process; `src/engine.ts`, `safety.ts`, `cli.ts` and
      `test/engine.test.ts` are removed (what the editors kept is `src/support.ts`), the installer no longer builds
      `bin/nuclear-builder.js`, and `package.json`'s scripts no longer bundle it (`test` runs `editors.test.ts`).

- [x] T3.7 Specs by component and layer: the layout, `- Component:`/`- Layer:`, the run's `specPath`, `spec new|list|
      move|migrate --json`, with tests (`specs.nuc`, `spec_line.nuc`, `tests/test_specs.nuc`, a run in
      `specs/booking/domain/<id>/` in `tests/test_factory.nuc`).
- [x] T3.8 The chat: `nuclear-builder chat --events` with the provider of `nuclear.builder.chat`, its tools, its
      history, its spending confirmed, with tests (`chat.nuc`, `tests/test_chat.nuc`; the tool's
      `docs/02-architecture/chat.md`). The factory's tools reach every provider as text blocks; a factory MCP server
      for the agents and the API loop is the tool's roadmap.

## Phase 4: the editors (U)

- [x] T4.1 Settings by component: one configuration section per tool, one `settings.ts` per tool, *Settings and
      integrations* by section; the moved ids are carried over at every level (`migrateSettings.ts`).
- [ ] T4.2 English and Spanish: `package.nls.*.json`, `vscode.l10n`, the pages' dictionaries; JetBrains' bundle.
      Done in VS Code: every contributed text, the host's texts (`l10n/bundle.l10n.es.json`, checked by
      `test/editors.test.ts`), the workspace, the welcome, *Settings and integrations*, Nuclear Atlas, HTTP
      Connections, the devices, the squad screen, the Builder page (its stations' names too). Left: JetBrains' bundle (T4.7), and
      the set-up's own texts the welcome shows (`setup --plan --json` is English only: Nuclear Builder's roadmap).
- [x] T4.3 The onboarding: every setting, *Next, Next*, with defaults, the providers and the vault, the team.
- [x] T4.4 The squad screen: the roster's cards, hiring, each employee's settings, several teams.
- [x] T4.5 The money's two confirmations and *force confirmation* in the editor: the engine's `spending` asks answered
      by `vscode/src/spending.ts`'s two modal questions, `--confirm-spending` / `--force-confirm` from the settings,
      the project's `"forceConfirm"` the engine's own.
- [x] T4.6 The diagram's four levels (Context, Containers, Components, Code), over the factory's run file (the
      employee, the provider and the model of each station and step).
- [ ] T4.7 JetBrains: the run, the team and the settings in the tool window. Done: the run as `nuclear-builder …
      --events` with its questions as dialogs (a gate, QA's plan, the spending's two), the team chosen among `team
      list`, *Go On* and *Run a Station Again…* (only compiled). Left: the settings in the tool window (the money's
      confirmations: it always asks), JetBrains' bundle of texts (T4.2).
- [x] T4.9 The workbench: the n8n-like page (left: New, specs by component/layer, runs as an accordion of
      stations and steps; middle: the diagram; right: the node at its C4 level over the team and its log), VS Code
      (`src/panel.ts`, `src/workbench.ts`); JetBrains' window keeps its tree (its roadmap). Checked rendered in a
      headless browser and by `test/editors.test.ts`, not yet in a running VS Code (the tool's roadmap, *Untested*).
- [x] T4.10 The chat docked under the diagram, on `nuclear-builder chat --events` (`src/chat.ts`); its provider
      (`nuclear.builder.chat`) in the onboarding's providers step and in *Settings and integrations*.
- [ ] T4.8 Release of the extensions; the knowledge base follows.

## Phase 5: the workbench, second version (requirements 22 to 26)

- [x] T5.1 The team file: `description`, `logo` (`team logo <id> <image>`), each member's `name` and `personality`;
      the run file's `team`; tests (E).
- [x] T5.2 The company screen: teams as cards with logo, name, description and their work; a team opens to its
      members (U).
- [x] T5.3 The node as a debugger's tree; the log with the team's logo; *who* as one label; no team grid (U).
- [x] T5.4 The specs and the runs in the Workspace's column; the Builder's page without its left column (U).
- [ ] T5.5 The chat is Nuclear Chat (spec 013, phase 3).
- [ ] T5.6 Release; the knowledge base follows.
- [x] T5.7 (redone: painted portraits, req. 27 changed) The faces: the generator in Nuclear, 200 cyberpunk portraits, every editor and the chat show them; the
      employee's name first wherever a role shows (U, R).
- [x] T5.8 The temperaments: the compendium of 25 (`description`, `voice`, `look`), one per roster employee, the
      team's override, the member's prompt, the *Person* tab (E, U).
- [x] T5.9 The roster's genders and their spread per role (req. 29).
- [x] T5.10 The company screen as a cyberpunk HUD, the member's profile as a summed-up LinkedIn profile (req. 30, 31).
- [ ] T5.11 Every action a command and an MCP tool (`nuclear-builder mcp`), given to every agent; the inventory test; a real run from a chat message with Claude Code and OpenCode (req. 32). Done: the 47 tools and their inventory (`extensions/tools/nuclear-builder/docs/02-architecture/actions.md`), the commands they share with the pages, every agent given the server, the local member through the same tools, both tests; the end-to-end with the local Nuclear Developer. Left: the real run with Claude Code and OpenCode (prepared; it waits for the user's confirmation of its cost).
- [x] T5.12 Teams of any size (the team file's `members`, old files converted, who works a station), the new-team wizard, no presets (req. 33, ADR-platform-0010). Done: `teams.nuc` v2 and `suggest.nuc` (`team create`, `suggest`, `name-suggest`, `runnable`, `member add|remove|update`, their MCP tools), `memberFor` and `run --assign`, every member in the chat, the wizard in VS Code. Left in the Builder's roadmap: the Developer's pieces split among several developers; the tech lead's assignment from the chat.
- [x] T5.13 The language button and `nuclear.language` (auto: editor, else OS; en; es) across the pages, the host, Nuclear Chat and the agents (req. 18, amended). Done in VS Code (`language.ts`, `i18n.ts`: the globe, `l10n.t`, `localize`); JetBrains recorded in its roadmap.
- [x] T5.14 Skills as files: the library of tested skills and agent files, team and member skills (inheritance, member first), preview, clone, the skills editor, commands and MCP tools (req. 34). Done: `nuclear-agents/skills/` (31 skills: 16 domains, 10 technologies, 5 practices) and `nuclear-agents/agents/` (5 agents), checked by `roles/tests/test_library.nuc` (front matter, Spanish, sections, every command real) and rendered for every provider by the Builder's `tests/test_skills.nuc`; the team file's `skills` (library ids; an old team's words converted, the rest kept in its purpose) and `ownSkills`, the member's too and its base `agent`; `library.nuc`, `skills.nuc` (`skills list|show|clone|create|update|delete`, `team skills set`, seven MCP tools, the delete the user's); the wizard's step 2, the preview drawer, the skills editor, the team's *Team skills* and the member's Skills tab in VS Code. Left in the Builder's roadmap: the skills in the JetBrains tool window.
- [x] T5.15 Models from each provider, the wizard's model picker fixed, the RAM guard for local models (req. 35). Done: `models.nuc` (`models --json`, `models_list`, each provider's list, Ollama's models with their memory need and fit, the warnings and the MCP `needsUser`), the pickers as selects of every model in the wizard, its *same for* bar and the member's Brain (red too-big, a confirmation, the red line), the native lists themed. Left in the Builder's roadmap: the API lists with a real key, the memory on macOS and Windows, a GPU's own memory.
- [x] T5.16 The Delivery role becomes DevOps (`devops`): role folder, roster, skills, engine, UI, texts en/es; old `delivery` data converted on read (fixtures).

