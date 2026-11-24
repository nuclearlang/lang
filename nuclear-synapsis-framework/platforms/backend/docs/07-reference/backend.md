# The `backend` platform of Synapsis

> Inherits every rule of [nuclear-base.md](../../../../../nuclearlang/docs/07-reference/nuclear-base.md) and the standard library ([library.md](../../../../../nuclearlang/docs/07-reference/library.md)).
> This document defines the backend platform (ADR-synapsis-0002): HTTP APIs, data, events and AI agents, written in Nuclear
> only. The same project builds with every backend dialect — `fastapi` (Python: [fastapi.md](../../../../../nuclearlang/dialects/python/docs/07-reference/fastapi.md),
> renamed `fastapi` in phase B1) and `nestjs` (TypeScript: [nestjs.md](../../../../../nuclearlang/dialects/typescript/docs/07-reference/nestjs.md)) — and its Nuclear never changes
> between them. Only a use of a dialect's type definitions ties code to that dialect.

## 1. Project

A backend's build also writes its **contract** (`.nuclear/contract.json`: controllers, routes, models) and its
**OpenAPI document** (`.nuclear/openapi.json`), served by the running app at `/.nuclear/contract.json` and
`/.nuclear/openapi.json`; a mobile or web project generates its models and repositories from it
([projects.md](../../../../../nuclearlang/docs/07-reference/projects.md) §1.2, ADR-synapsis-0006). The app serves no
interactive documentation pages (`/docs`, `/redoc`): its API is that document, also at `/openapi.json`.


```
tasks_api/
├── config.nuc                         synapsis(...), app(...), plugins(...), dependencies(...)
├── config/project_config.nuc          appConfig: the connections of the app
├── components/tasks/
│   ├── tasks_appcomponent.nuc         appcomponent: what the rest of the app sees
│   ├── config/tasks_config.nuc        config: connections only this component uses
│   ├── data/entities/*.nuc            entities (tables), by folder
│   ├── data/repositories/*.nuc        repository
│   ├── domain/models/*.nuc            models (what the API reads and answers), by folder
│   ├── domain/usecases/*.nuc          usecase; also service and aggregate
│   ├── api/*.nuc                      controller
│   ├── events/*.nuc                   listener
│   └── ai/*.nuc                       tools, agent, state, graph
├── shared/                            models, tools... used by several components
└── test/*_test.nuc                    tests
```

`config.nuc` is the only manifest ([projects.md](../../../../../nuclearlang/docs/07-reference/projects.md) §1): the platform and dialect, the app and the
plugins it uses, `testEnv(NAME = "value")` for the environment of its tests (§2.14), and `dependencies(name = "version")` for a package the framework does not bring: any package of the
dialect's technology. `nuclear add <package>[@version]` installs it with the dialect's package manager, writes it
there (`"name@version"` when the name is not an identifier) and generates its type definitions into the project's
`defs/`, so its names are known to the compiler and the editor and imported where they are used; `nuclear remove
<package>` takes it out (ADR-lang-0008, projects.md §3.2). A package the platform already covers is added with a word of
advice. A version that starts with `.` or `/` is a folder on disk, which brings its definitions by hand. `nuclear build
.` (or the `nuclear` CLI) writes `build/`: the dialect's project, never edited.

```nuclear
synapsis(platform = "backend", dialect = "fastapi")
app(name = "tasks_api", description = "Tasks and an assistant.", version = "0.1.0")
plugins(sqlite = true, events = true, ollama = true)
```

Kinds by folder: the file's folder gives the kind when the declaration does not name it (`data/entities/` →
entity, `data/repositories/` → repository, `domain/models/` → model, `domain/usecases/` → usecase, `api/` →
controller, `events/` → listener, `ai/` → the header word). Every kind's dependencies are the typed parameters
of its header, injected by type (ADR-synapsis-0003). Names stay Nuclear's (`camelCase`): the dialect writes its own case.

**Architecture rules** (N0301, N0302): from another component only `appcomponent`, `model`, `entity`, `tools`,
`agent`, `state` and `graph` are visible. A `usecase` is called only from the facade; a `service` from a use case
or an aggregate; an `aggregate` from a use case; a `repository` from a use case, an aggregate or a `tools`.
`test/` is exempt.

### Plugins

The optional parts of the platform ([projects.md](../../../../../nuclearlang/docs/07-reference/projects.md) §3.3), the same list in every dialect:
`sqlite`, `postgres`, `mysql`, `mariadb`, `redis`, `kafka`, `events`, `websocket`, `ai`, `openai`, `ollama`, `chroma`,
`telemetry`. Only the
enabled ones reach the generated project's dependencies. A kind or a name of a plugin not enabled is N0304, with
the line to add: `tools`, `agent`, `state`, `graph` need `ai`; `listener`, `publish` need `events` (or `kafka`
for a broker); `WebSocketServer` needs `websocket` (which needs `events`); `cacheGet`, `cacheSet` need `redis`; `Datadog`, `NewRelic`, `Grafana`, `Otlp`, `Metric` need `telemetry`; a
database connection needs its plugin.

## 2. Kinds

### 2.1 Entity

