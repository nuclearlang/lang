---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../07-reference/web.md, ../../examples/onboarding/todos_web]
---
# Your first web app: a todos list in four commands

A web app that lists todos from an API, written in Nuclear and built as a React app. Every file comes from the
tools: nothing in it was written by hand. The result is the example
[`examples/onboarding/todos_web`](../../examples/onboarding/todos_web), and the documentation site runs these same
commands again each time it is built, so they always work.

You need `nuclear` installed (`curl -fsSL https://nuclearlang.github.io/install.sh | sh`) and, to run the app,
Node.js 20 or later.

## 1. Create the project

```sh
nuclear new todos_web -p web
cd todos_web
```

`config.nuc` (the platform, the dialect, the app), `main.nuc` (the router with every screen) and
`config/project_config.nuc` (the app's HTTP connection).

## 2. Generate the resource and its screen

```sh
nuclear gen resource todos Todo --source rest:https://jsonplaceholder.typicode.com --path todos \
  --fields "id:int title:string completed:boolean" --screen todos
```

`--source rest:<url>` adds a connection to that API to `config/project_config.nuc` and makes the repository an
HTTP one; `--path todos` is the API's path (without it the path is the resource's name in the singular). It writes,
in the component `todos`:

| File | What it is |
|---|---|
| `domain/models/todo.nuc`, `todo_error.nuc` | the model and its error |
| `data/todo_repository.nuc` | `GET todos` and `GET todos/:id` over the connection |
| `domain/usecases/list_todos.nuc`, `get_todo.nuc` | the use cases |
| `todos_component.nuc` | the component's facade |
| `presentation/todos/` | the screen (`@screen(route = "/todos")`), its state manager and its state model |
| `test/todos_test.nuc` | a test with the repository mocked |

## 3. Check it

```sh
nuclear check --json
```

`[]`: no error.

## 4. Build, install, test and run

```sh
nuclear build        # the React app in build/app
nuclear install      # npm install
nuclear test         # 1 passed
nuclear run          # Vite: open http://localhost:5173/todos
```

The screen shows the todos of the API. A new web project has no screen at `/` yet: open `/todos`
([roadmap](../01-product/roadmap.md)).

## Next

- A library of npm in Nuclear: `nuclear add <package>` installs it, writes it in `config.nuc` and generates its type
  definitions (this documentation site animates with `motion` that way).
- Every kind of the platform: [the web reference](../07-reference/web.md). The same words on a phone: the mobile
  onboarding.
