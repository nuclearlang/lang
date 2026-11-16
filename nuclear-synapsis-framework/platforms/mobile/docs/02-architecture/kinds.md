---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [07-reference/mobile.md, 07-reference/brief/mobile.md, 02-architecture/local-database.md, 02-architecture/runtime.md]
---
# Kinds and decorators

What each kind is for. The list is the contract's (`platform.toml`); the index by area is
[mobile.md §2](../07-reference/mobile.md); each kind's full rules and its output are the
[flutter reference §5, §6 and §8](../../../../../nuclearlang/dialects/dart/docs/07-reference/flutter.md); a worked
example of every piece is the [brief](../07-reference/brief/mobile.md).

| Kind | Rule |
|---|---|
| `appConfig` / `config` | global / per-component configuration: `Http(connectionName, baseUrl, timeouts, interceptors)`, `WebSocket(uri, connectionName, interceptors)`, global services; `logColor`; `local: LocalDatabase` |
| `model` | only the definition; the transpiler writes the immutable class, the JSON mapping and equality. Generics `Page<T>` (ADR-synapsis-0005). `@key("json_name")`; `@Converter` on a field ([ADR-mobile-0003](../03-adr/0003-json-models-names-and-converters.md)). `@primary` (+ `@created`, `@updated`, `@entity("table")`) gives it a local table ([local-database.md](local-database.md)) |
| `converter` | `fromJson(json: J) T` + `toJson(value: T) J` (+ optional `sample() T` for the generated tests); in `shared/converters/`, visible everywhere |
| `repository` | `@repository(path, connection, saveLocal)`; methods `@get/@post/@put/@patch/@delete(path, headers = {...}, cache, cacheKey, ttl, retry, local)`. A cached method generates `purge<Method>()`; `purgeCache(key)` always exists. Undecorated parameters: to the path if `:name`, else the query (GET/DELETE) or the body (POST/PUT/PATCH); `@path`, `@query`, `@body` force it. Automatic retries only on GET, PUT and DELETE. `saveLocal` / `local` and the `<method>AsLocal()` twins: [local-database.md](local-database.md) |
| `usecase` | one method `exec`, always returns `Result`; guards `@requires(internet, session)` and `@acl(roles, permissions, guards)` |
| `appcomponent` | the facade: exposes the component's functions, usually aliases `getOne() = GetOneCharacterUseCase.exec` |
| `service`, `aggregate` | helpers of use cases |
| `statemodel` | each field is a state (a boolean is a state without data); `initial` always exists; generates a typed `<Model>Builder<Manager>` |
| `statemanager` | a screen's state: `@stateModel(M)`, `@state(M.field)` emits that state, `@before(f)` / `@after(f)`; a `@state` method that returns `Result` emits the error with the `Err` |
| `stateless` / `stateful` + `@screen` | `@screen(route, providers, loggedIn = { forward }, acl = { roles, permissions, guards, forward }, shell = { widget, tab }, notFound, transition = ScreenTransition.x)`; `@splash(color!, image)` is the native splash ([ADR-mobile-0002](../03-adr/0002-screens-routes-dialogs-and-splash.md)) |
| `event` | a typed global event (`shared/events/`), with JSON fields only and a name it travels by |
| `component` | a global component (`shared/components/`, ADR-synapsis-0003): anyone uses it; its `@on(Event)` methods always receive |
| `guard` | `canActivate()` with injected dependencies, like NestJS; sync or async (`~`) |
| `form` / `formmanager` | a form model with `@required @email @url @minLength @maxLength @min @max @pattern @matches` (each with `message`); `@form(F)`, `@validate("field")` is a remote validation with debounce (ADR-synapsis-0005) |
| `tests` / `integration` | `@mock([X])`, `@test`, `@states`, `@widget`, `@offline`; a method without a decorator is setUp / tearDown; `X.m()` is `inject<X>().m()`; `Result` does not propagate ([ADR-mobile-0004](../03-adr/0004-tests-in-nuclear.md)) |
| `tools`, `chat`, `flow`, `remote`, `knowledge` | the AI kinds of the `genkit` plugin, with `@remote`, `@flow`, `@stream` (ADR-synapsis-0004; [guide](../08-guides/genkit.md)) |

## Rules that cross kinds

- `Result<E, T>` is error first (ADR-lang-0006); `.ok()` / `.error()` by what the callback returns (ADR-lang-0006).
- Navigation is `context.goTo / pushTo / goBack(Screen(...))`, only in views.
- A decorator removed from the platform is `N0309` with its replacement: `@generated` is `@primary(generated = true)`.
- Every kind and decorator has its entry in the dialect's `docs.toml` (ADR-lang-0010): the editor shows it, and the
  editor lists only the kinds of the project's platform.

## Where to see each one written

In `examples/examples-flutter-dialect/clean-flutter-project/`: `shared/models/page.nuc` (`Page<T>`, `PageInfo`),
`components/episodes/domain/models/episode.nuc` with `shared/converters/date_converter.nuc` (a converter on a
field), `shared/screens/start_screen.nuc` (the `@splash`, route `/start`, the initial route),
`shared/guards/premium_guard.nuc`, `shared/events/`, `shared/components/force_logout_component.nuc`,
`components/session/presentation/login/` (a form, its form manager, a state manager), `test/` and
`integration_test/`. The AI kinds: `examples/examples-flutter-dialect/genkit-assistant/components/assistant/`.
