---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../../../docs/03-adr/0000-template.md]
---
# Decisions of the framework

Cited as `ADR-synapsis-NNNN`. A new decision copies the template of the tree (`docs/03-adr/0000-template.md` at the
root) with the next number. An accepted decision is never edited: a change is a new one, and the old one is marked
`superseded by ADR-synapsis-NNNN`. The decisions of one platform are in that platform's own `docs/03-adr/`.

| ADR | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-the-framework-comes-with-the-language.md) | Dragonfly is Nuclear's framework: a concept independent of the target language, and a project is only `.nuc` | accepted | 2026-11-16 |
| [0002](0002-three-platforms-dialects-under-them.md) | Exactly three platforms; dialects are grouped under them and never show in the Nuclear code | accepted | 2026-11-16 |
| [0003](0003-components-injection-and-architecture-rules.md) | Closed components with layers and a facade; injection by header; the transpiler checks the architecture | accepted | 2026-11-16 |
| [0004](0004-kinds-and-plugins-are-libraries.md) | Kinds are Nuclear's libraries: native kinds, extension kinds as packages, plugins of `config.nuc` | accepted | 2026-11-16 |
| [0005](0005-the-services-every-app-gets.md) | Every app gets events, session, ACL, forms, translations and generic models from the framework | accepted | 2026-11-16 |
| [0006](0006-shared-contracts.md) | A backend publishes a contract; a client generates its models and repositories from it | accepted | 2026-11-16 |

A decision cited by its old platform-wide number (`ADR-00NN`, in code or commits before 2026-11-16): see
[the table of old numbers](../../../docs/03-adr/old-numbers.md).
