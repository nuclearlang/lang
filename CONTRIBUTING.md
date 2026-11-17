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

By contributing you agree that your contribution is licensed under the [Apache License 2.0](LICENSE).
