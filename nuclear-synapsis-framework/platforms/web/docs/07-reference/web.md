# The `web` platform of Synapsis

> Inherits every rule of [nuclear-base.md](../../../../../nuclearlang/docs/07-reference/nuclear-base.md) and the standard library ([library.md](../../../../../nuclearlang/docs/07-reference/library.md)).
> This document defines the web platform (ADR-synapsis-0002, ADR-web-0001): apps that run in the browser, written in Nuclear
> only. Today its only dialect is `react` ([react.md](../../../../../nuclearlang/dialects/typescript/docs/07-reference/react.md)); this document holds the platform's rules and
> kinds, `react.md` how React writes them. A project's Nuclear never changes between the dialects of the platform;
> only a use of a dialect's type definitions (a React hook, an npm package) ties code to that dialect.

The web platform is the **mobile platform in a browser** (ADR-web-0001): the same words for the same things
(`appConfig`, `repository` with `@get`, `usecase`, `appcomponent`, state models and `statemanager`, `@screen`,
events, guards, tests), so an app's domain and state read the same on a phone and on the web, and an agent that
knows one writes the other. What a browser has no use for (a native splash, workmanager, a secure keystore) is not
here; what it needs and a phone does not (HTML elements, a url bar) is.

## 1. Project

```
my_store/
├── config.nuc                         synapsis(platform = "web", dialect = "react"), app(...), dependencies(...)
├── main.nuc                           the App view: the router with every screen
├── config/project_config.nuc          appConfig: the connections and global services of the app
├── components/<name>/                 appcomponent, config/, data/, domain/, presentation/
├── shared/                            models, events, guards, components, screens shared by the app
├── public/                            static files, copied as they are
└── test/*_test.nuc                    tests
```

`config.nuc` is the only manifest ([projects.md](../../../../../nuclearlang/docs/07-reference/projects.md) §1): the platform and dialect, the app (name,
description, version) and the backends it talks to (`contracts(tasks_api = "../tasks_api")`: their models and
repositories are generated into `contracts/`, [projects.md](../../../../../nuclearlang/docs/07-reference/projects.md) §1.2) and
`dependencies(name = "version")` for a package the framework does not bring: `nuclear add <package>[@version]`
installs it with the dialect's package manager, writes it there and generates its type definitions into the project's
`defs/`; `nuclear remove <package>` takes it out (ADR-lang-0008). `build/app` is the dialect's app, never edited.

```nuclear
synapsis(platform = "web", dialect = "react")
app(name = "my_store", title = "My Store", description = "A Synapsis web app.", version = "1.0.0")
```

`title` is the browser tab's title and `description` the page's description. `public/` is served as it is: a
`public/styles.css` is the app's stylesheet and a `public/favicon.svg` its icon (the page links them when they exist).

### 1.1 Mounted in a host's page (ADR-synapsis-0009)

