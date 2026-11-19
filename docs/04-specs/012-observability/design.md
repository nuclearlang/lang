---
status: in-progress
owner: Julian Molina
updated: 2026-11-18
related: [requirements.md, tasks.md]
---
# Spec 012: observability — Design

## 1. What the user writes

```nuclear
// config.nuc
synapsis(platform = "backend", dialect = "fastapi")
app(name = "rick_api", description = "Characters of the show.", version = "0.1.0")
plugins(sqlite = true, telemetry = true)
```

```nuclear
// config/project_config.nuc
appConfig ProjectConfig
  connections: Connection[] = [
    SQLite(file = env("DATABASE", "rick.sqlite")),
    Datadog(apiKey = env("DD_API_KEY")),
    // NewRelic(licenseKey = env("NEW_RELIC_LICENSE_KEY"), region = "eu"),
    // Grafana(url = env("GRAFANA_OTLP_URL"), instanceId = env("GRAFANA_INSTANCE_ID"), token = env("GRAFANA_TOKEN")),
    // Otlp(url = "http://localhost:4318"),
  ]
```

```nuclear
// a use case: nothing to add for its span; a business metric is one line
usecase CreateOrder(orders: OrderRepository)
  exec(input: NewOrder) Result<Error, Order>
    saved = ~orders.save(Order(region = input.region, total = input.total))
    Metric.count("orders.created", region = input.region)
    Metric.record("orders.total", input.total)
    Ok(saved)
```

Changing the dialect to `nestjs` changes none of these lines.

## 2. The destinations are data

| Connection | URL | Headers | Notes |
|---|---|---|---|
| `Otlp(url, headers)` | any | any | a collector: Grafana Alloy, OTel Collector, Jaeger, Tempo |
| `Datadog(apiKey, url)` | `http://localhost:4318` (the Agent's OTLP receiver) | `dd-api-key` when `apiKey` | without an Agent, `url` is the OTLP intake of the account's site; metrics in delta temporality |
| `NewRelic(licenseKey, region)` | `https://otlp.nr-data.net:4318`, `eu`: `otlp.eu01.nr-data.net` | `api-key: <license key>` | the ingest license key, not a user key |
| `Grafana(url, instanceId, token)` | `http://localhost:4318` (Alloy) or `https://otlp-gateway-<zone>.grafana.net/otlp` | `Authorization: Basic base64(instanceId:token)` | the token needs write on each signal |

Each runtime has one exporter; the four classes only fill URL and headers. A new vendor that speaks OTLP is one
more class of ten lines in each runtime and one entry in each dialect's `[project.plugins.telemetry] names`.

## 3. Who does what (root rule 2: Rust decides what, the dialect how)

| Part | Where | What |
|---|---|---|
| The plugin and `@untraced` | `platforms/backend/platform.toml` | `telemetry` in `plugins`, `untraced` in `decorators` |
| The words | each dialect's `[project.plugins.telemetry]` | `packages` (the OTel SDK of the target), `names` (`Datadog`, `NewRelic`, `Grafana`, `Otlp`, `Metric`), `docs.toml` |
| A use case's span | the dialect's template | `fastapi`'s `usecase_method.tpl` writes `@traced("{{site.component}} › usecase › {{owner}}.exec")` when `plugins.telemetry` is on and neither the method nor its class is `@untraced` |
| What the template knows | the compiler, generic | `plugins.<name>` (kind and method templates), `site.component` / `site.kind` / `site.path` / `site.line` and `is.<name>` (method templates) |
| A request's span | the runtime | `Connection.instrument(app)` hooks the web framework once the routes are mounted; a sampler drops the traces that start at an `@untraced` route |
| Log correlation | the runtime | `Log`'s sink adds `trace_id` / `span_id` and sends the record as an OTel log (pending: the backend has no `Log` yet) |
| The secret check | the compiler, data | a connection argument a platform marks `secret` in a client platform is a warning (phase 2) |

The compiler learns no vendor, no kind and no decorator name: three generic template variables.

## 3.1 `@untraced`

| On | Effect |
|---|---|
| a use case | its `exec` gets no `@traced`: no span, no cost |
| a use case's `exec` | the same, for that method |
| a route | the request starts no trace: nothing it calls is traced |
| a controller | every route of it, as above |

Without the plugin it does nothing. In `fastapi` it is written as the runtime's marker `untraced`; in `nestjs` it is
consumed (nothing written) until that dialect brings the plugin.

## 4. Per dialect

| Dialect | Packages | Hook |
|---|---|---|
| `fastapi` | `opentelemetry-sdk`, `opentelemetry-exporter-otlp-proto-http`, `opentelemetry-instrumentation-fastapi`, `-sqlalchemy`, `-httpx` | `create_app` calls `instrument(app)` of every connection before anything is injected |
| `nestjs` | `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http`, `-metrics-otlp-http`, the `http`, `nestjs-core` and `sequelize` instrumentations | the SDK must start before Nest is imported: `main.ts`'s template imports the runtime's `telemetry` first when the plugin is on |
| `flutter` | OTLP/HTTP JSON from the Dart runtime (no OTel SDK dependency) | `Log.sink` and the navigator observer; the vendor's client token |
| `react` | `@opentelemetry/sdk-trace-web` and the fetch instrumentation | the root template; the vendor's client token or a collector URL |

## 5. Performance (the golden rule)

- Off: the module is not imported, its packages are not in the manifest (the plugin system already does this).
- On: batch exporters in the background; one span per use case is a context switch and a clock read; sampling
  by `sample` at the root of the trace.
- The span names are constants written at build time, never computed per call.

## 6. Relation with spec 004 (backend parity)

F8 asks for `GET /metrics` in Prometheus format and request logs with a request id. This spec covers both with
OTLP: Grafana reads OTLP directly, and a Prometheus scrape stays possible through the collector. Whether F8 still
writes a `/metrics` route is a decision of the user (`tasks.md`).

## 7. State

Phase 1 is done for `fastapi` (`tasks.md`); `nestjs` comes next. The proof of concept's run-time wrapping (the
injector found the use cases by their folder) is gone: the template writes the span with its name as a constant.
