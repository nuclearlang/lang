---
status: approved
priority: high
owner: Julian Molina
updated: 2026-11-20
related: [design.md, tasks.md, naming.md, community.md, ../020-benchmark/requirements.md, ../../../website/docs/01-product/roadmap.md]
---
# Spec 019: Launch and growth — found by people, search engines and AI agents — Requirements

**Priority: high** (the user, 2026-11-20). NuclearLang must spread on its own: people find it when they search,
AI agents and AI chats (ChatGPT, Gemini, Claude, Copilot, Perplexity, OpenCode, Cursor) know it, recommend it and
can use it, and its launch is news.

## Goal

A developer or an agent that has never heard of NuclearLang meets it through any of these doors, and every door
leads to something that works in minutes:

1. **A search engine** (Google, Bing, DuckDuckGo): every page of the website is indexed with its own title,
   description and text.
2. **An AI chat or an AI agent** asked about "a language for AI agents", "write less code with an LLM", "one
   codebase for Flutter and FastAPI": it knows NuclearLang (it read about it, or it searches and finds it), and an
   agent can install it and use its MCP server without help.
3. **A registry** where developers and agents look for tools: the editors' stores, the MCP registries, the package
   registries, Context7.
4. **A community place**: GitHub, Hacker News, Reddit, Lobsters, dev.to, YouTube, newsletters, the press.

## What was found (2026-11-20)

- **The website is invisible.** Every route but `/` answers HTTP 404 on GitHub Pages (its 404 page loads the app,
  so a browser shows it): the 113 other URLs of `sitemap.xml` are not indexed. `/` is an empty `<div id="root">`
  filled by JavaScript, which GPTBot, ClaudeBot, PerplexityBot and most AI crawlers do not run: they see one
  title and one line.
