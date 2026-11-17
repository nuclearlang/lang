# Changelog

All notable changes to nuclear-zed are written here; versions follow [Semantic Versioning](https://semver.org).

## Unreleased

- 0.53.0: the bundled dialects: Python's `print` with named arguments, a `for` over `m ?? {}` (also Dart), a conditional spread, `a?.b ?? c`; a typed value at the top of a file is a value, not a declaration; a local or a member no longer imports another file of the project.
- 0.52.2: the AI set-up checks that the Smart Graph's and the Nuclear Developer's ports can be listened on and takes the next free one when another program holds 7878 or 7879, written to `ai.env`, which the editor, the graph and the MCP server read (ADR-installer-0003).
- 0.52.1: the repository is `nuclearlang/lang` (was `nuclearlang/nuclear`): the extension's `repository` and `bugs`, and the installer address Nuclear Builder suggests.
- 0.52.0: the version of the three extensions (HTTP Connections and Nuclear Atlas renamed in VS Code and Android Studio; nothing changes in Zed).
- 0.51.0: the version of the three extensions (one repository: the extension is `extensions/zed/`; the framework's commands of its tasks are `nuclear <command>`).
- First public version.
- 0.46.0: the version of the three extensions (the Builder's analysis step is in `nuclear-builder`, ADR-developer-0001).
- 0.48.0: the version of the three extensions (the set-up of the AI services is `nuclear-builder setup`, ADR-installer-0002).
- 0.49.0: the version of the three extensions (the Builder's graph of a run, any step run again and a run from scratch are in VS Code and `nuclear-builder`; the language server reads `[project] package` of `nuclear.toml`).
