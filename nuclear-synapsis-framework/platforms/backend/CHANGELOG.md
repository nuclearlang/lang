# Changelog

All notable changes to synapsis-backend are written here; versions follow [Semantic Versioning](https://semver.org).

## Unreleased

- The example `tasks_api`: the planner reports each step that could not become a task (`PlanReply.failed`, the
  reason with it) instead of leaving it out; an appcomponent's alias propagates its `Result` like the use case it
  names.
- One JSON per model in every dialect (ADR-synapsis-0012): a `fastapi` model extends `synapsis.Model` and its JSON
  has Nuclear's names (`lastRead`, not `last_read`), as `nestjs` and the contract; an entity's answer too.
- A client generated from the contract sends a route's model parameter as the body itself (`@body input: NewTask`),
  and keeps a list's and a map's default (`members: string[] = []`).
- Tests that call the app (ADR-synapsis-0010), fastapi and nestjs: `appClient()` sends requests over HTTP
  (`get`/`post`/`put`/`patch`/`delete`/`request`: `HttpAnswer` with `status`, `body`) and opens the app's WebSocket
  (`socket(path, headers)`: `Err` with 401/403 when refused; `request`, `subscribe`, `next(seconds)`, `close`);
  `testEnv(NAME = "value")` in `config.nuc` is the tests' environment (a test token). fastapi's `app/main.py` gains
  `create()`; nestjs gets `src/test_env.ts` and `npm test` imports it first.
- Guards (ADR-synapsis-0007), fastapi and nestjs: `guards: Guard[] = [NoOrigin(), Token(value = env("T"), header =
  "X-Token")]` in the `appConfig` checks every route, the contract's routes and the WebSocket's upgrade;
  `@controller("x", guards = [...])` adds a controller's own. Headers only (never a token in the query); an empty
  token refuses everything; a guarded app serves no documentation pages.
- The app's WebSocket (ADR-synapsis-0008), fastapi and nestjs: `plugins(websocket = true)` and
  `WebSocketServer(path = "ws")` in `connections` serve the same controllers over one socket (JSON frames: requests
  and their answers, `subscribe`/`unsubscribe`), and `~publish(topic, value)` pushes to the subscribed clients.
- The contract (`.nuclear/contract.json`) says `webSocket`, each controller's `transports` and `guards`, the app's
  `guards` and the `events` it publishes (topic, component, payload).
- Telemetry (spec 012), fastapi: `plugins(telemetry = true)` and one of `Datadog(...)`, `NewRelic(...)`, `Grafana(...)`,
  `Otlp(url)` in `connections` send traces and metrics over OTLP; every request and use case is a span by itself,
  `Metric.count` / `Metric.record` write metrics, `@untraced` leaves out a use case, a route or a controller,
  `sample` keeps a share of the traces. nestjs accepts `@untraced` and does not bring the plugin yet.
- `[toolchain] package_*` in fastapi (pip) and nestjs (npm, with the `@types` package of one that ships no types):
  `nuclear add|remove <package>` (ADR-lang-0008). `[project.manifest.advice]`: `flask`, `django`, `express`, `fastify`,
  `koa` are added with a word on what the platform already gives.
- First public version.
- HTTP repositories (`Http` connection, bodiless `@get`/`@post`...) in fastapi and nestjs; `@key` for a JSON key that differs from the field; `[[generators]]` for `nuclear gen` (ADR-codegen-0001).
- `[[generators.usecase]]`: `nuclear gen usecase` writes a use case over a repository method, its alias in the facade and its route (ADR-codegen-0001).
- The order of a controller's routes no longer matters, in both dialects: a fixed segment wins over a parameter. Before, fastapi added the routes by method name (`GET <prefix>/search` of a generated resource answered 400, taken by `{id}`) and nestjs in the order written (`synapsis-py` `router_of`, `synapsis-nest` `configureApp`; `spec/backend.md` §2.7).
- `[[generators.resource]]`: the repository and the controller are merged (`merge = true`), so an action added to a resource that exists gets the members it lacks (ADR-developer-0001).
- nestjs: `npm test` (what `nuclear test` runs) removes `dist/test` before compiling: `tsc` never deletes the output of a source that is gone, so a test that was deleted or renamed kept running from its old `.js` and failed the project.
