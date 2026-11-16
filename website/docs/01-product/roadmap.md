---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/overview.md, ../02-architecture/content.md]
---
# Roadmap

The pending work of the website. A done item is deleted. What the site found missing in the web platform (navigation
by address, the state builder's callback types, attributes like `aria-label`, a deploy story) is in
[the web platform's roadmap](../../../nuclear-synapsis-framework/platforms/web/docs/01-product/roadmap.md).

## To decide with the user

- **Publishing at nuclearlang.github.io from this tree is not wired.** The domain is served only from the
  `nuclearlang.github.io` repository; the site's old repository still deploys the old content. The CI
  (`.github/workflows/website.yml`) builds and tests the bundle but publishes nothing. How: a token that pushes the
  bundle to that repository, or a Pages workflow there that checks out this one.

## Pending

- **Old links break.** Every page has a new address (`/<project>/<reference|guide>/<name>`, e.g.
  `/nuclearlang/guide/README`); links to the old addresses (`/docs/language/...`, `/spec/...`) lead nowhere.
  TODO(human): redirects from the old addresses, or accept the break?
