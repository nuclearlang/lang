# Platform `backend` brief: Synapsis backends

A backend has only `.nuc` files: HTTP APIs, data, events and AI agents. You write the business logic; the kinds write
the framework code, the dependencies, the JSON, the validation and the routes. The same Nuclear builds with every
backend dialect. Full rules: `nuclear help backend`; one kind: `nuclear help <kind> --platform backend`; where each
file goes: `nuclear help layout --platform backend`.

## Work cycle

1. Read the project's `config.nuc` (`synapsis(platform = "backend", ...)`, `app(...)`, `plugins(...)`) and the
   doc comments of the declarations you will use: they say what each one is for.
2. Write the tests first (`test/*_test.nuc`), then the pieces, one file at a time.
3. `nuclear check . --json` until `[]`, then `nuclear test`. Never edit `build/`.

## Kinds (`components/<c>/`; the folder gives the kind of `entity`, `model` and `state`)

| Where | Kind | What it is |
|---|---|---|
| `data/entities/` | entity | a table: `@entity("t")`, fields with `@primary(generated = true)`, `@column(length = 100, unique = true)`, relations `@manyToOne` (+ `<name>Id`), `@oneToMany`, `@manyToMany` + `@joinTable`, `@oneToOne` + `@joinColumn` (optional fields, loaded by `relations(...)`) |
| `data/repositories/` | `repository NameRepository` | CRUD (`find`, `findAll`, `save`, `remove`) + methods whose lines build one query: `where({...})`, `orderBy`, `limit`, `relations("tasks")`, then `getOne()` / `getMany()` / `paginate(page, size)` (`Page<T>`) / `count()` / `exists()` |
| `domain/models/` | model | validated fields: `@minLength(1) name: string`, `@email`, `@min(n)`, `@max(n)`, `@pattern(r"...")`; a value of another JSON type is refused (`"30"` is not an `int`); built in code (`NewTask(title = "")`) it is checked too and throws |
| `domain/usecases/` | `usecase Name(deps)` | one `exec(...) Result<Error, T>` (`@transactional`: one transaction, an `Err` rolls it back); errors `NotFound`, `Invalid`, `Conflict`, `Forbidden`, `Unauthorized` |
| `domain/services/` | `service Name(deps)` | rules several use cases share |
| `<c>_appcomponent.nuc` | `appcomponent Name` | only aliases, `find() = GetThing.exec`: all the rest of the app sees |
| `api/` | `@controller("tasks") controller Name(deps)` | `@get("{id}")`, `@post()`, `@status(201)`... (segments, no leading slash); a `Result` answers its value or the error's status; `guards = [Token(value = env("T"))]` for its own token |
| `ai/` | `tools Name(deps)`, `agent Name(tools: T)`, `@state(S) graph Name` | doc comment = tool description; `prompt`, `model`; `@start`, `@next("node")` above the node it leaves |
| `ai/states/` | state | the graph's state (`messages: Messages`) |
| `events/` | `listener Name(deps)` | `@consumer("topic")` methods; `~publish("topic", value)` |
| `config/` | `appConfig` / `config` | `connections: Connection[] = [SQLite(file = "app.sqlite"), Postgres(url = env("DATABASE_URL", "...")), Redis(...), Kafka(...), Ollama(model = "..."), WebSocketServer(path = "ws")]` (the same routes over a WebSocket, `publish` pushed to the subscribed); `guards: Guard[] = [NoOrigin(), Token(value = env("TOKEN"), header = "X-Token")]` (every route: headers only); `origins: string[] = ["http://localhost:5173"]` (the web apps whose browsers may call it, CORS) |
| `test/` | `tests Name` | `@test("...")` methods, `inject<X>()`, `expect(cond)` |

Dependencies are constructor parameters, injected by type. Repository methods are awaited: `~repo.byName(name)`.
Only the `appcomponent` calls use cases; only use cases, aggregates and tools call repositories.

```nuclear
// The characters table.
@entity("characters")
Character()
  @primary(generated = true)
  id: int
  @column(length = 80, unique = true)
  name: string

repository CharacterRepository
  byName(name: string) Result<Error, Character>
    where({ "name": name })
    getOne()

usecase FindCharacter(characters: CharacterRepository)
  exec(name: string) Result<Error, Character>
    ~characters.byName(name)

appcomponent CharactersAppComponent
  byName() = FindCharacter.exec

@controller("characters")
controller CharactersController(characters: CharactersAppComponent)
  @get("name/{name}")
  one(name: string) Result<Error, Character>
    ~characters.byName(name)
```

`config.nuc` enables the optional parts: `plugins(sqlite = true, ollama = true)` (sqlite, postgres, mysql, mariadb,
redis, kafka, events, websocket, ai, openai, ollama, chroma, telemetry); a kind or class of one not enabled is N0304 (it says
which line to add). Telemetry: one of `Datadog(apiKey = env(...))`, `NewRelic(...)`, `Grafana(...)`, `Otlp(url)` in
`connections`; requests and use cases are traced by themselves, `Metric.count` / `Metric.record` for business
metrics, `@untraced` on a use case, route or controller to leave it out.

Environments: `env("NAME", "default")` (`env("NAME")`: required) reads a variable of the environment; values in `.env`,
`.env.<environment>`, `.env.local`, `.env.<environment>.local` (later wins), secrets in the keyring, the process last.
`nuclear env list`, `nuclear env set NAME value --env staging`, `nuclear env set NAME --secret --env production` (value
from stdin); `nuclear run|build|test|check --env <name>`. A required one without a value: `nuclear run` refuses, `check --env` says N0312.


The database: a text column holds `@column(length = n)` characters (255 without one); a long text is a larger `n`
(`@column(length = 100000)`), there is no other word. What the database refuses for integrity answers 409
`{ "status": 409, "message": "conflict" }` on every database: a repeated unique value, a foreign key that points at
no row, a row removed while others point to it, a null in a required column, a text longer than its column; check
first in the use case (`Err(Conflict("..."))`) when the client needs a better message. Migrations:
`nuclear migrate make "<message>"`, `nuclear migrate`, `nuclear migrate down`, `nuclear migrate status`; a renamed
table or column is told to `make`, or its data is dropped: `nuclear migrate make "<message>" --rename shops=stores
--rename orders.shop_id=store_id` (the database's names).
