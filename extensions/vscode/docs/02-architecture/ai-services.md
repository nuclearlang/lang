---
status: accepted
owner: Julian Molina
updated: 2026-11-17
related: [workspace.md, ../../../tools/nuclear-builder/AGENTS.md, ../../../tools/nuclear-atlas/AGENTS.md, ../../../../installer/docs/08-guides/ai-setup.md]
---
# The AI services in the editor: set-up, settings, connections, notifications

What Nuclear Builder and Nuclear Atlas need around them. The services themselves (the Smart Graph, the Nuclear Developer) and
their models are other projects; what a user does is in
[Set up the AI services](../../../../installer/docs/08-guides/ai-setup.md).

## The set-up (`setupPanel.ts`, `aiMachine.ts`; ADR-installer-0002)

The set-up is `nuclear-builder setup`, written in Nuclear
([`../../../tools/nuclear-builder/setup.nuc`](../../../tools/nuclear-builder/AGENTS.md), its data `setup.json`). The
extension runs it as a process, one call per action, and keeps no process of it alive:

| The extension asks | `nuclear-builder setup ...` | It gives |
|---|---|---|
| the page's state | `--plan --json --lang <en\|es>` | this machine, the profiles with `fit` and `note` (and `noteKey`, `noteArgs`: the page says the note in its language), the suggested one, the machine's choice, the AI root, the requirements of both modes (a `detail` with its `detailKey`); the profiles' and requirements' texts in the language asked (setup.json's `<field>_es` beside each English field). `--events` gives the steps' `ids` and `models` beside their English `titles`, said by the page in its language |
| the steps of a profile | `--events --profile <id> --from <step>` | one JSON line per event: `steps`, `step` (running with a line, done, failed), `done`; the page's messages as they are |
| whether the services start at login | `--status --json` | `atLogin`, what runs, the missing models |
| the models chosen in the settings | `--set CODER_MODEL=... ASSISTANT_MODEL=... NUCLEAR_GRAPH_EMBED=...` | written to `ai.env` |
| a service again | `--restart graph\|developer` | exit 0 when the system's manager restarted it |

- `aiMachine.ts` is what the extension reads itself, with no process: `machineFile()` / `readMachine()`
  (`~/.config/nuclearlang/ai.env`: Nuclear Builder's `defaultConfig` and `aiSettings` take their default models from
  it; a model set in the settings wins), `urls()` (the ports chosen there) and `builder(args)`, which runs the AI
  archive's `<installation>/ai/bin/nuclear-builder` (it runs before the set-up linked it onto the PATH), else the
  PATH's.
- The steps, in order, each can run again: the graph and the MCP server (the archive's launchers linked onto the
  PATH; from source `uv tool install`, editable), the AI clients (the MCP server added to every client found:
  Claude Code and Codex with their `mcp add`, Cursor, OpenCode and Gemini CLI in their JSON files, the rest of each file
  kept; spec 016), the Developer (in the archive; from source `nuclear install` and
  the `nuclear-developer` launcher), the models (Ollama's `/api/pull`), the ports (each service keeps its port when
  it already runs there, else the first one from 7878 / 7879 / 7880 (Nuclear Chat) upward it can listen on, written to `ai.env`;
  ADR-installer-0003 §5) and the graph's service, the knowledge base (`connect` twice, `ingest`), the Developer's
  service, Nuclear Chat's service (from source `nuclear-chat install`; `nuclear-chat serve` at login).
- `setupPanel.ts` is the welcome (*Nuclear: Welcome and Set-Up*, spec 011 requirement 14), *Next, Next* with a
  default on every step: 1 this machine and where the agents run, 2 the profile, 3 what it needs (polled every three
  seconds, a new plan), 4 the installation (an installer runs in a terminal, `createTerminal` + `sendText`, never
  hidden), 5 the toolchains (below), 6 the providers (Claude Code, Codex, Gemini CLI, OpenCode found on the PATH by running their command;
  Codex's and OpenCode's switch is their `nuclear.ai.*.enabled`; the API keys go to `nuclear-builder vault set
  <provider>` on stdin, asked hidden, never in a setting; and who works the Builder's chat by default, `nuclear.builder.chat`,
  chosen among the local agents, the agents and the APIs, with its model; a conversation can choose another), 7 the team (the squad screen mounted in the page,
  `TeamsHost`; with no team yet it opens the new-team wizard, `team create`: no team is cloned from a preset,
  ADR-platform-0010), 8 the spending (the `spending` section),
  9 each tool's settings (the sections of `settingsForm.ts`; an object setting with a `kind` and a `provider`, the
  chat's, is an *assignment*: a provider chosen by kind and a model, checked by `applySetting`), 10 a summary with *Change* on every line (the toolchains' line: the platforms and where each toolchain is).
  *Keep the defaults of the rest* jumps to the summary. `SetupPanel.offer` asks once while the welcome was never
  finished (`nuclear.onboarding.done`); *Settings and integrations* runs it again. Without the AI archive the
  machine steps say to run the installer again and the other steps still work.

