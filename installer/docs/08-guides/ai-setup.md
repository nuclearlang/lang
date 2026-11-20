# Set up the AI services

NuclearLang comes with two services that run on your machine: the **Smart Graph** (what an agent needs to know about
NuclearLang and Synapsis, read through the MCP server your agent talks to, `tools/mcp`) and the **Nuclear Developer** (small local models
that plan, write, test and review code). The Smart Graph and the MCP server are required: every install has them,
with the graph's own small model and no question ([what gets installed](what-gets-installed.md)). The local agents
are optional: the set-up reads your machine, says which profile of models fits it and how far each works, and asks;
its answer by default is `remote`, which downloads no local model.

## 1. Start it

| Where | How |
|---|---|
| The installer | `curl -fsSL https://nuclearlang.github.io/install.sh \| sh` runs it at its end: the graph and the MCP server always, the local agents asked in the terminal (none without a terminal) |
| VS Code | the offer the first time the extension starts, or *Nuclear: Set Up the AI Services* in the command palette, or *Set-up…* in *Settings and integrations* (`Ctrl+Alt+S`) |
| A terminal, any time | `nuclear-builder setup` |

The same steps run in the three. Run it again whenever you want another choice: what is installed is kept.

## 2. The steps

1. **This machine.** The processor, the memory, the GPU and the free disk, and where the agents run: remote agents
   only (`remote`, the answer by default) or also local agents on this machine (they write the code, so your remote
   agent spends tokens only on leading and correcting).
2. **The profile.** Which local models are downloaded, if any. The one that fits your memory and disk is named; the
   ones that are tight or do not fit are marked, with the reason. A local profile you decline at any step (the
   machine, Ollama, the models) goes on as `remote`: the Smart Graph and the MCP server are installed anyway.
