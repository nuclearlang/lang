# Walkthrough: one prompt, every call

What an agent and this server say to each other, call by call, for one request:

> quiero que hagas una interfaz ui usando el api de rick y morty has backend, web y mobile

Every answer below was recorded from the installed server on 2026-11-26 (excerpts: `…` marks a cut). The
result is three apps that build: a `fastapi` backend that reads the Rick and Morty API, and a `react` web app and a
`flutter` mobile app that read that backend through its contract.

## 1. Talking to the server

### Through a client (the usual way)

```sh
claude mcp add --scope user nuclear -- nuclear-mcp     # Claude Code; the other clients: mcp.md §1
```

The client starts `nuclear-mcp`, reads its `instructions` and its tool list, and the model calls the tools.

### By hand (to see the protocol)

`nuclear-mcp` speaks JSON-RPC 2.0 over stdio, one message per line: `initialize`, the notification
`notifications/initialized`, then any number of `tools/list` and `tools/call`.

```sh
cat > rpc.jsonl <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"manual","version":"1"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"graph_strategy","arguments":{"request":"hola"}}}
EOF
(cat rpc.jsonl; sleep 8) | nuclear-mcp
```

```json
{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"tools":{"listChanged":false},…},"instructions":"NuclearLang (.nuc) and Synapsis, its framework. …"}}
{"jsonrpc":"2.0","id":2,"result":{"content":[{"text":"strategy:question (the closest in meaning; …)\n\n…"}]}}
```

`nuclear-mcp tools` prints the instructions and every tool as JSON without starting a session.

### The yes of the user

A tool that changes a workspace, an app, a spec or a team asks the user first: by MCP elicitation, or, for a
client that cannot ask, with a preview `{"preview": …, "changed": "nothing yet", "confirm": "<token>",
"expiresInSeconds": 300}`. The agent shows it, and only after the user's yes calls the same tool with the same
arguments and `confirm`. A `{"declined": …}` means nothing changed.

## 2. The walkthrough

### Step 0. The client connects

The agent receives the server's `instructions`: Nuclear is not in its training; call `nuclear_start` before
anything; never write target code; start from a workspace; ask the user before every change; call
`graph_strategy` with the user's own words and follow its plan.

### Step 1. `nuclear_start()`: learn Nuclear

Answers the onboarding: what NuclearLang and Synapsis are (platforms `mobile`/flutter, `backend`/fastapi or
nestjs, `web`/react), the seven rules never broken (generate first, a product is made with the tools, never change
Nuclear, the standard library only, `nuclear check` after every change, the project documents itself), the work
cycle on this machine and the atlas of topics for `nuclear_doc`.

The agent learns from it: size the task first (`task-size`); this request is a new feature in three apps, larger
than medium, so the agent **proposes Nuclear Builder** (`spec_create`, `run_start`) with that count and lets the
user decide. The rest of this page is the path where the user says "do it yourself".

### Step 2. `graph_strategy(request = <the user's words>)`: which kind of request

```
strategy:system (it writes "backend, web"; the closest in meaning; the next closest: strategy:interface)
Strategy: a whole system or app (several components)
1. Inspect: workspace_show … No workspace yet: workspace_create …, then one app_add per app …
2. Limits: every cannot and limit row whose words the request writes … told to the user now
3. Decompose … one component per resource or capability
…
7. A backend that reads another API (a backend for frontend): every resource is strategy:resource-api …
8. The web and mobile apps of the backend come after it, from its contract: strategy:client-of-backend.
   A client never reads the external API again …
9. At the end, the whole project: nuclear build, nuclear check ., nuclear test.
```

The agent's plan from it: one workspace, three apps, the backend first; one component `characters`; the web and
mobile apps read the backend, never the Rick and Morty API.

### Step 3. The workspace: `workspace_show` → `workspace_create` → `app_add` ×3

`workspace_show(<the user's folder>)` answers that there is none. The agent asks the user, then:

| Call | The user is asked | The server answers |
|---|---|---|
| `workspace_create(path, name = "rick")` | create the folder and `.workspace/workspace.nuc` | `{"apps":[],"name":"rick","root":"…/rick"}` |
| `app_add(workspace, "api", "backend", "fastapi")` | `nuclear new` of a backend | `{"apps":[{"name":"api","platform":"backend","dialect":"fastapi","exists":true}],…}` |
| `app_add(workspace, "web", "web", "react")` | `nuclear new` of a web app | …the two apps |
| `app_add(workspace, "app", "mobile", "flutter")` | `nuclear new` of a mobile app | …the three apps |

`workspace_show` then lists the three apps: these are the projects to work in.

### Step 4. The limits (strategy step 2)

The request names no authentication, payment or push notification: nothing to tell the user.

### Step 5. The backend's resource

`graph_strategy("a backend resource that reads another API", platform = "backend")` answers
`strategy:resource-api`: inspect, `api_inspect`, a dry run, the real run, "a model writes nothing".

`project_inspect(api)`:

