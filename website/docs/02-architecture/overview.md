---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [content.md, ../../../nuclear-synapsis-framework/platforms/web/docs/07-reference/web.md]
---
# Architecture of the app

A web project of Synapsis (`config.nuc`: `synapsis(platform = "web", dialect = "react")`, `app(name =
"nuclearlang_website", ...)`) with one component, `components/docs/`. It reads only the JSON that
[`tools/content.mjs`](content.md) writes into `public/content/`.

```
config/project_config.nuc        Http(baseUrl = "/", timeout = 10000): the site reads its own public/content/
main.nuc                         App: the router with every @screen
components/docs/
  data/content_repository.nuc    @get ":key.json", "site.json", "search.json", "home.json" (cached)
  domain/models/                 Page, Site, SearchEntry, Home, ContentError
  domain/usecases/               GetPage, GetSite, GetHome, Search
  domain/services/search_score   the ranking of the search
  presentation/home/             HomeScreen "/" + HomeManager
  presentation/doc/              DocScreen "/:area/:name", DocGroupScreen "/:area/:group/:name",
                                 NotFoundScreen; PageManager
  presentation/layout/           the layout (top bar, menu, footer), the search box; SiteManager, SearchManager
public/styles.css, favicon.svg   the look: the Chernobyl palette of the editors (dark) and a light theme
test/docs_test.nuc               the search ranking, the pages and the home page (the repository is a mock)
```

## A page

`GetPageUseCase` turns an address into a content key: the parts of the path joined by `--`
(`/nuclearlang/guide/README` → `content/nuclearlang--guide--README.json`). Every address has three parts, the depth
`DocGroupScreen` (`/:area/:group/:name`) routes. The page's HTML comes
ready (highlighted at build time): the browser never parses markdown.

A link between pages reloads the page (the content is cached by the browser); navigation by address inside the app
is pending in the web platform ([its roadmap](../../../nuclear-synapsis-framework/platforms/web/docs/01-product/roadmap.md)).

## Build and test

`nuclear build` writes the app into `build/app` (with `public/` copied), `nuclear install` runs `npm install` there,
`nuclear test` runs vitest over `test/`, `npx vite build` in `build/app` writes the bundle to `build/app/dist`. The
CI (`.github/workflows/website.yml`) installs `nuclear` from the tree and runs the same steps.
