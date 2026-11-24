---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [../../../docs/03-adr/0000-template.md]
---
# Decisions of the framework

Cited as `ADR-synapsis-NNNN`. A new decision copies the template of the tree (`docs/03-adr/0000-template.md` at the
root) with the next number. An accepted decision is never edited: a change is a new one, and the old one is marked
`superseded by ADR-synapsis-NNNN`. The decisions of one platform are in that platform's own `docs/03-adr/`.

| ADR | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-the-framework-comes-with-the-language.md) | Synapsis is Nuclear's framework: a concept independent of the target language, and a project is only `.nuc` | accepted | 2026-11-16 |
| [0002](0002-three-platforms-dialects-under-them.md) | Exactly three platforms; dialects are grouped under them and never show in the Nuclear code | accepted | 2026-11-16 |
| [0003](0003-components-injection-and-architecture-rules.md) | Closed components with layers and a facade; injection by header; the transpiler checks the architecture | accepted | 2026-11-16 |
| [0004](0004-kinds-and-plugins-are-libraries.md) | Kinds are Nuclear's libraries: native kinds, extension kinds as packages, plugins of `config.nuc` | accepted | 2026-11-16 |
| [0005](0005-the-services-every-app-gets.md) | Every app gets events, session, ACL, forms, translations and generic models from the framework | accepted | 2026-11-16 |
| [0006](0006-shared-contracts.md) | A backend publishes a contract; a client generates its models and repositories from it | accepted | 2026-11-16 |
| [0007](0007-guards-of-a-backend.md) | A backend's guards (`Token`, `NoOrigin`) check the headers of every request, of the app or of a controller, over every transport | accepted | 2026-11-18 |
| [0008](0008-websockets-are-a-connection.md) | WebSockets are a connection of the configuration; the repository's adapter carries its calls; `publish` reaches the subscribed clients | accepted | 2026-11-18 |
| [0009](0009-a-web-app-mounts-in-a-host-page.md) | A web app also builds as a bundle that mounts in a host's page (`mount(element, host)`), with the host's theme and its bridge | accepted | 2026-11-18 |
| [0010](0010-a-backend-is-tested-as-its-clients-call-it.md) | A backend's tests call the app over HTTP and its WebSocket (`appClient()`), with their own environment (`testEnv`) | accepted | 2026-11-18 |
| [0011](0011-observability-over-otlp.md) | Observability is a connection over OTLP (`Datadog`, `NewRelic`, `Grafana`, `Otlp`), its spans written at build time; `@untraced` leaves something out | accepted | 2026-11-18 |
| [0012](0012-one-json-for-every-dialect.md) | A model's JSON has Nuclear's names (camelCase) in every dialect | accepted | 2026-11-18 |
| [0013](0013-errors-and-openapi-are-nuclears.md) | The body of an error and the OpenAPI document are Nuclear's: each runtime converts what its framework answers, and the API is described once from the contract | accepted | 2026-11-22 |
| [0014](0014-an-empty-required-text-is-not-given.md) | An empty text under `@required` answers the rule `required`, in every dialect; `@minLength(n)` keeps `minLength` | accepted | 2026-11-24 |

A decision cited by its old platform-wide number (`ADR-00NN`, in code or commits before 2026-11-16): see
[the table of old numbers](../../../docs/03-adr/old-numbers.md).
