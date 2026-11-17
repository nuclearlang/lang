---
status: accepted
date: 2026-11-17
deciders: Julian Molina
---
# ADR-0003: The AI services bring their own Python; nothing is assumed on the user's machine

## Context and problem
After ADR-installer-0002 a release carried only the `.nuc` sources of the services. The set-up then needed, on the
user's machine: Node.js (to run `nuclear-builder setup`), uv and a Python 3.12 or newer (to build the environments,
about 550 MB of packages downloaded there), and Ollama installed by the set-up. A clean machine has none of them, so
`install.sh` left a NuclearLang without its services, and the services failed in ways that depend on the machine
(a Python too old, a package without a wheel for it, a port held by another program). The user (2026-11-17): the
installer must bring the services ready to run, never assume a Python on the machine, take the option that weighs
least, works on the most machines and gives no service that does not start; Ollama and the models are the user's,
guided step by step by the extension's welcome page; the ports must be checked.

## Decision
1. **One runtime per system, built by the release.** Each release has, beside the archive of `nuclear`, an archive
   `nuclearlang-ai-<version>-<os>-<arch>`: a Python of python-build-standalone (the one uv uses, relocatable, no
   system Python), the locked packages of the services already installed in it, the services' code transpiled by
   the release's CI (`nuclear build`), and the launchers `nuclear-graph`, `nuclear-mcp`, `nuclear-developer` and
   `nuclear-builder`. The four share that one Python: no package is installed twice. The user's machine needs
   nothing: no Python, no uv, no Node.js, no compiler.
2. **Python, not TypeScript, for every service.** Measured on the development machine (Linux x86_64): the graph's
   environment is 406 MB, 107 MB compressed (chromadb with its Rust bindings 57 MB, onnxruntime 63 MB, numpy
   59 MB, and `kubernetes`, 74 MB, a dependency chromadb's client pulls in); the Developer's is 148 MB (LangChain,
   LangGraph, FastAPI). Moving the graph and the Developer to TypeScript would need Node.js on the machine (about
   45 MB compressed per system) and a new vector store: Chroma's embedded store exists only in Python, its
   JavaScript client needs a Chroma server, which is Python. The search would have to be measured again from zero
   (174 questions today). The MCP server is also Python. Python is already the language of three services out of
   four, so keeping them in Python and porting the fourth weighs least and risks least.
3. **Nuclear Builder becomes a Nuclear project with the `python` dialect** (rule 9 of the tree: Nuclear first),
   run by the same runtime. The editors call it as a process: VS Code, Android Studio and Zed get the same engine,
   and the terminal gets `nuclear-builder` without Node.js. The VS Code extension keeps only its pages in
   TypeScript. Until the port is done, the release builds `nuclear-builder` as today and the installer says that
   it needs Node.js.
4. **Ollama and the models are the user's.** The set-up never installs Ollama nor pulls a model by itself. The
   extension's welcome page shows the steps: what Ollama is, its page for the user's system, a check that sees it
   running, then the models, each with its size and how it sits on this machine (`fit`), downloaded only when the
   user presses its button. Without Ollama the services run in remote mode (ADR-installer-0002, §7).
5. **The ports are chosen, not assumed.** The services listen on 127.0.0.1 only. A port of 127.0.0.1 above 1024
   needs no permission and no administrator on Linux, macOS or Windows, and no firewall asks about it (a firewall
   asks only for an address other machines can reach). Nothing is reserved in the system: on Windows reserving a
   port (`netsh int ipv4 add excludedportrange`) needs an administrator, and the installers ask for none. Instead,
   the set-up listens on each port for a moment before writing it. A port another program holds, or one Windows
   keeps for Hyper-V, WSL or Docker (an error, not "in use"), is passed over for the next free one, from 7878 (the
   graph) and 7879 (the Developer). The choice is written to `ai.env` (`NUCLEAR_GRAPH_PORT`,
   `NUCLEAR_DEVELOPER_PORT`). Every service and client reads the port from the environment, then `ai.env`, then
   the default, so a shell that never read `ai.env` reaches the services all the same. A service of ours already
   answering on its port keeps it.
6. **What stays from ADR-installer-0002:**
   - the profiles as data, with their measured limits;
   - `ai.env` as the one record of the machine's choice;
   - the services at every login (systemd user units, launch agents, the Startup folder);
   - the wait for the keyring;
   - an update keeps the choice;
   - `--no-ai`, `--profile`;
   - uninstalling leaves the user's data, Ollama and the models.

## Options considered
1. **A Python of our own, shared by the four services.** Chosen.
2. **PyInstaller, one binary per service.** Each binary carries its own Python and packages, more than 1 GB in all.
   chromadb and onnxruntime need hand-kept hooks, and antivirus programs on Windows often flag such binaries.
3. **Nuitka.** Long builds on every system of the CI, and the same packages to tame.
4. **Everything in TypeScript on a Node.js of our own.** It rewrites the graph and the Developer and replaces
   Chroma, and the search would have to be measured again. It saves about 60 MB of runtime, but it needs Node.js
   inside the release anyway.
5. **Keep assuming Python, uv and Node.js.** The problem itself.

## Consequences
- Positive: `install.sh` on a clean machine leaves services that run. One runtime is tested by the release's CI
  on each system before it is published, so a failure shows there, not on the user's machine. A port held by
  another program no longer stops the set-up.
- Negative:
  - The AI archive is large. The packages are about 550 MB on disk, and the size of the compressed archive will be
    measured on the first release, not estimated here.
  - Every system and processor needs its own build: Linux x86_64 and arm64 (glibc), macOS arm64 and x86_64,
    Windows x86_64.
  - Linux with musl (Alpine) gets no local services: onnxruntime publishes no wheel for it.
  - Nuclear Builder must be ported before Node.js stops being needed.

## References
- Supersedes: ADR-installer-0002 §1, §2 (the set-up's two fronts, now one Python engine), §5 (what the services
  need), §6 (Ollama installed by the set-up). The rest of ADR-installer-0002 stands.
- The plan: [spec 009](../../../docs/04-specs/009-self-contained-ai-services/requirements.md).
