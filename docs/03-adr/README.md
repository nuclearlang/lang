# Decisions of the platform

Only the decisions about the whole platform. Each project keeps its own in its `docs/03-adr/`, numbered from 0001
and cited with its key (`../README.md` has the table of keys). The format is `0000-template.md`. An accepted ADR
is not edited: a new one replaces it.

| ADR | Decision | Status |
|---|---|---|
| [ADR-platform-0001](0001-english-everywhere.md) | Everything is written in English | accepted |
| [ADR-platform-0002](0002-one-repository-a-project-per-folder.md) | One repository; each project in its folder, with its own documents | accepted |
| [ADR-platform-0003](0003-the-ai-loop.md) | The AI loop: a private knowledge base, local agents, one MCP server and a pipeline tool | accepted |
| [ADR-platform-0004](0004-products-are-made-with-the-tools.md) | A product is made with the platform's tools, never by porting code by hand | accepted; point 2 amended by 0015 |
| [ADR-platform-0005](0005-the-software-factory.md) | The software factory: stations, roles as files, providers as assignments, teams (amends 0003) | accepted |
| [ADR-platform-0006](0006-the-builders-workbench.md) | The Builder is a workbench: specs by component and layer, a general agent's chat (amends 0005) | accepted |
| [ADR-platform-0007](0007-everything-is-a-component.md) | Everything is a component, as in a framework: a piece two tools need is its own project | accepted |
| [ADR-platform-0008](0008-nuclear-chat-the-factorys-workplace.md) | Nuclear Chat, the factory's workplace, is a project of its own (amends 0006) | accepted |
| [ADR-platform-0009](0009-the-ui-is-only-a-ui.md) | The UI is only a UI: every action is a command of the engine, and a tool of its MCP server for the agents | accepted |
| [ADR-platform-0010](0010-a-team-is-its-members.md) | A team is the members the user hires, as many per role as they want; a new team is a wizard (amends 0005) | accepted |
| [ADR-platform-0011](0011-one-version-one-release.md) | One version for the whole platform; a release and an installation are one snapshot | accepted |
| [ADR-platform-0012](0012-environments.md) | Environments are declared by `env()`, valued by dotenv files and the keyring; web and mobile resolve them at build | accepted |
| [ADR-platform-0013](0013-local-models-on-standby.md) | The local models (Ollama, the Nuclear Developer, the `local` kind) are on standby behind one switch; the AI work is done by external providers and agents; the Smart Graph stays | accepted |
| [ADR-platform-0014](0014-stability-and-parity.md) | The same Nuclear means the same in every dialect: the language's rules stay, every change runs every test set, a converter and one reference tool settle what dialects answer differently, the MCP server and the knowledge base serve every new thing | accepted |
| [ADR-platform-0015](0015-migrating-a-project-into-nuclear.md) | A project of another technology is migrated into Nuclear by an agent that reads it and rewrites it with the tools; the transpiler still reads only `.nuc` (amends 0004) | accepted |
| [ADR-platform-0016](0016-the-installation-is-sealed.md) | No agent changes Nuclear; the installation is sealed and a changed one builds nothing (N0225, N0226) | accepted |
| [ADR-platform-0017](0017-nuclear-libraries-reach-a-project-as-source.md) | A Nuclear library or plugin reaches a project as source, built with it; a runtime's own Nuclear is built into the runtime | accepted |

[old-numbers.md](old-numbers.md): the platform-wide numbers used before 2026-11-16 and the decision that stands for each now.
