# Dialect `fastapi` (→ `fastapi`): the `backend` platform in Python

> The Python dialect of the [backend platform](../../../../../nuclear-synapsis-framework/platforms/backend/docs/07-reference/backend.md) (ADR-synapsis-0002), extending [python.md](python.md). The
> platform's rules, kinds and Nuclear are in `backend.md`; this document holds only how this dialect writes them:
> REST controllers on **FastAPI**, repositories over tables with **SQLAlchemy 2 async**, **pydantic** models, and
> **LangChain / LangGraph** tools, agents and graphs. Files: `nuclearlang/dialects/python/frameworks/fastapi/` (renamed `fastapi` in phase B1,
> `docs/01-product/roadmap.md` of this dialect); runtime: `packages/synapsis-py` (import name `synapsis`).

## 1. Project

A folder with `config.nuc` (`synapsis(platform = "backend", dialect = "fastapi")`, [backend.md](../../../../../nuclear-synapsis-framework/platforms/backend/docs/07-reference/backend.md) §1);
`nuclear build .` writes `build/` (the Python package `app/`, `tests/` from the platform's `test/`, `pyproject.toml`
with the `app(...)` name, version and description). Run it with
`python -m synapsis.server` from `build/` (the runtime's server over uvicorn: `HOST`, default `127.0.0.1`, and `PORT`,
default 8000; `--reload` in development; no `Server` header, the request lines the app's own); test it with `pytest`.

```
rick_api/
├── config.nuc                         synapsis(platform = "backend", dialect = "fastapi"), app(...), plugins(...)
├── config/project_config.nuc          appConfig: the connections of the app
├── components/characters/
│   ├── characters_appcomponent.nuc    appcomponent: what the rest of the app sees
│   ├── config/characters_config.nuc   config: connections only this component uses
│   ├── data/entities/*.nuc            entities (tables), by folder
│   ├── data/repositories/*.nuc        repository
│   ├── domain/models/*.nuc            pydantic models, by folder
│   ├── domain/usecases/*.nuc          usecase
│   ├── api/*.nuc                      controller
│   ├── ai/*.nuc                       tools, agent, graph; ai/states/ = state by folder
│   └── events/*.nuc                   listener
├── shared/entities, shared/models     the same kinds, visible to every component
└── test/*_test.nuc                    tests (pytest, written to tests/), by folder
```

Generated once per project: `app/main.py` (the FastAPI `app`: config, component configs, controllers, listeners),
`tests/conftest.py` (each test with the connections open, databases in memory) and `pyproject.toml`.

**Architecture** (N0301, N0302): a use case is called only by its `appcomponent`; a repository by use cases,
aggregates and tools; a service by use cases and aggregates. Another component sees only the `appcomponent`,
models, entities, tools, agents, states and graphs.

**Libraries** (one per need, the most used): FastAPI (HTTP), pydantic (validation), SQLAlchemy 2 async with asyncpg /
aiomysql / aiosqlite (SQL), redis.asyncio (cache), aiokafka (Kafka), LangChain `init_chat_model` /
`init_embeddings` (OpenAI and Ollama behind one API), LangGraph (graphs, checkpoints), Chroma (vectors). Their type
definitions come with the dialect: `nuclear defs search <text> --dialect fastapi`.

### Plugins (`config.nuc`)

The optional parts are plugins ([projects.md](../../../../docs/07-reference/projects.md) §3.3): `plugins(sqlite = true, postgres = true, mysql =
true, redis = true, kafka = true, events = true, websocket = true, ai = true, openai = true, ollama = true, chroma = true,
telemetry = true)`. Only the enabled ones go to `pyproject.toml`, and the runtime imports them only then (`synapsis.ai`,
`synapsis.events`, `synapsis.sockets`, `synapsis.telemetry`). A kind or a name of a
plugin not enabled is N0304: `tools`, `agent`, `state`, `graph` need `ai`; `listener` needs `kafka`; `Redis` needs
`redis`.

## 2. Kinds

### 2.1 Entity

A table. In `components/<c>/data/entities/` the kind is given by the folder; elsewhere write `entity`. `@entity("table")` names the table (default: the name in snake_case). Each field is a column: `@primary(generated = true)` (a key the database gives: auto increment for an `int`, a uuid for a `string`), `@primary()` (a key the app gives), `@column(length = 100, unique = true, index = true, nullable = true, name = "x")`, `@created()`, `@updated()`; without a decorator it is a column too. Its SQL type comes from the field type; `name?: T` is nullable; a default goes to the column. A `DateTime` is the runtime's `UtcDateTime` (the timestamps too): the column keeps the fraction of a second on every database. `@created()` / `@updated()` are written by the app (`synapsis.orm`'s clock, to the millisecond, one instant for a new row's two), with `(CURRENT_TIMESTAMP)` as the column's default for a row written by SQL. A text is `String(n)` (`String(255)` without `length`): the database's `VARCHAR(n)` or, above what it holds, its text type; `Repository.save` and `update` refuse a longer text before it is written (`synapsis.errors.IntegrityViolation`, a 409).

```nuclear
@entity("characters")
entity Character()
  @primary(generated = true)
  id: int
  @column(length = 100, unique = true)
  name: string
  @column(length = 20)
  status: string = "alive"
  species?: string
```

```python
from __future__ import annotations

from synapsis import Entity, Mapped, column, primary


class Character(Entity):
    __tablename__ = "characters"

    id: Mapped[int] = primary(generated=True)
    name: Mapped[str] = column(length=100, unique=True)
    status: Mapped[str] = column(length=20, default="alive")
    species: Mapped[str | None] = column(nullable=True)
```

The exact numbers (ADR-backend-0003): a `bigint` is the runtime's `BigInt` (an `int` annotated so its JSON is a text) and
a `bigdouble` its `BigDouble` (a `Decimal`); their columns are `ExactInteger` (`BIGINT`) and `ExactDecimal(precision,
scale)` (`NUMERIC`, 30 and 10 by default; on SQLite the value's text, `EXACT TEXT(p,s)`), compared and sorted by value
by the runtime's comparator. `Repository.save` and `update` refuse a value the column cannot hold (`IntegrityViolation`,
409).

```nuclear
@entity("balances")
entity Balance()
  @primary(generated = true)
  id: int
  serial: bigint
  @column(precision = 40, scale = 20)
  rate: bigdouble
  amount: bigdouble = 0.0
```

```python
class Balance(Entity):
    __tablename__ = "balances"

    id: Mapped[int] = primary(generated=True)
    serial: Mapped[BigInt] = column()
    rate: Mapped[BigDouble] = column(precision=40, scale=20)
    amount: Mapped[BigDouble] = column(default=Decimal("0.0"))
```

#### Relations (ADR-backend-0001)

TypeORM's decorators; the related entity is the field's type. `@manyToOne x?: T` keeps its column in the field `xId`
(its own field, set without loading the row); `@oneToMany(inverse)` is the other side; `@manyToMany(inverse)` with
`@joinTable()` on one side makes the table `<table>_<field>` (columns `<entity>_id`); `@oneToOne` with `@joinColumn()`
on the side that keeps `xId`. `onDelete`: `"cascade"`, `"set null"`, `"restrict"`. A relation field is optional and
loaded only when a query asks for it (`relations("tasks")`); an unloaded one is absent from the JSON answer. N0308 when
a rule is not met. Setting a relation (`Task(projectId = id)`, `task.tags = [a, b]`) and saving writes it.

```nuclear
@entity("projects")
entity Project()
  @primary(generated = true)
  id: int
  name: string
  @oneToMany(inverse = "project")
  tasks?: Task[]

@entity("tasks")
entity Task()
  @primary(generated = true)
  id: int
  title: string
  @manyToOne(inverse = "tasks", onDelete = "cascade")
  project?: Project
  projectId?: int
  @manyToMany(inverse = "tasks")
  @joinTable()
  tags?: Tag[]

@entity("tags")
entity Tag()
  @primary(generated = true)
  id: int
  label: string
  @manyToMany(inverse = "tags")
  tasks?: Task[]
```

```python
from __future__ import annotations

from synapsis import Entity, Mapped, column, many_to_many, many_to_one, one_to_many, primary


class Project(Entity):
    __tablename__ = "projects"

    id: Mapped[int] = primary(generated=True)
    name: Mapped[str] = column()
    tasks: Mapped[list[Task]] = one_to_many("Task", "project")


class Task(Entity):
    __tablename__ = "tasks"

    id: Mapped[int] = primary(generated=True)
    title: Mapped[str] = column()
    project: Mapped[Project | None] = many_to_one("Task", "project_id", "projects.id", inverse="tasks", on_delete="cascade")
    project_id: Mapped[int | None] = column(nullable=True)
    tags: Mapped[list[Tag]] = many_to_many("Task", "tags", "Tag", inverse="tasks", join=True)


class Tag(Entity):
    __tablename__ = "tags"

    id: Mapped[int] = primary(generated=True)
    label: Mapped[str] = column()
    tasks: Mapped[list[Task]] = many_to_many("Tag", "tasks", "Task", inverse="tags")
```

### 2.2 Repository

The data of one entity: `NameRepository` works on `Name` (or `@repository(Entity)`). It brings `find(id)` (`Ok(entity)` / `Err(NotFound)`), `findAll()`, `save(entity)` and `remove(id)`. Each method's lines build ONE query, created for that call (`q`): `where({...})` (equality, or `gt`, `gte`, `lt`, `lte`, `ne`, `like`, `ilike`, `contains`, `icontains`, `oneOf`, `isNull`, `between`), `orderBy(field, desc = true)`, `limit(n)`, `offset(n)`, `relations("tasks", "tasks.tags")` (the relations to load); the last line runs it: `getOne()` (`Result`), `getMany()`, `paginate(page, size)` (`Page<T>`: `items`, `page` from 1, `size`, `total`, `pages`), `count()`, `exists()`, `update({...})`, `delete()`. The caller awaits it: `~characters.byName(name)`.

```nuclear
repository CharacterRepository
  byName(name: string) Result<Error, Character>
    where({ "name": name })
    getOne()

  aliveSince(year: int, max: int = 20) Character[]
    where({ "status": "alive", "year": gte(year) })
    orderBy("name")
    limit(max)
    getMany()
```

```python
from __future__ import annotations

from synapsis import AppError, Repository, Result, gte
from typing import Awaitable


class CharacterRepository(Repository[Character]):
    def by_name(self, name: str) -> Awaitable[Result[AppError, Character]]:
        q = self.query()
        q.where({"name": name})
        return q.get_one()

    def alive_since(self, year: int, max_: int = 20) -> Awaitable[list[Character]]:
        q = self.query()
        q.where({"status": "alive", "year": gte(year)})
        q.order_by("name")
        q.limit(max_)
        return q.get_many()
```

A client's text goes to `contains` / `icontains` (its `%`, `_` and `/` are characters, never wildcards:
SQLAlchemy's `contains(..., autoescape=True)`); `like` and `ilike` take a pattern:

```nuclear
repository CharacterRepository
  search(text: string) Character[]
    where({ "name": icontains(text) })
    orderBy("name")
    getMany()
```

```python
from synapsis import Repository, icontains
from typing import Awaitable


class CharacterRepository(Repository[Character]):
    def search(self, text: str) -> Awaitable[list[Character]]:
        q = self.query()
        q.where({"name": icontains(text)})
        q.order_by("name")
        return q.get_many()
```

A page and a relation:

```nuclear
repository ProjectRepository
  withTasks(id: int) Result<Error, Project>
    where({ "id": id })
    relations("tasks.tags")
    getOne()

repository TaskRepository
  page(page: int, size: int = 20) Page<Task>
    orderBy("id")
    paginate(page, size)
```

```python
from __future__ import annotations

from synapsis import AppError, Page, Repository, Result
from typing import Awaitable


class ProjectRepository(Repository[Project]):
    def with_tasks(self, id: int) -> Awaitable[Result[AppError, Project]]:
        q = self.query()
        q.where({"id": id})
        q.relations("tasks.tags")
        return q.get_one()


class TaskRepository(Repository[Task]):
    def page(self, page: int, size: int = 20) -> Awaitable[Page[Task]]:
        q = self.query()
        q.order_by("id")
        return q.paginate(page, size)
```

An HTTP repository (another API, ADR-codegen-0001; nuclear-synapsis-framework/platforms/backend/docs/07-reference/backend.md §2.2): an `HttpRepository` that sends each call through
the `Http` connection (httpx) and validates the answer against the declared type (pydantic):

```nuclear
@repository(path = "character")
repository CharacterRepository
  @get(path = ":id")
  one(id: int) Result<Error, Character>
```

```python
from __future__ import annotations

from synapsis import AppError, HttpRepository, Result


class CharacterRepository(HttpRepository):
    path = "character"

    async def one(self, id: int) -> Result[AppError, Character]:
        return await self.send("GET", ":id", { "id": id }, Character)
```

### 2.3 Model

What the API reads and answers: a pydantic model (in `domain/models/` by folder) that extends the runtime's `Model`:
its fields are Python's (`last_read`), its JSON Nuclear's (`lastRead`), the same as every dialect's and the contract's
(ADR-synapsis-0012); it reads either name. The same rule decorators as the nestjs dialect and Synapsis's forms become pydantic constraints: `@required` (the runtime's `AfterValidator(is_given)`: an empty text answers `required`), `@minLength(n)`, `@maxLength(n)`, `@min(n)`, `@max(n)`, `@pattern(r"...")`, `@email`, `@url`. An invalid body is a 400 with the reasons, the platform's answer in every dialect (the runtime replaces FastAPI's 422). Nothing converts a value: the runtime's `Model` takes pydantic's conversions away (a text is never a number or a boolean, a number is never a `DateTime`; `30.0` is a whole number). `NewCharacter(name = "")` built in code is checked by pydantic and raises its `ValidationError`. An optional field left empty is `None`, written `null` in the answer, never absent.

