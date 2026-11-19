# Nuclear Chat (`nuclear-chat/`)

The factory's workplace (spec 013, ADR-platform-0008): channels, direct messages, threads, mentions, reactions,
GIFs and the history of a project, where the user works with the members of their teams as a company works in
Slack. A component of the platform (ADR-platform-0007): Nuclear Builder and Nuclear Atlas are its hosts; it knows
nothing of the factory. ADR key: `chat`.

The platform's rules are the root [`AGENTS.md`](../AGENTS.md).

## Where the code is

Three parts, each a project of its own folder:

| Folder | What it is |
|---|---|
| `nuclear_chat/` | **the service**: a Synapsis backend (platform `backend`, dialect `fastapi`), made with `nuclear new` and `nuclear make`/`gen`; every rule of the chat is here, in platform Nuclear |
| `system/` | what the chat needs of the machine and the platform cannot say yet: the project's files, a responder's process, the keyring, the pack's folder; Nuclear, `python` dialect (`nuclear.toml`), package `nuclear_chat_system`, and the `nuclear-chat` command |
| `pack/` | the GIF pack made for the project: 36 animated SVG drawings and `pack.json` (their tags) |
| `ui/` | **the UI**: a Synapsis `web` project (dialect `react`) built as the embedded bundle the hosts' pages mount (`mount(el, {path, bridge})`); its repositories come from the service's contract: [ui.md](docs/02-architecture/ui.md) |

The service's components (`nuclear_chat/components/`):

| Component | What it holds |
|---|---|
| `workspaces` | a project registered by its host: members, teams (their tech lead), channels (`channels.json`) |
| `channels` | the list with unread counts, a new channel, a channel read |
| `messages` | the history (`<channel>.jsonl`, edits and reactions folded), threads, what the user says, what a host posts, buttons, the search |
| `members` | who answers (`Routing`: a DM's member, `@member`, `@role`, the team's tech lead) and the responders' runs (`Responders`) |
| `gifs` | the pack, the picker's search, a member's GIF by personality, Tenor and Giphy (HTTP repositories), the one question |
| `events` | the one place events pass through (`EventLog`, `chat.event` and `chat.<workspace>`, pushed to subscribed sockets) and the cursor read |

`nuclear_chat/defs/python/nuclear_chat_system/` types `system/` for the service (generated, see Commands).

## Stack

- Nuclear: the service in platform Nuclear (Synapsis backend, `fastapi`: FastAPI, pydantic, the `synapsis` runtime);
  `system/` in the `python` dialect (Python 3.12+, the standard library only); `ui/` a Synapsis `web` project
  (`react`: React 19 without JSX, Vite, Vitest, the `synapsis-web` runtime), one ES module for the hosts.
- `127.0.0.1` only; every route and the WebSocket (`/ws`) guarded by `X-Chat-Token` and no `Origin` (spec 014).

## Commands

- The UI's embedded bundle for the editors: `ui/build-embed.sh` (the CI's extension job and the release run it).

```sh
# system/: what the service depends on (build it first)
cd system && nuclear check . --json && nuclear build . && .venv/bin/python -m pytest -q   # venv: uv venv; uv pip install pytest
npx -y pyright --pythonpath .venv/bin/python build/nuclear_chat_system
# its type definitions for the service, after a public change of system/
cd nuclear_chat && PYTHONPATH=../system/build ../../nuclearlang/tools/python/.venv/bin/python \
  ../../nuclearlang/tools/defs/python/gen.py nuclear_chat_system 0.1.0 defs nuclear_chat_system.files \
  nuclear_chat_system.processes nuclear_chat_system.keyring nuclear_chat_system.pack --depends python@3.14
# nuclear_chat/: the service
cd nuclear_chat && nuclear check . --json && nuclear build . && nuclear install && nuclear test
#   test/fixtures/compat/: a history of the first service (chat_test.nuc `firstHistory`), part of the release's battery
#   (extensions/scripts/compat-check.sh)
build/.venv/bin/pip install --force-reinstall --no-deps ../system      # after a change of system/
cd build && ../../../nuclearlang/tools/python/.venv/bin/pyright --pythonpath .venv/bin/python app tests
cd build && NUCLEAR_CHAT_TOKEN=dev .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 7895  # by hand (stop it)
nuclear fmt --check .                                                   # in each of the three folders
# ui/: the page (Synapsis web, react)
cd ui && nuclear check --json && nuclear build && nuclear install && nuclear test
cd ui/build/app && npm run build:embed                                  # dist-embed/embed.js, what a host carries
```