```json
{"components": [], "dialect": "fastapi", "generators": ["component","resource","usecase"], "platform": "backend", …}
```

`api_inspect("https://rickandmortyapi.com/api/character")`:

```
GET https://rickandmortyapi.com/api/character → 200
info: object        count: int  pages: int  next: string  prev: null (optional)
results: list of    id: int  name: string  status: string  species: string  type: string  gender: string
                    origin: object (name, url)  location: object (name, url)  image: string
                    episode: list of string  url: string  created: string
```

`generate_resource(api, "characters", "Character", from_json = <url>, actions = ["list","get"], dry_run = true)`
shows every file; without `dry_run` it writes them:

```
added to  config/project_config.nuc                       Http(baseUrl = "https://rickandmortyapi.com/api")
created   components/characters/characters_appcomponent.nuc
created   components/characters/domain/models/character.nuc            (+ character_location, character_origin,
created   components/characters/data/repositories/character_repository.nuc   character_page, character_page_info)
created   components/characters/domain/usecases/list_characters.nuc   (+ get_character.nuc)
created   components/characters/api/characters_controller.nuc          GET /characters?page=, GET /characters/{id}
```

`nuclear_check(path = api)` → `ok` (`[]`). The agent wrote no line of the backend.

### Step 6. The web and mobile apps: the backend's contract

`graph_strategy("a web and a mobile client of my backend's characters contract")` answers
`strategy:client-of-backend`: `contracts(...)` in `config.nuc`, `nuclear contracts update`, a use case per action,
each screen with `strategy:interface`. `nuclear_doc("contracts")` gives the two lines to write.

The agent writes, in each app (Nuclear, by hand: the only way to declare a contract):

```nuclear
// config.nuc
contracts(api = "../api")
// config/project_config.nuc: the connection takes the contract's name
Http(connectionName = "api", baseUrl = env("API_URL", "http://127.0.0.1:8000/"), timeout = 5000),
```

`nuclear contracts update` (the agent's terminal) in each app:

```
✓ contract api 0.1.0 from ../api → contracts/api/
contracts/api/characters_repository.nuc     list(page: int = 1), one(id: int)
contracts/api/models/{character,character_origin,character_location,api_error}.nuc
```

### Step 7. The use case and the screen, in each app

| Call (web and mobile) | Answer |
|---|---|
| `generate_component(app, "characters")` | `created components/characters/characters_component.nuc` |
| `generate_usecase(app, "characters", "ListCharacters", calls = "CharactersRepository.list")` | `created …/usecases/list_characters.nuc`, `added to …/characters_component.nuc` |
| `generate_screen(app, "characters", "characters", route = "/")` | mobile: the state model, the manager and the screen; web: see §3 |

`graph_strategy("a screen that lists the characters …", platform = "web")` answers `strategy:interface`: three
pieces in order (the state model, the state manager, the view); the view calls only its manager, the manager only
the facade. The agent reads one example of the same kind, one section at a time
(`nuclear_doc("example/characters", section = "characters_state.nuc")`, then the manager, then the screen), and
fills the three pieces:

```nuclear
CharactersState
  (full: Character[], error: ApiError, loading: boolean)

@stateModel(CharactersState)
statemanager CharactersManager
  (characters: CharactersComponent)
    loadPage(1)
  @state(CharactersState.loading)
  loading()
  @before(loading)
  @state(CharactersState.full)
  loadPage(page: int) Result<ApiError, Character[]>
    ~characters.listCharacters(page)
```

The view draws `CharactersStateBuilder` with one callback per state: `img`, `strong`, `span` on web;
`ListTile(leading = Image.network(c.image), …)` on mobile. `nuclear_check` of each app → `ok`.

### Step 8. Validate the whole system

| Call | Answer |
|---|---|
| `project_test(api)` (not installed yet) | `{"ok":false,…,"output":"…sh: .venv/bin/python: No such file or directory"}` |
| `nuclear_project(api, "install")` | `exit 0`: the build, its venv and the runtime |
| `project_test(api)` | `{"ok":true,"passed":1,"failed":0}` |
| `nuclear build .` in each app | `api: 17 files`, `web: 23 files`, `app: 20 files` |

Running the backend (`nuclear run`): `GET /characters 200`, `GET /characters/1 200`, the API's characters.

What the agent wrote by hand: two lines of contract per app and the three screen pieces per app. Everything else
came from the generators.

## 3. What this walkthrough found

- `generate_screen` on **web** fails with any `route` (`nuclear make screen … --route /x`: "usage: nuclear make
  <kind> <component> <Name> [--screen <screen>]"); without `route` it writes only the view at `/characters`, not
  the state model and the manager that mobile gets and `strategy:interface` describes.
- `project_test` of a project not installed answers a runtime hint ("The error happened while running the code
  generated from this Nuclear line"), not "run `nuclear_project` with install" as its description says.
- No MCP tool runs `nuclear contracts update`: the agent needs a terminal for it (`PROJECT_COMMANDS` lacks
  `contracts`).
