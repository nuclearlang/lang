---
status: accepted
date: 2026-11-13
deciders: Julian Molina
---
# ADR-0002: The AI services come with the installer: a set-up in steps, a profile for the machine, the services at every login

## Context and problem
The Smart Graph and the Nuclear Developer were installed from the source tree only, followed by nine commands
typed by hand: pull three models, start the graph, build and ingest the knowledge base, connect two clients, start
the Developer. The release installers brought `nuclear-loop` and nothing else. The services were processes started
by hand: after a restart of the machine nothing answered. And there was one set of models for every machine: 9.7
GB, of which the assistant's model is 7.2 GB and leaves a 16 GB machine with under 1 GB of memory.

The user asked for every service the extension brings to be installed locally by the installer; for the hardware
to be analysed and the choices `lite`, `medium` and `hard` offered step by step, the best one for the machine
suggested, the user deciding what is downloaded and warned how far each choice works; for the services to start at
login; and for Ollama to be detected, installed as one of the steps or replaced by something better, with a user
who does not want it choosing the remote agents alone.

## Decision
1. **Every release archive carries the code of the services** (`ai/nuclear-graph-storage` with its knowledge base, and
   `ai/nuclear-agents/nuclear_developer`: 5 MB). What is large is downloaded by the set-up, after the user chose: the Python packages
   (about 550 MB) and the models. Nothing of a model fits a release (a release file is at most 2 GB).
2. **One set-up, two fronts.** `aiSetup.ts` reads the machine, finds what is installed and runs the steps. The
   editor shows it as a wizard (*Nuclear: Set Up the AI Services*; offered once on a machine never set up; a button
   in *Settings and integrations*); a terminal as `nuclear-loop setup`, which the installers call at their end.
   Nothing is downloaded before the user presses Install or answers the question.
3. **The wizard's steps**: this machine (processor, memory, GPU, free disk) and where the agents run; the profile;
   what it needs; the installation, with the progress of each step and *Try again* from the step that failed.
4. **Profiles are data** (`aiSetup.json`): `remote`, `lite`, `medium`, `hard`. Each names its models, what it
   downloads, the memory it runs well with and the least it loads with, what works with it and what does not. The
   set-up suggests the heaviest that fits the machine and marks the ones that are tight or do not fit, with the
   reason; the user chooses, also one that does not fit. What each profile says of itself is measured with the
   Developer's own evaluation, not estimated; the table of the profiles is in
   [the guide](../08-guides/ai-setup.md) (§3), held to the data by a test. Every local profile also downloads
   `embeddinggemma`, which makes the graph's vectors. No model is larger than 3B parameters of effective size.
5. **What the services need is data too**: NuclearLang itself, `uv` (the Python environments; it brings its own
   Python) and Ollama (the local profiles only). Each is found by its command, or installed by its own installer in
   a terminal the user sees (Ollama's asks for a password on Linux), or by hand from its page: the wizard checks
   every three seconds and sees it once it is there.
6. **Ollama stays the program that runs the models.** Looked at: llama.cpp's own server, LM Studio, MLX, vLLM.
   Ollama, LM Studio, Jan and others run the same engine (llama.cpp), so on the same model and quantization the
   published differences are a few percent, and the comparisons found disagree with each other; MLX is clearly
   faster on Apple silicon, and Ollama has an MLX engine there. What decides is the rest: one installer per system
   that leaves a service running, models pulled by name, a model loaded when asked and freed afterwards, chat and
   embeddings behind one address, an open licence, no window that must stay open. Where the models run is one
   address (`OLLAMA_URL`): changing the program later touches the Developer's connection, not the set-up.
7. **Remote agents only** is a choice of the first step: nothing runs on the machine. The MCP server is installed
   alone (`nuclear-graph[mcp]`, 33 MB instead of 405), offers the generators, the compiler, the command line and
   the internet tools, takes away the tools that need the graph or the local developer, and its instructions ask
   the model to write what the generators do not. The wizard says what that costs: every line is paid tokens.
8. **The choice is one file**: `~/.config/nuclearlang/ai.env` (`%APPDATA%\nuclearlang\ai.env`), `KEY=value` lines:
   the mode, the profile, its models. The services start with it; the Loop and the editor take their default models
   from it; the MCP server reads the mode from it. A model set in the editor's settings wins there and is written
   to the file when the editor restarts a service.
9. **The services start at every login**, with the system's own means and no administrator rights: two systemd
   user units on Linux (`nuclear-graph`, `nuclear-developer`, restarted when they fail), two launch agents on
   macOS, a script in the Startup folder on Windows. The editor's Start and Restart go through them. A system
   without a user service manager gets the services started now and is told so. A service started by hand that
   holds the port stops the set-up with the command that stops it.
10. **A service that starts at login runs before the keyring opens.** The graph writes down the names of the
    secrets its keyring keeps (`.keyring` of its data folder, no secret in it): a keyring that does not answer for
    one of them is closed, so the secret is waited for (90 s) and then refused, and the unit starts again until the
    keyring opens. No second secret is ever made, and a file made while the keyring was closed is not read.
    (Without this, the graph found no owner's token, made another one in a file, and the user's tools, which read
    the keyring's, were answered 401.)
11. **An update keeps the choice.** The environments live inside the installation, so an installer that replaces
    it runs the set-up again with the profile the machine has, without questions. `--no-ai` skips it,
    `--profile <id>` takes one without questions, and without a terminal (CI) nothing is asked or downloaded.
12. **Uninstalling** takes away what starts the services, the graph's tool, the Developer's launcher and the file
    of the choice (`nuclear-loop setup --remove`, called by `--uninstall`). Ollama, its models and the graph's data
    stay: they are the user's.

## Options considered
1. llama.cpp's server: ours to package for every system and GPU, with the models' files and memory managed by us.
2. LM Studio: not open, and an application with a window.
3. vLLM: for GPU servers.
4. Ollama, behind one address. Chosen.

## Consequences
- Positive: one command installs everything (`curl -fsSL https://nuclearlang.github.io/install.sh | sh`, then the
  questions of the set-up); from VS Code alone, the wizard installs NuclearLang too. A machine with 8 GB gets local
  agents that fit it, instead of a set that does not load. The services survive a restart of the machine and work
  with the editor closed (MCP clients, `nuclear-loop`). From the source tree, `installer/install.sh --ai` is the
  same set-up over the tree's own folders (the graph installed editable, the Developer built in place).
- Negative, the limits:
  - The set-up is in VS Code and in a terminal. Android Studio has no wizard: `nuclear-loop setup`.
  - macOS and Windows are written and not run: the launch agents, the Startup script, `winget` and Homebrew for
    Ollama. Only Linux with systemd ran.
  - No GPU is recognised except NVIDIA's (`nvidia-smi`) and Apple silicon: on other machines the set-up says that
    no GPU with memory of its own was found, although Ollama may use an integrated one.
  - The first load of the knowledge base asks Ollama for an embedding of every row: about two minutes.
  - The models are Ollama's files in the user's folder: several users of one machine download them once each.
  - `lite` and the assistant's part of `medium` are not fully measured: the wizard says so in their cards.

## References
- Replaces: ADR-0106
- The release archives and the installers that call the set-up: ADR-installer-0001.
- The AI loop the services belong to: `ADR-platform-0003`; the Smart Graph: `ADR-graph-0001`.