`installer/install.sh` installs the `nuclear-chat` command (editable, with uv, from `system/`); the AI set-up's
last step (`nuclear-builder setup`, `chat-service`) builds the service in place (`nuclear-chat install`), chooses
its port (7880 first, `ai.env`) and starts `nuclear-chat serve` at login (`systemctl --user status nuclear-chat`).
The AI archive (`installer/release/ai-runtime.sh`) carries both. `nuclear-chat connect --json` gives a host the
URL, the header and the token.

<!-- nuclearlang -->
## NuclearLang

This project is written in NuclearLang (`.nuc`): `nuclear_chat/` with the dialect `fastapi`, `system/` with
`python`, `ui/` with `react` (platform `web`). Its syntax is not TypeScript, Dart nor Python.

- Before writing code, read the sheet: `nuclear spec --brief --dialect fastapi` (or `python`, or `--platform web`).
- After each change: `nuclear check . --json` must report no errors; fix exactly what each error says.
- Look up instead of guessing: `nuclear defs show <Name> --dialect fastapi`; `nuclear help <word> --dialect fastapi`.
- Create each piece with `nuclear make ...` / `nuclear gen ...`; never edit `build/`.
<!-- /nuclearlang -->

## Rules

- **The chat knows nothing of the factory.** What a member is, how they answer and what a button does are the
  host's; the service only routes, keeps and tells.
- **Every rule in the service, in platform Nuclear**; `system/` only touches the machine (a file, a process, the
  keyring) and holds no rule of the chat. What platform Nuclear cannot say is a finding in its project's roadmap.
- **Nothing written is rewritten**: a channel's file is appended; an edit or a reaction is a line that names its
  message; a line cut by a crash is skipped. Only `channels.json` and `gifs.json` are replaced whole (atomically).
- **Events pass through one place**: `EventsAppComponent.emit` (the `EventLog` and the topic `chat.event`).
- **Local and private**: `127.0.0.1` only; a GIF service's key lives only in the keyring and never reaches a file,
  an answer or an event; a search leaves the machine only after the project said yes once.
- **The service is never served without its guards** (`config/project_config.nuc`): a route starts a member's
  command. Its token lives only in the keyring ([security.md](docs/05-standards/security.md)).
- A change to a route, a model of the API or an event updates [api.md](docs/02-architecture/api.md); to the
  responders' protocol, [responders.md](docs/02-architecture/responders.md).

## Documents (read by task)

| You need… | Read |
|---|---|
| Why each thing exists, for whom, what it leaves out | [docs/00-context/vision.md](docs/00-context/vision.md) |
| The words: workspace, member, tech lead, responder, moment, line, fold | [docs/00-context/domain.md](docs/00-context/domain.md) |
| The parts, the components, the files in a project, the dependencies | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| The routes, their models and the events | [docs/02-architecture/api.md](docs/02-architecture/api.md) |
| How a member answers: the responder's command, its lines, the questions, the money | [docs/02-architecture/responders.md](docs/02-architecture/responders.md) |
| The UI the hosts mount: its screen, managers, look, what it waits for | [docs/02-architecture/ui.md](docs/02-architecture/ui.md) |
| Why it is built this way | [docs/03-adr/README.md](docs/03-adr/README.md) |
| The security of the service and of the GIF keys | [docs/05-standards/security.md](docs/05-standards/security.md) |
| How a host uses it; the GIF keys | [docs/08-guides/README.md](docs/08-guides/README.md) |
| What is pending, half done, untested | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| The requirements and the design | [spec 013](../docs/04-specs/013-nuclear-chat/requirements.md) |
