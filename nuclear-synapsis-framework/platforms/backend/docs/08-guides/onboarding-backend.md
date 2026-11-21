---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../07-reference/backend.md, contracts.md, ../../examples/onboarding/todos_api]
---
# Your first backend: a todos API in four commands

A REST API with a database, written in Nuclear and built for Python (FastAPI) or TypeScript (NestJS). Every file
comes from the tools: nothing in it was written by hand. The result is the example
[`examples/onboarding/todos_api`](../../examples/onboarding/todos_api), and the documentation site runs these same
commands again each time it is built, so they always work.

You need `nuclear` installed (`curl -fsSL https://nuclearlang.github.io/install.sh | sh`) and, to run the app,
Python 3.12 or later.

## 1. Create the project

```sh
nuclear new todos_api -p backend
cd todos_api
```

The project is only `.nuc` files: `config.nuc` (the platform, the dialect, the app and its plugins),
`config/project_config.nuc` (the database connection, SQLite by default) and `test/app_test.nuc`. `-d nestjs` picks
TypeScript instead of the default `fastapi`.

## 2. Generate the resource

```sh
nuclear gen resource todos Todo --fields "id:int title:string completed:boolean"
```

One command writes the whole resource of the component `todos`:

| File | What it is |
|---|---|
| `data/entities/todo.nuc` | the entity: the table `todos` (`@primary(generated = true) id`) |
| `domain/models/new_todo.nuc` | what a client sends to create or change one |
| `data/repositories/todo_repository.nuc` | the queries |
| `domain/usecases/{list,get,create,update,delete}_todo(s).nuc` | one use case per action, each returning `Result` |
| `todos_appcomponent.nuc` | the component's facade, with an alias per use case |
| `api/todos_controller.nuc` | the routes: `GET /todos`, `GET /todos/{id}`, `POST`, `PUT`, `DELETE` |
| `test/todos_test.nuc` | the tests, over an in-memory database |

The fields can also come from an example answer of an API (`--from-json <url|file>`) or a spec (`--from-spec
<spec.md>`); [the code generator's guide](../../../../../tools/code_generator/docs/08-guides/README.md) has every option.

## 3. Check it

```sh
nuclear check --json
```

`[]`: no error. An error comes with its code, its position and, most of the time, the exact fix; `nuclear fix`
applies them.

## 4. Build, install, test and run

```sh
nuclear build        # the Python app in build/
nuclear install      # its virtual environment
nuclear test         # 3 passed
nuclear run          # http://localhost:8000, its OpenAPI docs at /docs
```

```sh
curl -X POST localhost:8000/todos -H 'content-type: application/json' -d '{"title":"Write the logic only","completed":false}'
# {"id":1,"title":"Write the logic only","completed":false}
```

## The same code in TypeScript

Change one word of `config.nuc`, `dialect = "fastapi"` to `dialect = "nestjs"`, and build again: the same `.nuc`
files become a NestJS app. The Nuclear of a platform never changes with its dialect.

## Next

- A client of this API, generated from its contract: [contracts](contracts.md); the web and mobile onboardings
  build apps that list todos.
- Every kind of the platform (relations, pagination, transactions, events, Kafka, Redis, AI agents):
  [the backend reference](../07-reference/backend.md).
- A web app on another origin calls this API once its origin is in `origins: string[]` of the `appConfig`
  ([the backend reference](../07-reference/backend.md)).
