---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [engine.md, providers.md, teams-and-vault.md, ../../../../../nuclear-chat/docs/08-guides/connect-a-host.md, ../../../../../docs/04-specs/013-nuclear-chat/design.md]
---
# The Builder in Nuclear Chat

Nuclear Chat (ADR-platform-0008, spec 013) is where the user works with the team; the Builder is its host. The
engine gives the chat its members and how each one answers; the extension mounts the chat in the page, tells each
run in the team's channel, and does what its buttons ask.

## What the engine gives (`member.nuc`, `chat.nuc`)
- `nuclear-builder chat-host --json [--root] [--lang]`: the host file of a project or a workspace (spec 023: every
  saved team, the one assigned to the folder first, [engine.md](engine.md) "The team"; none when none is saved: the
  local team a run takes is never a member of the chat, nobody could change it): every member, any number per role, as
  `<team>-<member id>` with their face, temperament, personality, responder and brain, who works them: `{agent, kind,
  provider, model, paid}`, their profile's `card` (`memberCard`: `{editable, temperament, temperaments: [{id, name}],
  skills (titles), instructions}`, editable for a saved team's member; the chat's profile changes them through the
  host: `team member update`), and `listed`: true only for each team's tech lead (the one it names, else its Architect,
  else its first member) and `atlas`; the teams with their tech lead, who answers a message to the team; `@<role>`
  reaches the role's first member as listed; the channels `home` (the folder's own, named after the workspace or the
  project: its member is the tech lead of the team assigned to the folder or to its workspace), `general` (its
  members: the listed ones but Atlas) and each team's (its members: its tech lead); `assigned`: the team assigned
  here, null when none is. With nobody in `home` (no team assigned: the host file the editor registers keeps the channels, not `assigned`) the
  editor (`panel.ts` `offerTeams`, listening from the extension's start: `followChat` is called at activation, so the
  chat's buttons are answered before the Builder's page was ever opened) posts in `home`, as Atlas, the
  saved teams as buttons (`team|assign|<id>`: its tech lead and whether it is free), or *Create a team*
  (`team|create`, the company screen) when there is none; a team chosen is `line set team=<id>` in the folder, and the
  folder is registered again so its tech lead joins `home`. Several teams and none chosen are no error here (`chooseTeam` is gone: every
  team is in the chat; a run still asks which one).
  The editor registers from it only the general agent and each team's tech lead (`registration` of
  `vscode/src/chatHost.ts`, spec 023): Nuclear Chat lists them and no other member; a run's station is then told by
  the tech lead (`placeOf`: a member the chat does not have is its team's lead); the other members' old
  conversations stay in the project.
- `nuclear-builder member --team <id> --member <member id> --events` (`--role <role>`: the role's first member;
  `--role chat`): the responder, one answer per message
  ([teams-and-vault.md](teams-and-vault.md), "A member in Nuclear Chat"). `--role chat` is the general agent
  (`--kind`, `--provider`, `--model`; by default the default external choice, `externalWorker`, while the local models
  are on standby, ADR-platform-0013: the local one asked is that choice too, and with none the command refuses with
  `NO_PROVIDER`; the local Nuclear Developer with them on).
- **A task is sized first** (spec 024 requirement 1, `leadSection` and `ATLAS_ROLE` of `member.nuc`): the tech lead
  counts the files and lines and whether a feature is added (`nuclear_doc("task-size")`); small or medium (≤ 10
  files, ≤ 400 lines, no new feature) is no run: the lead does it or one member does, saying which files changed; a
  large one is the plan, a spec and a run of the factory, with the size as the reason. Atlas says the size when it
  sends the user to a tech lead.
- **Nuclear Atlas only informs** (spec 023 requirement 1): its prompt (`ATLAS_ROLE` of `member.nuc`) explains
  Nuclear, the workspace and the projects from the Smart Graph and the project's map; asked for a task it sends the
  user to a team's tech lead, naming the free teams with their lead (its prompt's *The teams*, from `teamsAtWork`: a
  team with a run of the project running or waiting is busy), and with none free offers to make one with the Nuclear
  MCP server's team tools (each change asked first). Its tools are only those that read and teach: both MCP servers
  run with `--informs` (`nuclear-builder mcp --informs`: `INFORM_TOOLS` of `mcp.nuc`; `nuclear-mcp --informs`), and its
  local text tools are held to the same list: no `spec_new`, `run_start`, `run_answer`, no team changed by the
  Builder's tools.
- **The tech lead plans, explains and assigns** (spec 023 requirement 2): its prompt says that its first answer to a
  task is the plan, its first line `Plan: …` (what, how: the stations, the team's method; who does each part, by name and role, from *Your
  team, by station*), then `spec_new` with criteria and `run_start` assigning those members, and the run's progress
  told in the thread. Every member's prompt holds the team's method and instructions (`teamWay`, through
  `withSkills`).
- **A team's channel is its tech lead** (spec 023 requirement 8): Nuclear Chat runs the lead's responder for a
  message in the team's channel or a thread of it that mentions no member, the same command as its direct message;
  the prompt is the same but for the channel's name (`#<team>`, `, a thread`), with the same tools, spending and
  the run told in its thread. Another team's channel is that team's lead, with its own team, method and instructions.
