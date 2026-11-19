# Specs of the platform

A change that touches several projects. A change to one project is a spec in that project's `docs/04-specs/`.
One folder per change: `requirements.md`, `design.md`, `tasks.md`; `draft → approved → in-progress → done`.

| Spec | Change | State |
|---|---|---|
| [006-public-repositories](006-public-repositories/plan.md) | The organization and the split into public repositories | superseded by `ADR-platform-0002`; kept for what it says of the organization, the license and the published packages |
| [008-restructure](008-restructure/tasks.md) | One repository, a project per folder, per-project documents, the new names | done (2026-11-17) |
| [009-self-contained-ai-services](009-self-contained-ai-services/tasks.md) | The AI services ready to run from the installer: their own Python, Nuclear Builder in Nuclear, Ollama and the models by the user, the ports chosen | in progress (phases 1 and 2 done, phase 3 half done) |
| [010-migration-into-nuclear](010-migration-into-nuclear/requirements.md) | A TypeScript, Python or Dart project migrated into Nuclear: one meaning in every dialect, the points a tool cannot decide listed for an agent | draft |
| [011-software-factory](011-software-factory/requirements.md) | Nuclear Builder as a software factory: five roles as files (analyst, architect, developer, QA, DevOps), each done by the local agents, a provider's agent or a provider's model; a vault for keys; the plans as a console; the engine in Nuclear; the workbench (req. 19-26) | in progress |
| [012-observability](012-observability/requirements.md) | Traces, metrics and logs to Datadog, New Relic, Grafana or any OpenTelemetry collector: one connection in `config/`, the same Nuclear for every dialect | in progress (phase 1 done in `fastapi`; `nestjs` next) |
| [013-nuclear-chat](013-nuclear-chat/requirements.md) | Nuclear Chat, the factory's workplace as Slack: channels per team, direct messages with each member, threads per run and spec, members that ask and answer with their personality, GIFs; a component used by the Builder and Atlas | approved |
| [014-synapsis-real-time-and-embedded](014-synapsis-real-time-and-embedded/requirements.md) | Synapsis grows for Nuclear Chat: server-sent events in `backend`, a listening client and an embedded build in `web`, in every dialect | approved |
| [015-monitor](015-monitor/requirements.md) | Nuclear Monitor: each Nuclear function and method with its time, calls, connections and memory as a tree, written by the transpiler with `--monitor`, shown by the editor and read by the agents | in progress |
| [016-agent-onboarding](016-agent-onboarding/requirements.md) | An agent with no context learns Nuclear from the MCP server alone: `nuclear_start`, the atlas of topics embedded in the binary, the context documents `nuclear new` writes, every client integrated by the set-up, measured by a sandboxed run | in progress (phases 1-5 done; the other clients and the extension left) |
| [017-productivity-reports](017-productivity-reports/requirements.md) | Productivity and consumption: tokens, money, time, lines of code and results by agent, model, member, team and project, with charts; a command and an MCP tool | draft |
