---
name: analytics-events
description: Build product analytics in a Synapsis product: an event naming convention, a typed schema per event, consent before tracking, batching and retries, and no personal data in properties. Use when a feature must be measured, a funnel tracked or events sent to an analytics tool.
title: Analytics events
title_es: Eventos de analítica
description_es: Construir analítica de producto en un producto Synapsis: nombres de eventos, un esquema tipado por evento, consentimiento previo, envío por lotes con reintentos y sin datos personales. Úsalo cuando una función debe medirse, seguir un embudo o enviar eventos a una herramienta de analítica.
kind: domain
tags: [analytics, events, tracking, consent, metrics, funnel, telemetry, batching]
---
# Analytics events

## When to use

"How many users finish checkout?", feature adoption, funnels, retention. Technical health (latency, errors) is
the backend's telemetry instead: `plugins(telemetry = true)` and `Metric.count` / `Metric.record`
(`nuclear help backend`, §2.15).

## Steps

1. **Start from the question.** For each metric, write which events answer it and their properties, in the spec
   (a tracking plan). An event no question needs is not sent.
2. **Name events one way**: `object_action` in past tense, snake_case, from a fixed list of objects and verbs:
   `checkout_started`, `order_completed`, `search_performed`. No screen names or UI words that change with design
   (`blue_button_clicked`). Version breaking changes (`order_completed_v2`) instead of reusing a name.
3. **A typed model per event** (`nuclear make model analytics OrderCompleted`): its properties with types and
   rules (`amount: int` in minor units, `currency`, `itemCount`), plus common fields the sender adds:
   `eventId` (UUID, for dedupe), `occurredAt` (UTC), `anonymousId`, `userId?`, `sessionId`, `appVersion`,
   `platform`, `locale`. No free maps of "anything": a typo becomes a new property.
4. **No personal data in properties**: no email, name, phone, address, exact location, free text the user typed.
   Use internal ids; hash nothing that can be guessed (a hashed email is still personal data).
5. **Consent first** (`privacy-gdpr`): non-essential analytics start only after the user agrees; store the choice
   with the profile and on the device (`~session.set("analyticsConsent", ...)` or a local table), let the user
   change it in settings, and stop and drop the queue when they withdraw. Respect the OS's tracking settings.
6. **One tracking service per app**: `nuclear make service analytics Tracker` with `track(event)`. It checks
   consent, adds the common fields, and queues. Screens and state managers call a use case, not a provider SDK.
7. **Batch and retry**: keep events in a local table (mobile: a model with `@primary`), send in batches (every 30 s
   or 20 events, and when the app goes to the background), retry with growing waits, drop events older than a
   few days, cap the queue size.
8. **Collect on the backend**: `POST analytics/events` takes a batch, validates each event against its model,
   drops duplicates by `eventId`, and forwards to the analytics tool (an HTTP repository, key in `env(...)`) or
   stores it. Server-side events (`order_completed` after the payment webhook) are more reliable than client
   ones: send business facts from the backend.
9. **Test the plan**: a test per event checks its name and properties; a test without consent checks nothing is
   queued.

## The platform's tools

- `nuclear make component analytics`, `nuclear make model analytics <EventName>`, `nuclear make service analytics Tracker`.
- `nuclear gen usecase analytics IngestEvents --route "POST analytics/events"` (backend).
- `nuclear gen resource analytics Collector --source rest:<tool base url> --actions create` to forward.
- Backend telemetry: `plugins(telemetry = true)` with `Datadog`, `NewRelic`, `Grafana` or `Otlp`; `@untraced`.
- A provider's SDK on the device is a target package (`nuclear add <package>`), tied to the dialect: prefer
  sending to your own backend. There is no analytics kind.

## Pitfalls

- Tracking before consent; ignoring a withdrawal.
- Event names that drift (`OrderComplete`, `order-completed`, `orderCompleted`) and split the data.
- Personal data in properties or in URLs sent as properties.
- One request per event: battery and data use; lost events when offline.
- Client clocks for ordering; no `eventId`, so retries double-count.
- Measuring revenue from client events instead of the backend's facts.

## Checklist

- [ ] Every event is in the tracking plan with a question it answers.
- [ ] Names follow `object_action`, past tense, snake_case; each has a typed model.
- [ ] No personal data in any property (review the models).
- [ ] Nothing is queued or sent without consent; withdrawal clears the queue (a test).
- [ ] Events are batched, retried and deduplicated by `eventId`.
- [ ] `nuclear check .` reports 0 errors and `nuclear test` is green.
