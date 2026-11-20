# Governance

## Who decides

NuclearLang is led today by its creator, **Julian Molina**, who has the final word (a "benevolent dictator" model,
usual for a young project). As maintainers join, decisions move to them by consensus, the creator deciding only
when they cannot agree.

## How a change is decided

| Change | How |
|---|---|
| A fix, a test, documentation, an example | a pull request reviewed and merged by a maintainer |
| A dialect word, a platform kind, a generator, a tool's feature | a pull request; the owner of that area reviews (`CODEOWNERS`) |
| **The base language or a platform's contract** (what every user writes) | an **RFC**: a pull request adding `docs/rfcs/NNNN-<name>.md` (the problem, the proposal, the alternatives, what breaks, the migration), open for discussion at least two weeks, decided by the maintainers and recorded as an ADR |
| A new dialect (a new target language) | an issue proposing it, then a pull request; the person who brings it usually owns it |

Every decision that shapes the project is an ADR in the `docs/03-adr/` of the project it touches, so the reasons
stay readable.

## Versions and stability

One version for the whole platform, Semantic Versioning
([ADR-platform-0011](docs/03-adr/0011-one-version-one-release.md)). While the version is `0.x`, a minor release may
change the language; each change is in the CHANGELOG with its migration (`nuclear fix` rewrites what it can). From
1.0, a change that breaks code needs an RFC and a major version.

## How to become a maintainer

Sustained, good work: merged pull requests over months, reviews that help others, care for the documents. A
maintainer invites you; you can decline. A maintainer who is away for six months becomes emeritus and can come back.

## Areas and owners

Each project of the tree (a folder with its `AGENTS.md`) can have an owner who reviews its pull requests: a
dialect, a platform, a tool, an editor. Owners are listed in `.github/CODEOWNERS` as they join.