A table. `@entity("name")` names it (default: the class name in snake_case, plural not added). Fields are
columns: `@primary` (the key; `@primary(generated = true)`: the database gives it, auto increment for an `int`, a
uuid for a `string`; `@primary(length = 8)`: the app gives a code), `@column(length, unique, nullable, name)`,
`@created`, `@updated` (timestamps: when the row was inserted and last changed, written by the app with their
milliseconds, the same instant for a new row's two; a row written by SQL gets the database's clock). `T?` is a
nullable column; a default is the
column's default. A `DateTime` column is an instant: it
comes back as the same instant on every database, with its milliseconds, and its JSON is what `toIso()` writes
(`2026-03-04T03:06:07.000Z`). The column keeps the fraction of a second on every database (six digits on MySQL,
MariaDB and SQLite, `DATETIME(6)`; PostgreSQL's own).

**A text column** holds the characters `@column(length = n)` says, 255 without one; a long text is a larger `n`
(`@column(length = 100000)`), there is no other word for it. The column is the database's `VARCHAR(n)` while that
type holds `n` characters of any alphabet, and above it the database's text type that holds at least `n`:

| `n`, in characters | PostgreSQL | MySQL, MariaDB | SQLite |
|---|---|---|---|
| up to 16 383 | `VARCHAR(n)` | `VARCHAR(n)` | `VARCHAR(n)` |
| up to 4 194 303 | `VARCHAR(n)` | `MEDIUMTEXT` | `VARCHAR(n)` |
| up to 10 485 760 | `VARCHAR(n)` | `LONGTEXT` | `VARCHAR(n)` |
| more | `TEXT` | `LONGTEXT` | `VARCHAR(n)` |

A text longer than `n` characters is never written, on any database: the write is refused with 409 `conflict`
(§2.4), as PostgreSQL, MySQL and MariaDB refuse it in a `VARCHAR`. Characters are counted, not bytes (`日😀` is two).
`@maxLength(n)` on the model of the body answers the client first, with a 400 that names the field. A changed
`length` is a migration (§2.8). A long text is not a key nor a unique column: MySQL and MariaDB refuse a unique
over a text type.

**An exact number** (ADR-backend-0003) keeps its value exactly on every database. A `bigint` column is a `BIGINT`: a
whole number from −2^63 to 2^63 − 1. A `bigdouble` column is a `NUMERIC(p, s)`: `@column(precision = p, scale = s)`,
30 and 10 without them; `p` from 1 to 65, `s` from 0 to 30 and at most `p` (`precision` and `scale` are only a
`bigdouble`'s, N0308). SQLite has no exact number: there the column keeps the value's text (`EXACT TEXT`, and
`EXACT TEXT(p,s)` with exactly `s` decimals), and `where` and `orderBy` compare it by value as the other databases do.
A value the column cannot hold (beyond 64 bits; more decimals than `s` or more digits before the point than `p − s`) is
never written, rounded or cut: the write is refused with 409 `conflict`. A key (`@primary`) is an `int` or a `string`.

| Field | PostgreSQL | MySQL, MariaDB | SQLite |
|---|---|---|---|
| `bigint` | `BIGINT` | `BIGINT` | `EXACT TEXT` |
| `bigdouble` | `NUMERIC(30, 10)` | `DECIMAL(30, 10)` | `EXACT TEXT(30,10)` |
| `@column(precision = 40, scale = 20)` `bigdouble` | `NUMERIC(40, 20)` | `DECIMAL(40, 20)` | `EXACT TEXT(40,20)` |

A changed precision or scale is a migration (§2.8): the databases round the values to the new scale, half away from
zero, and refuse one with more digits than the column takes (the migration fails). A row written by SQL into SQLite
writes the column's text (`'0.3000000000'`).

```nuclear
@entity("balances")
Balance()
  @primary(generated = true)
  id: int
  serial: bigint
  @column(precision = 40, scale = 20)
  rate: bigdouble
  amount: bigdouble = 0.0
```

```nuclear
@entity("tasks")
Task()
  @primary(generated = true)
  id: int
  @column(length = 200)
  title: string
  done: boolean = false
  // 1 high, 2 normal, 3 low
  priority: int = 2
  @created()
  createdAt?: DateTime
```

#### Relations (ADR-backend-0001)

Decorators on the relation field; the related entity is the field's type, never repeated:

| Decorator | On | Means |
|---|---|---|
| `@manyToOne(inverse, onDelete)` | `x?: T` + a field `xId` | this row points to one row of T by its column `xId` |
| `@oneToMany(inverse)` | `xs?: T[]` | the rows of T whose `@manyToOne` field `inverse` points here |
| `@manyToMany(inverse)` + `@joinTable()` on one side | `xs?: T[]` | through the table `<table>_<field>` (columns `<entity>_id`) |
| `@oneToOne(inverse, onDelete)` + `@joinColumn()` on one side | `x?: T` | the `@joinColumn` side keeps the column `xId` |

`onDelete`: `"cascade"`, `"set null"`, `"restrict"` (default: the database's). A relation field is optional: it is
there only when a query loads it (`relations("tasks")`, `relations("tasks.tags")`), and an unloaded one is absent from
the JSON answer, never `null` and never a hidden query. The join column is a field of its own: a row is related
without loading the other (`Task(title = t, projectId = id)`); a `@manyToMany` list set on a row is written by `save`.
These rules are checked at compile time (N0308).

```nuclear
@entity("projects")
Project()
  @primary(generated = true)
  id: int
  name: string
  @oneToMany(inverse = "project")
  tasks?: Task[]

@entity("tasks")
Task()
  @primary(generated = true)
  id: int
  title: string
  @manyToOne(inverse = "tasks", onDelete = "cascade")
  project?: Project
  projectId?: int
  @manyToMany(inverse = "tasks")
  @joinTable()
  tags?: Tag[]
```

### 2.2 Repository

The data of one entity: `NameRepository` works on `Name` (or `@repository(Entity)`). It brings `find(id)`
(`Ok(entity)` / `Err(NotFound)`), `findAll()`, `save(entity)` and `remove(id)`. Each method's lines build ONE
query, created for that call: `where({...})` (equality, or `gt`, `gte`, `lt`, `lte`, `ne`, `like`, `ilike`,
`contains`, `icontains`, `oneOf`, `isNull`, `between`), `orderBy(field, desc = true)`, `limit(n)`, `offset(n)`, `relations(...)` (the
relations to load); the last line runs it: `getOne()` (`Result`), `getMany()`, `paginate(page, size)` (`Page<T>`:
`items`, `page` from 1, `size`, `total`, `pages`; the same on the mobile local tables), `count()`, `exists()`,
`update({...})`, `delete()`. An exact column (`bigint`, `bigdouble`) is compared and sorted by its value on every
database. A page holds at most `maxPageSize` rows (§2.8, 100 by default): a larger `size` is
answered with that many, and the page's `size` says so. `where` and `orderBy` take only the entity's columns: another
name (a relation, a field that is none) is an error of the program, answered 500. The caller awaits it:
`~tasks.byTitle(title)`. The same chain works outside the repository: `~tasks.where({ "title": t }).exists()`.

`like(pattern)` and `ilike(pattern)` take a pattern: `%` is any text and `_` any character. `contains(text)` and
`icontains(text)` take a text and match the rows whose column holds it as it is: its `%`, `_` and `/` are
characters, never wildcards. A text a client sends (a search box) goes to `contains` or `icontains`, never into a
pattern: `ilike("%${text}%")` with the text `%` matches every row, `icontains(text)` only the rows that hold a `%`.

`like` and `contains` follow the case rule of the database: PostgreSQL tells `A` from `a`; MySQL, MariaDB and SQLite
do not (for ASCII letters). `ilike` and `icontains` ignore the case on every database: they are the ones to use for
a search that must find the same rows everywhere.

```nuclear
repository TaskRepository
  byState(done: boolean) Task[]
    where({ "done": done })
    orderBy("priority")
    getMany()

  byTitle(title: string) Result<Error, Task>
    where({ "title": title })
    getOne()

  search(text: string) Task[]
    where({ "title": icontains(text) })
    getMany()

  page(page: int, size: int = 20) Page<Task>
    orderBy("id")
    paginate(page, size)
```

#### An HTTP repository (ADR-codegen-0001)

A repository can also be another API, with the mobile platform's words: `@repository(path = "...")` and methods
without a body that carry `@get`, `@post`, `@put`, `@patch` or `@delete` (`path = ":id"`). They call the `Http(baseUrl)`
connection (§2.8; `connection = "name"` picks another): `:name` in a path takes the parameter of that name, the
other parameters go to the query (GET, DELETE) or to the JSON body (POST, PUT, PATCH: a single model parameter is the
body). The answer is the method's type; an error status is the `Err` of a `Result` (404 `NotFound`, 400/422
`Invalid`, 401 `Unauthorized`, 403 `Forbidden`, 409 `Conflict`, any other an `Error` with that status).

```nuclear
@repository(path = "character")
repository CharacterRepository
  @get(path = ":id")
  one(id: int) Result<Error, Character>

  @get
  page(page: int) Result<Error, CharacterPage>
```

### 2.3 Model

What the API reads and answers, in `domain/models/`. The field decorators of Synapsis's forms are its validation:
`@required`, `@minLength(n)`, `@maxLength(n)`, `@min(n)`, `@max(n)`, `@pattern(r"...")`, `@email`, `@url`. An
invalid body answers **400** with the reasons (below). `NewTask(title = "x")` builds one; optional fields (`T?`) may be
left out. In an answer an optional field is always there: one left empty is `null`, never absent, in the model,
in a model inside it and in the items of a list or a page (an entity's empty column is `null` too).

**A value's JSON type is its field's: nothing is converted.** In a body each field takes only the JSON type of its
Nuclear type, and any other is refused with the rule `type`:

| Field | JSON it takes | Refused |
|---|---|---|
| `string` | a text | a number, `true` / `false` |
| `int` | a number without a fraction (`30`, `30.0`: JSON has one kind of number), from -2^63 to 2^63 - 1 | a text (`"30"`), `true` / `false`, a number with a fraction, one beyond 64 bits |
| `double` | a finite number (`1.5`, `30`) | a text (`"1.5"`), `true` / `false`, one too large to be finite (`1e999`) |
| `boolean` | `true` / `false` | a text (`"true"`), a number (`1`) |
| `DateTime` | a text that is a date and time (`"2026-03-04T05:06:07Z"`) | a number, a text that is no date |
| `bigint` | a text of `text.toBigInt()`: a sign and digits (`"12345678901234567890123"`) | a number (`5`), another text (`"5.0"`), more than 1000 digits |
| `bigdouble` | a text of `text.toBigDouble()`: decimals, an exponent (`"0.1"`, `"-2.5e3"`) | a number (`0.1`), another text (`"1."`), more than 1000 digits written without the exponent |
| `T[]` | a list whose items are each a `T` | anything else; an item of another type is named by its place (`tags.1`) |

`null` is only for an optional field (`T?`); for a required one the rule is `required`. A text never holds the
character U+0000 (a database cannot keep it): a body that has one is refused with the rule `invalid` at its field.

**A body is JSON.** A request that carries a body sends it as `application/json` (or `application/<name>+json`), in
UTF-8; another type, a form among them, answers **415** `unsupported media type`. A body larger than the app's
`maxBodySize` (§2.8, 1 MB by default) answers **413** `content too large`. JSON that cannot be read (not JSON, not
UTF-8, `NaN`, nested deeper than 512 levels) answers 400 with the rule `json`; an empty body, or `null`, is `required`;
one that is not an object is `type`.

**A parameter of the path or of the query** has no JSON type: it is a text, converted to its type, without the blanks
around it. An `int` is digits with an optional sign, within 64 bits (`?page=2`; not `0x1`, `1e0`, `1.0`); a `double`
a finite decimal number (`1.5`, `-2e3`; not `NaN`, `Infinity`, `0x10`); a `boolean` exactly `true` or `false`; a
`bigint` and a `bigdouble` the texts of a body (`?min=0.1`).
Another text is refused with the rule `type`, and so is a parameter given twice. An empty one is not given: the
method's default, `null` when it is optional (`T?`), else `required`. The parameters are checked before the body: when
any is refused, the answer has the reason of each refused one, and the body is read only after they pass.

**An exact number is a text in JSON** (`"price": "0.3"`): its answer is what `toString()` writes (`"0.3"`, `"2.0"`),
never a number a client would round. In the OpenAPI document it is a `string` with the `pattern` of its text.
`@min(n)` and `@max(n)` of an exact field compare exactly; `n` is a literal of the field's type (`@min(0.01)`,
`@max(12345678901234567890123)`).

**A model built in code is checked like a body.** `NewTask(title = "")` breaks `@minLength(1)` and throws; a use
case that lets that error go answers 500 (the body of a request is checked before the use case, and answers 400).

```nuclear
NewTask
  @minLength(1)
  @maxLength(200)
  title: string
  @min(1)
  @max(3)
  priority: int = 2

TaskChanges
  @minLength(1)
  title?: string
  done?: boolean
```

### 2.4 Use case

One business operation: `exec` returns `Result<E, T>`. `Error` is the platform's error, with an HTTP status:
`NotFound` (404), `Invalid` (400), `Unauthorized` (401), `Forbidden` (403), `Conflict` (409). `x = ~repo.find(id)`
unwraps the `Ok` and returns the `Err` by itself ([nuclear-base.md](../../../../../nuclearlang/docs/07-reference/nuclear-base.md) §3.2).

**The body of an error** is the same in every dialect: its status and its message, and for an invalid body or
parameter one reason per field, in the order of the fields' names.

```json
{ "status": 404, "message": "no task 9" }
{ "status": 400, "message": "invalid", "errors": [
  { "field": "priority", "rule": "max", "message": "priority must be at most 3" } ] }
```

`field` is a path (`items.0.name`; empty for the body itself); `rule` is the validation's name: `required`, `type`,
`minLength`, `maxLength`, `min`, `max`, `pattern`, `email`, `url`, `json` (the body is not JSON), `invalid`. A field
that breaks several rules names the first of that list. A route that does not exist answers `not found`; what
nothing handled answers 500 with the message `error`, and its cause is in the app's log (§2.8).

**What the database refuses for integrity answers 409** with the message `conflict`, on every database, and never
the database's own words (they name a constraint, a column, a value):

```json
{ "status": 409, "message": "conflict" }
```

It is the answer for a repeated value in a unique column, a foreign key that points at no row, a row removed
while others point to it (a relation without `onDelete`), a null in a required column, and a text longer than its
column (§2.1). So of many requests at once for one unique value, one writes its row and every other answers 409:
the use case that checks first (`Conflict("...")`, below) gives the client a better message, and the database
still decides. Inside `@transactional` the whole transaction is rolled back. `GET /openapi.json` answers the API's OpenAPI document,
written from the project, with this body as its `Error`.

```nuclear
usecase CreateTask(tasks: TaskRepository)
  exec(input: NewTask) Result<Error, Task>
    taken = ~tasks.where({ "title": input.title }).exists()
    if taken
      return Err(Conflict("there is already a task '${input.title}'"))
    task = ~tasks.save(Task(title = input.title, priority = input.priority))
    ~publish("tasks.created", { "id": task.id, "title": task.title })
    Ok(task)
```

`@transactional` on `exec` (ADR-backend-0001): every repository call inside shares one transaction of the default database;
an `Err` or an error rolls it back, an `Ok` commits it. A transactional call inside another joins it.

```nuclear
usecase CloseProject(tasks: TaskRepository, projects: ProjectRepository)
  @transactional
  exec(id: int, into: int) Result<Error, Moved>
    ~projects.find(into)
    moved = ~tasks.move(id, into)
    ~projects.remove(id)
    Ok(Moved(count = moved))
```

### 2.5 Appcomponent

The facade of a component: aliases to its use cases ([nuclear-base.md](../../../../../nuclearlang/docs/07-reference/nuclear-base.md) §4.1.2). Other
components, the controllers, the tools and the listeners use only this.

```nuclear
appcomponent TasksAppComponent
  list() = ListTasks.exec
  task() = GetTask.exec
  create() = CreateTask.exec
```

### 2.6 Service and aggregate

A `service` is logic shared by use cases (an external API, a calculation); an `aggregate` composes several
repositories or services for one use case. Both are plain classes with injected headers.

### 2.7 Controller

HTTP routes. `@controller("tasks")` is the prefix; `@get`, `@post`, `@put`, `@patch`, `@delete` take a path
relative to it: `@get()` is the prefix itself, `@get("{id}")` binds `{id}` to the parameter `id`, `@post("plan")`
adds a segment. Paths are segments: no leading slash. A parameter that is a model is the body; a parameter named
in the path is a path parameter; any other parameter is a query parameter (optional when `T?` or defaulted).
`@status(201)` changes the success status. A `Result` answer becomes the value or its error's status. The order of
the routes does not matter: a fixed segment wins over a parameter (`page` is never taken by `{id}`).
`@controller("x", guards = [...])` checks every route of the controller with its guards, after the app's (§2.8).

A path is matched as it is written: `/Tasks` and `/tasks/` are not `/tasks` (404, never a redirect); an encoded
letter, digit, `-`, `.`, `_` or `~` is that character (`/%74asks` is `/tasks`), and an encoded `/` or `\` matches no
route. A path the app has with another method answers **405** `method not allowed` with the header `Allow` (its
methods); `HEAD` answers as its `GET` without the body; `OPTIONS` answers 200 with `Allow`. Both pass the app's
guards first. How each parameter is read is §2.3.

```nuclear
@controller("tasks")
controller TasksController(tasks: TasksAppComponent)
  @get()
  all(done?: boolean) Result<Error, Task[]>
    ~tasks.list(done)

  @get("{id}")
  one(id: int) Result<Error, Task>
    ~tasks.task(id)

  @post()
  create(input: NewTask) Result<Error, Task>
    ~tasks.create(input)

  @patch("{id}")
  change(id: int, changes: TaskChanges) Result<Error, Task>
    ~tasks.update(id, changes)
```

### 2.8 Configuration and connections

The connections of the app (`appConfig`, `config/project_config.nuc`) and of a component (`config`,
`components/<c>/config/`): opened at start, closed at stop, never opened by hand. Each has a `name` (default
`"default"`); `connectionName` in a kind picks another. `env("VAR", "default")` reads the environment (below).

| Connection | Plugin | Parameters |
|---|---|---|
| `SQLite(file)` | `sqlite` | `file` (`":memory:"` in tests), `createTables` |
| `Postgres(url)` `MySQL(url)` `MariaDB(url)` | `postgres` `mysql` `mariadb` | `url` (`"postgres://user:pass@host/db"`, `"mysql://..."`, `"mariadb://..."`: the dialect adds its driver), `createTables` (creates the entities' tables: development) |
| `Redis(url)` | `redis` | `url` |
| `Kafka(servers, group)` | `kafka` | `servers` (`"a:9092,b:9092"`), `group` |
| `Ollama(model, baseUrl)` `OpenAI(model, apiKey)` | `ollama` `openai` (both `ai`) | the chat model; `Embeddings(model)` for vectors (`"ollama:nomic-embed-text"`, `"openai:text-embedding-3-small"`) |
| `Http(baseUrl, headers, timeout)` | — | another API, for the HTTP repositories (§2.2): `baseUrl` (`"https://rickandmortyapi.com/api"`), `headers` (an API key), `timeout` (seconds) |
| `Chroma(collection, embeddings, url)` | `chroma` | a vector store on a Chroma server (`url`, default `http://localhost:8000`); `embeddings` names the `Embeddings` connection |
| `WebSocketServer(path)` | `websocket` | the app also answers over a WebSocket at `/<path>` (§2.9): the same controllers, and the events it publishes |

```nuclear
appConfig ProjectConfig
  connections: Connection[] = [
    SQLite(file = env("DATABASE", "tasks.sqlite"), createTables = true),
    Ollama(model = env("CHAT_MODEL", "qwen3.5:4b"), baseUrl = env("OLLAMA_URL", "http://localhost:11434")),
  ]
```


#### Limits, the address and the log

Two numbers of the `appConfig` change the platform's limits: `maxBodySize: int` (the largest body or WebSocket frame
the app reads, in bytes; default 1 MB, 1 048 576) and `maxPageSize: int` (the largest page `paginate` answers, in
rows; default 100).

```nuclear
appConfig ProjectConfig
  connections: Connection[] = [SQLite(file = env("DATABASE", "app.sqlite"))]
  maxBodySize: int = 4194304
  maxPageSize: int = 500
```

The app listens on `127.0.0.1` (this machine only) and the port `PORT` (8000 or 3000 by the dialect, `nuclear run`
gives its own); `HOST` changes the address (`HOST=0.0.0.0` in a container). No answer names what runs underneath
(no `Server`, no `X-Powered-By`).

The app writes one line per request to the standard output, and the cause of every 500 to the standard error, the
same in every dialect; never a value the client sent (the query, the body, a header, a parameter of SQL):

```
2026-11-23T10:00:00.123Z GET /tasks/1 200 3ms
2026-11-23T10:00:00.456Z ERROR GET /tasks/draft <the error's type>: <its message>
    <the stack, one line per call>
```

A request line is the time (UTC), the method, the path without its query, the status and the duration in
milliseconds. A cause names the error and says why without the request's values: a model built in code names its
fields and rules, a database error its code. A request over the app's WebSocket is a line of its own, and so is the
upgrade (`GET /ws 101`).

#### Environments (spec 021, ADR-platform-0012)

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
from stdin, never printed). The backend reads them at run time: `nuclear run` passes them to the app's process and does not start
while a required one has no value (it lists each with where it is used; `nuclear check --env <name>` reports them as
N0312); `nuclear build --env <name>` writes the non-secret values into the build's `.env`, which the runtime loads at
start without replacing a variable the process already has: where it runs, the real environment gives the secrets.
A project without `.env` files reads the process environment as before.