```nuclear
model NewCharacter
  @minLength(1)
  @maxLength(100)
  name: string
  status: string = "alive"
  @email
  contact?: string
```

```python
from __future__ import annotations

from annotated_types import MaxLen, MinLen
from pydantic import AfterValidator
from synapsis import Model
from synapsis.validators import is_email
from typing import Annotated


class NewCharacter(Model):
    name: Annotated[str, MinLen(1), MaxLen(100)]
    status: str = "alive"
    contact: Annotated[str | None, AfterValidator(is_email)] = None
```

A `bigint` or `bigdouble` field reads a JSON text with the language's rules (`synapsis.exact`) and refuses a JSON number
(the reader marks JSON's whole numbers, `JsonInt`); it writes its `toString()`. `@min` and `@max` of one are bounds of
its type, compared exactly:

```nuclear
model NewBalance
  @max(12345678901234567890123)
  serial: bigint
  @min(0.01)
  amount: bigdouble
  rates: bigdouble[] = []
```

```python
class NewBalance(Model):
    serial: Annotated[BigInt, Le(12345678901234567890123)]
    amount: Annotated[BigDouble, Ge(Decimal("0.01"))]
    rates: list[BigDouble] = []
```

### 2.4 Use case

One business operation: its dependencies are injected by type; `exec` returns `Result<E, T>`. `Error` is `AppError`; the runtime has `NotFound` (404), `Invalid` (400), `Unauthorized` (401), `Forbidden` (403) and `Conflict` (409). What the database refuses for integrity (SQLAlchemy's `IntegrityError`: a unique, a foreign key, a required column) is answered by the app with 409 `conflict`; inside `@transactional` the transaction is rolled back.

```nuclear
model NewCharacter
  name: string
  status: string = "alive"

entity Character()
  @primary(generated = true)
  id: int
  name: string
  status: string

usecase CreateCharacter(characters: CharacterRepository)
  exec(input: NewCharacter) Result<Error, Character>
    taken = ~characters.where({ "name": input.name }).exists()
    if taken
      return Err(Conflict("${input.name} already exists"))
    Ok(~characters.save(Character(name = input.name, status = input.status)))
```

```python
from __future__ import annotations

from synapsis import AppError, Conflict, Entity, Err, Mapped, Model, Ok, Result, column, primary


class NewCharacter(Model):
    name: str
    status: str = "alive"


class Character(Entity):
    __tablename__ = "character"

    id: Mapped[int] = primary(generated=True)
    name: Mapped[str] = column()
    status: Mapped[str] = column()


class CreateCharacter:
    def __init__(self, characters: CharacterRepository) -> None:
        self.characters = characters

    async def exec(self, input: NewCharacter) -> Result[AppError, Character]:
        taken = await self.characters.where({"name": input.name}).exists()
        if taken:
            return Err(Conflict(f"{input.name} already exists"))
        return Ok(await self.characters.save(Character(name=input.name, status=input.status)))
```

`@transactional` on `exec`: every repository call inside shares one transaction of the default database; an `Err`
or an error rolls it back, an `Ok` commits it.

```nuclear
usecase CloseProject(tasks: TaskRepository, projects: ProjectRepository)
  @transactional
  exec(id: int, into: int) Result<Error, int>
    ~projects.find(into)
    moved = ~tasks.where({ "projectId": id }).update({ "projectId": into })
    ~projects.remove(id)
    Ok(moved)
```

```python
from __future__ import annotations

from synapsis import AppError, Ok, Result, transactional


class CloseProject:
    def __init__(self, tasks: TaskRepository, projects: ProjectRepository) -> None:
        self.tasks = tasks
        self.projects = projects

    @transactional
    async def exec(self, id: int, into: int) -> Result[AppError, int]:
        await self.projects.find(into)
        moved = await self.tasks.where({"projectId": id}).update({"projectId": into})
        await self.projects.remove(id)
        return Ok(moved)
```

### 2.5 Appcomponent

The facade of a component: aliases to the use cases. Other components and the controllers use only this.

```nuclear
appcomponent CharactersAppComponent
  character() = GetCharacter.exec
  create() = CreateCharacter.exec
```

```python
from __future__ import annotations


class CharactersAppComponent:
    def character(self):
        return GetCharacter.exec

    def create(self):
        return CreateCharacter.exec
```

### 2.6 Controller

REST routes over FastAPI, like NestJS: `@controller("path")` and `@get`, `@post` (201), `@put`, `@patch`, `@delete` with the route of the platform (`"{id}"`: a path parameter; segments without a leading slash: the runtime's decorators add it). A parameter that is a model is the JSON body; an entity is read and answered through its pydantic schema. A `Result` answers its value, or the error's status and message; an invalid body or parameter answers 400 with the reasons.

```nuclear
@controller("characters")
controller CharactersController(characters: CharactersAppComponent)
  @get("{id}")
  one(id: int) Result<Error, Character>
    ~characters.character(id)

  @post()
  create(input: NewCharacter) Result<Error, Character>
    ~characters.create(input)
```

```python
from __future__ import annotations

from synapsis import AppError, Result, controller, get, post


@controller("characters")
class CharactersController:
    def __init__(self, characters: CharactersAppComponent) -> None:
        self.characters = characters

    @get("{id}")
    async def one(self, id: int) -> Result[AppError, Character]:
        return await self.characters.character(id)

    @post()
    async def create(self, input: NewCharacter) -> Result[AppError, Character]:
        return await self.characters.create(input)
```

An exact parameter of the path or the query is read with the texts of a body (`BigInt`, `BigDouble`: the runtime's
reader sees the annotation):

```nuclear
@controller("balances")
controller BalancesController()
  @get("{serial}")
  one(serial: bigint, min: bigdouble = 0.5) bigdouble
    min
```

```python
@controller("balances")
class BalancesController:
    @get("{serial}")
    @_public_names(min_="min")
    def one(self, serial: BigInt, min_: BigDouble = Decimal("0.5")) -> BigDouble:
        return min_
```

### 2.7 Configuration

The connections of the app (`appConfig`, `config/project_config.nuc`) and of a component (`config`): opened at start and closed at stop. Databases: `Postgres`, `MySQL`, `SQLite` (`url` picks the async driver, `createTables = true` creates the tables, by the operations a migration runs); `Redis`; `Kafka(servers, group)`; models: `OpenAI(model)`, `Ollama(model, baseUrl)`, `Embeddings(model)`; `Chroma(collection, embeddings, path)`. Each has a `name` (default `"default"`). `env("VAR", "default")` reads the environment. The value is read at run time from the process
(spec 021): `nuclear run --env <environment>` passes the values of the environment's files (`.env`,
`.env.<environment>`, their `.local` versions) and its secrets (the system's keyring); `nuclear build --env
<environment>` writes the non-secret ones into the build's `.env`, which `synapsis.config` loads at start without replacing a
variable the process already has (production gives its secrets in the real environment). `env("VAR")` without a
default is required: `nuclear run` does not start without it. A database is a plugin (`SQLite`, `Postgres`, `MySQL`, `MariaDB`;
ADR-backend-0004) is a class the build writes from the plugin's Nuclear into `app/plugins/`, `class Postgres(Database)`
with the `driver` its package names (`postgresql+asyncpg`) and its `retries`, imported from there.

```nuclear
appConfig ProjectConfig
  connections: Connection[] = [
    Redis(url = env("REDIS_URL", "redis://localhost:6379/0")),
    Kafka(servers = env("KAFKA", "localhost:9092"), group = "rick"),
    OpenAI(model = "gpt-4o-mini"),
  ]
```

```python
from __future__ import annotations

from synapsis import AppConfig, Connection, Kafka, OpenAI, Redis, env


class ProjectConfig(AppConfig):
    connections: list[Connection] = [
        Redis(url=env("REDIS_URL", "redis://localhost:6379/0")),
        Kafka(servers=env("KAFKA", "localhost:9092"), group="rick"),
        OpenAI(model="gpt-4o-mini"),
    ]
```

#### Guards and the app's WebSocket (ADR-synapsis-0007, ADR-synapsis-0008)

`guards` in the `appConfig` become a FastAPI dependency of every router (and of the contract's routes; a guarded app
serves no `/openapi.json`; no app serves `/docs` or `/redoc`); `@controller(..., guards = [...])` stays the runtime's decorator, whose router gets them too.
`Token` and `NoOrigin` are `synapsis.guards`'s, re-exported by `synapsis`. `WebSocketServer` (plugin `websocket`:
`websockets` for uvicorn) is `synapsis.sockets`'s: it adds a Starlette WebSocket route that checks the app's guards
on the upgrade (a refusal is the upgrade's HTTP answer, the WebSocket Denial Response) and sends every request frame
through the app with httpx's ASGI transport. Every request passes the runtime's `Edge` (an ASGI middleware: the line
of the log, the cause of a 500, the body's limit and type, CORS); a parameter of the path or the query is read by one
dependency of the route (`synapsis.wire.parse_param`), the body by FastAPI through the runtime's JSON reader.

```nuclear
// config.nuc: plugins(events = true, websocket = true)

appConfig ProjectConfig
  connections: Connection[] = [WebSocketServer(path = "ws")]
  guards: Guard[] = [NoOrigin(), Token(value = env("CHAT_TOKEN"), header = "X-Chat-Token")]

@controller("admin", guards = [Token(value = env("ADMIN_TOKEN"))])
controller AdminController()
  @get()
  info() string
    "ok"
```

```python
from __future__ import annotations

from synapsis import AppConfig, Connection, Guard, NoOrigin, Token, controller, env, get
from synapsis.sockets import WebSocketServer


# config.nuc: plugins(events = true, websocket = true)

class ProjectConfig(AppConfig):
    connections: list[Connection] = [WebSocketServer(path="ws")]
    guards: list[Guard] = [NoOrigin(), Token(value=env("CHAT_TOKEN"), header="X-Chat-Token")]


@controller("admin", guards=[Token(value=env("ADMIN_TOKEN"))])
class AdminController:
    @get()
    def info(self) -> str:
        return "ok"
```

### 2.8 Tools

Each public method with a doc comment is a LangChain tool, and the doc comment is the description the model reads; a method without one is a helper of the others (never offered to the model). A tool can use the component's repositories.

```nuclear
tools CharacterTools(characters: CharacterRepository)
  // Tells whether a character of the show is alive, by its name.
  status(name: string) string
    match ~characters.byName(name)
      Ok(c) -> "${c.name} is ${c.status}"
      Err(_) -> "nobody is called ${name}"
```

```python
from __future__ import annotations

from synapsis.ai import Tools


class CharacterTools(Tools):
    def __init__(self, characters: CharacterRepository) -> None:
        self.characters = characters

    async def status(self, name: str) -> str:
        """Tells whether a character of the show is alive, by its name."""
        by_name_result = await self.characters.by_name(name)
        if by_name_result.is_ok:
            return f"{by_name_result.value.name} is {by_name_result.value.status}"
        else:
            return f"nobody is called {name}"
```

### 2.9 Agent

A model with tools and a system prompt (LangChain `create_agent`, with memory per thread). Its tools are the `tools` it receives; `model` names the chat model connection. `~guide.ask(text, thread = "user-1")` answers; `stream(text)` gives the answer piece by piece.

```nuclear
agent Guide(tools: CharacterTools)
  model: string = "default"
  prompt: string = "You answer questions about the characters. Use the tools."
```

```python
from __future__ import annotations

from synapsis.ai import Agent


class Guide(Agent):
    model: str = "default"
    prompt: str = "You answer questions about the characters. Use the tools."

    def __init__(self, tools: CharacterTools) -> None:
        self.tools = tools
```

### 2.10 State and graph

A LangGraph `StateGraph`: `state` is its state, a pydantic model, so a node reads `state.field`; a field without a default gets its type's empty value (`""`, `0`, `[]`, `None` for `T?`), so a graph can start from a partial state; `messages: Messages` keeps a conversation. Each method of the `graph` is a node that receives the state and returns what changes; `@start` marks the first one and `@next("node")` the one after it (`"end"` ends). A node can also return `Command(goto = "node", update = {...})` to choose at run time. `~review.run(state, thread)` runs it.

```nuclear
state ReviewState
  question: string
  answer: string

@state(ReviewState)
graph Review(guide: Guide)
  @start
  @next("end")
  ask(state: ReviewState) <string, string>
    { "answer": ~guide.ask(state.question) }
```

```python
from __future__ import annotations

from pydantic import BaseModel
from synapsis.ai import Graph, next, start


class ReviewState(BaseModel):
    question: str = ""
    answer: str = ""


class Review(Graph[ReviewState]):
    state = ReviewState

    def __init__(self, guide: Guide) -> None:
        self.guide = guide

    @start
    @next("end")
    async def ask(self, state: ReviewState) -> dict[str, str]:
        return {"answer": await self.guide.ask(state.question)}
```

### 2.11 Listener

A Kafka consumer: each `@consumer("topic")` method receives the messages of the topic, parsed as the type of its parameter (a model). `~publish("topic", value)` sends one. The Redis cache: `~cacheGet(key)`, `~cacheSet(key, value, seconds = 60)`.

```nuclear
listener CharacterEvents(characters: CharactersAppComponent)
  @consumer("characters.created")
  created(input: NewCharacter) void
    ~characters.create(input)
```

```python
from __future__ import annotations

from synapsis.events import Listener, consumer


class CharacterEvents(Listener):
    def __init__(self, characters: CharactersAppComponent) -> None:
        self.characters = characters

    @consumer("characters.created")
    async def created(self, input: NewCharacter) -> None:
        await self.characters.create(input)
```

### 2.12 Tests

In `test/*_test.nuc` (written to `tests/`, pytest's folder): `tests Name` + `@test("what it checks")` methods → a pytest class. Every test runs with the project's connections, the databases in memory and the project's listeners created (`tests/conftest.py`); `inject<X>()` gives the instances. `expect(condition)` is `assert`. `synapsis.testing.FakeModel([...])` answers fixed texts.

```nuclear
tests Characters
  @test("an unknown id is not found")
  unknownId() void
    app = inject<CharactersAppComponent>()
    missing = ~app.character(99)
    expect(missing.isErr)
    expect(missing.error.status == 404)
```

```python
from __future__ import annotations

from synapsis import inject


class TestCharacters:
    async def test_unknown_id(self) -> None:
        "an unknown id is not found"
        app = inject(CharactersAppComponent)
        missing = await app.character(99)
        assert missing.is_err
        assert missing.error.status == 404
```

#### The app over HTTP and its WebSocket (ADR-synapsis-0010)

`appClient()` is `synapsis.testing.app_client()`: it builds the app again from `app/main.py`'s `create()` (the
test's connections), sends HTTP through httpx's ASGI transport and opens the socket as an ASGI connection in the
test's event loop. `testEnv(...)` of `config.nuc` is `os.environ.update({...})` at the top of `tests/conftest.py`.

```nuclear
tests Api
  @test("the guards and the socket")
  guarded() void
    app = appClient()
    expect((~app.get("/tasks", headers = { "X-Tasks-Token": "t" })).status == 200)
    ws = (~app.socket("/ws", headers = { "X-Tasks-Token": "t" })).value
    made = ~ws.request("POST", "/tasks", body = { "title": "call mom" })
    expect(made.status == 201)
```

```python
from __future__ import annotations

from synapsis.testing import app_client


class TestApi:
    async def test_guarded(self) -> None:
        "the guards and the socket"
        app = app_client()
        assert (await app.get("/tasks", headers={"X-Tasks-Token": "t"})).status == 200
        ws = (await app.socket("/ws", headers={"X-Tasks-Token": "t"})).value
        made = await ws.request("POST", "/tasks", body={"title": "call mom"})
        assert made.status == 201
```

### 2.13 Telemetry

`plugins(telemetry = true)` adds the OpenTelemetry SDK, its OTLP/HTTP exporter and its FastAPI instrumentation to
`pyproject.toml`. The connections (`Datadog`, `NewRelic`, `Grafana`, `Otlp`) and `Metric` come from
`synapsis.telemetry`; their named arguments are snake_case (`api_key`). Every use case's `exec` gets
`@traced("<component> › usecase › <Class>.exec")`, the name written as a constant (`app` for a file outside a
component, as below); `@untraced` is
`synapsis.untraced`, a marker: on a use case it removes `@traced`, on a route or a controller the request starts no
trace.

```nuclear
// config.nuc: plugins(telemetry = true)

usecase FindOrder(orders: OrderRepository)
  exec(id: int) Result<Error, Order>
    Metric.count("orders.read", region = "eu")
    ~orders.find(id)
```

```python
from __future__ import annotations

from synapsis import AppError, Result
from synapsis.telemetry import Metric, traced


# config.nuc: plugins(telemetry = true)

class FindOrder:
    def __init__(self, orders: OrderRepository) -> None:
        self.orders = orders

    @traced("app › usecase › FindOrder.exec")
    async def exec(self, id: int) -> Result[AppError, Order]:
        Metric.count("orders.read", region="eu")
        return await self.orders.find(id)
```

### Migrations

Migrations of the database schema (ADR-backend-0001, ADR-backend-0002): Alembic's operations in
`migrations/versions/`, made by `nuclear migrate make` against an empty SQLite where every migration ran, in batch
mode. The commands and the rules: `nuclear-synapsis-framework/platforms/backend/docs/07-reference/backend.md` §2.8.
What is this dialect's:

- A migration is `versions/<time>_<name>.py` with `upgrade()` and `downgrade()` over Alembic's `op`. The table
  `migrations` lists the ones applied.
- They run through `nuclear migrate` only: Alembic's own commands, revisions and `alembic_version` are not used.
- A `DateTime` column is `UtcDateTime()` (imported from `synapsis.orm`): `DATETIME(6)` on MySQL, MariaDB and
  SQLite, `TIMESTAMP WITH TIME ZONE` on PostgreSQL. A migration of before 0.94 wrote `sa.DateTime(timezone=True)`
  (whole seconds on MySQL and MariaDB): the next `make` writes the `alter_column` of each.
- A text column is `sa.String(length=n)`: the runtime makes it the database's `VARCHAR(n)`, or its text type when
  `n` is more than that `VARCHAR` holds (`MEDIUMTEXT` and `LONGTEXT` on MySQL and MariaDB, `TEXT` on PostgreSQL:
  `synapsis.orm.text_type`).
- A rename, as `nuclear migrate make "shops are stores" --rename shops=stores --rename orders.shop_id=store_id`
  writes it: Alembic's `op.rename_table` and the runtime's `rename_column` (imported from `synapsis.migrate`; one
  `ALTER TABLE ... RENAME COLUMN` on every database, where Alembic's own rename rebuilds the table on SQLite and
  needs the whole column again on MySQL):

```python
def upgrade() -> None:
    op.rename_table('shops', 'stores')
    rename_column('orders', 'shop_id', 'store_id')


def downgrade() -> None:
    rename_column('orders', 'store_id', 'shop_id')
    op.rename_table('stores', 'shops')
```

## 3. What is not there yet

- `nuclear make` generators for the backend kinds, `nuclear check` and `watch` (the CLI has `new`, `build`,
  `install`, `run`, `test` and `migrate`).
