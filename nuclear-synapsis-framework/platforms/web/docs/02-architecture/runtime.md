---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, dependencies.md, ../06-runbooks/change-the-runtime.md]
---
# The runtime: `synapsis-web`

`packages/synapsis-web` (npm `synapsis-web`, ES modules): what the code of the `react` dialect imports. Sources in
`src/`, tests in `test/`, built to `dist/` (`npm run build` = `tsc -p tsconfig.json`).

## Entry points and modules

| Import | Module | Holds |
|---|---|---|
| `synapsis-web` | `result` | `Result`, `Ok`, `Err`: the same runtime the `typescript` dialect writes in a file and `synapsis-nest` exports |
| | `errors` | `AppError` (Nuclear's `Error(message)`), `HttpError` (a failed request), `NotFound` |
| | `inject` | the injector: `register`, `replace`, `inject`, `isRegistered`, `resetInjector`. Singletons are built once; factories (use cases, managers) on every `inject` |
| | `config` | `AppConfig`, `ComponentConfig`, `Connection`, `Global`, `Transport` (what a repository's calls travel over), the `Http` connection and `HttpInterceptor` |
| | `sockets` | the platform's frames (`Frames`), the `WebSocket` connection, the host's `Bridge` and `BridgeTransport`, `Stream` (ADR-synapsis-0008) |
| | `embed` | `mountApp`, `Host`: the embedded mode (ADR-synapsis-0009) |
| | `app` | `Synapsis`: the entry point (the connections, the global services, the injector; `transport`, `embed`) |
| | `http` | `Repository`, `Decode`, `Cache`, `MemoryCache`, `HttpMethod` |
| | `exact` | the exact numbers in JSON (ADR-lang-0015): `exactText` (the checked text of a `bigint` / `bigdouble` of an answer, else a `TypeError`), `wire` (the replacer of a request body: a model as its `toJson()`, a `bigint` as its text), `MAX_DIGITS` |
| | `state` | `StateManager` |
| | `react` | `View`, `StatelessView`, `StatefulView`, `statelessOf`, `statefulOf`, `Providers`, the hooks `useManager`, `useStateOf`, `useManagerState`, the type `Element` |
| | `html` | the HTML functions (`div`, `ul`, `button`, `input`...), `el`, `fragment` |
| | `events` | `AppEvent`, `Events` (publish / subscribe), `useEvent` |
| | `session` | `SessionManager`, `SessionStarted`, `SessionEnded`, `Acl`, `Guard`, `Guards`, `NetworkManager` |
| | `router` | `buildRouter`, `goTo`, `pushTo`, `goBack`, `pathTo`, `RouterProvider` |
| | `log` | `Log` |
| `synapsis-web/testing` | `testing` | `SynapsisTest`, `when`, `verify`, `renderScreen`, `statesOf`, `okOf`, `errOf` |

The base entry also re-exports what a view needs from React (`createElement`, `Fragment`, `useState`, `useEffect`,
`useMemo`, `useRef`, `useCallback`).

## How the pieces work

- **Views.** A view is a class (`StatelessView` / `StatefulView`) shown through `createElement` (`statelessOf` /
  `statefulOf`), so hooks work inside `build`. A `stateless` is built on every render; a `stateful` keeps its
  instance, and so its fields, between renders and re-renders on `setState` (`initState`, `dispose`), the way the
  mobile platform's stateful view does.
- **HTML without JSX.** `div({ className: 'row', children: [...] })`; a string, a number, an element or a list
  given in place of the props is the children.
- **State.** A `StateManager` holds one state model and emits a new one; React reads it with
  `useSyncExternalStore`. The same shape as the mobile platform's state manager. The dialect generates a
  `<Model>Builder` component for each state model. `listen(stream, on)` follows a `Stream` until `close()`.
- **Providers.** `@screen(providers)` wraps the screen in `Providers`; `Manager.method()` inside its views is
  `this.manager(Manager).method()`, which reads the provided manager without a hook, so it works in a callback.
  `useManager` and `useStateOf` are hooks: only in `build`.
- **Repositories.** Each method is an http call through `send`, with the mobile platform's rules: the path is
  appended to the connection's base, `:name` takes a parameter, the other parameters go to the query (GET, DELETE)
  or the JSON body; a cache by key with a ttl; retries on transient failures. The adapter is the `Transport` the
  repository is bound to (`Synapsis.transport(name)`): `Http` (fetch), `WebSocket` (a request frame and its answer)
  or, mounted with a bridge, the host's `BridgeTransport` for every repository; the connection's interceptors run
  around it either way. `stream(topic, decode)` gives a `Stream` of what the transport receives on a topic. A body is
  `JSON.stringify(body, wire)`: a model travels as its `toJson()` (its `@key` names, its exact fields as texts).
- **Mounted in a host.** `mountApp` calls `Synapsis.embed(host)` (the in-memory router at `host.path`, the bridge),
  starts the app once, renders it in a shadow root of the element with the stylesheet as a `<style>`.
- **Router.** One route per `@screen(route = "/path/:id")`, built by the transpiler; navigation is by screen
  (`goTo(CharacterDetailScreen, { id })`) from anywhere in a view.
- **Session and access.** `SessionManager` keeps who is signed in; `Acl` the roles, permissions and guards;
  `Guards` runs the checks a use case asks for (`@requires(session = true)`, `@acl(roles = [...])`).
  `Guards.verify` is asynchronous.
- **Logs.** `Log` writes with the place it is called from; the transpiler passes it (component › kind ›
  Class.method · file:line).
- **Tests.** `SynapsisTest` starts the app with its real config and replaces `fetch` by canned answers; any
  registered class can be a mock (`when`, `verify`); `renderScreen` renders a screen with Testing Library;
  `statesOf` collects the states a manager emits.

## How it is installed

An app gets the runtime as a copy, never as a link: from a link, TypeScript and Vite resolve the runtime's imports
(`react`) next to the runtime's own folder, not the app's; the types become `any` and the bundle fails. After a
reinstall Vite's dependency cache is removed: it would keep serving the runtime it bundled before (same version,
new code). The dialect's `[toolchain] install` does both.

## Tests and type definitions

- `test/runtime.test.ts`: 7 vitest tests (repository, cache, mocks, states, views, events), in jsdom
  (`vitest.config.ts`); `test/exact.test.ts`: the exact numbers' texts, a body as the model's JSON, a JSON number
  refused. The check runs them ([testing](../05-standards/testing.md)).
- The compiler and the editors know the runtime's names from its type definitions,
  `nuclearlang/dialects/typescript/defs/synapsis-web/<version>/` (modules `synapsis-web`,
  `synapsis-web/testing`): regenerated after a change of the public API
  ([runbook](../06-runbooks/change-the-runtime.md)).
