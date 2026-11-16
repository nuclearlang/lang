---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/overview.md, ../02-architecture/content.md, ../03-adr/0001-the-site-sells-the-idea.md]
---
# Vision

## Problem
NuclearLang is free, but it still has to be chosen: a visitor must see in a minute what it gives (a minimal
language, three platforms from one codebase, tools that write the standard code, an AI loop that runs locally) and
reach the detail of whatever interests them. Its documentation is spread over the projects of the tree, each beside
its code; people need one site to read it, and search engines and agents need it without JavaScript.

## What the site does
- **Sells the idea** ([ADR-website-0001](../03-adr/0001-the-site-sells-the-idea.md)): a home page of hooks, from
  the most general to the most concrete, each a small interactive block with real output (the compiler's samples,
  an agent's mistake and its fix, the commands that make an app, one file built for two dialects).
- **A page per tool** (`/tools/<key>`) and an index of them (`/tools`): the pitch, how it starts, the index of its
  documents.
- **A page per platform** (`/platforms/<key>`), from the context down to the code as in the C4 model, and its
  **onboarding** (`/start/<key>`): the commands that build its example app, run again on every build of the site
  ([ADR-website-0002](../03-adr/0002-onboardings-are-run-when-the-site-is-built.md)).
- Publishes the reference (`docs/07-reference/`) and the guides (`docs/08-guides/`) of every project, with the code
  already highlighted (the editors' Nuclear grammar and Chernobyl theme), and a search over all of them.
- For readers without JavaScript: a plain HTML copy of every documentation page in `/static/`, `llms.txt`,
  `llms-full.txt`, the sitemap.
- Serves the installers at its root (`curl … /install.sh | sh`, `irm … /install.ps1 | iex`).
- **Proves the platform**: the site is a Synapsis web app written in Nuclear, made with the tools
  ([ADR-platform-0004](../../../docs/03-adr/0004-products-are-made-with-the-tools.md)), and uses a library of the
  target through `nuclear add` ([ADR-website-0003](../03-adr/0003-libraries-of-the-target-through-nuclear-add.md)).

## Users
- People who meet NuclearLang for the first time, and those learning or using it.
- AI agents reading `llms.txt` and the plain pages.

## Non-goals
- Holding documentation: no page of documentation is written in this project; the texts of the hooks, the tools
  and the platforms are data (`site.toml`). A context document (`00-context` … `06-runbooks`) is never published.
- A claim nobody measured, or an output nobody ran.
- Translations: the site is in English only.
