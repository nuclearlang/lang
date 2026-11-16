# Changelog

All notable changes to dragonfly-web are written here; versions follow [Semantic Versioning](https://semver.org).

## Unreleased

- `dependencies(...)` in `config.nuc` and `[toolchain] package_*` in react: `dragonfly add|remove <package>` installs
  any npm package and generates its type definitions (ADR-lang-0008).
- First public version.
- `[[generators]]` in the platform: `dragonfly gen` writes a resource's models, repository, use cases, view with its state manager and tests (ADR-codegen-0001).
- `[[generators.usecase]]`: `dragonfly gen usecase` adds a use case's alias to its component's facade and, with `--calls`, writes a use case over a repository method (ADR-codegen-0001).
- `[[generators.resource]]`: the repository is merged (`merge = true`), so an action added to a resource that exists gets the members it lacks (ADR-developer-0001).
