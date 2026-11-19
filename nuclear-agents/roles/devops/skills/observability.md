---
name: observability
description: Make a backend observable with the platform's telemetry plugin (Datadog, New Relic, Grafana or any OTLP collector) and say what to watch after a deploy.
title_es: Observabilidad
description_es: Hacer observable un backend con el plugin de telemetría de la plataforma (Datadog, New Relic, Grafana o cualquier colector OTLP) y decir qué vigilar tras un despliegue.
---
# Observability

1. Switch the plugin on in `config.nuc`: `plugins(telemetry = true)`.
2. Add the connection that says where the traces and metrics go, in `config/`: `Datadog(apiKey, url)`,
   `NewRelic(licenseKey, region)`, `Grafana(url, instanceId, token)` or `Otlp(url)`, with `service` (the name the
   vendor shows) and `sample` (the share of traces kept). Every key from `env(...)`.
3. A number the team must follow (orders paid, failed logins): a `Metric` of the platform, never a vendor's library.
4. `nuclear check .` and the tests pass with the plugin on; the tests send nothing (no key in `testEnv`).
5. Write in `deployment.md` what to watch after a deploy (the error rate, the latency of the routes the change
   touched, the metric it added) and the alert that says it went wrong.
