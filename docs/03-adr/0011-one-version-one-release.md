---
status: accepted
date: 2026-11-20
deciders: Julian Molina
---
# ADR-platform-0011: One version for the whole platform; a release is one snapshot

## Context and problem
NuclearLang is many projects that work together: the compiler and its CLI, the language server, the devices, the
dialects and their runtimes (synapsis-py, synapsis-nest, synapsis-web, synapsis), the Smart Graph and its knowledge
base, the MCP server, the local agents, Nuclear Builder, Nuclear Chat, and the editors' extensions. Each one carried
its own version (the CLI 0.1.16, the extensions 0.79.0, Zed 0.74.0, the graph 0.2.0, the rest 0.1.0), so a number
said nothing about what goes with what. The stores update the extension by themselves, so an extension could run
over an older `nuclear`; and the release of 0.1.16 was published with a knowledge base that did not have the
documents of that same release, with nothing to stop it.

## Decision
1. **One version for every project**: `version` of `[workspace.package]` in the root `Cargo.toml`, written into
   every manifest and lock file by `installer/release/version.sh <version>` and checked by
   `installer/release/version.sh --check` (Semantic Versioning: [coding.md](../05-standards/coding.md#git)). A change
   to any project raises the version of all of them.
2. **A release is one snapshot.** The tag `v<version>` builds everything from the same commit, and the release
   workflow builds nothing when a project carries another version or when the knowledge base
   (`nuclear-graph-storage/data`) was not built at that version (its component rows name each one's version). The
   CI runs the same check on every push.
3. **An installation is one snapshot.** The public installers install the binaries, the AI services (`ai/`) and the
   editor extension of one release, each folder with its `.version`.
4. **Nothing is blocked; the parts are brought together.** At start the VS Code extension compares its version with
   the installation's `.version` (and `ai/.version`): an extension newer than the installation (the store updated
   it) offers `nuclear update`, which installs the newest release whole; an older one offers the extension of the
   installed release; AI services of another version offer `nuclear update`. A build from source has no `.version`
   and is not compared.

## Consequences
- The numbers jumped: every project went to 0.80.0, the first number above every published one (the stores accept
  only a higher version than their last).
- A fix to one project makes a release of all of them; the archives and the stores carry the same number.
- The knowledge base is rebuilt (`nuclear-graph knowledge build`) after the version changes, before the tag.
- The JetBrains plugin and the Zed extension do not compare versions yet (roadmap of the editors).
