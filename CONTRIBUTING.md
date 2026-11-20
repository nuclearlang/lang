# Contributing to NuclearLang

Thank you for helping. The whole platform is this one repository; each folder is a project with its own
`AGENTS.md` and `docs/` ([README.md](README.md), "The tree").

## Set up

```sh
git clone https://github.com/nuclearlang/lang && cd lang
installer/install.sh
```

## Before a pull request

```sh
cargo test && cargo clippy --all-targets
UPDATE_GOLDEN=1 cargo test                                    # when the output changes on purpose
(cd nuclearlang && python3 tools/spec-check/check.py dialects/typescript/docs/07-reference/typescript.md typescript typescript)   # also dart, python
sh nuclearlang/tools/stdlib-check.sh                          # needs tsc, dart and python
```

The checks of the project you touch are in its `AGENTS.md`.

- Everything is written in English: code, comments, documents and messages.
- A change updates the documents of the project it touches in the same pull request: its reference, its guides,
  its `docs/` for agents and contributors ([docs/05-standards/coding.md](docs/05-standards/coding.md)).
- The rules are in [AGENTS.md](AGENTS.md); the reasons behind them, in each project's `docs/03-adr/`.

## Sign off your commits (DCO)

Each commit carries `Signed-off-by: Your Name <you@example.com>` (`git commit -s`): you certify the
[Developer Certificate of Origin](https://developercertificate.org), that you wrote the change or have the right to
submit it. No CLA.

Changes written with an AI agent are welcome under the same review: you answer for them.

## Where to start

Issues labelled [`good first issue`](https://github.com/nuclearlang/lang/labels/good%20first%20issue); a dialect
(TOML and templates, no compiler code: [nuclearlang/dialects/README.md](nuclearlang/dialects/README.md)); examples;
type definitions; translations. Questions: [Discussions](https://github.com/nuclearlang/lang/discussions). How
decisions are made: [GOVERNANCE.md](GOVERNANCE.md). Conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

By contributing you agree that your contribution is licensed under the [Apache License 2.0](LICENSE).