- **Done right already:** `llms.txt` and `llms-full.txt` (the sheets agents read), `robots.txt`, `sitemap.xml`, the
  VS Code extension on the Visual Studio Marketplace (0.80.0), Open VSX publishing (its namespace waits for
  verification: EclipseFdn/open-vsx.org#16010).
- **The repository looks empty to a visitor:** 0 stars, no topics, no `CODE_OF_CONDUCT.md`, `SECURITY.md`,
  issue templates, discussions or funding; a stray file named `-` at the root; four archived `dragonfly*`
  repositories (the old name of Synapsis) in the organization; the organization has no avatar.
- **The MCP server is in no MCP registry**, the packages in no package registry, the docs not in Context7.
- **There is no public proof** that Nuclear makes cheaper models succeed: [spec 020](../020-benchmark/requirements.md).

## Requirements

### R1 — The website is readable without JavaScript (blocking: every other door leads here)
1. Every route of the website answers HTTP 200 with its content rendered in the HTML: the web platform's build
   writes `<route>/index.html` for each route (static prerender), a capability of Synapsis web (every product of
   the platform gets it), not a patch of the site.
2. Each page has its own `<title>`, `<meta name="description">`, canonical URL, Open Graph and Twitter cards (an
   image per page: the screenshots of `public/shots/`, a generated card otherwise) and JSON-LD:
   `SoftwareApplication` (name, operatingSystem, applicationCategory, offers 0, downloadUrl, softwareVersion,
   license), `SoftwareSourceCode` for the repository, `TechArticle` for guides, `FAQPage` for the FAQ,
   `BreadcrumbList`.
3. `sitemap.xml` lists only URLs that answer 200, with `lastmod`; `robots.txt` names the AI crawlers and allows
   them (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-Web, anthropic-ai, PerplexityBot, Google-Extended,
   Applebot-Extended, CCBot, Bytespider, Meta-ExternalAgent, cohere-ai, DuckAssistBot).
4. A check in the website's CI fails when a sitemap URL does not answer 200 with its title in the HTML, when a page
   has no description, or when `llms.txt` names a page that does not exist.
5. Core Web Vitals green on mobile (LCP < 2.5 s, CLS < 0.1, INP < 200 ms), measured by Lighthouse in the CI.
6. The website is registered in Google Search Console and Bing Webmaster Tools (Bing feeds ChatGPT search and
   Copilot), the sitemap submitted, IndexNow pinged on each deploy.

### R2 — Agents can learn and use NuclearLang from the outside (GEO: generative engine optimization)
1. `llms.txt` stays the index of the sheets; `llms-full.txt` the full text; both generated from the documents at
   each build (never written by hand), and listed in `robots.txt`.
2. A page per question people ask an AI ("What is NuclearLang?", "NuclearLang vs TypeScript", "How to write a
   FastAPI backend with an AI agent in fewer tokens", "One codebase for Flutter, FastAPI and React"), each answered
   in its first paragraph, with code and numbers (the benchmark of spec 020), so an AI that searches cites it.
3. **The MCP server in every MCP registry**: the official registry (registry.modelcontextprotocol.io, its
   `server.json`), Smithery, mcp.so, Glama, PulseMCP, the Docker MCP catalog, Cursor's and VS Code's MCP
   galleries; each entry with the install line and what the tools do.
4. **Context7** has the documentation (the repository registered, its `context7.json`), so the coding agents
   that use it read the real Nuclear instead of guessing.
5. A `nuclear` page on the agents' own skill or rule galleries where they exist (Claude Code skills, Cursor rules,
   the `AGENTS.md` convention): the skill the installer copies, published.
6. The knowledge base answers "where do I learn Nuclear" and "how do I install it" for an agent with no context
   (it does: `faq:install`, `nuclear_start`); measured by a sandboxed run of an agent that only has a web search.

### R3 — The repository and the organization are ready for visitors and contributors
1. The organization: its avatar (the radioactive mark of `website/public/favicon.svg`, 500×500), its profile
   README in English and Spanish, pinned repositories, a verified domain when a domain is bought.
2. The repository: description, homepage, topics (`programming-language`, `transpiler`, `compiler`, `ai-agents`,
   `llm`, `mcp`, `mcp-server`, `flutter`, `fastapi`, `nestjs`, `react`, `rust`, `code-generation`,
   `developer-tools`), a social preview image (1280×640), Discussions on, private vulnerability reporting on.
3. `README.md` in English and `README.es.md` in Spanish, each linking the other; a GIF or screenshot first, the
   install line second, a 30-second example third, the benchmark numbers fourth.
4. `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md` (private reporting, supported versions: the
   latest release), `GOVERNANCE.md` (who decides, the RFC process for the language, how a maintainer is made),
   `CONTRIBUTING.md` (also the DCO sign-off), issue and pull request templates (bug, feature, dialect request,
   language RFC), `FUNDING.yml`, `CITATION.cff`, labels (`good first issue`, `help wanted`, `dialect`, `platform`,
   `docs`, `rfc`).
5. What is dead is gone: the archived `dragonfly`, `dragonfly-backend`, `dragonfly-web`, `dragonfly-mobile`
   repositories (deleted by the user), the stray root file `-`, the remote branch `restructure-one-repository`
   when merged.

### R4 — The packages are where developers look
1. `nuclear-mcp` on PyPI (`uvx nuclear-mcp` works), `synapsis-py` on PyPI, `synapsis-nest` and `synapsis-web` on
   npm, `synapsis` on pub.dev, the compiler on crates.io (`cargo install nuclear-cli`), Homebrew (a tap first,
   homebrew-core later), Scoop and winget for Windows, the AUR. Each publish is a job of the release
   (ADR-platform-0011: one version, one snapshot); none is published by hand.
2. Each package page names NuclearLang, links the website and carries the logo.

### R5 — Content that people and models learn from
1. A blog on the website (in English, the best posts also in Spanish): the story ("why a language for AI
   agents"), each release's notes, the benchmark, tutorials by stack (FastAPI, NestJS, Flutter, React,
   LangGraph).
2. The same posts syndicated (canonical to the website) on dev.to, Hashnode and Medium.
3. Videos: a 2-minute demo (an agent builds a backend and a mobile app with Nuclear, the device inside the
   editor), one per platform, a benchmark explainer; YouTube with transcripts, shorts for X, LinkedIn and TikTok.
4. Answers where people ask (Stack Overflow, Reddit, GitHub discussions of the tools Nuclear works with), always
   disclosed, never spam.
5. "Awesome" lists: awesome-mcp-servers, awesome-ai-agents, awesome-llm-apps, awesome-programming-languages,
   awesome-flutter, awesome-fastapi, awesome-rust (each a pull request when the project meets their rules).
6. Wikipedia only when independent sources exist (press, papers): never written by us.

### R6 — The launch is news
1. **The hook is a number**: the benchmark of spec 020 ("a model at a tenth of the price builds the app with
   Nuclear and fails without it"), published with its data and its reproducible harness.
2. **One launch day**, prepared: Show HN ("Show HN: NuclearLang – a language designed to be written by AI
   agents"), Product Hunt, r/ProgrammingLanguages, r/LocalLLaMA (the local 3B agents), r/FlutterDev, r/FastAPI,
   r/rust, Lobsters, dev.to, X, LinkedIn, Bluesky, the Spanish-speaking communities; the founder answers every
   comment that day.
3. **The press and newsletters**: a press kit page (logo, screenshots, the one-paragraph description, the numbers,
   contact), pitches to The New Stack, InfoQ, DevClass, The Register, Changelog, TLDR, Console.dev, Bytes, Python
   Weekly, Flutter Weekly, Rust Weekly; podcasts (Changelog, Software Engineering Daily, Latent Space).
4. **Talks**: a lightning talk and a full talk ready (slides in the press kit), sent to Rust, Flutter, Python and AI
   conferences and local meetups.
5. **Milestones that make news later**: 1.0, the first company using it, the first community dialect, the
   benchmark's next round with new models.

### R7 — A community that grows by itself ([community.md](community.md))
Places, rituals and paths from user to maintainer; measured each month.

### R8 — What an open source project like this must take care of (design.md, "Open source")
License, trademark, contributions, security, privacy, governance, sustainability, supply chain, accessibility.

### R9 — Names a newcomer understands ([naming.md](naming.md))
The names of the projects, commands, tools and themes reviewed; the changes decided by the user, then made in one
release with the old names kept working where a user typed them.

## Measures (reported monthly in this spec's tasks.md until 1.0)

| Measure | Now | 3 months | 6 months |
|---|---|---|---|
| Indexed pages (Search Console) | 1 | 100 | all |
| GitHub stars | 0 | 500 | 2 000 |
| Marketplace + Open VSX installs | — | 1 000 | 5 000 |
| MCP registries listing `nuclear-mcp` | 0 | 6 | 8 |
| AI chats that describe NuclearLang correctly when asked (ChatGPT, Gemini, Claude, Perplexity, Copilot; with search on) | 0/5 | 3/5 | 5/5 |
| Contributors with a merged pull request | 1 | 10 | 30 |
| Community members (Discord + Discussions) | 0 | 300 | 1 500 |