#### Guards (ADR-synapsis-0007)

`guards: Guard[]` in the `appConfig` checks every route, the contract's routes and the upgrade of the app's
WebSocket; `@controller("x", guards = [...])` adds a controller's own, checked after them. They run in order and the
first that refuses answers:

| Guard | Refuses |
|---|---|
| `Token(value, header = "Authorization")` | **401** when `header` does not carry `value` (`Authorization: Bearer <value>`; another header: the value alone). An empty `value` refuses every request |
| `NoOrigin()` | **403** when the request has an `Origin` header (a web page): a local service is not reachable from a browser |

A guard reads only headers, never the query: a token in a URL would reach the access logs. A header is read without
the blanks around it, and a header given twice is not given (`Token` refuses it: which value counts would be the
server's choice); `NoOrigin` refuses any `Origin`, empty or repeated. A guarded app serves no OpenAPI document. Over the WebSocket, each request carries the upgrade's headers and its own, so a controller's
guards answer as over HTTP.

```nuclear
appConfig ProjectConfig
  connections: Connection[] = [SQLite(file = env("DATABASE", "tasks.sqlite")), WebSocketServer(path = "ws")]
  guards: Guard[] = [NoOrigin(), Token(value = env("TASKS_TOKEN"), header = "X-Tasks-Token")]

@controller("projects", guards = [Token(value = env("OWNER_TOKEN"))])
controller ProjectsController(tasks: TasksAppComponent)
  @get("{id}")
  one(id: int) Result<Error, Project>
    ~tasks.project(id)
```

#### The web apps that call it (CORS)

`origins: string[]` in the `appConfig` lists the web origins whose browsers may call the API (a web app of the
platform served on another port or host): their requests answer with `Access-Control-Allow-Origin`, any method and
header. A browser's preflight (`OPTIONS` with `Origin` and `Access-Control-Request-Method`) from a listed origin
answers 200 with the methods, the headers it asked for and `Access-Control-Max-Age: 1800`; from any other origin
**403** `origin not allowed`. Without `origins`, no browser on another origin can call it; credentials are never
allowed.

```nuclear
appConfig ProjectConfig
  connections: Connection[] = [SQLite(file = env("DATABASE", "app.sqlite"))]
  origins: string[] = ["http://localhost:5173"]
```

In development the allowed origins are more: an app that runs in the environment `development` (`NUCLEAR_ENV`,
which `nuclear run` gives the server: spec 021) also allows every development address of the machine's registry of
projects (`nuclear projects`: every Nuclear project of the machine, whatever its workspace, given to the server by
`nuclear run` in `NUCLEAR_DEV_ORIGINS`, read when it starts) and any origin `http://` or `https://` with the host
`localhost`, `127.0.0.1` or `[::1]` and any port or none. Nothing else changes: the preflight of any other origin
answers 403 and credentials are never allowed. In any other environment, and in a server started without
`NUCLEAR_ENV` (a deployment), only `origins` apply. A browser that is refused never shows the answer to the app: its
request fails as one that found no server ("no connection"), so a web app whose origin is not allowed seems to have
no backend.

#### Where it runs in development

Each project has its own development port, recorded in the machine's registry of projects the first time it is
made, built or run, and kept: the dialect's port when no other project of the registry has it, else the next one
that none has (`nuclear projects` shows them; two backends of one machine never share a port). `nuclear run` serves
on it, on `127.0.0.1` (`HOST` changes the address; a `PORT` of the command's environment is used instead of the
registry's for that run). A web or mobile app of a
workspace built in `development` without an `API_URL` calls the workspace's first backend at its address of the
registry (`http://127.0.0.1:<port>/`): an app written with `env("API_URL", "http://127.0.0.1:8000/")` follows its
backend's port. The address is `127.0.0.1`, never `localhost`, which may be `::1` first where the server listens on
IPv4 only. The Android emulator reaches the machine at `10.0.2.2`: its `API_URL` is
`http://10.0.2.2:<port>/` (`nuclear env set API_URL http://10.0.2.2:8000/ --local`).

#### Migrations of the database (ADR-backend-0001, ADR-backend-0002)

`createTables` is for development and tests: when the app starts it makes the tables of the entities the database
does not have, and never changes one that is there. It makes them as the migrations make them: the same types,
defaults, keys, foreign keys (those of a join table too) and names of constraints. A database that keeps its data
changes by migrations, kept in the project's `migrations/` folder (with the sources, not in `build/`):

```sh
nuclear migrate make "notes on tasks"   # one migration: what the entities changed since the migrations of the folder
nuclear migrate make "shops are stores" --rename shops=stores --rename orders.shop_id=store_id   # renames that keep the rows
nuclear migrate                         # applies the pending ones to the default database (also: nuclear migrate up)
nuclear migrate --to <migration>        # applies the pending ones up to that one
nuclear migrate down                    # reverts the last one applied
nuclear migrate down --to <migration>   # reverts every one applied after that one (it stays applied)
nuclear migrate status                  # every migration of the folder: applied or pending
```

`up` and `down` take `--fake` (the history changes and nothing runs) and `--transaction all|each|none`.

Making a migration:

- `make` compares the entities with the migrations of the folder, never with a database; with no change it writes
  nothing (`no changes: the entities match the last migration`).
- A migration's name is `<year month day hour minute second>_<message in snake_case>` (local time); `--to` takes the
  name or its timestamp.
- A migration is a file of the dialect's migration tool, written once and then the project's.
- **A rename is told to `make`**: after renaming the field or the entity in the code,
  `nuclear migrate make "<message>" --rename <table>=<new table>` and `--rename <table>.<column>=<new column>` (any
  number of them, with the names the database has: `customers`, `full_name`). The migration renames in place: the
  rows, the values and the foreign keys that point there are kept, and `down` renames back. A column of a table
  renamed in the same command is named by the table's old name (`--rename shops=stores --rename shops.name=title`).
  The unique and the foreign key of a renamed column keep the name they had. Without `--rename` a renamed table or
  column is a drop and an add: the data is lost, and `make` warns of it and says the option.
- `make --rename` refuses, writing nothing, a rename whose old name the migrations do not have (`cannot rename
  <old>: the migrations have no table <old>`) or the entities still have (`the entities still have the table
  <old>`), and one whose new name the entities do not have (`cannot rename <old> to <new>: the entities have no
  column <table>.<new>`) or the migrations already have (`the migrations already have the column <table>.<new>`).
- A changed `length` of a text column is a change of that column, in both directions; the type follows the table of
  §2.1. Making a column shorter fails while a row holds a longer text.
- `make` warns of what loses data or what a table with rows refuses: a dropped table or column, a required column
  added without a default, a column that becomes required.
- A field with a default (`done: boolean = false`) is also the column's SQL default, so adding it to a table with rows
  works. A `@created` or `@updated` column is required and has the database's clock as its default.
- A `DateTime` column is made with the fraction of a second (§2.1). A project whose migrations made it without one
  (before 0.94: whole seconds on MySQL and MariaDB) gets the change from its next `nuclear migrate make`.
- Every unique and foreign key has a name, `uq_<table>_<column>` and `fk_<table>_<column>`. A foreign key does what
  `onDelete` says and nothing else.
- `make` refuses a changed key (`the key of <table> changed`): a migration does not change the key of a table.
- Two migrations made at the same time (two people, each without the other's) both count: the next `make` compares
  with both.

Applying and reverting:

- The database keeps one row per migration applied, in the table `migrations` (`id`, `timestamp`, `name`).
- The migrations are ordered by their timestamp. `up` applies every pending one in that order, also one older than
  the ones already applied.
- `down` reverts the last one applied (the last row of the history), whatever its timestamp.
- A migration the database has applied and the folder does not hold is not listed and stops nothing; only
  reverting it is refused.
- `--transaction all` (the default) runs the whole command in one transaction, `each` one per migration, `none`
  none. When a migration fails the command stops with exit code 1 and that migration stays pending. PostgreSQL and
  SQLite undo what the failed transaction did: with `all` nothing of the run stays, with `each` the migrations before
  the failed one stay. MySQL and MariaDB keep every schema change made before the failure (they cannot undo them),
  and so does `none` on every database: the message says so, and they are undone by hand before it is applied again.
- A table that is already in the database is never taken as made by a migration: applying a migration that creates
  it fails. A database that already has its tables comes under migrations with `nuclear migrate --fake`: the
  pending migrations are written in the history without running. `nuclear migrate down --fake` takes the last one
  out of the history without running. The tables `createTables` made are the ones the first migration makes, so
  after `--fake` the next `make` has nothing to write.
- `down` runs the way back the migration holds; what `up` dropped comes back empty.
- A migration edited after it was applied is not applied again.
- With nothing to do a command says so and ends with exit code 0 (`the database is up to date`, `no migration is
  applied`, `nothing to revert`).

| Command | Prints, one line each |
|---|---|
| `make` | `wrote <file>`, and a `warning: ...` per risk |
| `migrate`, `migrate up` | `applied <migration>` (`applied <migration> (fake)`) |
| `migrate down` | `reverted <migration>` (`reverted <migration> (fake)`) |
| `migrate status` | `applied  <migration>` or `pending  <migration>` |
| a refused command | `error: ...`, exit code 1 |

- The migrations belong to the dialect they were made with, like code that uses type definitions (rule 11). The
  schema they leave is the same in every dialect.
- A project with migrations leaves `createTables` out of its connection.

### 2.9 Listener, events and cache

`~publish("topic", value)` sends an event: in the process (plugin `events`) or to Kafka when a `Kafka`
connection exists (plugin `kafka`), and to the clients of the app's WebSocket subscribed to the topic. A `listener` receives them: each `@consumer("topic")` method gets the
messages of the topic, parsed as the type of its parameter (a model or a map). The Redis cache: `~cacheGet(key)`,
`~cacheSet(key, value, seconds = 60)`.

```nuclear
listener TaskEvents
  created: string[] = []

  @consumer("tasks.created")
  onCreated(event: <string, any>) void
    created.add(event["title"])
```

#### The app's WebSocket (ADR-synapsis-0008)

With `WebSocketServer(path = "ws")` in its connections, the app answers its same controllers over one socket at
`/ws`, and pushes what it publishes; nothing else changes in the project. The frames are JSON text:

| Direction | Frame |
|---|---|
| client → app | `{"id": 1, "method": "GET", "path": "/tasks/1", "headers": {...}, "body": ...}`: a request |
| app → client | `{"id": 1, "status": 200, "body": ...}`: its answer, the same as over HTTP |
| client → app | `{"subscribe": "tasks.created"}`, `{"unsubscribe": "tasks.created"}` |
| app → client | `{"event": "tasks.created", "data": ...}`: an event published by the app |

The upgrade passes the app's guards: a refusal answers the upgrade with the guard's status (401, 403) and the error's
body; an upgrade on another path answers 404. A frame is a JSON object (`method` and `path` texts, `headers` an
object of texts): any other frame (not JSON, binary, `null`, a number, a list, deeper than 512 levels) closes the
socket with 1003, and one larger than `maxBodySize` with 1009. A request's `path` starts with one `/` and stays in the
app (another answers 404, and nothing leaves the app); a `method` other than `GET`, `HEAD`, `POST`, `PUT`, `PATCH`,
`DELETE` answers 405. A frame's own `headers` replace the upgrade's of the same name; `Host`, `Content-Length`,
`Transfer-Encoding` and the other headers of a connection are never taken from a frame. A `web` client gets this
with a `WebSocket(url)` connection and its repositories as they are (web.md §3.2). With Kafka, a socket receives what
its own process publishes. The contract says which transports serve each controller (`transports`), the path
(`webSocket`) and the events published (`events`: topic, component, payload; projects.md §1.2).

### 2.10 Tools

Functions a model can call. A method with a doc comment is a tool: the comment is its description, the
parameters its schema (types and defaults), the return a `string`. A method without a comment is a helper.
`tools.tools()` lists them.

```nuclear
tools TaskTools(tasks: TasksAppComponent)
  // Creates a task with a title and a priority (1 high, 2 normal, 3 low).
  addTask(title: string, priority: int = 2) string
    match ~tasks.create(NewTask(title = title, priority = priority))
      Ok(task) -> "created task ${task.id}: ${task.title}"
      Err(e) -> e.message
```

### 2.11 Agent

A model with tools and a prompt, with memory per conversation: `~agent.ask(text, thread = "default")` answers.
Its `tools` dependencies are its tools; `model` names a chat connection (default `"default"`).

```nuclear
agent AssistantAgent(tools: TaskTools)
  prompt: string = "You are a task assistant. Use the tools to read, add and complete tasks; never invent ids."
```

### 2.12 State and graph

A `state` is the state of a graph (a model; `messages: Messages` keeps a conversation). A `graph` runs nodes over
it: each method receives the state (`state.field`) and returns what changes (a map); `@start` marks the first
node and `@next("node")` the one after it (`"end"` ends). `~chatModel()` is the chat connection; `textOf(reply)`
its text. `~planner.run(input, thread = "default")` runs it and gives the final state.

```nuclear
state PlanState
  goal: string
  titles: string[]
  created: int

@state(PlanState)
graph Planner(tasks: TasksAppComponent)
  @start
  @next("save")
  split(state: PlanState) <string, any>
    reply = ~chatModel().invoke("Split this goal into at most 5 short tasks, one per line: ${state.goal}")
    titles = textOf(reply).split("\n").map((line) => line.trim()).filter((line) => not line.isEmpty)
    { "titles": titles.take(5) }

  @next("end")
  save(state: PlanState) <string, any>
    created = 0
    for title in state.titles
      made = ~tasks.create(NewTask(title = title))
      if made.isOk
        created += 1
    { "created": created }
```

### 2.13 Generators

`nuclear gen resource <component> <Name>` writes the finished, compiling code of a resource (ADR-codegen-0001): its models
(nested objects become models named `<Name><Key>`; a paged answer gives `<Name>Page`), the repository (`--source rest:<base url>`: an HTTP repository over `Http(baseUrl)`, the app's connection added when missing; `--source db`: an entity, a `New<Name>` model and a paged query), one use
case per action (`--actions list,get,search,create,update,delete`), their aliases in the facade, and the controller with the routes; a database resource also gets its tests. The fields
come from an example answer (`--from-json <file|url>`), a spec (`--from-spec <spec.md>`: its example answer, else its
`Key | Type` table; a `GET https://...` line gives the API) or `--fields "id:int name:string"`. A file that exists is
never overwritten (the facade, the repository and the controller get only the members they lack, so an action added to a resource that exists is finished); a name another file declares stops it before it writes.
`nuclear gen inspect` answers what the project has. A stored resource gets no `search`: which column is searched is
a decision, so it is a query of the repository wired with `nuclear gen usecase --calls`. The agent writes only what
is not standard: a use case with its own rules, a view's details.

`nuclear gen usecase <component> <Name>` wires a use case into its component: its alias in the facade and, with
`--route "POST orders/{id}/cancel"`, its route in the controller of the route's prefix (`OrdersController`, made
when missing; a `{name}` of the path is a parameter of the use case). The use case is one the project declares (its
rules are written first; its signature is read, and its route calls it with `~` when its `exec` awaits), or, with
`--calls <Repository>.<method>`, it is written too: all it does is call that method, which a repository of the
project declares (an answer that is not a `Result` goes inside an `Ok`).

```sh
nuclear gen resource characters Character --from-json https://rickandmortyapi.com/api/character
nuclear gen usecase orders CancelOrder --route "POST orders/{id}/cancel"       # CancelOrder is in the project
nuclear gen usecase catalog PageBooks --calls BookRepository.page --route "GET shelves/{page}"
```

### 2.14 Tests

In `test/*_test.nuc`: `tests Name` + `@test("what it checks")` methods. Every test runs with the project's
connections and the databases in memory; `inject<X>()` gives the instances; `expect(condition)` asserts;
`FakeModel(["answer"])` is a chat model with fixed answers.

```nuclear
tests Tasks
  @test("a repeated title is a conflict")
  repeatedTitle() void
    tasks = inject<TasksAppComponent>()
    ~tasks.create(NewTask(title = "call mom"))
    again = ~tasks.create(NewTask(title = "call mom"))
    expect(again.error.status == 409)
```

#### The app as its clients call it (ADR-synapsis-0010)

`appClient()` gives the app over HTTP and over its WebSocket, with the test's connections: `~app.get(path,
headers)`, `~app.post(path, body, headers)`, `put`, `patch`, `delete` and `~app.request(method, path, body,
headers)` answer an `HttpAnswer` (`status`, `body`); `~app.socket(path = "/ws", headers)` is `Ok` of an `AppSocket`,
or `Err` with the status of the guard that refused it. A socket's `~ws.request(...)` is a request frame and its
answer, `~ws.subscribe(topic)` / `unsubscribe(topic)` follow a topic, `~ws.next(seconds = 2)` is the next pushed
`SocketEvent` (`topic`, `data`) or `null`, `~ws.close()` ends it. `body` and `headers` are always named.

`testEnv(NAME = "value")` in `config.nuc` is the environment the tests run with, set before the app is loaded: the
test's own token for a guard, never the user's.

```nuclear
// config.nuc: testEnv(TASKS_TOKEN = "test-tasks-token")
TOKEN = { "X-Tasks-Token": "test-tasks-token" }

tests Api
  @test("the guards and the socket")
  guarded() void
    app = appClient()
    expect((~app.get("/tasks")).status == 401)
    expect((~app.get("/tasks", headers = TOKEN)).status == 200)
    expect((~app.socket("/ws")).error.status == 401)
    ws = (~app.socket("/ws", headers = TOKEN)).value
    ~ws.subscribe("tasks.created")
    made = ~ws.request("POST", "/tasks", body = { "title": "call mom" })
    expect(made.status == 201)
    expect((~ws.next())!.data["title"] == "call mom")
    ~ws.close()
```

### 2.15 Telemetry

With `plugins(telemetry = true)` the app sends its traces and metrics over OTLP (the OpenTelemetry protocol) to the
connection of `config/` that says where: `Datadog(apiKey, url)` (the local Agent on `http://localhost:4318` by
default), `NewRelic(licenseKey, region)` (`us` or `eu`), `Grafana(url, instanceId, token)` (a local Alloy by
default, or the stack's OTLP gateway) or `Otlp(url)` (any collector). Every one takes `service` (the name the
vendor shows; default `OTEL_SERVICE_NAME`) and `sample` (the share of the traces kept, `1` = all, decided once at the
root of each trace). Keys come from `env(...)`.

```nuclear
appConfig ProjectConfig
  connections: Connection[] = [
    SQLite(file = env("DATABASE", "orders.sqlite")),
    Datadog(apiKey = env("DD_API_KEY"), sample = 0.5),
  ]
```

Measured without code: every HTTP request, and every use case's `exec` as a span named with its place
(`orders › usecase › FindOrder.exec`), a child of the request that called it. An `Err` marks the span as an error
with the error's name. Two words write metrics: `Metric.count(name, value = 1, attributes...)` and
`Metric.record(name, value, attributes...)`; the attributes are named arguments.

`@untraced` leaves something out: on a use case, its span; on a route, the whole request (nothing it calls is
traced); on a controller, every route of it. Without the plugin `@untraced` does nothing, and no use case carries a
span.

```nuclear
controller HealthController
  @get("health")
  @untraced
  health() Result<Error, Health>
    Ok(Health(ok = true))
```

## 3. What the dialect decides

Only how it is written: the language, the framework, the packages, the generated project's files and how to
run it. Each dialect's spec documents that and nothing else: [fastapi.md](../../../../../nuclearlang/dialects/python/docs/07-reference/fastapi.md) (`fastapi`),
[nestjs.md](../../../../../nuclearlang/dialects/typescript/docs/07-reference/nestjs.md). One example project is built with every backend dialect from the same `.nuc` files
(ADR-synapsis-0002).
