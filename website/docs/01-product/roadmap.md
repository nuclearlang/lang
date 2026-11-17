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

## Half done

- **The site is published from the `nuclearlang.github.io` repository**, whose only file of substance is a workflow
  that checks out this tree's `main`, builds `website/` and deploys it: by hand, every day, or on a
  `repository_dispatch` of type `website`. A push to this tree does not publish at once: the tree's CI
  (`.github/workflows/website.yml`) has no token to send that dispatch. TODO(human): a token (a fine-grained one with
  Actions write on `nuclearlang.github.io`, as a secret here), or is the daily run enough?

## Untested

- **The Cursor page** says the VS Code extension runs in Cursor, as the user states; no Cursor was at hand to open it.
- **The install block** shows the one-line installers; they need a published release, and there is none yet
  (`installer/` roadmap).
- The animations on Safari and Firefox: checked only in a Chromium browser (Brave, headless, desktop and phone
  widths) and in the tests (where they are skipped). The same for the screenshots' tilted windows and callouts,
  and for the logos' colour per theme (an SVG `<img>` that reads `prefers-color-scheme`).

## Pending

- **Example apps for the agent onboarding.** Its prompts (`[[onboarding]] prompts`: a todos API, an orders API, an AI
  agent endpoint, a notes app, a chat with Genkit...) have no app made from them yet, nor a page that shows what an
  agent writes for each. Asked by the user (2026-11-16) for later.
- **A publish can mix the new app with the old content for about ten minutes.** The bundle's name changes with each
  build, `content/*.json` keep theirs, and GitHub Pages caches them (`max-age=600`): a reader who loads the new app
  with a cached `home.json` of the shape before sees "Loading…" (`Cannot read properties of undefined (reading
  'map')`), until a reload without cache. Seen on 2026-11-16. The fix: each publish's content under a path of its
  own (`content/<version>/…`), which the app's repositories (written by `nuclear gen resource`, a fixed `--path`)
  cannot name today; it needs a way in the generator or the web platform to give the build's version to a path.
- **Old links break.** Every page has a new address (`/<project>/<reference|guide>/<name>`, e.g.
  `/nuclearlang/guide/README`); links to the old addresses (`/docs/language/...`, `/spec/...`) lead nowhere.
  TODO(human): redirects from the old addresses, or accept the break?
- **The screens of the tools and the platforms have no plain copy.** `/tools`, `/tools/<key>`, `/platforms/<key>`
  and `/start/<key>` are in the sitemap but not in `/static/` nor `llms.txt`: an agent that reads without
  JavaScript does not see them (their texts are in `site.toml`, their detail in the pages they link, which are).
