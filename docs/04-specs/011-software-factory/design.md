---
status: approved
owner: Julian Molina
updated: 2026-11-18
related: [requirements.md, tasks.md]
---
# Spec 011: the software factory — Design

## The parts

```
nuclear-agents/roles/<role>/          the one source of a role (files)
        │ read by
        ├── the factory's engine (Nuclear, python dialect: extensions/tools/nuclear-builder)
        │       stations → assignment → a provider → documents in specs/<id>/
        ├── the Nuclear Developer (LangGraph, local models): its graphs stay code, its prompts come from here
        └── the provider adapters: the role rendered as that agent's own skill / sub-agent / instructions
editors (VS Code page, JetBrains window): draw .nuclear/builder/runs/<id>.json and send the user's choices
```

## A role is a folder

`nuclear-agents/roles/` (the agents' project owns what an agent is):

```
roles/analyst/
  role.md            front matter: id, title, stations, default assignment; body: mission, inputs, outputs,
                     definition of done, what it never does
  skills/*.md        how-tos it may use (ask-the-client.md, read-the-graph.md, write-acceptance-criteria.md)
  templates/*.md     the documents it writes (analysis.md, questions.md)
  checks.toml        the checks it proposes: id, title, station, on by default, who runs it (role | user),
                     a command of .nuclear/builder.json or a prompt
```

The five roles: `analyst`, `architect`, `developer`, `qa`, `devops` (the Delivery station's role; its id `delivery` of
before is read as `devops` in a team, a run and a command: `roles.nuc`'s `OLD_ROLES`). Today's prompts
(`nuclear-graph-storage/prompts/*.md`, `prompts/agents/*.md`) move into the roles' skills and templates; the
Developer's LangGraph code keeps deciding *how* a 3B model is led (recall, write, repair with the compiler) and
reads *what* the role is from the folder. A change of a role's text is an evaluation round of the Developer
(`nuclear-agents/nuclear_developer/eval`), as a change of a prompt is today.

## Who does a role: the providers

| Kind | Providers | How the factory calls it | What the role becomes |
|---|---|---|---|
| `local` | the Nuclear Developer (Ollama, models ≤3B) | HTTP, as today (`/developer/*`) | its prompts |
| `agent` | Claude Code, Codex, Gemini CLI, OpenCode | the agent's command line, headless, with the Nuclear MCP server, in the project's folder | the agent's own format: a skill and a sub-agent for Claude Code (`.claude/skills`, `.claude/agents`), instructions for Codex (`AGENTS.md` section), Gemini CLI (`GEMINI.md`) and OpenCode (`.opencode/agent/<role>.md`), written into a temporary folder of the run, never into the user's files |
| `api` | Anthropic, OpenAI, Google, OpenRouter | the factory's own loop: the role's files as the system prompt, the Nuclear MCP server's tools as the model's tools | its system prompt and tools |

- An **agent** brings its loop, its file edits, its skills and sub-agents and its own login: no key. An **API
  model** is only a model: the factory runs the loop and needs a key from the vault.
- Each adapter is one Nuclear file with the same interface (`run(role, station, inputs) → events, documents,
  files, cost`); the exact flags of each command line are checked against the installed version's `--help` when
  its adapter is written, and recorded in the adapter's tests.
- The assignment (`.nuclear/builder.json`):

  ```json
  { "team": "night-shift" }
  ```

## The vault

API keys live in the system's keyring under the service `nuclear-factory` (libsecret's `secret-tool` on Linux,
Keychain on macOS, the Credential Manager on Windows), by the same rules as the Smart Graph's secrets
(`nuclear-graph-storage/secrets_store.nuc`): a closed keyring is waited for, never replaced by a file in the
project. The editors ask for a key once (VS Code's input box, password) and hand it to `nuclear-builder vault set
<provider>`; a run reads it when it starts and never writes it into a log or a run file.

## A run

1. Each station takes the documents of the stations before it and writes its own in `specs/<id>/` from its role's
   templates: `analysis.md`, `design.md` (with Mermaid diagrams and the ADRs it follows), `plan.md`,
   `test-plan.md`, the tests and the code in the project, `qa-report.md`, `definition-of-done.md`, `pr.md`.
2. A **gate** stops the run for the user where the line says (after Analysis, after Design, before Delivery by
   default): the questions to answer, the plan to approve or change.
3. The **checks** of every role are one list per run (`specs/<id>/checks.json`): on/off, station, who runs it, the
   user's own prompts. The QA station first writes its plan into that list and stops; the user switches checks,
   adds their own, runs those that are theirs (a load test) and marks them; then QA runs the rest.
4. **Delivery**: DevOps writes the documents (and the deployment's, when the change touches it), then, approved, makes the branch, the commit in the user's name and the pull
   request with `gh` (`pr.md` as its body).
5. The run file (`.nuclear/builder/runs/<id>.json`) keeps, for every step, the role, the provider and model that did
   it, its decisions and why, its documents and files, its cost: what the editors draw. Today's safety holds:
   what a failed step wrote is undone, a crashed run resumes.

Today's stages map onto the stations: Specification → Analysis; Generate and Plan → Design (the generators still
write first what follows from the data); Tests first; Code; Verification and Security → Quality; Artifacts and
Deploy → commands of the line, after Delivery.

## The page

- **The line** is a React Flow diagram (`extensions/tools/nuclear-builder/src/flow.tsx`, bundled apart as
  `out/builder-flow.js`), in two levels like C4. *The pipeline*: a node per station with its role's avatar, who does
  it (provider and model), its progress and the step on now; the one working has a light running round its border
  and the edge that hands work to it flows. *Inside a station* (the node's *Inside*, a double click, or the
  breadcrumb): the station as a boundary, its steps as components with the role that did each, the steps the agent
  followed under each step, the stations before and after as neighbours to walk to. Nodes can be dragged, the view
  zoomed and panned, a minimap shows the whole. A click on a role opens its assignment (kind, provider,
  model), its files (open in the editor) and its checks.
- **The console**: the run's checks as a table (on/off, title, station, who runs it, state) with *Add a check*
  (a prompt for a role); the user's checks have *Mark done* and *Failed*.
- **The settings of the line**: the stations that run, the gates, the team: kept in
  `.nuclear/builder.json`.
- The JetBrains window draws the same run file with the same parts.

## Teams

- **The roster**: `nuclear-agents/roles/<role>/roster/{en,es}.json`, 40 employees per role, the same ids in both
  languages: `{ "id", "name", "location", "age", "university", "profile", "bio", "hrNote", "stats": { six numbers
  0-99 named by the role (a developer's: speed, tests, naming, compiles, coffee, obedience) } }`. Satire, dark
  humour allowed, never about real people or protected groups. Shipped with the extension and with
  `nuclear-builder`.
- **A team**: `~/.config/nuclearlang/factory/teams/<id>.json` (the user's, never inside the extension's storage):

  ```json
  { "id": "night-shift", "name": "Night shift", "updated": 0, "budgetUsd": 5,
    "roles": { "developer": { "employee": "dev-017", "kind": "agent", "provider": "claude-code", "model": "haiku",
      "skills": ["tdd-in-nuclear"], "extraSkills": [{ "name": "…", "text": "…" }], "instructions": "…",
      "behaviour": { "askBeforeWriting": false }, "tasks": [{ "id": "…", "title": "…", "station": "code", "on": true }] } } }
  ```

  The engine composes a role as `role.md` + the skills switched on + the team's `instructions` and `extraSkills`;
  the role's files are never changed. A write is atomic (a temporary file, then a rename) and the previous version
  stays as `<id>.json.bak`. The commands, the editors' contract (one process per call, JSON on stdout, an error as
  `{"error": "…"}` with exit code 1): `team list --json` → `[{ "id", "name", "updated", "default" }]`;
  `team show <id> --json` → the team; `team save --json` reads a team on stdin, validates it, writes it and prints
  it; `team delete <id>`; `team default <id>`; `team export <id> <file>`; `team import <file> --json` → the team;
  `team roster [--lang en|es] --json` → `{ "<role>": [employees] }`; `team create --json` → a new team from the
  wizard's draft on stdin, its members' who-works not said the local defaults (the profile's Ollama models, the
  Developer `qwen2.5-coder:3b`, the rest `gemma4:e2b`; budget 5 USD); `team suggest`, `team name-suggest`, `team
  runnable`, `team member add|remove|update` (ADR-platform-0010; the whole contract is the Builder's
  `docs/02-architecture/teams-and-vault.md`). The run's team: the project's
  `.nuclear/builder.json` `"team"`, else the setting `nuclear.builder.team`, else the team the onboarding made.
- **The screen** (VS Code, `extensions/tools/nuclear-builder/src/teams/`): a football game's squad screen — a pitch
  with the five roles as positions, the hired employee's card on each (avatar, name, profile, stats as bars, the
  HR note), the roster as a scrolling row of cards to pick from (a card turns over to its full profile), and the
  hired one's settings (who does the work, model, skills, instructions, behaviours, tasks). Teams: new, rename,
  duplicate, delete (confirmed), export, import, set as default.

## Settings, onboarding and money

- **By component**: `contributes.configuration` is one section per tool (`nuclear.ai.*` the services,
  `nuclear.builder.*`, `nuclear.atlas.*`, `nuclear.http.*`, `nuclear.devices.*`, `nuclear.spending.*`); in code each
  tool reads its own through a `settings.ts` of its folder (`extensions/tools/<tool>/src/settings.ts`, the services'
  in `extensions/vscode/src/aiSettings.ts`). *Settings and integrations* shows the same sections, and the Builder's
  *Team…* and *Budget* open their section.
- **Onboarding**: the existing set-up wizard becomes the first-run welcome, every step with its defaults: 1 the
  machine and the profile, 2 what it needs, 3 the installation, 4 the providers (found on the machine: Claude Code,
  Codex, Gemini CLI, OpenCode; API keys into the vault), 5 the team (the new-team wizard), 6 the spending (budget, the confirmations), 7 the settings of each tool, then a summary. It can be run
  again from *Settings and integrations*.
- **Money**: `nuclear.spending.confirm` (default on: two questions, the second with the amount and the providers),
  `nuclear.spending.forceConfirm` (default off; also `"forceConfirm": true` in `.nuclear/builder.json`, which wins).
  The engine asks the editor (or the terminal) through the run's events before the first paid call; a run in CI
  needs `--confirm-spending`, refused when the project forces confirmation.

## The four levels of the diagram

`flow.tsx` draws *Context* (the project in the middle; you, the team's five, the providers in use, the Smart
Graph, GitHub around it, edges by who talks to whom), *Containers* (the stations), *Components* (inside a
station) and *Code* (inside a step: its trace, decisions, files and tool calls as nodes). The breadcrumb walks the
levels; a double click goes down.

## Languages

VS Code's own mechanism: `package.nls.json` and `package.nls.es.json` for what `package.json` contributes,
`vscode.l10n.t` with `l10n/bundle.l10n.es.json` for the host's texts, and the pages get their texts from the host
(one dictionary per page, `en` and `es`). JetBrains: a `messages/*.properties` bundle with its `_es` twin. The
roster has one file per language.

## The Builder's workbench

The page (`extensions/tools/nuclear-builder/src/panel.ts`, its diagram `flow.tsx`):

```
┌ New · specs by component ─┬─ the run's diagram (Context → Code) ─┬─ the node: its C4 level ─┐
│ ▾ booking                 │                                      │ what it is, did, decided │
│    ▸ domain / spec A      │   ○──○──●──○──○──○                   ├─ the team ───────────────┤
│ ▾ Runs (accordion)        │                                      │ the five, who works now, │
│    ▾ spec A: stations ▸   ├─ the chat (docked, resizable) ───────┤ the log of each one      │
│        steps              │ general agent · provider · model     │                          │
└───────────────────────────┴──────────────────────────────────────┴──────────────────────────┘
```

The spec form is no longer the page: *New* opens it in the middle (or the chat writes its base); a spec opens to
its runs. The left column, the chat and the right column can be folded; their sizes are kept per viewer.

## Specs by component and layer

`specs/<component>/<id>/spec.md` by default; `specs/<component>/<layer>/<id>/spec.md` (`presentation`, `domain`,
`data`) when the spec touches one layer; `specs/_global/<id>/spec.md` for the whole project. The component is a
business component of the project (`components/<name>/` of a Synapsis project), proposed by the analysis and
editable. The spec says it too (`- Component:`, `- Layer:`). A run's id stays the spec's id; the run file stays
`.nuclear/builder/runs/<id>.json` and names the spec's folder (`specPath`). `nuclear-builder spec new|list|move
--json` keep the layout; a spec of the earlier flat `specs/<id>/` is moved to its component (`spec migrate`).

## The chat

`nuclear-builder chat --events` (one process per conversation, JSON lines both ways, the history in
`.nuclear/builder/chat/<id>.jsonl`): the general agent, worked by the provider of the setting
`nuclear.builder.chat` (`{ kind, provider, model }`, chosen in the onboarding; default the local Nuclear Developer's
assistant), through the same adapters, with the Nuclear MCP server and the factory's commands as its tools (`spec
new` to write a spec's base, `runs`, `checks`, reading a run file). Its spending is confirmed twice like a run's.

*The chat above is replaced by spec 013 (Nuclear Chat): the Builder is its host; `nuclear-builder chat` gives way to
the responder `nuclear-builder member`.*

## The workbench, second version (requirements 22 to 26)

```
┌ Workspace column ─────────┬─ the run's diagram (Context → Code) ─┬─ the node ───────────────┐
│ + New spec                │                                      │ Tests first · failed 1m  │
│ ▾ booking                 │   ○──○──●──○──○──○                   │ ▸ Write the tests  ✗ Neo │
│    ▸ domain / spec A      │                                      │ ▾ Why it failed    Ana   │
│ ▾ Runs                    │                                      │    ▸ classify            │
│    ▾ spec A: stations     ├─ Nuclear Chat (spec 013) ────────────┤    ▸ explain             │
│        steps              │ #night-shift · thread run:spec-a     ├─ log ────────────────────┤
│                           │                                      │ ▸ Neo wrote 3 tests      │
│                           │                                      │ [logo] Night shift       │
└───────────────────────────┴──────────────────────────────────────┴──────────────────────────┘
```

- **Who**: one label everywhere, `<employee> · <role> · <provider> · <model>` (a local one: *Nuclear Developer ·
  qwen2.5-coder:3b*), from the run file's step (`employee`, `provider`, `model`), the role's long text only in a
  tooltip.
- **The node** is a tree: a step's row (status dot, title, who, time) opens to its children: the trace's items,
  each tool call (its input and output folded), the decisions, the files (a click opens the file); a child with
  children opens the same way. Keyboard: arrows move and open, Enter opens a file.
- **The log**: the run's lines newest last, one row each (avatar, who, what), a click opens its detail; the footer
  is the team's logo and name (`logo` of the team file).
- **The Workspace's column** (`extensions/vscode/src/workspace.ts`) asks the Builder for its sidebar (the specs'
  tree and the runs' accordion, the same code of `workbench.ts`) and shows it where the tool's description was; a
  click there drives the Builder's page (open a spec, pick a node, a new spec).
- **The team file** gains `"techLead"` (a role of the five, the Architect by default: answers for the team in
  Nuclear Chat),`"description"`, `"logo"` (a file name beside the team, `<id>.logo.<png|svg|jpg>`, copied
  there by `team logo <id> <image>`; none: initials drawn in the team's colour) and, per role, `"name"` (the
  member's name, the employee's by default) and `"personality"` (`{ "gifs", "on", "note" }`). The run file names
  the team (`team`: `{ id, name }`) so a run shows its logo after the team changes.
- **The company screen** (was the squad screen): the teams as cards (logo, name, description, what they work on);
  a team opens to its pitch of five members and their settings, as before.

## Faces and temperaments (requirements 27, 28)

- **The portraits are data, one source**: `nuclear-agents/roles/<role>/roster/faces/<employee id>.webp` (512 px, a
  few tens of KB), painted by a local image model: stable-diffusion.cpp (Vulkan, for the machine's GPU) with
  FLUX.1-schnell (Apache-2.0, so the images may ship in an open-source repository), driven by a generator written
  in Nuclear (`nuclear-agents/roles/faces.nuc`) that writes each employee's prompt from their profile, temperament,
  role and gender, with a fixed seed per employee, both kept in `roster/faces/faces.json` so a face can be made
  again. Checked in, read by every editor and by Nuclear Chat. The
  model is the developer's tool for making them, not a dependency of the platform: nobody needs it to use them.
- **The temperaments**: `nuclear-agents/roles/temperaments.json`, the compendium of 25 (`{ id, name: {en, es},
  description: {en, es}, voice, look }`: `description` one sentence for the screens, `voice` how a member of that
  temperament writes, for the member's prompt, `look` how the portrait shows it); each roster employee gets `"temperament"`; the team file's
  `personality.temperament` overrides it.

