---
status: accepted
date: 2026-11-18
deciders: Julian Molina
---
# ADR-0011: Observability is a connection over OTLP, written at build time, and `@untraced` leaves something out

## Context and problem
An app must send its traces and metrics to Datadog, New Relic or Grafana without a vendor's library in the `.nuc`
and with the same Nuclear for every dialect. Tracing everything by default needs a way to leave things out (health
checks, hot paths) that costs nothing where it applies.

## Decision
**One protocol, vendors as data.** The plugin `telemetry` sends over OTLP (the OpenTelemetry protocol), which the
three vendors accept. Each vendor is a connection of `config/` that only fills a URL and headers: `Datadog`,
`NewRelic`, `Grafana`, and `Otlp` for any collector. Two words write metrics: `Metric.count` and `Metric.record`.

**The span is written at build time.** A dialect's template writes the span of each use case with its name as a
constant (`orders › usecase › FindOrder.exec`, `Log`'s breadcrumb), only when the plugin is on. The compiler gives
every template the enabled plugins and the method's place, generic variables that name no kind and no vendor.

**`@untraced` is the one way out.** On a use case or its `exec`, no span is written; on a route, the request starts
no trace; on a controller, every route of it. There is no `@traced`: everything is traced by default.

## Options considered
1. One `Telemetry(to = "datadog")` connection: rejected, a word per vendor reads better and completes in the editor.
2. The runtime wraps every use case at injection: rejected, it costs a check per call and finds use cases by folder.
3. The template writes the span, `@untraced` removes it: chosen.

## Consequences
- Positive: without the plugin, or with `@untraced`, the generated code carries nothing; changing the vendor is one line.
- Positive: a new vendor that speaks OTLP is a class of a few lines in each runtime.
- Negative: what the vendors offer beyond OTLP (profiling, their own agents) is out of reach.

## References
- Spec: `docs/04-specs/012-observability/` of the tree.
