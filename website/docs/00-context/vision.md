---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/overview.md, ../02-architecture/content.md]
---
# Vision

## Problem
The documentation of NuclearLang is spread over the projects of the tree, each beside the code it describes. People
need one site to read it; search engines and agents need it without JavaScript.

## What the site does
- Publishes the reference (`docs/07-reference/`) and the guides (`docs/08-guides/`) of every project, with the code
  already highlighted (the editors' Nuclear grammar and Chernobyl theme).
- A home page whose sample is transpiled by the real compiler to TypeScript, Dart and Python at build time.
- A search over the titles, headings and words of every page.
- For readers without JavaScript: a plain HTML copy of every page in `/static/`, `llms.txt`, `llms-full.txt`
  ([ADR-lang-0010](../../../nuclearlang/docs/03-adr/0010-compiler-helps-editors-and-agents.md)), the sitemap.
- Serves the installers at its root (`curl … /install.sh | sh`, `irm … /install.ps1 | iex`).
- Proves the web platform: the site is a Synapsis web app written in Nuclear.

## Users
- People learning or using Nuclear and Synapsis.
- AI agents reading `llms.txt` and the plain pages.

## Non-goals
- Holding content: no page is written in this project. A context document (`00-context` … `06-runbooks`) is never
  published.
- Translations: the site is in English only.
