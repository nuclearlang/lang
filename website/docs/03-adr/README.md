---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [0001-the-site-sells-the-idea.md, 0002-onboardings-are-run-when-the-site-is-built.md, 0003-libraries-of-the-target-through-nuclear-add.md]
---
# Decisions of the website

A decision of this project is cited `ADR-website-NNNN`. For a new one, copy
[the template](../../../docs/03-adr/0000-template.md) with the next number. An accepted decision is not edited: a
change is a new ADR, and the old one is marked `superseded by ADR-website-NNNN`.

| ADR | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-the-site-sells-the-idea.md) | The site sells the idea: hooks on the home page, a page per tool, a page per platform from the context down to the code | accepted | 2026-11-16 |
| [0002](0002-onboardings-are-run-when-the-site-is-built.md) | Each platform's onboarding is run again when the site is built, and must give the example of the tree | accepted | 2026-11-16 |
| [0003](0003-libraries-of-the-target-through-nuclear-add.md) | A library of the target (the animations) comes through `nuclear add`, and the site stays 100% Nuclear | accepted | 2026-11-16 |

Decided elsewhere and binding here: a product is made with the platform's tools
([ADR-platform-0004](../../../docs/03-adr/0004-products-are-made-with-the-tools.md)); everything in English
(ADR-platform-0001); the web platform and its words (ADR-web-0001); packages of the target in a project
(ADR-lang-0008); the generators (ADR-codegen-0001).
