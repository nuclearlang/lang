# Set up the AI services

NuclearLang comes with two services that run on your machine: the **Smart Graph** (what an agent needs to know about
NuclearLang and Synapsis, read through the MCP server your agent talks to, `tools/mcp`) and **Nuclear Chat** (the
factory's workplace, where Nuclear Builder's teams and Nuclear Atlas answer you). Both are required: every install
has them, with the graph's own small model and no question ([what gets installed](what-gets-installed.md)).

The AI work is done by the agents and API providers you choose (Claude Code, Codex, Gemini CLI, Cursor, OpenCode,
Grok Build; Anthropic, OpenAI, Google, OpenRouter). **The local models are on standby** (ADR-platform-0013): no
Ollama, no local model and no Nuclear Developer is offered or installed, and the set-up has one profile, `remote`.

## 1. Start it

| Where | How |
|---|---|
| The installer | `curl -fsSL https://nuclearlang.github.io/install.sh \| sh` runs it at its end, with no question |
| VS Code | the offer the first time the extension starts, or *Nuclear: Set Up the AI Services* in the command palette, or *Set-up…* in *Settings and integrations* (`Ctrl+Alt+S`) |
| A terminal, any time | `nuclear-builder setup --profile remote --yes` |

The same steps run in the three. Run it again at any time: what is installed is kept.

## 2. The steps

