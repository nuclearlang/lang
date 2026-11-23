---
status: draft
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, design.md, ../008-restructure/requirements.md]
---
# Spec 019: Launch and growth — The names

A newcomer meets the names before the code. This is the review of every public name, what makes each one easy or
hard, and the proposals. **Nothing here is changed until the user decides each line** (rule 8): a rename is one
release, with the old command or setting still working where a user typed it.

## What works

- **NuclearLang** as the brand and **`nuclear`** as the command; **`.nuc`** as the extension: short, unique enough
  to search ("NuclearLang" has no other meaning), memorable.
- **Synapsis** for the framework (mobile, backend, web): a word with a meaning (connections), easy in English and
  Spanish.
- The verbs of the command: `new`, `gen`, `make`, `build`, `run`, `test`, `check`, `fix`, `add`, `update`.

## What is hard, and the proposals

| Today | Where | Why it is hard | Proposal |
|---|---|---|---|
| repository `lang` | github.com/nuclearlang/nuclearlang | generic: "nuclearlang/nuclearlang" says "lang" twice, and a search for the project finds nothing by the repo's name | rename to `nuclearlang/nuclearlang` (GitHub redirects the old URL, clones keep working) |
| folder `nuclearlang/` inside the repository | the tree | the repository and one folder have the same name | `language/` (or `compiler/`) |
| `nuclear-synapsis-framework/` | the tree | long; "nuclear" and "framework" add nothing | `synapsis/` |
| `nuclear-graph-storage/`, command `nuclear-graph`, product "the Smart Graph", chat "Nuclear Atlas" | the tree, the CLI, the docs, the editor | four names for two things (the knowledge base, the chat that asks it) | the knowledge base is **Nuclear Graph** everywhere (folder `graph/`, command `nuclear-graph`); the chat stays **Atlas** |
| `nuclear-agents/nuclear_developer`, "Nuclear Developer", port 7879 | the tree, the docs | underscore and hyphen in the same path; "Developer" reads as a person | folder `agents/`; the product **Nuclear Agents** (the local agents) |
| `tools/code_generator`, crate `nuclear-codegen`, commands `gen`/`make` | the tree | three names; underscore | folder `tools/codegen/` |
| `device-emulators/`, crate `nuclear-devices`, commands `device`, `terminal-device` | the tree, the CLI | "emulators" is wrong (they are devices that run the app, not emulators) | folder `devices/` |
| "Nuclear Builder", `nuclear-builder`, its "software factory", "teams", "members" | the editor, the CLI | fine as a product; "factory" and "Builder" both describe it | keep **Builder**; say "Builder" in the UI, not "the factory" |
| "Nuclear Chat", `nuclear-chat` | the editor | clear | keep |
| "Nuclear Monitor", "HTTP Connections", "Devices" | the editor | clear | keep |
| the themes **Chernobyl** and **Chernobyl Soft** | the editors, the website | a real disaster that killed people: press and companies may find it in bad taste, and it ties the brand to danger at launch | rename to a name of the same palette without the tragedy (e.g. **Isotope** and **Isotope Soft**, or **Radium**); the old theme ids keep working |
| the radioactive mark ☢ | the logo | strong and recognizable, but a hazard sign | keep (it is the brand), soften with the green glow already used; never paired with disaster imagery |
| "dialect" | the docs | accurate but uncommon for "target" | keep in the docs; the website's first pages say "target (dialect)" once |
| "platform" vs "dialect" | the docs | right and already consistent: platform = what you write (web, mobile, backend), dialect = the language underneath | keep, explained on the first page |
| `synapsis` on pub.dev, npm, PyPI | the registries | "synapsis" alone may be taken | reserve `synapsis-*` names, or publish as `nuclear-synapsis*` if taken |

## How a rename is done (when decided)

1. One spec per rename group, listing every reference (`git grep`), the compatibility kept (an alias command, a
   setting moved on read, a theme id mapped), and the knowledge base rows.
2. One release (ADR-platform-0011): the version rises for everything.
3. The website, the READMEs, the stores and the registries updated the same day.
