# Decisions of the platform

Only the decisions about the whole platform. Each project keeps its own in its `docs/03-adr/`, numbered from 0001
and cited with its key (`../README.md` has the table of keys). The format is `0000-template.md`. An accepted ADR
is not edited: a new one replaces it.

| ADR | Decision | Status |
|---|---|---|
| [ADR-platform-0001](0001-english-everywhere.md) | Everything is written in English | accepted |
| [ADR-platform-0002](0002-one-repository-a-project-per-folder.md) | One repository; each project in its folder, with its own documents | accepted |
| [ADR-platform-0003](0003-the-ai-loop.md) | The AI loop: a private knowledge base, local agents, one MCP server and a pipeline tool | accepted |
| [ADR-platform-0004](0004-products-are-made-with-the-tools.md) | A product is made with the platform's tools, never by porting code by hand | accepted |
| [ADR-platform-0005](0005-the-software-factory.md) | The software factory: stations, roles as files, providers as assignments, teams (amends 0003) | accepted |
| [ADR-platform-0006](0006-the-builders-workbench.md) | The Builder is a workbench: specs by component and layer, a general agent's chat (amends 0005) | accepted |
| [ADR-platform-0007](0007-everything-is-a-component.md) | Everything is a component, as in a framework: a piece two tools need is its own project | accepted |
| [ADR-platform-0008](0008-nuclear-chat-the-factorys-workplace.md) | Nuclear Chat, the factory's workplace, is a project of its own (amends 0006) | accepted |
| [ADR-platform-0009](0009-the-ui-is-only-a-ui.md) | The UI is only a UI: every action is a command of the engine, and a tool of its MCP server for the agents | accepted |
| [ADR-platform-0010](0010-a-team-is-its-members.md) | A team is the members the user hires, as many per role as they want; a new team is a wizard (amends 0005) | accepted |
| [ADR-platform-0011](0011-one-version-one-release.md) | One version for the whole platform; a release and an installation are one snapshot | accepted |
| [ADR-platform-0012](0012-environments.md) | Environments are declared by `env()`, valued by dotenv files and the keyring; web and mobile resolve them at build | accepted |

[old-numbers.md](old-numbers.md): the platform-wide numbers used before 2026-11-16 and the decision that stands for each now.
