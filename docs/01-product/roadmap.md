---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: []
---
# Roadmap of the platform

What is left for the platform as a whole. The pending work of a project is in that project's
`docs/01-product/roadmap.md`; nothing is listed twice.

## Half done

- **The tree restructure**: its phases 1 to 4 are done; what is left (the reinstall, the user's projects outside the
  tree, the old repositories archived) is in `04-specs/008-restructure/tasks.md`.
- **The GitHub side of one repository**: the workflows of `.github/workflows/` were rewritten and have not run (each platform's and the VS Code one also run when `tools/code_generator/` or `device-emulators/` change; `website.yml` builds and tests the site); the
  nine repositories that are now folders are still public (archived only when the user says so); the Zed
  extension's grammar is still fetched from the old `nuclear-zed` repository (`extensions/zed/extension.toml`).

## The competitiveness plan (decided by the user, 2026-11-06)

What the platform lacks to compete, in the order the user chose. Each step's details are in the roadmap of the
project named.

| Step | Goal | State | Where |
|---|---|---|---|
| 1 | Exist publicly: CI of everything done by hand, a license, a versioned 1.0 reference, the packages and the extensions published, binaries for macOS and Windows, a one-command installer | the installers and the release workflow are written; no release yet | `installer/`, each published package |
| 2 | A real reference app shipped on Android, iOS and web with a deployed backend, built from the tutorial on a clean machine | not started | `nuclear-synapsis-framework/` |
| 3 | Shared contracts across platforms | done; a drift warning by version is left | `nuclear-synapsis-framework/` |
| 4 | Backend parity: relations, migrations, transactions, pagination, auth, jobs, uploads, Dockerfile, observability | the data parts are done; auth, jobs, uploads, Dockerfile, observability are left | `nuclear-synapsis-framework/platforms/backend/` |
| 5 | The web platform | a first version | `nuclear-synapsis-framework/platforms/web/` |
| 6 | The language: `nuclear fmt`, TypeScript type definitions, member types, constructors and patterns, `const` inference; then freeze the 1.0 reference | `nuclear fmt` is done | `nuclearlang/` |
| 7 | Prove the thesis with numbers: the hard agent evaluation and benchmarks of the generated code | the system is done and the benchmark ran; the agent arms wait for the user's go (paid: about USD 100) | `nuclear-synapsis-framework/eval/thesis/` |

After these: offline write sync and conflicts for the local database, push notifications, OAuth, analytics and
crash reporting, deep links, CI templates and store publishing from the command line, a validated 30-minute
tutorial and comparison tables.

## Pending

- **The end-of-turn hook holds only a project's `docs/` to its code** (`.claude/hooks/README.md`). Left of what the
  user decided on 2026-11-11: the project's `CHANGELOG.md`, the agents' skill and the briefs when a command, an MCP
  tool or a stage of the pipeline changed, the website's content rebuilt when a page it publishes changed; a test
  that the hook refuses a change with a missing document.
