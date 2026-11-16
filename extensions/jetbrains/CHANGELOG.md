# Changelog

All notable changes to nuclear-jetbrains are written here; versions follow [Semantic Versioning](https://semver.org).

## Unreleased

- 0.52.0: the tool window Nuclear Connector is now HTTP Connections (its code in `extensions/tools/nuclear-http-connections/jetbrains/`, the class `HttpConnections`).
- 0.51.0: the version of the three extensions (one repository; the tool windows Nuclear Builder and HTTP Connections, their code in `extensions/tools/<tool>/jetbrains/`; Synapsis; the framework's commands are `nuclear <command>`).
- First public version.
- 0.46.0: the version of the three extensions (the Builder's analysis step is in `nuclear-builder`, ADR-developer-0001).
- 0.48.0: the version of the three extensions (the set-up of the AI services is `nuclear-builder setup`, ADR-installer-0002).
- 0.49.0: the version of the three extensions (the Builder's graph of a run, any step run again and a run from scratch are in VS Code and `nuclear-builder`; the language server reads `[project] package` of `nuclear.toml`).
