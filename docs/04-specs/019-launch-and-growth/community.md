---
status: approved
priority: high
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, design.md, tasks.md]
---
# Spec 019: Launch and growth — The community

A community is people who come back. It needs places to meet, reasons to come back, and a path from first visit to
maintainer.

## Who it is for

1. **Developers who build with AI agents** and pay for tokens: the main audience (the benchmark speaks to them).
2. **People who run local models** (r/LocalLLaMA): the 3B local agents and the private Smart Graph speak to them.
3. **Flutter, FastAPI, NestJS and React developers**: one codebase for their stack and the others.
4. **Language and compiler people**: dialects as data, a transpiler in Rust; future dialect authors.
5. **The Spanish-speaking community** (Latin America and Spain): the founder speaks it, the docs and the editor
   speak it, and few new languages serve it first; an advantage to use from day one.

## The places

| Place | For | Started in |
|---|---|---|
| GitHub Discussions | questions, ideas, show and tell, RFCs (searchable, indexed by search engines and models) | phase 2 |
| Discord (or Zulip) | live help, the channels: `#help`, `#show-and-tell`, `#dialects`, `#agents`, `#español`, `#contributors` | phase 4 |
| X, Bluesky, LinkedIn, Mastodon | news, clips, releases | phase 2 |
| YouTube | demos, tutorials, streams | phase 4 |
| A monthly newsletter (Buttondown or GitHub releases digest) | what changed, community projects | phase 5 |

Answers go in Discussions when they help others (a search engine finds them; a chat does not).

## The rituals (reasons to come back)

- **A release every week or two**, with notes written for humans and a clip.
- **A monthly community call / stream**: what shipped, a live build with an agent, questions.
- **Show and tell**: the best project of the month featured on the website and the newsletter.
- **The benchmark leaderboard** (spec 020): each new model measured with and without Nuclear; people return to see
  where their favorite model lands, and send runs.
- **Challenges**: "build X with Nuclear and a 3B model", with a page of results.

## The path from user to maintainer

1. **First contact**: the website, a 2-minute install, a first app in 10 minutes (the tutorial, tested in the CI).
2. **First contribution**: issues labelled `good first issue` (always at least ten open, each with what to change,
   where, and how to test it), docs fixes, examples, translations.
3. **Regular contributor**: a dialect word, a platform kind, a generator, a dialect's reference equivalences;
   recognized in the release notes and an `all-contributors` table.
4. **Dialect or tool owner**: owns a dialect (a new target, e.g. Kotlin, Swift, Go) or a tool, reviews its pull
   requests (`CODEOWNERS`).
5. **Maintainer**: invited after sustained work (GOVERNANCE.md).

What makes this path real: every project documents itself (root rule 7), so a newcomer opens one `AGENTS.md` and
knows where to work; the CI tells them when they are done; a maintainer reviews within three days.

## Open to contributions where it is easiest to start

- **New dialects**: they are TOML and templates (no compiler code): the best entry for language people.
- **Examples and templates**: an app per stack, each a test of the platform.
- **Type definitions** of libraries (`nuclear add` generates them; curated ones help everyone).
- **Translations** of the website and the editors.
- **The benchmark**: new tasks, new models, new harnesses.

## Measured monthly

New stars, new members, questions answered and time to first answer, first-time contributors, returning
contributors, open `good first issue` count, Discussions threads, Discord active members.
