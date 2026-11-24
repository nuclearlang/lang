---
status: accepted
owner: Julian Molina
updated: 2026-11-24
related: []
---
# How the platform is tested

Each project's tests and how to run them are in its `AGENTS.md` and its `docs/05-standards/testing.md`.

| Level | What it covers | Command (from the root) |
|---|---|---|
| Rust crates | the lexer, the parser, the resolver, the emitter, the loader, the language server, the command line tools; golden files of every dialect's examples | `cargo test` |
| The references | every Nuclear → target block of a dialect's reference is the transpiler's real output | `cd nuclearlang && tools/spec-check/check.py dialects/<language>/docs/07-reference/<dialect>.md <dialect> <language>` |
| The standard library | the same program prints the same in TypeScript, Dart and Python | `nuclearlang/tools/stdlib-check.sh` |
| The language's conformance | every operator, statement and feature of the language: the same output in TypeScript, Dart and Python, no warning of the target's checker | `DIR=examples/conformance nuclearlang/tools/stdlib-check.sh` (and `DIR=examples/semantics`) |
| A platform with a dialect | its example built, the target's analyzer in strict mode, its tests, a live run | `nuclear-synapsis-framework/platforms/<platform>/checks/` |
| The extensions | compile, the pipeline's and the set-up's tests, the bundled server loads every dialect | `extensions/vscode`: `npm run compile && npm test && npm run server` |
| The agents | a bank of tasks against a frontier model | `nuclear-agents/nuclear_developer/eval/run.py` |

Rules:
- A test that cannot find a folder of the tree fails; it never skips itself.
- A golden file changes only with `UPDATE_GOLDEN=1` and a review of the difference.
- Every change to the transpiler, a dialect or the library runs the standard library, the semantics and the
  conformance programs before it is done: one feature must never break another.
- A check that needs an SDK the machine lacks is listed as *Untested* in the project's roadmap, not left out.
- A check of more than about ten minutes is split, never shortened: in the CI one job per part, run at the same time,
  and a last job that compares what they kept (`platform-backend.yml`: a job per dialect and database, then
  `compare`); on this machine every part at once before a tag (`installer/release/delivery.sh`, step `databases`).
  The repository is public: its jobs run on GitHub's runners (free for a public repository), never on a runner of
  this machine, where a pull request's code would run with the user's files.