1. **What it needs.** NuclearLang (the `nuclear` command, the code of the services); from the source tree also
   [uv](https://docs.astral.sh/uv/) (the Python environments of the services). A release's archive brings its own
   Python: nothing else is needed.
2. **What was local.** On a machine an earlier version set up with a local profile, a first step takes away what
   NuclearLang put there for the local models: the Nuclear Developer's service and launcher, the models NuclearLang
   downloaded, and Ollama when NuclearLang installed it (what was on the machine before stays, ADR-installer-0005).
   `ai.env` becomes `remote`, and the step says what it removed and how many GB were freed.
3. **Install.** The Smart Graph and the MCP server, the MCP server added to every AI client on this machine
   (Claude Code, Codex, Grok Build, Cursor, OpenCode, Gemini CLI: an agent opened in any of them finds Nuclear with no
   step of yours), the graph's model, the knowledge base loaded into the graph (a few seconds with the vectors the
   release computed; about ten minutes on a processor when they cannot be downloaded; an update whose knowledge base
   did not change keeps the vectors already here, checked against the release's SHA-256, and downloads nothing), and the Smart Graph and Nuclear
   Chat started. A step that fails says why and is tried again from there.

## 3. The profile

| Profile | Models | Downloads | Memory | Measured |
|---|---|---|---|---|
| `remote` | none (the Smart Graph's own) | 0.3 GB | 2 GB | only the Smart Graph and Nuclear Chat run on this machine |

The Smart Graph's model is EmbeddingGemma in ONNX (0.3 GB, counted above), which makes the graph's vectors: the graph
runs it itself, inside its own process, so it needs no Ollama.

**`remote`: Remote agents and the Smart Graph.**

- Works: the generators (a resource, a use case, a screen) from your agent.
- Works: the compiler's checks and fixes, the documentation of every kind and decorator.
- Works: nuclear build, test and migrate from your agent.
- Works: the Smart Graph: the strategy of each request and the search of the knowledge base, for your agent.
- Works: Nuclear Builder and Nuclear Atlas in the editor, worked by the agents and API providers you choose, in Nuclear Chat.
- Does not, or less: your agent writes every line the generators do not: all of it is paid tokens.
- Does not, or less: the local models are on standby (ADR-platform-0013): nothing is answered by a model of this machine but the Smart Graph's own.

### On standby

The profiles `lite`, `medium` and `hard` (local models through Ollama, the Nuclear Developer) stay in Nuclear
Builder's data and code but are not offered nor installable: `nuclear-builder setup --profile lite` says they are on
standby, and an installer given one (`--profile`, `-AiProfile`, `NUCLEAR_AI_PROFILE`, or a profile an earlier install
kept in `ai.env`) takes `remote` and says so. Turning them on again is a decision of the user: the switch
`localModels` of Nuclear Builder's `setup.json`, with their own tests on each system that day.

## 4. After the set-up

The services start at every login and are started again if they fail: the Smart Graph and Nuclear Chat (its token is
made the first time and kept in your keyring; the editors get it from `nuclear-chat connect --json`).

| | Linux | macOS | Windows |
|---|---|---|---|
| What starts them | two systemd user units | two launch agents | a script of the Startup folder |
| State | `systemctl --user status nuclear-graph nuclear-chat` | `launchctl print gui/$UID/io.github.nuclearlang.graph` | `nuclear-builder setup --status` |
| Restart | `systemctl --user restart nuclear-chat` | `launchctl kickstart -k gui/$UID/io.github.nuclearlang.chat` | sign out and in |
| Their output | `journalctl --user -u nuclear-graph -n 50` | `~/Library/Logs/nuclear-graph.log` | |

`nuclear-builder setup --status` says on every system what is installed and running. In VS Code, *Settings and
integrations* shows the same and restarts a service with a button.

| What | Where |
|---|---|
| Your choice (the mode, the profile, the ports) | `~/.config/nuclearlang/ai.env` (`%APPDATA%\nuclearlang\ai.env`) |
| The code of the services | `~/.local/share/nuclearlang/ai/` (`%LOCALAPPDATA%\nuclearlang\ai\`) |
| The graph's data, encrypted | `~/.local/share/nuclear-graph/` |

In idle the two services take about 150 MB of memory.

To give your agent the MCP server: the buttons of *Settings and integrations*, or
`claude mcp add --scope user nuclear -- nuclear-mcp` ([every client](../../../tools/mcp/docs/08-guides/mcp.md#1-set-up)).

## 5. Update and remove

- **Update:** run the installer again, or `nuclear update` (in a terminal `nuclear` also asks when a new release is
  out). It brings the new version and sets the services up again with the profile `remote`, without questions; a
  machine that had a local profile loses what NuclearLang put there for it (step 2 above).
- **A client installed later** (Claude Code, Codex, Grok Build, Cursor, OpenCode, Gemini CLI): `nuclear-builder setup --clients`
  adds the MCP server to it.
- **Remove:** `nuclear-builder setup --remove` takes the services away, and the MCP server out of each AI client;
  the graph's data stays. `--remove --all` also takes away everything the set-up installed and made: the models an
  earlier version downloaded, Ollama when it installed it (on Linux it says the commands: they need your password),
  the graph's and the chat's data and secrets, and its folder (Nuclear Builder's teams, keys and runs). What was on
  your machine before the set-up stays. The installer's `--uninstall` runs `--remove --all`, and also takes away the
  compiler's cache and the editors' extension: nothing of NuclearLang is left.
- **In a script or CI:** `--no-ai` skips the set-up, and without a terminal nothing is asked.

## 6. When a step fails

A step that fails is a red box: what it was doing, the last lines it said, the error and what to do. Everything the
steps said is in `~/.local/state/nuclearlang/setup.log` (Windows: `%LOCALAPPDATA%\nuclearlang\setup.log`). Run
`nuclear-builder setup --profile remote --yes` again: what is done stays, and it goes on from the step that failed.
While a step runs, the NuclearLang sign turns beside it with what it does; the first load of the knowledge base
takes about ten minutes and shows the time it has taken.

| It says | What to do |
|---|---|
| the graph or Nuclear Chat on a port other than 7878 / 7880 | another program held it: the set-up took the next free one and wrote it to `ai.env` (`NUCLEAR_GRAPH_PORT`, `NUCLEAR_CHAT_PORT`); the tools and the editor read it there. The ports are checked again at every login, before the services start (`nuclear-builder setup --ports`): a program that took one since gets the service moved. Nothing to do |
| `a Nuclear Smart Graph started by hand already answers at ...` | a graph you started in a terminal holds the port: stop it with the command the message gives, then *Try again* |
| `no Python 3.12 or newer, and uv could not install one` | (from the source tree) install Python 3.12 or newer and try again |
| Ollama was installed by the set-up; to take it away ... | on Linux without a terminal the set-up cannot ask for your password: run the commands it gives |

## 7. From the source tree

`installer/install.sh --ai` runs the same set-up over the tree's own folders: the graph is installed editable, so a
change to it is live after a restart of its service. After changing the knowledge base:
`nuclear-graph knowledge build && nuclear-graph ingest`.
