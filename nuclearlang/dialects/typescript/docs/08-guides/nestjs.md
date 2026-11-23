# Synapsis for NestJS: a TypeScript backend with Sequelize

The `nestjs` dialect turns Nuclear into a **NestJS 12** backend (ES modules): **Sequelize** repositories
(`@nestjs/sequelize` + `sequelize-typescript`), DTOs validated with **class-validator**, Kafka events, Redis cache, and
**LangChain.js / LangGraph.js** tools, agents and graphs. The Nest modules are written for you. The generated code
passes `tsc --strict`. It uses the same kinds and query API as [Synapsis for Python](../../../python/docs/08-guides/fastapi.md), so a project moves
between the two almost line by line.

This guide follows the example `examples/examples-backend/tasks_api`: a tasks CRUD, an event listener and an assistant
that reads and changes tasks. The full rules are in [nestjs.md](../07-reference/nestjs.md).

## 1. The project

```
tasks_api/
├── config.nuc                      synapsis(platform = "backend", dialect = "nestjs"), app(...), plugins(...)
├── config/project_config.nuc       the connections
├── components/tasks/               data/, domain/, api/, events/, tasks_appcomponent.nuc
├── components/assistant/           ai/ (tools, agent, graph), api/
└── test/                           tests in Nuclear (node:test)
```

```nuclear
appConfig ProjectConfig
  connections: Connection[] = [
    SQLite(file = env("DATABASE", "tasks.sqlite"), createTables = true),
    Ollama(model = env("CHAT_MODEL", "qwen3.5:4b"), baseUrl = env("OLLAMA_URL", "http://localhost:11434")),
  ]
```

Each component becomes a Nest module; the database goes to `SequelizeModule`, the other connections open at start
and close at stop.

## 2. Entity, repository, models

```nuclear
@entity("tasks")
Task()
  @primary(generated = true)
  id: int
  @column(length = 200)
  title: string
  done: boolean = false
  priority: int = 2
  @created()
  createdAt?: DateTime
```

```nuclear
repository TaskRepository
  byState(done: boolean) Task[]
    where({ "done": done })
    orderBy("priority")
    getMany()

  search(text: string) Task[]
    where({ "title": icontains(text) })
    getMany()
```

A search box's text goes to `icontains(text)` (or `contains`, in the database's case): its `%` and `_` are
characters. `like` and `ilike` take a pattern written by the program (`like("Buy%")`). `@created()` is written by the
app with its milliseconds.

The models of `domain/models/` are DTOs; their decorators become class-validator rules (an optional field left
empty answers `null`):

```nuclear
NewTask
  @minLength(1)
  @maxLength(200)
  title: string
  @min(1)
  @max(3)
  priority: int = 2
```

### Relations, pages and transactions

Relations are TypeORM's decorators; the related entity is the field's type. A relation field is optional: it is only
there when a query loads it, so no query is hidden.

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
```

`projectId` is the column of `project`: `Task(title = "paint", projectId = id)` puts a task in a project without
loading it. `@manyToMany(inverse = "tasks")` with `@joinTable()` on one side makes the join table (`tasks_tags`);
`@oneToOne` with `@joinColumn()` is the one-to-one. The compiler checks every rule (N0308).

```nuclear
repository ProjectRepository
  withTasks(id: int) Result<Error, Project>
    where({ "id": id })
    relations("tasks")
    getOne()

repository TaskRepository
  page(page: int, size: int = 20) Page<Task>
    orderBy("id")
    paginate(page, size)
```

`paginate` answers `Page<Task>`: `items`, `page` (from 1), `size`, `total`, `pages`. A use case whose writes must
happen together is `@transactional`: an `Err` (or an error) undoes them all.

```nuclear
usecase CloseProject(tasks: TaskRepository, projects: ProjectRepository)
  @transactional
  exec(id: int, into: int) Result<Error, Moved>
    ~projects.find(into)
    moved = ~tasks.move(id, into)
    ~projects.remove(id)
    Ok(Moved(count = moved))
