---
status: in-progress
priority: high
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, design.md, naming.md, community.md]
---
# Spec 019: Launch and growth — Tasks

Who: **agent** (an agent does it in the tree, commits and releases), **user** (only the user can: an account, a
payment, a decision, a click in a website's settings), **agent → user** (the agent prepares, the user publishes).

## Phase 1 — Readable (blocks the launch)

- [ ] T1.1 agent: spec of the web platform's prerender (`nuclear-synapsis-framework/platforms/web/docs/04-specs/`).
- [ ] T1.2 agent: the `prerender` command of the react dialect and `synapsis-web`'s renderer; `nuclear build` runs it.
- [ ] T1.3 agent: the website declares each page's head from `site.toml` (`[seo]`), turns prerender on.
- [ ] T1.4 agent: JSON-LD (`SoftwareApplication`, `SoftwareSourceCode`, `TechArticle`, `FAQPage`, `BreadcrumbList`).
- [ ] T1.5 agent: Open Graph images per page (the screenshots, generated cards for the rest).
- [ ] T1.6 agent: `robots.txt` naming the AI crawlers; `sitemap.xml` with `lastmod` and only 200 URLs.
- [ ] T1.7 agent: the website's CI check (every sitemap URL 200 with its title; descriptions; `llms.txt` links) and
      Lighthouse (Core Web Vitals green on mobile).
- [ ] T1.8 user: Google Search Console and Bing Webmaster Tools (verify the site; the agent gives the meta tag or
      file), submit the sitemap. agent: IndexNow ping in the deploy.
- [ ] T1.9 user (decision): a domain of our own (nuclearlang.dev or .org), or stay on github.io.

## Phase 2 — Presentable

- [x] T2.1 agent: the stray root file `-` removed; the old `dragonfly` build artifacts removed from `target/`.
- [ ] T2.2 user: delete the archived `dragonfly`, `dragonfly-backend`, `dragonfly-web`, `dragonfly-mobile`
      repositories (0 stars, 0 forks, moved into `lang`): `gh repo delete nuclearlang/<name> --yes` (the agent's
      permission mode does not allow deleting repositories).
- [ ] T2.3 user: the organization's avatar: upload `github-profile/profile/assets/avatar-500.png` in github.com/nuclearlang →
      Settings → Profile picture (GitHub has no API for it).
- [x] T2.4 agent: the organization's profile README in English and Spanish, with the logo.
- [x] T2.5 agent: `README.md` (English) and `README.es.md` (Spanish) at the root.
- [x] T2.6 agent: `CODE_OF_CONDUCT.md`, `SECURITY.md`, `GOVERNANCE.md`, issue and pull request templates;
      `CONTRIBUTING.md` with the DCO.
- [x] T2.7 agent: topics (14), description, Discussions on, private vulnerability reporting on (2026-11-20).
      user: upload the social preview image (`github-profile/profile/assets/social-preview.png`, 1280×640, made)
      in github.com/nuclearlang/nuclearlang → Settings → Social preview (no API).
- [ ] T2.8 agent: labels done (`good first issue`, `help wanted`, `dialect`, `platform`, `docs`, `rfc`); left: the first ten
      `good first issue` issues, each with what, where and how to test.
- [ ] T2.9 agent: `FUNDING.yml`, `CITATION.cff`, `TRADEMARKS.md`, `PRIVACY.md`. user: open GitHub Sponsors and Open
      Collective accounts.
- [ ] T2.10 user (decisions): each line of [naming.md](naming.md). agent: the renames decided, one release.

## Phase 3 — Findable

- [ ] T3.1 agent: `server.json` of `nuclear-mcp`; publish to the official MCP registry from the release (its GitHub
      OIDC login). agent → user: Smithery, mcp.so, Glama, PulseMCP, the Docker MCP catalog (forms or pull requests).
- [ ] T3.2 agent → user: Context7 (`context7.json`, register the repository).
- [ ] T3.3 agent: reserve and publish the packages from the release (PyPI `nuclear-mcp`, `synapsis-py`; npm
      `synapsis-nest`, `synapsis-web`; pub.dev `synapsis`; crates.io `nuclear-cli`), trusted publishing each.
      user: the accounts and each registry's trusted publisher (as the Marketplace).
- [ ] T3.4 agent: Homebrew tap, Scoop bucket, winget manifest, AUR package, updated by the release.
- [ ] T3.5 Open VSX namespace verified (EclipseFdn/open-vsx.org#16010, done 2026-11-20); release.yml publishes with
      trusted publishing once the secret is gone (done). Left, user: register the trusted publisher on open-vsx.org
      (nuclearlang/nuclearlang, release.yml), delete `OVSX_PAT`.
- [ ] T3.6 agent: the pages that answer the questions people ask an AI (R2.2).
- [ ] T3.7 agent: signing and provenance of the release archives (cosign or minisign, GitHub artifact
      attestations, an SBOM per archive); user: Apple Developer and a Windows code-signing certificate (paid).
- [ ] T3.8 agent: pull requests to the awesome lists that accept the project.
- [ ] T3.9 agent: Nuclear in GitHub Linguist with the extensions `.nuc` and `.nuclear` (both free there today; the
      grammar is public in `nuclearlang/nuclear-tmlanguage`): the pull request (`languages.yml`, `samples/Nuclear/`,
      `script/add-grammar`) once they are in 200 repositories of several owners; then `.gitattributes` loses its
      `linguist-language` lines.

## Phase 4 — Launch (after phases 1-3 and spec 020's first round)

- [ ] T4.1 agent: the blog on the website; the first posts (the story, the benchmark, a tutorial per stack).
- [ ] T4.2 agent: the press kit page (logo, screenshots, description, numbers, contact).
- [ ] T4.3 agent → user: the 2-minute demo video (the agent scripts and records the screen; the user narrates or
      approves a generated voice), one per platform.
- [ ] T4.4 agent → user: the launch posts written (Show HN, Product Hunt, each subreddit, Lobsters, dev.to, X,
      LinkedIn, Bluesky, Spanish communities); the user posts them on one day and answers.
- [ ] T4.5 agent → user: the press pitches and the newsletter submissions; the user sends them.
- [ ] T4.6 agent → user: the talk (slides and script); the user submits it to conferences.

## Phase 5 — Grow

- [ ] T5.1 user: Discord server (the agent writes the channels, rules and bots' configuration).
- [ ] T5.2 agent: the monthly measures of requirements.md, written below.
- [ ] T5.3 agent: content every week (a post, a clip), the monthly call's agenda.
- [ ] T5.4 agent: the benchmark leaderboard on the website, updated with each new model (spec 020).

## Measures

| Month | Indexed pages | Stars | Installs | MCP registries | AI chats correct | Contributors | Members |
|---|---|---|---|---|---|---|---|
| 2026-11 | 1 | 0 | — | 0 | 0/5 | 1 | 0 |