3. **What it needs.** Each program is found by itself once installed, or installed for you in a terminal you see:

   | Program | For | Installed for you with |
   |---|---|---|
   | NuclearLang | the `nuclear` command, the code of the services | its installer |
   | [uv](https://docs.astral.sh/uv/) | the Python environments of the services (it brings its own Python) | its installer, in your user folder |
   | [Ollama](https://ollama.com) | running the local models | its own installer on Linux (it asks for your password), Homebrew on macOS, `winget` on Windows |

   Ollama runs the local agents' models: without it, choose the remote agents (the Smart Graph does not need it). A program
   already on the machine is used as it is, with no question; an Ollama that is installed but stopped is started.
   The models Ollama already has are used as they are; the ones missing are listed with the size, and downloaded
   only when you say yes (`--yes`: without asking).
4. **Install.** The Smart Graph and the MCP server, the MCP server added to every AI client on this machine
   (Claude Code, Codex, Grok Build, Cursor, OpenCode, Gemini CLI: an agent opened in any of them finds Nuclear with no step of
   yours), the Nuclear Developer, the models, the knowledge base loaded
   into the graph (a few seconds with the vectors the release computed; about ten minutes on a processor when they
   cannot be downloaded), and the services started. A step that fails says why and is
   tried again from there.

## 3. The profiles

| Profile | Models | Downloads | Memory | Measured with the Developer's evaluation |
|---|---|---|---|---|
| `lite` | `qwen2.5-coder:1.5b` | 1.3 GB | 8 GB (4 GB at least) | not measured yet |
| `medium` | `qwen2.5-coder:3b`; the chat `qwen3.5:2b` | 4.9 GB | 12 GB (8 GB at least) | as coder, the model of hard: 43 of 45 single-file tasks, 16 of 18 never seen; as assistant, 6 of the first 8 chat questions (hard: 10 of 10) |
| `hard` | `qwen2.5-coder:3b` + `gemma4:e2b`; the chat `qwen3.5:2b` | 12.1 GB | 24 GB (16 GB at least) | 43 of 45 single-file tasks (Claude Sonnet: 39), 16 of 18 never seen, 2 of 3 whole features, 10 of 10 chat questions, 10 of 11 analyses |
| `remote` | none (the Smart Graph's own) | 0.3 GB | 2 GB | only the Smart Graph runs on the machine |

Every profile downloads the Smart Graph's model, EmbeddingGemma in ONNX (0.3 GB, counted above), which makes the graph's vectors: the graph runs it itself, inside its own process, so it needs no Ollama. The Smart Graph runs in every profile, because the MCP server reads it; Ollama is needed only by the local agents.

**`lite`: One 1.5B model does everything: for a machine with little memory.**

- Works: the Smart Graph: the strategy of each request and the knowledge base, for the local agents and for your remote agent.
- Works: the generators and the compiler's fixes, which need no model.
- Does not, or less: not measured yet: its model is half the size of the coder the project measures, so expect it to miss more and your remote agent to correct more.
- Does not, or less: plans, reviews and chat answers come from a small model made for code.

**`medium`: The coder the project measures does everything, also the plans and the reviews: one 3B model in memory.**

- Works: the Smart Graph: the strategy of each request and the knowledge base, for the local agents and for your remote agent.
- Works: the generators and the compiler's fixes, which need no model.
- Works: a file is written as in hard: 43 of 45 single-file tasks (Claude Sonnet: 39), 16 of 18 never seen before.
- Works: the chat answers with its own small model, `qwen3.5:2b`: about 4 GB while you chat, freed 3 minutes after the last message.
- Does not, or less: plans and reviews come from a model made for code: as assistant it answered 6 of the first 8 chat questions as required, where hard answers 10 of 10.
- Does not, or less: some answers are slow: one chat question had not ended after five minutes.
- Does not, or less: turning a request in plain words into generator calls is not measured yet with this model.

**`hard`: The set every measurement of the project was made with: a coder and a separate model to plan, review and answer.**

- Works: the Smart Graph: the strategy of each request and the knowledge base, for the local agents and for your remote agent.
- Works: the generators and the compiler's fixes, which need no model.
- Works: 43 of 45 single-file tasks (Claude Sonnet: 39), 16 of 18 never seen before.
- Works: the assistant answers 10 of 10 questions about NuclearLang as required, and reads 10 of 11 requests right.
- Works: the chat answers with its own small model, `qwen3.5:2b`: about 4 GB while you chat, freed 3 minutes after the last message.
- Does not, or less: its assistant model takes 7.2 GB: with 16 GB of memory little else stays open.
- Does not, or less: a whole feature of several files passes 2 times of 3: your remote agent validates and corrects.

The set-up suggests the heaviest profile your machine runs well. A profile marked *tight* loads and works with
little else open; one marked *not for this machine* may still be chosen, and will be slow or fail to load.

In a terminal, without questions: `nuclear-builder setup --profile medium --yes`.

## 4. Remote agents and the Smart Graph

Only the Smart Graph runs on your machine, with its own model (EmbeddingGemma in ONNX, 0.3 GB; no Ollama), and the MCP server,
which the set-up adds to every AI client it finds. Claude Code, Codex, Grok Build, Cursor, OpenCode or Gemini CLI get the generators, the compiler, the documentation of every word and the `nuclear` commands as tools
([the MCP server](../../../tools/mcp/docs/08-guides/mcp.md)). Your agent also gets the Smart Graph: the strategy of each request and the search of the knowledge base. What you
give up: the Builder panel of the editor and the local agents themselves, so your remote
agent writes every line the generators do not and all of it is paid tokens.

## 5. After the set-up

The services start at every login and are started again if they fail: the Smart Graph, the Nuclear Developer and
Nuclear Chat (the factory's workplace: its token is made the first time and kept in your keyring; the editors get
it from `nuclear-chat connect --json`).

| | Linux | macOS | Windows |
|---|---|---|---|
| What starts them | three systemd user units | three launch agents | a script of the Startup folder |
| State | `systemctl --user status nuclear-graph nuclear-developer nuclear-chat` | `launchctl print gui/$UID/io.github.nuclearlang.graph` | `nuclear-builder setup --status` |
| Restart | `systemctl --user restart nuclear-developer` | `launchctl kickstart -k gui/$UID/io.github.nuclearlang.developer` | sign out and in |
| Their output | `journalctl --user -u nuclear-graph -n 50` | `~/Library/Logs/nuclear-graph.log` | |

`nuclear-builder setup --status` says on every system what is installed and running. In VS Code, *Settings and
integrations* shows the same and restarts a service with a button.

| What | Where |
|---|---|
| Your choice (the mode, the profile, its models) | `~/.config/nuclearlang/ai.env` (`%APPDATA%\nuclearlang\ai.env`) |
| The code of the services | `~/.local/share/nuclearlang/ai/` (`%LOCALAPPDATA%\nuclearlang\ai\`) |
| The graph's data, encrypted | `~/.local/share/nuclear-graph/` |
| The models | Ollama's own folder (`ollama list`) |

In idle the two services take about 150 MB of memory. A model is loaded by Ollama when an agent asks and freed a few
minutes later.

To give your agent the MCP server: the buttons of *Settings and integrations*, or
`claude mcp add --scope user nuclear -- nuclear-mcp` ([every client](../../../tools/mcp/docs/08-guides/mcp.md#1-set-up)).

## 6. Update and remove

- **Update:** run the installer again, or `nuclear update` (in a terminal `nuclear` also asks when a new release is out). It brings the new version and sets the services up again with the profile
  you had, without questions.
- **Another profile:** run the set-up again and choose it. The models of the old one stay in Ollama
  (`ollama rm <model>` frees their disk).
- **A client installed later** (Claude Code, Codex, Grok Build, Cursor, OpenCode, Gemini CLI): `nuclear-builder setup --clients`
  adds the MCP server to it.
- **Remove:** `nuclear-builder setup --remove` takes the services away, and the MCP server out of each AI client;
  Ollama, its models and the graph's data stay. `--remove --all` also takes away everything the set-up installed
  and made: the models it downloaded, Ollama when it installed it (on Linux it says the commands: they need your
  password), the graph's and the chat's data and secrets, and its folder (Nuclear Builder's teams, keys and runs).
  What was on your machine before the set-up stays. The installer's `--uninstall` runs `--remove --all`, and also
  takes away the compiler's cache and the editors' extension: nothing of NuclearLang is left.
- **In a script or CI:** `--no-ai` skips the set-up, `--profile <id>` takes that profile without questions, and
  without a terminal nothing is asked or downloaded.

## 7. When a step fails

A step that fails is a red box: what it was doing, the last lines it said, the error and what to do. Everything the
steps said is in `~/.local/state/nuclearlang/setup.log` (Windows: `%LOCALAPPDATA%\nuclearlang\setup.log`). Run
`nuclear-builder setup` again: what is done stays, and it goes on from the step that failed. While a step runs, the
NuclearLang sign turns beside it with what it does; the first load of the knowledge base takes about ten minutes and
shows the time it has taken.

| It says | What to do |
|---|---|
| the graph, the Developer or Nuclear Chat on a port other than 7878 / 7879 / 7880 | another program held it: the set-up took the next free one and wrote it to `ai.env` (`NUCLEAR_GRAPH_PORT`, `NUCLEAR_DEVELOPER_PORT`, `NUCLEAR_CHAT_PORT`); the tools and the editor read it there. The ports are checked again at every login, before the services start (`nuclear-builder setup --ports`): a program that took one since gets the service moved. Nothing to do |
| `a Nuclear Smart Graph started by hand already answers at ...` | a graph you started in a terminal holds the port: stop it with the command the message gives, then *Try again* |
| `Ollama refused to pull ...`, or a model stays at the same percent | check the disk and the connection; the download goes on from where it stopped when the step is tried again |
| `no Python 3.12 or newer, and uv could not install one` | install Python 3.12 or newer and try again |
| `the Nuclear Developer does not answer at ...` | its output (the table above) says why; most often a model of the profile is missing: `nuclear-builder setup --status` |

## 8. From the source tree

`installer/install.sh --ai` runs the same set-up over the tree's own folders: the graph is installed editable and the
Developer is built in place, so a change to either is live after a restart of its service. After changing the
knowledge base: `nuclear-graph knowledge build && nuclear-graph ingest`.
