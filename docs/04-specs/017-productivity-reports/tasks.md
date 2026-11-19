---
status: accepted
owner: Julian Molina
updated: 2026-11-19
related: [requirements.md, design.md]
---
# Spec 017 — Tasks

- [x] T1 Usage at the source: every adapter and the API loop give `usage` (tokens in/out, cost, ms, provider, model); the Developer returns Ollama's counts; run steps and chat answers keep it; tests with stubbed providers.
- [x] T2 Lines per step from the run's writes; cycle and waiting times from the run file.
- [x] T3 The ledger: one line per step and chat answer across projects; old runs back-filled once from their run files (what they have).
- [x] T4 `nuclear-builder metrics … --json` and the MCP tool: every view of design.md; tests over a fixture ledger.
- [x] T5 The *Reports* page (HUD style, en/es, light/dark), its strip icon; each member's numbers in their Summary.
- [x] T6 Docs, the knowledge base, the editors' release.

Built on 2026-11-19: `extensions/tools/nuclear-builder` (`adapter*.nuc`, `usage.nuc`, `metrics.nuc`, `src/reports/`,
`tests/test_metrics.nuc`), the Nuclear Developer's `usage` (`nuclear-agents/nuclear_developer`), the strip's tool in
`extensions/vscode`. What is left is in the Builder's roadmap ("The reports").
