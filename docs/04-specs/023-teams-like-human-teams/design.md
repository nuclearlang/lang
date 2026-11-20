---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, tasks.md, ../../../extensions/tools/nuclear-builder/docs/02-architecture/teams-and-vault.md, ../../../extensions/tools/nuclear-builder/docs/02-architecture/chat.md]
---
# Spec 023 — Design notes: the engine's contract

What Nuclear Builder (`nuclear-builder`), the MCP server and Nuclear Chat give the editors for this spec.

## The team (`team show|screen --json`, `team save`)
- `method`: the text the user wrote, `""` for Scrum (the default). `methodText`: what the members follow (the
  user's text, else `SCRUM_METHOD`). `instructions`: what every member follows, `""` by default.
- `brain`: `{ "kind": "agent" | "api", "provider", "model" }` or `null` (each member its own).
- Each member: its effective `kind`, `provider`, `model` and `inheritsBrain` (true: worked by the team's brain).
- `team save` of the whole team keeps `method`, `instructions` and `brain`; a member saved with `inheritsBrain:
  true` is stored without its own brain.
- A team of before (no `method`, `instructions`, `brain`): Scrum, `""`, `null`, every member `inheritsBrain: false`
  (converted on read, nothing written).

## The commands
- `team update <id> --method <text> --instructions <text>`.
- `team update <id> --kind <agent|api> --provider <p> --model <m>`: sets the brain and puts every member on it (their
  own give way); a kind without its provider takes the kind's first. `--no-brain`: takes it away, each member keeps
  the brain it worked with. A brain this machine cannot work is refused (`{ "error" }`, exit 1).
- `team member update <id> <member> --kind|--provider|--model …`: the member's own, which wins. `--team-brain`:
  back to the team's. A member added without a who-works takes the team's brain.
- `team create` (stdin draft): also `method`, `instructions`, `brain`.
- MCP: Builder's `team_update` (`method`, `instructions`, `kind`, `provider`, `model`, `noBrain`), `team_member_update`
  (`teamBrain`), `team_create` (`method`, `instructions`, `brain`); the Nuclear MCP server's `team_create` and
  `team_edit` (`method`, `instructions`, `kind`, `provider`, `model`).

## The teams' state (`team list --json`, `team screen`'s `teams`, the tool `team_list`)
Each team also has `lead` (`{ "id", "name", "role" }` of its tech lead, or `null` without members), `running` (the
ids of the runs of the current project running with a live owner or waiting) and `free` (`running` is empty).

## The chat's roster (`chat-host --json`)
- Every saved team, the project's first (the local team when none is saved); several teams and none chosen are no
  error (`chooseTeam` is no longer given).
- Every member of each team is in `members` (a run's station can still be told as them), with `listed`: true only
  for the team's tech lead (`techLead`, else its first Architect, else its first member) and for `atlas`.
- Channels: `general` (members: the listed ones but Atlas) and one per team (members: its tech lead).
- Nuclear Chat (`Member.listed`, default true): a direct message and a place in `#general` only for a listed
  member; a direct message kept with a member no longer listed stays (readable, out of the sidebar, found by the
  quick switcher by the member's name); the members list shows the listed ones.

## Atlas and the tech lead
- Atlas (`member --role chat`) only informs: its MCP servers run `--informs` (`nuclear-builder mcp --informs`,
  `nuclear-mcp --informs`): no tool writes a spec, starts or answers a run, builds or generates; teams are made with
  the Nuclear MCP server's team tools, which ask first. Its prompt lists the teams with their lead and free/busy.
- The tech lead's first answer to a task is the plan (what, the stations, who of *Your team, by station*), then
  `spec_new` with criteria and `run_start` assigning those members, and the progress in the thread. Every member's
  prompt has the team's method and instructions.

## The spending
Asked only for kind `api`; an agent (`claude-code`, `codex`, `cursor`, `gemini-cli`, `opencode`, `grok`) is not asked;
`forceConfirm` (the project's, or `--force-confirm` from the setting) asks it of every paid provider. The same rule in
a run (`waiting: spending`, `paidOf`), in a detached run and its tools, and in the chat.
