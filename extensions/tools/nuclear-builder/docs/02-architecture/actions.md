# The actions: every button is a command and a tool

ADR-platform-0009: the UI is only a UI. Every action of the Builder's page, the company screen and the Builder's
settings is a command of `nuclear-builder` (Nuclear, `--json`), and every command an agent may use is a tool of the
Builder's MCP server, `nuclear-builder mcp` (`tools.nuc`, `mcp.nuc`), with the same name and arguments. The page and
the agents are two clients of the same commands. A test holds the three together (`tests/test_tools.nuc`: every
tool is in this page and its command in the help; `test/editors.test.ts`: every message of the pages names a
command of this page).

**Who** says who may do it through a tool:

- **anyone**: an agent does it by itself.
- **spending**: it may start a paid provider. The tool never confirms the money: it answers `{"waiting": "spending",
  "run", "spending": {roles, providers, budgetUsd}}` and the run waits. The user confirms twice where they answer:
  the editor's two modal questions (Resume on the page, spec 011 requirement 16) or the chat's two `ask` (the member
  asks them, then `applyForUser("run_spending")` keeps the confirmation in the run and resumes it). *Force
  confirmation* holds: only `--confirm-spending` is refused by it, never the user's own answers.
- **user**: it destroys, or it acts in the user's name. The tool answers `{"needsUser": {tool, input, question,
  command}}` and changes nothing; the chat asks the user (`ask` of kind `confirm`) and applies it on a yes
  (`applyForUser`); elsewhere the agent tells the user, who does it on the page or with the `command`.
- **host**: no tool. It belongs to the machine, the keyring or the editor.

Merging a pull request is never a tool, nor a command.

**In a workspace** (the tools of a workspace's own channel, `.workspace/workspace.nuc`) the specs and runs are its
apps': `spec_new` takes `app` (refused without one, with the apps), every tool of a spec or a run by its id works in
the app that holds it (`homeOf`), `spec_list` and `runs` say each one's `app`, and a spec at the workspace's root is
never run there (a workspace is no project).

## The specs

| Action (page) | Command | Tool | Who |
|---|---|---|---|
| New spec (the form; with its criteria) | `spec new --title … --component … [--layer] [--use-case] [--description] [--criteria …]… [--stdin]` | `spec_new` (criteria required: the tool asks for them; in a workspace `app` too, the app the spec is for) | anyone |
| The specs' tree | `spec list --json` | `spec_list` | anyone |
| Open a spec | `spec show <id> --json` | `spec_show` | anyone |
| Replace a spec's text (its whole markdown; the Nuclear MCP server's `spec_edit`, the user's yes asked there) | `spec update <id> --stdin` | `spec_update` | user |
| A member's draft (*Polish in the chat*) | — (the chat's tool) | `spec_draft` | anyone |
| Accept a draft (button in the thread) | `spec accept <id>` | `spec_accept` | user |
| Discard a draft | `spec discard <id>` | `spec_discard` | user |
| Move a spec | `spec move <id> --component … [--layer …]` | `spec_move` | anyone |
| Migrate the flat specs | `spec migrate` | `spec_migrate` | anyone |
| Delete a spec (to `.nuclear/builder/deleted/`) | `spec delete <id>` | `spec_delete` | user |

## The reports

| Action (page) | Command | Tool | Who |
|---|---|---|---|
| The *Reports* page: the bill and the Jira-like views, with its filters (spec 017) | `metrics [--project <name\|dir>] [--team <id>] [--member <id>] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--by day\|week] [--view <view>] --json` | `metrics` (`since`/`until` for `--from`/`--to`: `from` is a reserved word of Nuclear) | anyone |
| A member's numbers in the member panel's Summary | `metrics --team <id> --member <id> --view people --json` | `metrics` | anyone |

## The runs

| Action (page) | Command | Tool | Who |
|---|---|---|---|
| Start a spec, or several in one run (in order, one bill), with a team (`--assign <role>=<member>`: who works a role; else its first member) | `run <spec.md> [<spec.md>…] [--team <id>] [--assign …] --events` (the page) · `--detach` (apart) | `run_start` (`spec`, or `specs`) | spending |
| Resume a run that waits | `run --resume <id>` | `run_resume` | spending |
| *↻ Retry "<step>"* (the page's main action on a run that failed or waits for its retry: the smallest unit that failed, in place), *Retry this step* or the tree's *↻* on a failed step or a failed attempt inside it (in place, its files kept), *Run again from this step* on one that passed, *Run <station> again* | `retry <id> [--step <step> \| --from <station>] [--yes]` (`--plan --json`: the files it would take back, none in place, which the page asks about in a modal before it passes `--yes`) | `run_retry` (`confirm`: refused without it when it would take back the agents' work) | spending; taking back the agents' work: user |
| Start over from the Analysis (its files go back, set aside first) | `restart <id> --yes` (the page's modal first; without `--yes` a terminal is asked, anything else refused) | `run_restart` | user |
| Stop | `run stop <id>` | `run_stop` | anyone |
| The runs | `runs --json` | `runs` | anyone |
| A run's file | `run show <id>` | `run_file` | anyone |
| A run's journal | `run journal <id>` | `run_journal` | anyone |
| Answer a gate: Approve / Ask for a change / Later; QA's plan: Go on; a station that waits for its retry (`kind: retry`): Retry (`yes`) / End as failed (`no`) / Later (`stop`) | `run answer <id> --answer approve\|change\|stop\|yes\|no [--text …]` | `run_answer` | anyone; the delivery gate (a commit and a pull request in the user's name): user; the spending: never (above) |

`run answer` reaches a run's process through `.nuclear/builder/runs/<id>.answer.json` when one waits on the
question (the process reads it beside its stdin), else the run goes on with the answer (`--events` for the page,
`--detach` for an agent).

## QA's plan (the run's checks)

| Action (page) | Command | Tool | Who |
|---|---|---|---|
| The checks | `checks <id> --json` | `checks` | anyone |
| Switch a check on or off | `checks <id> on\|off <check>` | `check_switch` | anyone |
| Add a check of yours | `checks <id> add --title … --station … [--by user\|role] [--prompt …]` | `check_add` (no `--command`: the shell runs only the user's data) | anyone |
| Mark a check done, failed or skipped | `checks <id> mark <check> passed\|failed\|skipped [--note …]` | `check_mark` | anyone |
| Go on with the plan | `run answer <id> --answer yes` | `run_answer` | anyone |

## The teams (the company screen)

| Action | Command | Tool | Who |
|---|---|---|---|
| The company screen, opened or a team opened: everything it draws in one process (the teams, each one shown, the roster with each face's `face` and `thumb`, the temperaments, the vault's providers) | `team screen [--lang en\|es] --json` | — (one read for a page; an agent asks `team_list`, `team_show`, `team_roster`, `team_temperaments`, `vault_list`) | the page |
| The teams, each with its tech lead (`lead`: id, name, role) and the runs of this project it has in progress (`running`, `free`) | `team list --json` | `team_list` | anyone |
| Open a team | `team show <id>` | `team_show` | anyone |
| New team (the wizard's *Create team*) | `team create` (the draft on stdin: identity, purpose, skills, members, tech lead) | `team_create` | anyone; a local model too big for this machine's memory: user (it can make the computer restart; the answer carries `warnings`) |
| Suggest members for the purpose and skills (wizard, step 3) | `team suggest [--purpose …] [--skills a,b] [--lang]` | `team_suggest` | anyone |
| Suggest a name (wizard, step 1) | `team name-suggest [--purpose …] [--lang]` | `team_name_suggest` | anyone |
| Whether the team can run (a member of each role the stations need) | `team runnable <id>` | `team_runnable` | anyone |
| Add members (several at once) | `team member add <id> --role … [--employee …] [--kind] [--provider] [--model] [--name] [--count n]` · a JSON list on stdin | `team_member_add` | anyone; a local model too big for this machine's memory: user (it can make the computer restart; the answer carries `warnings`) |
| Remove a member | `team member remove <id> <member>` | `team_member_remove` | user |
| Save a member: who works it (kind, provider, model: one this machine has; its own wins over the team's brain, `--team-brain` gives it back), skills, extra skills, instructions, personality, temperament, name | `team member update <id> <member> [--kind] [--provider] [--model] [--team-brain] [--employee] [--name] [--skills] [--extra-skills <json>] [--instructions] [--temperament] [--gifs] [--on] [--note]` (the page saves the whole team: `team save`) | `team_member_update` | anyone; a local model too big for this machine's memory: user (it can make the computer restart; the answer carries `warnings`) |
| Rename, description, purpose, skills, tech lead (a member), budget, method (empty: Scrum), instructions every member follows, the team's brain for every member (`--no-brain`: each keeps its own) | `team update <id> [--name] [--description] [--purpose] [--skills] [--lead <member>] [--budget] [--method] [--instructions] [--kind --provider --model] [--no-brain]` (the page may save the whole team: `team save` keeps `method`, `instructions`, `brain`) | `team_update` | anyone |
| Duplicate | `team duplicate <id> [--name …]` | `team_duplicate` | anyone |
| Delete (to `<id>.json.bak`) | `team delete <id>` | `team_delete` | user |
| Make it the default | `team default <id>` | `team_default` | anyone |
| Export / import (a file of the project for a tool) | `team export <id> <file>` · `team import <file>` | `team_export` · `team_import` | anyone |
| The logo | `team logo <id> <image>` · `--clear` | `team_logo` | anyone |
| The hiring pool | `team roster --lang en\|es` | `team_roster` | anyone |
| The temperaments | `team temperaments` | `team_temperaments` | anyone |
| Keep an API key | `vault set <provider>` (stdin) · `vault remove <provider>` | — | host (a key never passes through an agent) |
| Which keys are kept | `vault list` | `vault_list` | anyone |

## The skills (spec 011 requirement 34)

A skill is a `SKILL.md`: the library's (`nuclear-agents/skills/`, read-only: cloned to be changed), or a team's or a
member's own (`ownSkills` of the team file). A member gets its role's skills switched on, the team's, its base
agent's and its own; a member's own skill wins over the team's, the team's over the library's
([teams-and-vault.md](teams-and-vault.md), "Skills").

| Action (page) | Command | Tool | Who |
|---|---|---|---|
| The library (the wizard's chips by kind, the agents a member can take as base) and a team's or a member's skills, with where each comes from | `skills list [--team <t>] [--member <m>] [--lang en\|es] --json` (the page reads the library with its files in `team screen`) | `skills_list` | anyone |
| Preview a skill's file (the drawer) | `skills show <id> [--team <t>] [--member <m>] [--lang]` | `skills_show` | anyone |
| *Clone into the team* / *Clone into a member* | `skills clone <id> --team <t> [--member <m>]` | `skills_clone` | anyone |
| The skills editor: *Save* a new skill / a changed one (its SKILL.md on stdin) | `skills create --team <t> [--member <m>]` · `skills update <id> --team <t> [--member <m>]` | `skills_create` · `skills_update` | anyone |
| Delete an own skill (asked first) | `skills delete <id> --team <t> [--member <m>]` | `skills_delete` | user |
| A library skill's chip switched on or off (the team's *Team skills*, the member's Skills tab) | `team skills set <t> [--member <m>] --skills a,b` | `team_skills_set` | anyone |
| A member's base agent (the Skills tab) | `team member update <t> <m> --agent <id>` (empty: none) | `team_member_update` | anyone |

The wizard keeps a new team's skills and clones in its draft until *Create team* (`team create` with `skills`,
`ownSkills` and each member's `skills`, `ownSkills`).

## The line (`.nuclear/builder.json`), CI, the connections, a file

| Action | Command | Tool | Who |
|---|---|---|---|
| The line's settings | `line show` | `line_show` | anyone |
| Set the team, the stations, the branches | `line set team=… stations=[…]` | `line_set` | anyone |
| Set the gates, the commands, forceConfirm, the addresses, the prices | `line set KEY=<json>` | `line_set` | user (the gates are the user's stops, the commands run in the shell, forceConfirm guards the money) |
| *Pipeline settings* (opens the file; writes its defaults first) | `line set stations=… gates=… forceConfirm=false` | — | the page |
| Export the CI file (it installs Nuclear with the installer of `nuclearlang/nuclearlang`) | `export github\|gitlab\|bitbucket --json` | `ci_export` | anyone; replacing a file: user |
| Compare the CI file with the line's (nothing written) | `export github\|gitlab\|bitbucket --print [--json]` | `ci_preview` | anyone |
| *Check the connections* | `connections [--team <id>] --json` | `connections_check` | anyone |
| The agents a conversation can choose (the chat's dropdown) | `agents --json`: the local Nuclear Developer (always), each agent whose command is on the PATH, each API provider with a key noted by the vault and a priced model; `{id, kind, provider, label, models, defaultModel, available, paid, why?}` | `agents_list` | anyone |
| The models of each provider (the wizard's and the member's model pickers) and this machine's memory | `models [--provider <id>] [--fresh] --json`: from the provider (Claude Code's aliases and ids, `opencode models`, an API's list with a key in the vault, Ollama's installed models with each one's memory need and fit plus the small ones it can pull); `{memory: {totalGb, availableGb}, providers: {<id>: {kind, models: [{id, family, version, label, alias?, installed?, sizeGb?, params?, needGb?, fit?, downloadGb?, priced?}], free, source, why?}}}`; kept 10 minutes | `models_list` | anyone |
| Read a document of the project (slides, a brief) | `read <path>`: a PDF by `pdftotext` (said when missing), a `.pptx` from its XML, markdown and text; other office files are refused with how to convert them; confined to the project | `project_read` | anyone |

## What stays with the host

| Action | Where | Why |
|---|---|---|
| The set-up of the AI services | `nuclear-builder setup …` | the machine's, not a project's |
| A member's answer, the chat's host file (with the general agent's choices) | `member`, `chat-host` | the chat runs them; an agent is the member |
| The project's commands | `nuclear-builder ci` | the stations run them; the agents never get a shell |
| The Builder's settings (`nuclear.builder.*`, `nuclear.spending.*`) | the editor's settings page | the editor's, not the project's |
| The form's helpers: Jira and GitHub issues, the context suggested, the pieces the local Developer proposes | `src/support.ts`, the page | they fill the form; the agents have the Nuclear MCP server and the issue's text (roadmap: as commands) |
| Open a file, the chat's tab, the company screen (`teams`; `wizard`: its new-team wizard, the page's *Build a team*) | the editor | drawing |

57 tools; with the host's, 73 actions.
