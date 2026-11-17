---
status: accepted
owner: Julian Molina
updated: 2026-11-17
related: [../02-architecture/engine.md, ../../../../vscode/docs/01-product/roadmap.md, ../../../../jetbrains/docs/01-product/roadmap.md]
---
# Roadmap of Nuclear Builder

What the agents, the strategies and the generators still lack is in their own projects
(`nuclear-agents/nuclear_developer/`, `nuclear-graph-storage/`, `tools/code_generator/`).

## Half done

- **Nuclear Builder in Nuclear** ([spec 009](../../../../../docs/04-specs/009-self-contained-ai-services/tasks.md),
  phase 3). Done: the set-up and the `nuclear-builder` command (`setup.nuc`, `cli.nuc`, `python` dialect), in the
  AI archive; the VS Code pages run it as a process. Left: the engine (`src/engine.ts`, `src/safety.ts`, the
  pipeline commands of `src/cli.ts`, about 2,400 lines) with its tests; until then `cli.nuc` runs it with node, so
  the pipeline still needs Node.js outside the editor.

- Nuclear Builder's form in the editor has no field for the strategy (the spec file's `- Strategy:` line and
  `nuclear-builder run` read it).

## Untested

- **The set-up in Nuclear on macOS and Windows** (launch agents, the Startup script, `Get-CimInstance` for the memory
  and the processor, the `.cmd` launchers): written, never ran. On Linux it ran from a working tree and on the clean
  machine.

- **The message that sends a question to Nuclear Atlas** (renamed from the chat) and its tests pass (`npm test`);
  never seen in a running VS Code.
- **The Nuclear Builder panel was never opened in a running VS Code** (only headless renders, node checks, HTTP
  calls and `nuclear-builder`): the form, the pipeline, the *Generate* stage, the *Analysis* step, a stage skipped by a
  strategy, the questions that stop a run, the Plan step's tree and limits, the *For the agent* tab, the run's graph
  with a node's drawer and *Run again from this step* / *Run <stage> again* / *Run again from scratch*; an
  interrupted run resumed after a real restart.
- The JetBrains *Nuclear Builder* tool window in a running IDE (only compiled).
- A Jira import against a real site, a GitHub issue import (`gh`), an exported CI file run on GitHub / GitLab /
  Bitbucket, the deploy stage with real `seed` / `integration` / `deploy` commands, the keyring on macOS and
  Windows (ADR-platform-0003).

## Pending

- **A spec outside `specs/<id>/spec.md`**: `nuclear-builder run specs/count-books.md` takes the parent folder as the
  run's id (`specs`) and writes `specs/specs/spec.md`; its help says only `[spec.md]`. Either the id comes from the
  file's name, or the help says the layout. Found by the functional tests of 2026-11-16, where a run with the local
  agents went through every stage up to *Tests first* and stopped there: the local tester wrote no test that
  compiled in 3 attempts (it called `exec` on a use case the planner had named otherwise), and the diagnoser said so.
- **The old ledgers** (runs of Nuclear Builder before `ENGINE = 2`): a from-scratch restart removes a file the ledger says
  "was" what an earlier attempt wrote, only when that text is a step's `code` of the run; an older run whose steps
  kept no code still gets such a file back.
- **The disk check** holds the temporary folder to the same 500 MB as the project. With `/tmp` (a 7.7 GB tmpfs) full
  of other sessions' scratch and of `flutter_tools.*` folders, every run stopped at *Check the connections*. The
  message names the folder and the diagnoser has the kind `disk`; nothing cleans the temporary folders the tools
  leave (`nuclear-lsp-backend-*`, `nuclear-web-device-*`).
- **Not written in Nuclear** (rule 9 of the root `AGENTS.md`): `nuclear-builder` is TypeScript, inside
  `extensions/vscode`. Decided by the user to stay as it is for now.

What Android Studio's tool window lacks: [the plugin's roadmap](../../../../jetbrains/docs/01-product/roadmap.md).
