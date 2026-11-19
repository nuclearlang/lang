---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [engine.md, providers.md, teams-and-vault.md, ../../../../../nuclear-chat/docs/08-guides/connect-a-host.md, ../../../../../docs/04-specs/013-nuclear-chat/design.md]
---
# The Builder in Nuclear Chat

Nuclear Chat (ADR-platform-0008, spec 013) is where the user works with the team; the Builder is its host. The
engine gives the chat its members and how each one answers; the extension mounts the chat in the page, tells each
run in the team's channel, and does what its buttons ask.

## What the engine gives (`member.nuc`, `chat.nuc`)
- `nuclear-builder chat-host --json [--root] [--lang]`: the host file (the run's team, [engine.md](engine.md) "The
  team": every member, any number per role, as `<team>-<member id>` with their face, temperament, personality,
  responder and brain, who works them: `{agent, kind, provider, model, paid}`; the team with its tech lead, who
  answers a message to the team; `@<role>` reaches the role's first member as listed; the channels `general` and the
  team's). Several teams and none chosen: the error with `chooseTeam`.
- `nuclear-builder member --team <id> --member <member id> --events` (`--role <role>`: the role's first member;
  `--role chat`): the responder, one answer per message
  ([teams-and-vault.md](teams-and-vault.md), "A member in Nuclear Chat"). `--role chat` is the general agent
  (`--kind`, `--provider`, `--model`; the local Nuclear Developer by default).
- **The general agent is a front for any agent** (spec 013 requirement 17): the host file gives the member `atlas`
  (role `chat`, its direct message `dm-atlas`) with `responder.choices`, one per agent of `nuclear-builder agents`
  (`chat_agents.nuc`: the local Nuclear Developer always, Claude Code, OpenCode, Codex and Gemini CLI when their
  command is on the PATH, the API providers when the vault notes their key and a model has a price; each with
  `{id, label, kind, command, paid, models, defaultModel, available, why?}` and its command `member --role chat
  --kind … --provider …`), and `choice: "nuclear-developer"`. The user picks the agent and its model in the
  conversation's header; the chat runs that choice's command with `--model`. A spending confirmation holds only for
  the provider it named: another agent chosen for the same conversation asks twice again.
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
  tool: <name> ---` and its JSON, listed from the same server, called through it: `callBuilderTool`).
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
  `.nuclear/builder.json`: watched, one registration after a burst). A host file with `chooseTeam` asks once which
  team the project uses (a quick pick), saves it (`line set team=<id>`) and registers with it,
  and what a page missed is read back (`GET events/{ws}?since=`). A service that cannot be reached is said in the
  page with how to fix it (`nuclear-builder setup`).
- **The dock**: under the diagram, the chat mounted on the team's channel, folded and resized as before; *Open the
  chat* opens it as a full editor tab (also the command *Nuclear Chat: Open the Chat*).
- **A run is a thread** of its team's channel (`followRun`, from `driveRun`): the tech lead starts it (`run:<id>`,
  found again by the chat's search when the run goes on), each station that passes or fails is posted by the member
  of its role (a failure with `moment: "failure"`: the member's GIF personality applies), its end by the tech lead.
  A gate or QA's plan is the member's message with buttons (`run|<run>|<ask>|<answer>`); a click answers the run
  through `answerRun` (*Ask for a change* asks for the text in the editor) and the buttons go. The spending is told
  but confirmed only in the editor's two modal questions. A run of another team than the project's is told in
  `general`, as `system`.
- **A spec's thread**: *Polish in the chat* on a spec opens its thread in the team's channel (the tech lead posts
  `spec:<id>` with its text; once). A member's `spec_draft` is posted as the difference (`diff`) with *Accept* and
  *Discard*: the spec is written only on *Accept* (`spec accept`), and the specs' tree follows.
- **`/poc <what>`** (the chat's `action`): not available yet, and said so in its thread: the factory runs only on a
  project's own code, not on a scratch folder `.nuclear/poc/<id>/` (the roadmap).
