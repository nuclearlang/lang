# Nuclear Builder

The pipeline tool of the editors: a spec goes through specification, generate, plan, tests first, code,
verification, security, artifacts and deploy on the developer's machine, and every step shows who did it (you,
Claude, a local agent, the shell). It is a tool of the Nuclear workspace in VS Code (`Ctrl+Alt+P`), a tool window in
Android Studio / IntelliJ (`Alt+Shift+P`), and the `nuclear-builder` command in a terminal or a CI job.

## Why it exists

Work with AI agents should start from a spec and end in tested, reviewed code, with every step visible, and the same
pipeline should run on a server. A frontier model that does everything is paid for every token and the code leaves
the machine; a local 3B model alone cannot hold a whole feature. The Builder puts them in the roles of a lead and a
junior: Claude makes the decisions (the plan, the names, the review), the local Nuclear Developer writes each piece,
and what the junior cannot fix the lead fixes and keeps as an example.

What it leaves out on purpose: the shell runs nothing that is not in `.nuclear/builder.json`; the agent stages do
not run on a server (the server checks their result with the deterministic stages); the acceptance step informs and
never fails a run; there is no Builder for Zed.

## How we made it

- **The AI loop** ([ADR-platform-0003](../../../docs/03-adr/0003-the-ai-loop.md)): the Builder is one of its four
  projects, with the [Smart Graph](../../../nuclear-graph-storage/README.md), the
  [Nuclear Developer](../../../nuclear-agents/nuclear_developer/README.md) and the
  [MCP server](../../../tools/mcp/AGENTS.md). A failure is diagnosed before it is retried.
- **A strategy for each kind of request**
  ([ADR-developer-0001](../../../nuclear-agents/nuclear_developer/docs/03-adr/0001-a-strategy-for-each-kind-of-request.md)):
  the *Specification* stage ends with the analysis (a whole system, one screen, a rename, a failing test…), which
  decides the stages that run.
- **The generators write first**
  ([ADR-codegen-0001](../../../tools/code_generator/docs/03-adr/0001-the-generators-write-finished-code-the-agent-only-what-is-not-standard.md),
  [ADR-platform-0004](../../../docs/03-adr/0004-products-are-made-with-the-tools.md)): *Generate* runs `nuclear gen`
  for the resources the spec names, so the agents write only what is left; *Tests first* is skipped when the
  generators wrote every file.
- **Who leads**: *Claude leads, the local developer writes* is the default, because the local developer is at
  Sonnet's level on single files and behind on whole features: in the last rounds it passes 41 or 42 of 42 single
  files (Sonnet 36) and one or two of three features (Sonnet three)
  ([the rounds](../../../nuclear-agents/nuclear_developer/docs/05-standards/testing.md)).
- **A run is a file**, `.nuclear/builder/runs/<id>.json`, saved on every step: VS Code, JetBrains and the command
  draw the same file. It survives a crash of the editor: what an unfinished step wrote is undone and the run goes on.
- **One engine, no editor inside it**: `src/engine.ts` and `src/safety.ts` never import `vscode`, so the page, the
  command, Nuclear Atlas and the tests drive the same code. Written in TypeScript (bundled by the VS Code extension) and
  Java for the JetBrains window; not in Nuclear yet, decided by the user to stay so for now
  ([roadmap](docs/01-product/roadmap.md)).

**State:** the engine and `nuclear-builder` run and are tested; the VS Code panel and the JetBrains window were
never opened in a running editor ([roadmap](docs/01-product/roadmap.md)).

## Try it

It needs the Smart Graph and the Nuclear Developer running
([Set up the AI services](../../../installer/docs/08-guides/ai-setup.md)):

```sh
nuclear-builder setup            # reads the machine, suggests a profile, installs the services and the models
nuclear-builder setup --status   # what is installed and running
cd <your project>                # the folder with config.nuc
nuclear-builder run specs/<id>/spec.md --lead local   # one line per step as it ends; the journal in .nuclear/builder/runs/<id>.md
nuclear-builder runs             # the runs kept in the project
```

In VS Code: `Ctrl+Alt+P`, write the spec and its acceptance criteria, press **Start the loop**. To build the command
from the tree: `cd extensions/vscode && npm run builder` (→ `out/nuclear-builder.js`); `npm test` there runs the
engine's tests.

## Where to read next

| | |
|---|---|
| Write a spec and start a run (VS Code, JetBrains, a terminal) | [docs/08-guides/write-a-spec.md](docs/08-guides/write-a-spec.md) |
| Follow a run, run something again, read a failure | [docs/08-guides/follow-a-run.md](docs/08-guides/follow-a-run.md) |
| The commands of each stage, the CI export | [docs/08-guides/pipeline-commands.md](docs/08-guides/pipeline-commands.md) |
| What it is for, who leads and why | [docs/00-context/vision.md](docs/00-context/vision.md) |
| How the engine runs, retries, undoes and survives a crash | [docs/02-architecture/engine.md](docs/02-architecture/engine.md) |
| What is pending | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| To change it | [AGENTS.md](AGENTS.md) |