## The toolchains (`toolchains.ts`, `toolchainHost.ts`)

What builds and runs each platform: Python (fastapi backends), Node.js (TypeScript, NestJS, React; npm and npx
next to it), Flutter's SDK (mobile, required). The settings `nuclear.toolchains.python|node|flutter` hold a path
(Flutter: the SDK's root or its `flutter`), `nuclear.toolchains.platforms` the platforms the user builds.

- **Into the environment**: `applyToolchains` (at activation, before the language server, and on every change)
  writes `toolchainEnv(settings)` into the extension host's `process.env` and the terminals' and tasks'
  `environmentVariableCollection`: `NUCLEAR_PYTHON`, `NUCLEAR_NODE`, `FLUTTER_ROOT` (and `FLUTTER` for an
  executable, a path ending in `bin/flutter` or `flutter.bat`). Every process the extension starts inherits it:
  `nuclear` (build, run, repair, explain), the language server, the Builder's processes (`toolEnv()` spreads
  `process.env`), the debuggers of the same host. With no Python setting it is the Python included with the
  installation (the AI services' own, `<installation>/ai/python/bin/python3`, Windows `ai/python/python.exe`); a
  variable the user set themselves stays while its setting is empty.
- **The status** of each: `nuclear doctor --json`'s `toolchains` (`found`: `env`, `nuclear`, `path`, `missing`;
  `path`, `version`) when the CLI has it, else `probe` in the CLI's order without running anything: the setting →
  the variable → NuclearLang's own (`<installation>/toolchains/<id>`; Python's included one first) → the PATH. A
  Python found in `ai/python` is shown as *included*.
- **The actions** (`handleToolchain`, the pages' `tc*` messages; ids and platforms checked, a path only from the
  dialog or the PATH): *Browse…* (Flutter: a folder or a file), *Install NuclearLang's own* (`nuclear setup <id>`
  in a terminal the user sees; the page checks again when it closes), *Use the one on PATH*, *Back to the default*.