- **Every channel is a memory** (`memory.nuc`, spec 023 requirement 8): besides the last 40 messages the chat gives
  verbatim, each channel keeps `.nuclear/builder/chat/memory/<channel>.jsonl` (a thread
  `<channel>/<thread>.jsonl`), one JSON line per fact, appended, written without a model call: `request` (the
  user's message, its first line, before the answer: `rememberAsked`), `spec` (`spec_new`: id, title), `run`
  (`run_start`: its id), `plan` (an answer's first line `Plan: …`; the tech lead's plan starts with it), `question`
  (an answer that ends asking), `message` (each message of the others, one line: `ChannelMemory` taps the member's
  events). The prompt's `## What this channel remembers` (before *The conversation so far*): newest first, a spec
  or run once (a run's state read from its file), a question only while no request came after it, a message only
  once the window no longer holds it, the message being answered left out; at most 40 lines and 4000 characters
  (`MEMORY_LINES`, `MEMORY_CHARS`). A thread reads its own, then its channel's; a channel never reads another's, nor a
  thread's; `dm-atlas` and a member's DM are channels of their own. A channel with no file has no section.
  `nuclear-builder chat memory <channel> [--thread <t>] [--clear] [--json]` shows it (`facts`, `threads`, `prompt`)
  or forgets it (a channel: with its threads).
- **The general agent is a front for any agent** (spec 013 requirement 17): the host file gives the member `atlas`
  (role `chat`, its direct message `dm-atlas`) with `responder.choices`, one per agent of `nuclear-builder agents`
  (`chat_agents.nuc`: the local Nuclear Developer only while the local models are on, Claude Code, OpenCode, Codex and Gemini CLI when their
  command is on the PATH, the API providers when the vault notes their key and a model has a price; each with
  `{id, label, kind, command, paid, models, defaultModel, available, why?}` and its command `member --role chat
  --kind … --provider …`; the local one offers only the machine's chat model, `CHAT_MODEL` of `ai.env`, else
  setup.json's `chat`), and `choice`: the default external choice (`externalWorker`, its `model` with it) while the
  local models are on standby, `""` with `why` (a provider must be chosen) when this machine has none;
  `"nuclear-developer"` with them on. The user picks the agent and its model in the
  conversation's header; the chat runs that choice's command with `--model`. A spending confirmation holds only for
  the provider it named: another agent chosen for the same conversation asks twice again. Only an API (kind `api`)
  asks it; an agent's subscription is not asked unless `forceConfirm` (the project's, or `--force-confirm`) is on.
- **The answer as it is written**: a chat's turn asks its adapter to stream (`inputs.stream`): Claude Code runs with
  `--include-partial-messages` and each piece of text is a `text-delta` event, told to the chat as
  `{"type": "text-delta", "text"}` (the event `message.delta`); the final `text` is still the answer. The other
  adapters give their text whole.
- **The language of an answer**: the prompt opens with it and says it again under the message to answer: the
  user's chosen language (the input's `lang`, `nuclear.language` resolved by the host), said in it too (*Responde en
  español.*); when the message's own words tell English from Spanish (`messageLanguage`) and that is not the chosen
  one, the member answers in the language the user wrote in. A small model follows one language it is told better
  than it tells the message's language itself (checked with the local 3B model: Spanish and English messages, both
  registrations).
- **A member's GIF**: when their personality sends GIFs (`gifs`: `sometimes` or `often`) and the chat gave the
  pack's tags (`gifTags`), the prompt says they may end an answer with one line `gif: <tag>` from that list, with
  their temperament's GIF habit (the sentences of its `voice` about GIFs), their moments (`on`) and when it fits (the
  user sent a GIF, a joke); a GIF the user sent is in the conversation (`[a GIF: <title>]`) and, just before the
  message, asks for a GIF back. `MemberLines` never tells that line as text (nor while it is being written: an end
  that may become it is held back) and gives its tag in `done` (`"gif": "<tag>"`); the chat chooses the GIF and
  caps it by the personality.
- A member's turn is `Chat`'s (`chat.nuc`, the base class): the whole conversation as one prompt, its factory tools
  run, six rounds at most, a role's files put back, the money confirmed twice inside the team's budget.