```

The same Nuclear builds with the other backend dialect, and `paginate` works the same on the mobile local tables.

### Migrations

`createTables = true` makes the tables at start, for development: the same tables the migrations make. Once the
database keeps data, leave it out, bring the database under migrations (`nuclear migrate make "first"`, then
`nuclear migrate --fake`) and change the schema with migrations in the project's `migrations/` folder:

```sh
nuclear migrate make "notes on tasks"   # what the entities changed since the last migration
nuclear migrate                         # applies the pending ones
nuclear migrate down                    # reverts the last one
nuclear migrate status                  # every migration: applied or pending
```

They are Sequelize migrations (`migrations/<time>_<name>.js` over `queryInterface`; the table `migrations` of the database lists the ones applied);
each one also keeps the schema it leaves, which the next `make` compares with. A renamed table or column is told to `make`, or it is a drop and an add and its data is lost (`make` warns): `nuclear migrate make "shops are stores" --rename shops=stores --rename orders.shop_id=store_id` (the database's names) writes `queryInterface.renameTable` and `renameColumn`, with their way back. By hand a rename is the same two calls (`queryInterface.renameColumn`, `renameTable`). `--to <migration>` after `migrate` or `migrate down` stops at that one; `--fake` changes the history without running (a database that already has its tables); `--transaction all|each|none` (default `all`).

## 3. Use cases and events

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

`~publish` sends the event in the same process (plugin `events`) or to Kafka (plugin `kafka` and a `Kafka(...)`
connection). A `listener` receives it:

```nuclear
listener TaskEvents
  created: string[] = []

  @consumer("tasks.created")
  onCreated(event: <string, any>) void
    created.add(event["title"])
```

## 4. The controller

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
```

```typescript
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksAppComponent) {}

  @Get()
  async all(@Query('done', BoolPipe) done?: boolean): Promise<Result<AppError, Task[]>> {
    return await this.tasks.list(done);
  }

  @Get(':id')
  async one(@Param('id', RequiredPipe, IntPipe) id: number): Promise<Result<AppError, Task>> {
    return await this.tasks.task(id);
  }
  // ...
}
```

Path parameters, query parameters and the body are found from the route and the types; the pipes come out by
themselves. `Err(NotFound(...))` answers 404, `Conflict` 409, an invalid body 400. What the database itself refuses (a repeated unique value, a foreign key that points at nothing, a null in a required column, a text longer than its `@column(length = n)`) answers 409 `conflict` too, whatever the database. Every error answers Nuclear's body
(`status`, `message`, and the reasons of an invalid body in `errors`), written by the runtime's `ErrorFilter`
whatever Nest would write; a parameter of the route or the query is read by the runtime's `IntPipe`, `DoublePipe`,
`BoolPipe` and `TextPipe` (`RequiredPipe` when it has no default), by the platform's rules (exactly its type, given
once), and the route refuses every refused one together, before the body (ADR-synapsis-0013). The body is read by
the runtime's own JSON reader (Nest's parsers are off: JSON only, `maxBodySize`); `main.ts` listens on `HOST`
(default `127.0.0.1`) and `PORT`.

## 5. The assistant (plugin `ai`)

```nuclear
tools TaskTools(tasks: TasksAppComponent)
  // Creates a task with a title and a priority (1 high, 2 normal, 3 low).
  addTask(title: string, priority: int = 2) string
    match ~tasks.create(NewTask(title = title, priority = priority))
      Ok(task) -> "created task ${task.id}: ${task.title}"
      Err(e) -> e.message

agent AssistantAgent(tools: TaskTools)
  prompt: string = "You are a task assistant. Use the tools to read, add and complete tasks; never invent ids."
```

A `graph` with `@state(PlanState)`, `@start` and `@next("node")` is a LangGraph.js `StateGraph`; `~chatModel()` is
the model of the config. See `components/assistant/ai/planner.nuc` in the example.

## 6. Build, run and test

```sh
nuclear build                    # nuclear build .: writes build/ (src/, test/, package.json, tsconfig.json); compiles once installed
nuclear install                  # npm install with the runtime (copied: build/.npmrc has install-links=true)
nuclear run                      # npm run dev: http://localhost:3000 (PORT); restarts on every build (node --watch)
nuclear test                     # npm test: the tests written in Nuclear
```

The same by hand, from `build/`: `npm install ~/.local/share/nuclearlang/packages/synapsis-nest && npm install`,
`npm run dev`, `npm test`. While `nuclear run` serves, `nuclear build` (or saving a `.nuc` in VS Code) restarts the
server with the new code. ◉ Debug in VS Code (or F5 with `build/tasks_api.code-workspace`) runs the server under
the node debugger with its source maps: a breakpoint in a `.nuc` stops there.

```sh
curl -X POST localhost:3000/tasks -H 'content-type: application/json' -d '{"title": "buy milk"}'
curl localhost:3000/tasks?done=false
```

`install-links=true` copies the runtime into `node_modules` (a link would make Node and TypeScript look for its
NestJS packages next to the runtime, not in the app). The generated `package.json` approves the install script of `sqlite3`, the driver of
the tests (npm 12 runs only approved scripts).
