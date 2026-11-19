---
name: rest-contracts
description: Design REST routes in a Synapsis backend (paths, status codes, errors, validation) and generate the apps' clients from its contract with nuclear contracts list and update. Use when a task adds or changes an API route, or a mobile or web app must call a backend written in Nuclear.
title: REST APIs and contracts
title_es: APIs REST y contratos
description_es: Diseñar rutas REST en un backend Synapsis (rutas, códigos de estado, errores, validación) y generar los clientes de las apps desde su contrato con nuclear contracts list y update. Úsalo cuando una tarea añade o cambia una ruta de la API, o una app móvil o web debe llamar a un backend escrito en Nuclear.
kind: technology
tags: [rest, api, contracts, routes, status codes, openapi, client, http]
---
# REST APIs and contracts

## When to use

A route is added or changed in a backend, or an app (mobile, web) calls a backend of ours. The backend describes
its API once; the apps get their models and repositories generated from it, and a breaking change fails the app's
build, not the phone (ADR-synapsis-0006). Read `nuclear help contracts` and `nuclear help backend` §2.3, §2.7.

## Steps

1. **Routes come from the tools.** `nuclear gen resource <component> <Name>` writes the controller with a route per
   action (`GET /names`, `GET /names/{id}`, `POST`, `PUT`, `DELETE`). Another route:
   `nuclear gen usecase <component> <Name> --route "POST orders/{id}/cancel"` (the controller of the first segment
   gets it, created when missing).
2. **Paths are segments**: `@controller("tasks")` is the prefix; `@get()` the prefix itself, `@get("{id}")` binds
   `{id}`, `@post("plan")` adds a segment; no leading slash. A fixed segment wins over a parameter.
3. **Where parameters go**: a model parameter is the JSON body, a name in the path is a path parameter, any other
   is a query parameter (optional when `T?` or defaulted).
4. **Status codes**: `@post` answers 201, the others 200; `@status(201)` changes the success status. A `Result`
   answer becomes the value, or its error's status: `NotFound` 404, `Invalid` 400, `Unauthorized` 401, `Forbidden`
   403, `Conflict` 409. Return the error from the use case (`Err(Conflict("..."))`), never a 200 with an error
   inside.
5. **Validation lives on the model**: `@required`, `@minLength(n)`, `@maxLength(n)`, `@min(n)`, `@max(n)`,
   `@pattern(r"...")`, `@email`, `@url`. An invalid body is refused with the reasons before the use case runs.
6. **Build the backend**: `nuclear build` writes `.nuclear/contract.json` and `.nuclear/openapi.json`; the running
   app serves both at `/.nuclear/contract.json` and `/.nuclear/openapi.json`.
7. **Declare the backend in the app**: `contracts(tasks_api = "../tasks_api")` in its `config.nuc` (a path in the
   same repository) or `contracts(tasks_api = "https://api.example.com")`, and a connection with that name:
   `Http(connectionName = "tasks_api", baseUrl = "http://localhost:3000/")`.
8. **Generate the client**: a path is regenerated at every build; a URL with `nuclear contracts update [<name>]`.
   `nuclear contracts list` shows each contract, its source and the version of the copy. The models (with their
   validation rules and key) and one repository per controller land in `contracts/<name>/`.
9. **Write only the app's logic**: use cases over the generated repository (`~tasks.all(done = false)`), then
   screens. `nuclear check --json` in both projects, `nuclear test`.

## The platform's tools

- `nuclear contracts list`, `nuclear contracts update [<name>...]`.
- `appClient()` in backend tests: `~app.get(path, headers = ...)`, `post`, `put`, `patch`, `delete`, answering
  `status` and `body`: assert the real status of each route.
- Guards for a private API: `Token(value = env("TOKEN"))`, `NoOrigin()` (skill `security-review-owasp`).
- The editor's HTTP Connections view lists every endpoint from the contracts and sends requests with a sample body.
- Examples: `nuclear help example/tasks_api` (backend) and `nuclear help example/tasks_app` (its app).

## Pitfalls

- Editing `contracts/<name>/*.nuc`: they are generated and overwritten. Change the backend and rebuild.
- Forgetting to commit `contracts/<name>/contract.json` of a URL contract: the app's build would need the network
  and the diff would not show the API change.
- A route reached by a parameter by mistake: `{id}` never takes `page`, but two parameter routes at the same depth
  are ambiguous; give one a fixed segment.
- A token in the query string: guards read only headers, so it would fail and leak into logs.
- The web client gets no `@primary` and no rules from the contract until the web platform has forms and a local
  database.
- The OpenAPI document does not list the guards' headers yet (the contract does).
- No CORS setting: a browser on another origin cannot call the API (roadmap).

## Checklist

- [ ] Every route came from `gen resource` or `gen usecase --route`, or is a controller method calling the facade.
- [ ] Each route returns a `Result`, and each error is one of the platform's with the right status.
- [ ] Every body is a model with validation decorators; a test sends an invalid body and gets a 4xx.
- [ ] `appClient()` tests assert the status of the success and of each error path.
- [ ] The app declares the contract, its connection has the same name, and `nuclear contracts list` shows it current.
- [ ] No hand-written repository duplicates a generated one in the app.
- [ ] `nuclear check --json` prints `[]` in the backend and in every app.