- **The factory's tools** are every action of the Builder ([actions.md](actions.md), ADR-platform-0009): a member
  can read a document of the project (`project_read`: slides as PDF or `.pptx`), write specs with their criteria
  (`spec_new` refuses one without them), start runs (`run_start`, apart: the host tells the run in its thread),
  answer their gates (`run_answer`), keep the teams and the line. An agent or an API model has them as the MCP
  server `nuclear_builder` beside `nuclear`; the local Nuclear Developer (no MCP) writes them in its answer (`---
  tool: <name> ---` and its JSON, listed from the same server, called through it: `callBuilderTool`). Its model's
  window is small (the Developer's `CHAT_MODEL`, 4096 tokens), so its prompt describes the tools a chat calls most
  (`LOCAL_CHAT_TOOLS`: `project_read`, the specs' `new`, `list` and `show`, `run_start`, `runs`, `run_file`,
  `run_answer`, `team_list`, `team_show`) and names the rest; and the body gives the Developer the user's last
  words as `query`, what it searches its graph and the project's files with (not the whole prompt).
  `spec_draft` (`id`, `text`: the spec's whole new markdown) writes `spec.draft.md` beside the spec, never over it.
- **What is the user's is asked in the chat**: a tool's `needsUser` (accept or discard a draft, delete a spec or a
  team, restart a run, the delivery gate, the line's gates, commands or forceConfirm, a CI file replaced) is an
  `ask` of kind `confirm`, applied on a yes (`applyForUser`); a run's `waiting: spending` is two `ask` of kind
  `spending` (`run-spending-1`, `-2`), and on two yeses the confirmation is kept in the run, which goes on. The
  member's own tools and its agent's MCP tool results (the adapter's `tool-result` events) are both read.
- `nuclear-builder spec accept <id>` puts the draft over the spec (atomically) and `spec discard <id>` throws it
  away (`spec_line.nuc`).

## What the extension does (`vscode/src/chatHost.ts`, `chatView.ts`; `src/panel.ts`)
- **The connection**: one WebSocket per window to the service, with the token of `nuclear-chat connect --json`
  (read by the extension host only; never in a page, a setting, a log or a file). Every mounted chat (the dock, the
  tab, Nuclear Atlas) relays its frames through it; the project is registered from the host file (each `face` read
  as a `data:` URL; the general agent's default for a new conversation is the setting `nuclear.builder.chat` when
  that agent is on the machine, else the local one), again on every reconnection, on a change of the chat's settings
  and when a team changes (a file of `factory/teams/`, `factory/settings.json`'s default team, a project's
  `.nuclear/builder.json`: watched, one registration after a burst), and what a page missed is read back (`GET events/{ws}?since=`). A service that cannot be reached is said in the
  page with how to fix it (`nuclear-builder setup`).
- **No chat in the Builder's page** (the user, 2026-11-20): the conversations are Nuclear Atlas's. A member (the
  team's roster in the spec form), the team (at the foot of the log), *Ask Nuclear Atlas* and *Polish in Nuclear
  Atlas* send `atlas` with the channel (`dm-<team>-<member>`, the team's id, else `teamChannel`), and the host runs
  `nuclear.atlas.open` (root, channel); the company screen does the same with `team:chat`. The chat as a full editor
  tab stays the command *Nuclear Chat: Open the Chat*.
- **A run is a thread** of its team's channel (`followRun`, from `driveRun`): the tech lead starts it (`run:<id>`,
  found again by the chat's search when the run goes on), each station that starts, passes or fails is posted by the
  member of its role in one line, a passed or failed one with its log folded (`details`, `stationDetails`: each
  step's line with the files it wrote, then the failed step's log; its last 4,000 characters), a failure with
  `moment: "failure"` (the member's GIF personality applies), its end by the tech lead. Each repair of the engine is
  posted once by the station's member, *failed and is being repaired: <the diagnosis's first line>*, the diagnosis
  folded: the run file's `repairs: [{ "station", "diagnosis", "at" }]` (spec 024 requirement 6), appended by the
  engine, read by `runPosts` (the ones after the last seen). An answer to a gate says it was the user's
  (*Answered by you: …*).
  A gate or QA's plan is the member's message with buttons (`run|<run>|<ask>|<answer>`); a click answers the run
  through `answerRun` (*Ask for a change* asks for the text in the editor) and the buttons go. The spending is told
  but confirmed only in the editor's two modal questions. A run of another team than the project's is told in
  `general`, as `system`.
- **A spec's thread**: *Polish in Nuclear Atlas* on a spec opens its thread in the team's channel, then Nuclear Atlas on it (the tech lead posts
  `spec:<id>` with its text; once). A member's `spec_draft` is posted as the difference (`diff`) with *Accept* and
  *Discard*: the spec is written only on *Accept* (`spec accept`), and the specs' tree follows.
- **`/poc <what>`** (the chat's `action`): not available yet, and said so in its thread: the factory runs only on a
  project's own code, not on a scratch folder `.nuclear/poc/<id>/` (the roadmap).
