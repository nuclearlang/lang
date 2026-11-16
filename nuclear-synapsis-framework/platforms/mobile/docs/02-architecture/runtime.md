---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [07-reference/synapsis.md, 02-architecture/local-database.md, 02-architecture/dependencies.md, 05-standards/security.md]
---
# The runtime packages

Two packages for Flutter, in Dart. This file says how each service behaves and where it lives; every class and
argument is in the API reference, [synapsis.md](../07-reference/synapsis.md). The code a project's kinds turn
into is the dialect's.

## `packages/synapsis`

What the UI toolkit lacks. Independent and publishable: README and CHANGELOG for pub.dev, `example/`. The entry
points are `lib/synapsis.dart` and `lib/testing.dart`; a service is one folder of `lib/src/`. A global service is
a `Global`: `register`, `init` at startup, `dispose`. 64 tests in `test/`.

| Service | `lib/src/` | Behaviour |
|---|---|---|
| Startup, injector | `core.dart` | `Synapsis.start(config)`, `addConfig(config, component:)`, one injector, `Synapsis.reset` stops the services and closes the local database |
| Http | `http/` | `Repository.send` / `attempt`; an in-memory cache with TTL and a cap (`MemoryCache(maxEntries = 256)`); retries with growing waits; interceptors `HttpLogInterceptor`, `SessionInterceptor`, `EventInterceptor`. `WebSocket` uses `dart:io`: it does not work on web |
| Local database | `local/local.dart` | [local-database.md](local-database.md) |
| State | `state/` | `StateManager<S>` never emits after it is closed |
| Events (ADR-synapsis-0005) | `events/` | below |
| Session (ADR-synapsis-0005) | `session/` | `session.start(data, token, roles, permissions, expiresAt)`, `get<T>()`, `set / value / remove`, `destroy()`; kept in the secure storage, it survives restarts. `start` publishes `SessionStarted<T>`; `destroy` publishes `SessionEnded` and purges the cache. `SessionInterceptor` adds the token, ends the session on a 401 and never sends an expired token |
| ACL (ADR-synapsis-0005) | `acl/` | Phalcon style (`Acl(inherits, permissions)`, deny by default) plus NestJS guards. The access map per screen is computed once per session. `canActivate` is `FutureOr<bool>`: the router (async `redirect` only then), `AclBuilder`, `Acl.check` and `Guards.verify` (async use cases) wait; `Acl.can`, `canOpen` and `Guards.check` stay sync and throw on an async guard |
| Routes | `router/router.dart` | go_router from views only; `AppRoute`, `goTo / pushTo / goBack`, typed path and query parameters, deep links, `shell` tabs, `notFound`, a `ScreenTransition` per screen; a route is nested by its path prefix, so back returns to the parent |
| Splash | `router/splash.dart` | `SplashScreen(next, child, minDuration = 3 s, onLoad, onError)`; then `goTo(next)`; `onError` with retry. `onLoad` has no timeout. The native splash is `@splash` |
| Network | `network/` | `NetworkManager` (connection and quality; it probes only when connectivity changes; on web it trusts the browser), `NetworkManager.fixed`, `NetworkWrapper`, `NetworkBuilder` |
| Logs | `log/log.dart` | below |
| Forms (ADR-synapsis-0005) | `forms/` | format validation in presentation, business validation in the domain (`@validate`). `Rules`, `FormManager` with `checkOf` and debounce, `SynapsisForm`, `FormTextField`, `FormCheckbox`, `FormInput<T>`, `FormSubmit`, `Validators`; bound by the field's name |
| Dialogs | `popups/` | `SynapsisDialog` header / body / footer (`.info / .success / .warning / .danger`, `size`, `autoClose`, `onClose`, `onCloseButton`, `onAccept`); `Popups.toast / snackbar / alert / confirm`, `PopupTheme` |
| Translations (ADR-synapsis-0005) | `i18n/` | `assets/i18n/<locale>/<component>.json` + `shared.json`; `"key".tr({...})`; `Translations(locales, fallback, remote)`; `RemoteDictionaries` by version (files, or localStorage on web). No third-party library |
| Device text layer | `device/probe_web.dart` | in debug the package exposes `__synapsisTextLayer` for the terminal device |
| Test helpers | `lib/testing.dart` | `SynapsisTest.start / respondWith / requests / replace / startSession`, `pumpScreen / pumpRouter / closeScreen`, `isOk / isErr`, `thenReturnAsync`; `start` keeps the local database in memory |

