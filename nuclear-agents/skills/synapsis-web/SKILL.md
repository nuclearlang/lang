---
name: synapsis-web
description: Build a Synapsis web app (react dialect) with the tools: screens, state managers, HTTP repositories, contracts and tests. Use when a task creates or changes a browser app written in Nuclear, or mounts one in a host page.
title: Synapsis web
title_es: Web con Synapsis
description_es: Construir una app web Synapsis (dialecto react) con las herramientas: pantallas, gestores de estado, repositorios HTTP, contratos y tests. Úsalo cuando una tarea crea o cambia una app de navegador escrita en Nuclear, o la monta en una página anfitriona.
kind: technology
tags: [web, react, browser, screen, statemanager, repository, frontend, synapsis]
---
# Synapsis web

## When to use

A task touches a project whose `config.nuc` says `synapsis(platform = "web", dialect = "react")`, or asks for a
browser app. The web platform is the mobile platform in a browser: the same words for the same things.

## Steps

1. **Read first.** `nuclear spec --brief --dialect react`, `nuclear help web`, `nuclear help onboarding-web`. A word:
   `nuclear help <word> --dialect react`.
2. **Create the project** (only for a new one): `nuclear new <name> -p web` (`--websocket` makes its connection a
   WebSocket instead of `Http`). It writes `config.nuc`, `main.nuc` (the router) and `config/project_config.nuc`.
3. **Inspect**: `nuclear gen inspect`.
4. **Generate a resource with its screen**: `nuclear gen resource todos Todo --source rest:<base url> --path todos
   --fields "id:int title:string completed:boolean" --screen todos`. It writes the model and its error, the HTTP
   repository, the use cases, the facade, the screen (`@screen(route = "/todos")`) with its state manager and state
   model, and a test with the repository mocked. A backend of ours: use its contract (skill `rest-contracts`).
5. **Make the other pieces**: `nuclear make <kind> <component> <Name> [--screen <screen>]` with a kind of
   `appcomponent, component, event, guard, model, repository, screen, service, stateful, stateless, statemanager,
   statemodel, tests, usecase, widget`. Examples: `nuclear make screen tasks Tasks`,
   `nuclear make statemanager tasks TasksManager --screen tasks` (it also writes `TasksState` when missing).
6. **Write what is left**: the view's elements (`div`, `ul`, `button`... with named attributes and `children`), the
   states a manager emits, a use case's rules. Navigate by screen: `goTo(Screen, id = 7)`, `goBack()`.
7. **Wire a use case**: `nuclear gen usecase <component> <Name> --calls <Repository>.<method>` (the alias; what the
   screen shows of it is written by hand).
8. **Check**: `nuclear check --json` prints `[]`.
9. **Build, install, test, run**: `nuclear build` (the app in `build/app`), `nuclear install` (npm install),
   `nuclear test` (vitest), `nuclear run` (Vite, `http://localhost:5173/<route>`).
10. **Mounted in another page** (an editor's webview, another site): every build also writes `mount(element,
    host)`; `npm run build:embed` in `build/app` gives `dist-embed/embed.js` (`nuclear help web` §1.1).

## The platform's tools

- Views: `stateless`, `stateful` (`setState(() => ...)`), `@screen(route, providers, loggedIn, acl, notFound)`.
- State: `statemodel`, `statemanager` with `@stateModel`, `@state`, `@before`, `@after`, `listen(stream, ...)`;
  the screen reads it with `<Model>Builder(full = ..., error = ..., loading = ..., orElse = ...)`.
- Data: `repository` with `@get`/`@post`/`@put`/`@patch`/`@delete` (`path`, `cache`, `ttl`, `retry`), `@path`,
  `@query`, `@body`; `@on("topic")` returning `Stream<T>` over a WebSocket (skill `websocket-connections`).
- Domain: `usecase` with `@requires` and `@acl`, `appcomponent`, `service`, `aggregate`.
- Session and access: `SessionManager(timeout)`, `Acl(inherits)`, `guard` with `canActivate`.
- Static files: `public/styles.css` (the stylesheet), `public/favicon.svg`. Packages: `nuclear add <package>`.
- Examples: `nuclear help example/todos_web`, `example/characters`, `example/tasks_live`.

## Pitfalls

- A new web project has no screen at `/`: open the generated route, or add one with
  `nuclear make screen <component> <Name>` and set its `@screen(route = "/")`.
- Not in this version: forms and `formmanager`, converters, translations, the local database, plugins and AI kinds.
  Do not write them in React by hand; record the need in the web platform's roadmap.
- An assignment inside a lambda must be a block (`() =>` and its lines), never one line.
- A manager method named `close`, `emit`, `subscribe`, `listen` or `state`: N0223.
- A repository used from a view, or a use case from another component: N0301/N0302.
- Mocks follow this platform's syntax (`when(Class.method).thenReturn(...)`), not the mobile one.
- Editing `build/app`: it is regenerated on every build.

## Checklist

- [ ] `nuclear check --json` prints `[]`.
- [ ] `nuclear test` is green: the generated test plus a `@states` or `@widget` test for each changed screen.
- [ ] Every screen, manager and repository came from `gen`/`make`; no `.ts`/`.tsx` written for a feature.
- [ ] No React or npm name in platform code unless the file is meant to use that package's definitions.
- [ ] `nuclear run` opens the changed route and it shows what the spec asks.
- [ ] The project's `AGENTS.md`, `docs/` and roadmap say what changed.