- **The welcome's step**: which platforms (checkboxes: the setting, else the workspace's project cards, else all
  three), then the toolchains they need. Python, included, asks nothing. A missing Node.js or Flutter offers *I'll
  install it myself (I'll point to it)* (the dialog), *Install NuclearLang's own*, *Later*; Flutter is marked
  required for mobile. Settings and integrations has the section *Toolchains* with the same cards and the paths.

## Settings and integrations (`settingsPanel.ts`, `aiSettings.ts`, `localModels.ts`; ADR-platform-0003)

The tool `settings` of the strip (`Ctrl+Alt+S`).

- `aiSettings()` reads `nuclear.ai.*` (`contributes.configuration` of `package.json`). `machineConfig()` is passed
  to `readConfig(root, platform, machine)`: defaults < settings < the project's `.nuclear/builder.json`, which is
  shared with CI. `serviceEnv()` is the environment the graph and the Developer are started with (`CODER_MODEL`,
  `ASSISTANT_MODEL`, `OLLAMA_URL`, `NUCLEAR_GRAPH_EMBED`, the ports).
- The page:
  - **services**: their health urls; *Start* / *Restart* go through the system's services first, else spawn
    `<graphCommand> serve` / `nuclear-developer` (owned processes, stopped on deactivate);
  - **models**: Ollama's `/api/tags`; `billionsOf` (`localModels.ts`) counts a model's size from what Ollama
    reports, with the effective size of an `eNb` tag, against `MAX_BILLIONS` = 3.5 (the rule of the local models:
    at most the 3B class); *Pull* runs as a task;
  - **MCP**: registers `nuclear.ai.mcpCommand` (default `nuclear-mcp`, the server of
    [`tools/mcp/`](../../../../tools/mcp/AGENTS.md), started with no argument) in Claude Code
    (`claude mcp get|add --scope user`), Codex (`codex mcp list|add`), Cursor (`~/.cursor/mcp.json` merged) and
    OpenCode;
  - **connections**: `nuclear.ai.graphCommand` (default `nuclear-graph`)
    `requests|allow|deny|revoke|connect mcp`, Jira in the secret storage
    (`jiraAuth`), `gh auth status`;
  - **the toolchains** follow it: the cards above and the paths' form;
  - **the language** is the first section (as it is the onboarding's first step): `nuclear.language`, *Automatic*
    with what it resolves to here (`autoResolved`: *Español (from the editor)*), English, Español;
  - **the other sections** (Nuclear Builder, the spending, Nuclear Chat, Nuclear Atlas, HTTP Connections, the
    devices): `settingSections` reads `contributes.configuration` with the texts of `package.nls*.json` in the
    editor's language and the values now; the page draws each as a form (`FORM_JS`) and `applySetting` checks a
    value against its contributed type, enum and range before it writes it (the page is a trust boundary). The
    Builder's section has the default team (`nuclear.builder.team`, from `nuclear-builder team list`) and opens the
    squad screen; Nuclear Chat's has where its GIFs come from (`nuclear.chat.gifs`: `pack`, `tenor`, `giphy`) and
    *Keep a GIF service's key* (`chatGifKey`: the key asked in a password box and given to `nuclear-chat gif-key
    <service>` on its stdin, never a setting or a file); the welcome's *tools* step shows the same section; *Run the
    welcome again* opens the welcome.

## Settings by component (spec 011)

- One `contributes.configuration` section per tool, each read in code by its own module: `aiSettings.ts`
  (`nuclear.ai.*`), `../tools/nuclear-builder/src/settings.ts`, `spending.ts`, `chatView.ts` (`nuclear.chat.gifs`,
  given to the chat as the workspace's `gifs`, every project registered again when it changes), and the `settings.ts`
  of HTTP Connections and the devices. `nuclear.atlas.contextTokens` is read by nothing since Atlas's page is the
  chat (Atlas's roadmap).
- The settings that moved (`MOVED` in `migrateSettings.ts`: `nuclear.ai.claudeModel` → `nuclear.builder.claudeModel`,
  `nuclear.ai.claude.maxBudgetUsd` → `nuclear.spending.budgetUsd`, `nuclear.ai.resumeInterrupted`,
  `nuclear.ai.watch.minFreeMb` and `nuclear.ai.watch.commandTimeoutMinutes` → `nuclear.builder.*`,
  `nuclear.ai.contextTokens` → `nuclear.atlas.contextTokens`) are copied at start-up at every level where the user
  set them (user, workspace, folder); the old one is removed only once the new one holds the value, and a level
  where the new id already has a value keeps both.
- The money (`spending.ts`): `confirmSpending` asks twice (the second time with the amount and the providers) unless
  `nuclear.spending.confirm` is off; `nuclear.spending.forceConfirm` or `"forceConfirm": true` in the project's
  `.nuclear/builder.json` brings both questions back.

## Languages (spec 011)

English is the source and the fallback. The language is the setting `nuclear.language` (`auto`, the default; `en`;
`es`), decided in one place: `language.ts` (no `vscode` import, tested) resolves `auto` to the editor's display
language (`vscode.env.language`) when it is English or Spanish, else the operating system's (`LC_ALL`,
`LC_MESSAGES`, `LANG`, else `Intl`), else English; `i18n.ts` gives it to the extension as `lang()`, `langState()`
(the language and why: the setting, the editor, the system or the default) and `onDidChangeLang`.

- The host's texts are `l10n.t` of `i18n.ts` (not `vscode.l10n.t`, which follows only VS Code's language): English
  is the key, `l10n/bundle.l10n.es.json` the one Spanish source (`test/editors.test.ts` checks every one has its
  Spanish with the same placeholders).
- One dictionary per page (`en` and `es`, the same keys, checked by the compiler through `dictionary()` and by a
  test), given to the page by `pageI18n` (`LANG`, `T`, `t(key, ...args)`, the webview's `vscode` API, which a page
  never acquires again, and `langButton()`).
- The globe: `langButton()` in every page's header (the Builder, the company screen, Nuclear Atlas, Settings and
  integrations, the onboarding, HTTP Connections and its WebSockets panel, the workspace's column) and the status bar
  item (`$(globe) Auto|EN|ES`, command `nuclear.chooseLanguage`, which also takes `auto|en|es` as an argument for
  the agents). Its menu: *Automatic* (what it resolves to, and from where), English, Español, and one line saying
  that command titles and setting descriptions follow VS Code's language: VS Code draws `package.nls*.json`
  itself and an extension cannot change it.
- A change re-renders every open page at once (`localize(webview, render, again)`: the HTML again, then what a page
  without a `ready` of its own showed); Settings and integrations keeps its section and the onboarding its step.
  Nuclear Chat registers every project again with the new `lang` (the members answer in it), and the engine's
  calls pass it (`chat-host --lang`, `team roster|suggest|name-suggest --lang`). The devices' pages and the chat's
  full tab take the new language when they open next (a re-render would cut a device's live screen).
- The roster's profiles come from `nuclear-builder team roster --lang`. The machine's profiles and requirements in the welcome are `nuclear-builder setup --plan`'s texts, English
only today.

## Checked connections (`connections.ts`; ADR-platform-0003)

Every external connection of the extension: the Nuclear Developer, the Smart Graph, Ollama and the local models,
and each integration enabled in the settings (Claude Code, Codex, OpenCode, GitHub, Jira).

- `checkAll`: all of them. `checkForChat`: what a chat question needs. A Nuclear Builder run checks its own
  (`preflight` of the engine).
- `watchConnections`: every `nuclear.ai.checkEveryMinutes`; a connection that stops answering, or answers again, is
  a notice of kind `settings`.

## Notifications (`notifications.ts`; ADR-platform-0003)

What the local agents did while the user was elsewhere: a member answered, mentioned or asked the user in Nuclear
Chat, a Nuclear Builder run waits for the user, passed or failed, a connection stopped answering. One system every
tool uses.

- `src/notify.ts` holds the rules, with no `vscode` import (tested by `test/notify.test.ts`): `pops(kind, setting)`
  (the kinds `mention`, `gate`, `failed`, `done`, `info`; `nuclear.notifications` `all` pops every one,
  `mentions-and-gates` only `mention` and `gate`, `off` none), `seen` (the notice's tool or place is on screen),
  `add` (newest first, 50 at most; an unread notice with the same `key` within two minutes takes the repeat in
  instead of a new line and a new pop-up), `badges` (the unread count of each tool) and `chatCall` (below).
- `src/notifications.ts`: `notices` is the one store. `add` records it, fires `onDidChange` (the workspace draws its
  badges and list again) and pops a VS Code notification with *Open* unless it is seen, folded or not for this
  setting. `watch(tool, visible)` from the panels' `onDidChangeViewState` (the tool's notices are read);
  `look(place, visible)` for a place on screen (`chat:<root>:<channel>`: the Builder's docked chat on its team's
  channel, the chat tab on its channel); `open` is set by the workspace's `openNotice`: a Builder notice opens the
  page on its run (`ref`) and, for a failure, on the step that failed (`stage`, `step`, `BuilderPanel.drive`); a
  chat notice opens Nuclear Atlas on its channel (`AtlasPanel.show(…, channel)`); a settings notice opens
  *Settings and integrations*.
- Nuclear Chat's notices (`followChatNotices`, once per window, on `chat().onEvent`): `chatCall` calls the user for
  a member's message in a direct message (`dm-<member>`), a message with `@you`, a message with buttons (a spec's
  draft), an `ask` event, and the `done` event of a member's answer (no error). Never for the user's own messages,
  `system`'s, an edit or reaction of a message already met, a run's progress (`links.run`) or a run's question
  (`run|…` buttons: the Builder notifies those). A member's message and its answer's end fold into one notice
  (`chatKey`). They are Nuclear Atlas's notices; the chat opens on the channel, not on the message (the chat's page
  cannot open a thread or scroll to a message from its path yet: Nuclear Chat's roadmap).
- The workspace shows them: the badge on the Nuclear icon of the activity bar, a badge on the tool's icon of the
  strip, and one list of every tool's notices at the bottom of the column ([workspace.md](workspace.md)).
- Nuclear Builder's runs (`lines` in `tools/nuclear-builder/src/panel.ts`) and Nuclear Chat's connection
  (`chat()` in `src/chatView.ts`, one per window) are module-level: a page is only a view, so closing it or switching
  tools leaves the work running.

## Nuclear Chat (spec 013)

- `src/chatHost.ts` (no `vscode` import, tested by `test/chat.test.ts`): `readConnect` (`nuclear-chat connect
  --json`, the extension host only), `Relay` (each page's request ids kept apart, the token header added, one
  subscription per topic), `registration` (the Builder's host file → `POST workspaces`: faces as `data:` URLs; the
  general agent `atlas` comes with its choices, the agents of this machine, and its default for a new conversation
  is the setting `nuclear.builder.chat` when that agent is available, else the local one; each conversation then
  chooses its own in the chat's header), `ChatHost` (the one WebSocket, re-registered and caught up with `GET events?since=` after a
  reconnection, the host's own requests and events), and a run's posts (`runPosts`, `askPost`, `buttonOf`,
  `lineDiff`).
- `src/chatView.ts`: the window's `chat()`, `wireChat` (a page's frames ↔ the connection; `chatOpen` → `chatPath`
  or `chatError` with how to fix it), `chatScript` (the page's `nuclearChat(post)`: the embedded bundle imported
  from `out/chat-embed.js`, its bridge over `postMessage`), `chatCsp`, the tab (`openChatTab`, command
  `nuclear.chat.open`) and the GIF key (`nuclear.chat.gifKey`).
- `npm run chat` (in `compile`) copies `../../nuclear-chat/ui/build/app/dist-embed/embed.js` to `out/chat-embed.js`:
  build it first there (`nuclear build`, `npm run build:embed`).
