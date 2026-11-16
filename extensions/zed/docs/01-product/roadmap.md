---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../../../docs/01-product/roadmap.md, ../02-architecture/overview.md]
---
# Roadmap of the Zed extension

What is common to the three editors, also what was never tried in a running Zed:
[the editors' roadmap](../../../docs/01-product/roadmap.md).

## Pending

- `extension.toml` reads the grammar from a commit of the repository `nuclearlang/nuclear-zed`
  (`[grammars.nuclear]`: `repository`, `path = "grammar"`, `rev`). The grammar is now a folder of this tree, with no
  git of its own: a published extension needs a repository and a commit that hold it.
  `TODO(human): which repository does the published Zed extension read its grammar from?`
