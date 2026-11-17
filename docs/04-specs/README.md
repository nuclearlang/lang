# Specs of the platform

A change that touches several projects. A change to one project is a spec in that project's `docs/04-specs/`.
One folder per change: `requirements.md`, `design.md`, `tasks.md`; `draft → approved → in-progress → done`.

| Spec | Change | State |
|---|---|---|
| [006-public-repositories](006-public-repositories/plan.md) | The organization and the split into public repositories | superseded by `ADR-platform-0002`; kept for what it says of the organization, the license and the published packages |
| [008-restructure](008-restructure/tasks.md) | One repository, a project per folder, per-project documents, the new names | done (2026-11-17) |
| [009-self-contained-ai-services](009-self-contained-ai-services/tasks.md) | The AI services ready to run from the installer: their own Python, Nuclear Builder in Nuclear, Ollama and the models by the user, the ports chosen | in progress (phases 1 and 2 done, phase 3 half done) |
