---
status: approved
owner: Julian Molina
updated: 2026-11-18
related: [design.md, tasks.md, ../../../nuclear-synapsis-framework/platforms/backend/docs/04-specs/004-backend-parity/plan.md]
---
# Spec 012: observability — Requirements

## Goal

A Synapsis app sends its traces, metrics and logs to **Datadog, New Relic, Grafana** or any OpenTelemetry
collector by declaring one connection in `config/`, with no line of a vendor's library in the `.nuc` and the same
Nuclear for every dialect of its platform. Changing the vendor is changing that one line.

## Users

- The developer of an app: wants to see each request, use case and query in the vendor's console, and the errors
  with their place in the `.nuc`.
- The agent that writes the app: needs no vendor knowledge; the brief says one connection and two words.
- Operations: picks the vendor per environment from `env(...)`, without a rebuild of the Nuclear.

## Requirements

1. **One standard underneath: OpenTelemetry (OTLP over HTTP).** The three vendors accept it natively (New Relic,
   Grafana Cloud's gateway, Datadog's Agent and its OTLP intake). A vendor is a URL and headers: data, never a
   code path of its own.
2. **Declared like every connection.** `plugins(telemetry = true)` in `config.nuc` and one of `Datadog(...)`,
   `NewRelic(...)`, `Grafana(...)`, `Otlp(...)` in `connections`. Keys come from `env(...)`.
3. **Measured without code:** each HTTP request, each use case (named with `Log`'s breadcrumb,
   `component › usecase › Class.exec`), each query and outgoing HTTP call, each listener and agent node. An `Err`
   of a use case marks its span as an error with the error's name.
4. **Two explicit words**, Nuclear's own: `Metric.count(name, value, attributes...)` and
   `Metric.record(name, value, attributes...)`.
5. **`Log` goes to the vendor too**, with the trace and span of the moment, so a log opens its trace.
6. **Zero cost when off:** without the plugin, no package, no import, no wrapper in the generated app.
7. **Sampling and the service name** are arguments of the connection (`sample = 0.1`; the service defaults to
   `app(name)` of `config.nuc`).
8. **Clients never carry a secret.** In `mobile` and `web` the connections take the vendor's public client token;
   a license or API key there is a diagnostic.
9. **Every dialect of a platform implements it** (backend first: `fastapi` and `nestjs`), with the same test in
   both runtimes.
10. **`@untraced` leaves something out** at build time: a use case, a route or a controller (decided 2026-11-18).

## Out of scope

- A vendor's own agent or SDK in the generated code (`ddtrace`, `newrelic`): OTLP only.
- Dashboards and alerts as code: they belong to the vendor.
- Manual spans (`Trace.span(...)`) and `@traced(...)` until a real project asks for one: the automatic spans cover
  the layers, `@untraced` the exceptions.
- Profiling and real user monitoring of the vendors beyond what OTLP carries.