Decisions of this project behind the table: routes, dialogs and splash,
[ADR-mobile-0002](../03-adr/0002-screens-routes-dialogs-and-splash.md); async guards, events between engines and the
session's events, [ADR-mobile-0007](../03-adr/0007-accepted-rules-of-events-guards-forms-and-state.md).

### Events

`Events.publish / subscribe`. Delivery is **on demand**: the visible screen gets the event at once; a hidden one
gets the last of each type when it is shown again. A `component` with `@on` always receives. Widgets
`EventBuilder`, `EventListener`, `GlobalEvents<T>`; mixin `EventsOnDemand`.

A background isolate publishes to the main one (not on web: no `ReceivePort` nor `IsolateNameServer` under
`kIsWeb`). An `event` has `eventName` and `toJson` / `fromJson`, so from another engine (workmanager) it travels as
JSON text and `Events.decoder`, registered at startup, reads it back. The backend publishes an event with the
header `x-app-event` (`EventInterceptor`).

### Logs

`Log.d / i / s / w / e` (and the long names). One block per log: the breadcrumb `component › kind › Class.method`,
the time, the message, `data` as JSON, the error, the stack, and the `.nuc` file and line at the foot, which the
transpiler writes in the call (`at`). A thick frame and a level badge in the colors of Bootstrap's dark alerts;
code colors in the breadcrumb and the data; Synapsis's own logs in purple; only the error's line blinks. A pastel
color per component (`LogColor`, a stable hash; `logColor` in the component's `config`).

- Release: only warn and error. `token`, `password`, `authorization`, `secret` and `cookie` are masked.
- `Log.level`, `Log.colors`, `Log.console`, `Log.sink` (a `LogEntry`).
- Flutter exceptions: `Log.catchFlutterErrors(app:)`, called at startup: a double red frame, the stack in columns,
  a repeated error shown once.
- The package logs by itself http (request, response, error), the failures of a splash's `onLoad` and the
  translations.
- Not caught: async errors outside Flutter (there is no `PlatformDispatcher.onError`).

Why: [ADR-mobile-0005](../03-adr/0005-readable-logs-by-component.md).

## `packages/synapsis_genkit`

The runtime of the `genkit` plugin (ADR-synapsis-0004). `lib/synapsis_genkit.dart`, `lib/testing.dart`
(`startFakeGenkit`), and in `lib/src/`:

| File | Holds |
|---|---|
| `providers.dart` | the AI providers a config declares among its connections |
| `tools.dart` | the tools a model may call |
| `chat.dart` | a chat with memory and streaming, `ChatController` for a screen |
| `flows.dart` | `GenkitFlow`: typed flows with structured output |
| `remote.dart` | `RemoteFlows`: the flows of a Genkit server |
| `knowledge.dart` | `Knowledge`: embeddings and search, kept in memory |
| `schemas.dart` | `Schemas`: the schemas of the app's models, what a flow reads and answers and what a structured output is |
| `runtime.dart` | `SynapsisGenkit`: the Genkit instance of the app and the models and embedders of its providers, by connection name; `generateText` |

The kinds are `tools`, `chat`, `flow`, `remote` and `knowledge`; the dialect writes one project file
(`lib/synapsis_genkit.g.dart`) that starts it; the plugins of `config.nuc` are the dialect's `[project.plugins]`
([projects.md §3.3](../../../../../nuclearlang/docs/07-reference/projects.md)). Example:
`examples/examples-flutter-dialect/genkit-assistant`. How to use it: [the guide](../08-guides/genkit.md).
