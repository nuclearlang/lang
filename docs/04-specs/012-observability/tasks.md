---
status: in-progress
owner: Julian Molina
updated: 2026-11-18
related: [requirements.md, design.md]
---
# Spec 012: observability — Tasks

## Decided with the user (2026-11-18, ADR-synapsis-0011)

- One connection per vendor (`Datadog`, `NewRelic`, `Grafana`, `Otlp`) and `Metric.count` / `Metric.record`.
- `@untraced` is the one way to leave something out: a use case, a route or a controller. No `@traced`.
- The span is written by the dialect's template at build time, never wrapped at run time.

## To decide with the user

1. Spec 004's F8: drop its `GET /metrics` route for OTLP, or keep both.
2. The order of the platforms after backend: mobile or web.
3. A component switched off at once (`trace = false` in its `config`), or `@untraced` on each class is enough.

## Phase 1 — backend

- [x] `telemetry` and `@untraced` in `platforms/backend/platform.toml`; the reference `backend.md` §2.15 and the brief.
- [x] The compiler, generic: `plugins.<name>` in kind and method templates, `site.*` and `is.<name>` in method
  templates (`projects.md` §5); `transpile_with_plugins` for a file built alone, which `spec-check` reads from a
  `// config.nuc: plugins(...)` first line.
- [x] `fastapi`: `[project.plugins.telemetry]`, `templates/usecase_method.tpl` (`@traced`), `untraced` written as the
  runtime's marker, `docs.toml`, the reference §2.13 (`spec-check`: 0 problems).
- [x] `synapsis-py`: `synapsis.telemetry` (own providers, the sampler of `@untraced` routes and `sample`,
  `traced`, `Metric`), `web.untraced`, `app.state.synapsis_routes`; `tests/test_telemetry.py`; the type definitions
  regenerated (`synapsis.telemetry` is now one of their libraries).
- [x] The test of the compiler: `telemetry_writes_a_span_on_each_use_case_but_the_untraced`
  (`nuclear-transpile/tests/projects.rs`).
- [ ] `nestjs` and `synapsis-nest`: the plugin, the SDK started first in `main.ts`, the same template and test
  (today `@untraced` is only consumed; the loader warns the plugin is missing).
- [ ] The spans of queries (the SQL instrumentation) and outgoing HTTP calls, in both runtimes.
- [ ] The spans of listeners and agent nodes, with the trace carried in the message's headers (Kafka), so an event
  continues the trace of the request that published it.
- [ ] `Log` in the backend runtimes and `[call_site.Log]` in `fastapi`; its records sent as OTel logs with the trace.
- [ ] `service.version` and `deployment.environment` on every span: from `app(version)` and an `environment`
  argument, the tags Datadog's unified service tagging and Grafana's filters read.
- [ ] A short exporter timeout at stop: with the destination down the exporter retries for about ten seconds when
  the app stops (seen in the live run).
- [ ] The URL's query string and the headers kept out of the request spans (a token in a query must not reach the
  vendor).
- [ ] A warning for a key written as a literal (`Datadog(apiKey = "abc")`) instead of `env(...)` (a new code in
  `nuclearlang/docs/07-reference/diagnostics.md`).
- [ ] `tasks_api` or `rick_api` with the plugin on and `Otlp`; both checks send to a local collector in the live run.
- [ ] The tests against the real vendors (left for later by the user, 2026-11-18): a local collector, Datadog (Agent
  and agentless), New Relic (`us`, `eu`), Grafana Cloud, and the stop with the destination down. The steps are in
  the backend platform's roadmap, *Untested*.
- [ ] `nuclear new` / `gen` know the plugin (`tools/code_generator/`): a generated `/health` route is `@untraced`.
- [ ] A helper of `synapsis.testing` to read the spans of a test written in Nuclear.

## Phase 2 — clients

- [ ] The connection arguments marked `secret`; the warning in `mobile` and `web` (`diagnostics.md`).
- [ ] `mobile` (`flutter`) and `web` (`react`): the plugin, the connections with the vendor's client tokens, `Log` and
  the navigation as spans, the trace carried to the backend in the request headers.

## Phase 3 — the tree

- [ ] The website's guide page and the MCP brief.