Every build also writes the app's embedded entry, `mount(element, host)`: the same project, mounted in an element
of another page (an editor's webview, another site), giving back the function that unmounts it. Its bundle is one
module with the UI library inside (in the built app: `npm run build:embed` → `dist-embed/embed.js`). Mounted:

- the router is an in-memory one, starting at `host.path` (default `/`); `goTo` and `goBack` work as always;
- the app lives in a shadow root of `element` with `public/styles.css` inside: the host's rules do not reach it, and
  its rules do not leak out;
- the host's theme reaches it through CSS variables, which cross the shadow root: the stylesheet reads them
  (`color: var(--accent, #0a84ff)`);
- `host.bridge = { send(frame), onMessage(callback) }`: every repository's call and every `Stream` goes through the
  host with the frames of the backend's WebSocket ([backend.md](../../../backend/docs/07-reference/backend.md) §2.9),
  whatever the connection the configuration names; the host forwards them to its service, with its own token.
  Without a bridge, the connections of the configuration work as in the normal app.

```js
// the host's page
import { mount } from './embed.js';
const unmount = await mount(document.getElementById('chat'), {
  path: '/channels',
  bridge: { send: (frame) => host.postMessage(frame), onMessage: (on) => host.onMessage(on) },
});
```

## 2. Kinds

| Area | Kinds and decorators | Rules |
|---|---|---|
| Views | `stateless`, `stateful` (params = props; `build() Element`; HTML functions `div`, `ul`, `button`...) | §3.1 |
| Configuration | `appConfig`, `config`; connections `Http(baseUrl, headers, timeout, interceptors)`, `WebSocket(url, headers, timeout, interceptors)`; globals `SessionManager`, `Acl`, `NetworkManager` | §3.2 |
| Data | models (`@key`), `repository` with `@get`/`@post`/`@put`/`@patch`/`@delete` (`path`, `cache`, `ttl`, `retry`; `@path`, `@query`, `@body`), `@on("topic")` → `Stream<T>` | §3.3 |
| Domain | `usecase` (`@requires`, `@acl`; returns a `Result` or a `Stream`), `appcomponent`, `service`, `aggregate` | §3.4 |
| State | state models, `statemanager` (`@stateModel`, `@state`, `@before`, `@after`, `listen`), `<Model>Builder` | §3.5 |
| Screens | `@screen(route, providers, loggedIn, acl, notFound)`, `goTo`, `goBack` | §3.6 |
| Events | `event`, `Events.publish`, `component` with `@on(Event)`, `useEvent` | §3.7 |
| Session and access | `SessionManager`, `Acl`, `guard` with `canActivate` | §3.8 |
| Tests | `tests` with `@test`, `@widget`, `@states`, `@mock` | §4 |

Not in this version (this platform's `docs/01-product/roadmap.md`): forms and `formmanager`, converters, translations, the local
database (`@primary`, `saveLocal`), plugins and AI kinds. They come with the same words as the mobile platform.

## 3. Rules

1. **Golden rule:** performance, speed and readability of the syntax.
2. **Only the business logic in Nuclear.** Components, props, registration in the injector, JSON, http calls,
   state handling, routes and imports are written by the transpiler.
3. **Light clean architecture:** `data`, `domain` and `presentation` layers plus what is shared; the same
   `N0301`/`N0302` rules as the mobile platform (§5).
4. **Closed components:** another component is used only through its `appcomponent`.
5. **The platform's runtime and the official ecosystem of the dialect:** http with cache and retries, state
   managers, events, session, ACL, the router and the test helpers come from the dialect's runtime package; the UI
   library, the bundler and the test runner are the dialect's.

### 3.1 Views

A view's parameters are its props; `build()` returns an `Element`. Elements are HTML functions with the
attributes as named arguments and `children` (a text, an element or a list), and other views called like
functions; `if c x` in `children` keeps its place when `c` is false (the elements after it are not remade). A
`stateful` keeps its fields while it is shown; `setState(() => ...)` changes them.

```nuclear
stateless CharacterTile(character: Character)
  build() Element
    li(className = "tile", onClick = () => goTo(CharacterDetailScreen, id = character.id), children = [
      img(src = character.image, alt = character.name),
      span(children = character.name),
    ])

stateful Counter(start: int = 0)
  count: int = 0

  initState() void
    count = start

  add() void
    setState(() =>
      count = count + 1
    )

  build() Element
    button(onClick = () => add(), children = "Clicked ${count}")
```

An assignment is a statement: a lambda that assigns is a block (`() =>` and its lines), never one line.

### 3.2 Configuration

`appConfig` (one per project) and `config` (per component) list `connections` and `globals`, as in the mobile
platform. `Http` is the http connection; `SessionManager(timeout)`, `Acl(inherits)` and `NetworkManager()` the
global services.

`WebSocket(url, headers, timeout, interceptors)` is a connection with the options of `Http`, to a backend's
WebSocket ([backend.md](../../../backend/docs/07-reference/backend.md) §2.9, ADR-synapsis-0008): the repositories
bound to it are written as they are, and their calls travel over the socket; changing a repository from HTTP to
WebSockets is changing its connection in the configuration. The socket opens on the first call, reconnects by
itself with growing waits and subscribes again to what it listened to; a call during a reconnection fails like a
network failure, which the repository's retries cover. A browser sends no headers on a socket's upgrade: `headers`
go with every call, and a backend whose guards check the upgrade is reached through a host (§1.1).

```nuclear
appConfig ProjectConfig
  connections: Connection[] = [
    WebSocket(url = "ws://localhost:3000/ws", timeout = 5000),
  ]
```

Environments (spec 021, ADR-platform-0012): the backend of each environment is a variable,
`Http(baseUrl = env("API_URL", "http://127.0.0.1:8000/"))`. In `development`, an app of a workspace whose
`API_URL` is not chosen (not given, or its `.env` only repeats the code's default) calls the workspace's backend at
the address it serves on (the backend's reference, §2.8), and `nuclear run` serves the app on its own port (the
dialect's, or the `PORT` the project sets), an origin a backend in development allows.

`env("NAME", "default")` is a variable of the project; `env("NAME")`, without a default, is required. The
compiler lists every one in the contract (`env` of `.nuclear/contract.json`: name, default, required, client, where it
is used); the name and the default are texts written as they are (N0310). Its values live beside `config.nuc`, by
precedence (the later wins): `.env` < `.env.<environment>` < `.env.local` < `.env.<environment>.local` < the
system's keyring (a secret) < the real process environment. `.env.local` is not read in the environment `test`, and
`testEnv(...)` of `config.nuc` wins in tests. The `.local` files are this machine's (`nuclear new` writes the
`.gitignore` line `.env*.local` and a `.env` with the defaults of the code). The format is dotenv's: `NAME=value`,
`export NAME=value`, `#` comments, `'literal'`, `"escaped\n"` (several lines), `${OTHER}`.

The environment of a command: `--env <name>` on `nuclear run`, `build`, `test`, `check`; else `NUCLEAR_ENV`; else the
project's active one (`nuclear env use <name>`); else `development` (`nuclear test`: `test`, never the active one).
`nuclear env list` shows every variable by environment, `nuclear env set NAME value --env staging` writes
`.env.staging`, `nuclear env set NAME --secret --env production` keeps a secret in the system's keyring (the value
from stdin, never printed). A web app gets the values its code reads when it is built: `nuclear build --env <name>` puts them in the
build as constants (nothing is read at run time, no lookup of a file); a variable stored as a secret that the code
reads is a build error (N0311), since anyone who has the app can read what is inside it. `nuclear run` builds with
the environment's values and does not start while a required one has none.

### 3.3 Data

A `repository` is a class of http calls: the same decorators, parameters and return rules as the mobile platform
([flutter.md](../../../../../nuclearlang/dialects/dart/docs/07-reference/flutter.md) §6.3): the path under the connection's `baseUrl`, `:name` from a parameter, the rest to
the query (GET, DELETE) or the JSON body; a `Result` method answers `Err(E(message = ...))`; `cache`/`ttl`/`retry`.
A model is its fields; it gets `fromJson`, `toJson` and `copyWith`; `@key` names a field in the JSON. A request's
body is the JSON of its model (`toJson`: the names of `@key`).

**Exact numbers are exact in the browser** (`bigint`, `bigdouble`: ADR-lang-0015, the backend's rule
ADR-backend-0003). A model field of an exact type is a JSON text both ways, the language's `toString()` (`"0.3"`,
`"2.0"`, `"12345678901234567890123"`): an answer whose exact field is a JSON number, another text or more than 1000
digits is a decoding error, and the call fails with it (it is not the `Err` of a `Result` method), as on the mobile
platform. A client of a contract (`contracts(...)`) or of `nuclear gen resource --fields "price:bigdouble"` gets the
exact fields as their type, never as a `string`.

```nuclear
// domain/models/: its JSON is {"price": "0.3", "code": "12345678901234567890123"}
Product
  id: int
  price: bigdouble
  code: bigint
```

What the server pushes is a method without a body with `@on("topic")` that returns `Stream<T>` (`T` a model, or a
map): the events of that topic, read as `T`, over a connection that can push (`WebSocket`, or the host's bridge);
over `Http`, listening to it is an error. `stream.listen((value) => ...)` gives back the function that stops. The
topic may use the method's parameters: `@on("chat.${workspace}") events(workspace: string) Stream<ChatEvent>`.

```nuclear
@repository(path = "tasks")
repository TaskRepository
  @get
  all() Result<TaskError, Task[]>

  @on("tasks.created")
  created() Stream<TaskCreated>
```

### 3.4 Domain

`usecase` (one `exec` that returns `Result`; `@requires(internet, session)`, `@acl(roles, permissions, guards)`),
`appcomponent` (aliases to the use cases), `service`, `aggregate`: identical to the mobile platform. A use case
may also return a `Stream` (it passes on a repository's, without `~`).

### 3.5 State

A state model lists the states of a screen; a `statemanager` emits them (`@stateModel`, `@state`, `@before`,
`@after`). The screen reads them with the model's builder: `CharactersStateBuilder(full = (list) => ..., error =
(e) => ..., loading = () => ..., orElse = () => ...)`, which re-renders on every state. `listen(stream, (value) =>
...)` in a manager calls the function with every value until its screen leaves. When an asynchronous `@state` method
is called again before its answer comes, only the latest call's answer is emitted: an older one that comes back last
is dropped (a list read twice, the list of a channel left). A manager's method is never named like the runtime's
own members (`close`, `emit`, `subscribe`, `listen`, `state`, `stateTurn`, `isLatestTurn`: N0223):

```nuclear
@stateModel(TasksState)
statemanager TasksManager
  (tasks: TasksComponent)
    load()
    listen(tasks.watchCreatedTasks(), (created) => load())
```

### 3.6 Screens and navigation

`@screen(route = "/characters/:id", providers = [Manager], loggedIn = { forward: "/login" }, acl = { roles,
permissions, forward: "/denied" }, notFound = true)` on a view: a route of the router; `:id` becomes the screen's
parameter of that type, the other parameters come from the query (`/channels/general?thread=t1`). Every address is a new instance of its screen:
going from `/docs/a` to `/docs/b` builds the screen and its managers again. `providers` creates the managers for the screen
and its views, where `Manager.method()` uses them. `goTo(Screen, id = 7)` and `goBack()` navigate by screen, never
by address. The `App` view of `main.nuc` is the router.

### 3.7 Events

`event Name` + fields; `Events.publish(Name(...))`; a global `component` method with `@on(Name)` runs with every
one; a view calls `useEvent(Name)` in `build` to re-render on it.

### 3.8 Session and access

`SessionManager` keeps the session (token, user, roles, permissions, values) in the browser's storage and ends it
after `timeout`; `Acl` gives role inheritance; a `guard` is a custom check for `@acl(guards = [...])`.

### Generators

`nuclear gen resource <component> <Name>` writes the finished, compiling code of a resource (ADR-codegen-0001): its models
(nested objects become models named `<Name><Key>`; a paged answer gives `<Name>Page`), the repository (an HTTP repository over the app's `Http` connection, a named one added when the app has another), one use
case per action (`--actions list,get,search,create,update,delete`), their aliases in the facade, with `--screen <screen>` a screen that lists it with its state manager and state model, and a test with the repository mocked. The fields
come from an example answer (`--from-json <file|url>`), a spec (`--from-spec <spec.md>`: its example answer, else its
`Key | Type` table; a `GET https://...` line gives the API) or `--fields "id:int name:string"`. A file that exists is
never overwritten (the facade and the repository get only the members they lack, so an action added to a resource that exists is finished); a name another file declares stops it before it writes.
`nuclear gen inspect` answers what the project has. The agent writes only what is not standard: a use case with
its own rules, a view's details.

`nuclear gen usecase <component> <Name>` adds the alias of a use case the project declares to its component's
facade; with `--calls <Repository>.<method>` it writes the use case too, when all it does is call that method of a
repository. What a screen shows of it (a state manager's method and its state) is written by hand.

```sh
nuclear gen resource characters Character --from-json https://rickandmortyapi.com/api/character
nuclear gen usecase characters CharacterEpisodes --calls CharacterRepository.episodes   # a method the repository declares
```

## 4. Tests

`tests` in `test/`: the app starts with its real config and every request answers what the test prepares
(`SynapsisTest.respondWith`, `respond`); `@mock([Class])` makes a class a mock (`when(Class.method).thenReturn`,
`verify`; an async method resolves with what `thenReturn` gives, a `Stream` method answers it as it is); `@test`,
`@states` (the states a manager emits) and `@widget` (a screen rendered in a memory router, read with Testing
Library's `screen`; it leaves the page after its test) as in the mobile platform; `beforeEach()`/`afterEach()`
methods are the hooks.

## 5. Architecture

| Rule | Code |
|---|---|
| A `usecase` is only used from an `appcomponent` | `N0301` |
| A `service` is only used from a `usecase` or an `aggregate` | `N0301` |
| An `aggregate` is only used from a `usecase` | `N0301` |
| A `repository` is only used from a `usecase` or an `aggregate` | `N0301` |
| From another component (or from `shared/`, `config/` and `main.nuc`) only the `appcomponent`, the models, the events, the global components, the guards and the screens (`@screen`) are visible | `N0302` |
| Tests may use any declaration | — |

## 6. What the dialect decides

Only how it is written: the language, the UI library, the bundler, the test runner, the generated app and how to
run it ([react.md](../../../../../nuclearlang/dialects/typescript/docs/07-reference/react.md)).
