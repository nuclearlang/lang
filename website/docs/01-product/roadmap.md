---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/overview.md, ../02-architecture/content.md]
---
# Roadmap

The pending work of the website. A done item is deleted. What the site found missing in the tools it is made with is
recorded in each tool's roadmap: the web platform (navigation by address, no DOM globals, a deploy story), the code
generator (a screen keyed by an `id` the model lacks, no single-object resource, no app-wide shared view), the
compiler (an arrow passed where a `void` callback is expected passes `nuclear check` and fails `tsc`).

## To decide with the user

- **Publishing at nuclearlang.github.io from this tree is not wired.** The domain is served only from the
  `nuclearlang.github.io` repository; the site's old repository still deploys the old content. The CI
  (`.github/workflows/website.yml`) builds and tests the bundle but publishes nothing. How: a token that pushes the
  bundle to that repository, or a Pages workflow there that checks out this one.

## Untested

- The animations on Safari and Firefox: checked only in a Chromium browser (Brave, headless, desktop and phone
  widths) and in the tests (where they are skipped).

## Pending

- **Old links break.** Every page has a new address (`/<project>/<reference|guide>/<name>`, e.g.
  `/nuclearlang/guide/README`); links to the old addresses (`/docs/language/...`, `/spec/...`) lead nowhere.
  TODO(human): redirects from the old addresses, or accept the break?
- **The screens of the tools and the platforms have no plain copy.** `/tools`, `/tools/<key>`, `/platforms/<key>`
  and `/start/<key>` are in the sitemap but not in `/static/` nor `llms.txt`: an agent that reads without
  JavaScript does not see them (their texts are in `site.toml`, their detail in the pages they link, which are).
