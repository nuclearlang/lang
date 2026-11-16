# Changelog

All notable changes to synapsis-mobile are written here; versions follow [Semantic Versioning](https://semver.org).

## Unreleased

- `nuclear add|remove <package>` is `flutter add|remove` (ADR-lang-0008); adding a package no longer fails in an app
  without the AI plugin.
- First public version.
- `[[generators]]` in the platform: `nuclear gen` writes a resource's models, repository, use cases, screen with its state manager and tests (ADR-codegen-0001).
- `[[generators.usecase]]`: `nuclear gen usecase` adds a use case's alias to its component's facade and, with `--calls`, writes a use case over a repository method (ADR-codegen-0001).
- `[[generators.resource]]`: the repository is merged (`merge = true`), so an action added to a resource that exists gets the members it lacks (ADR-developer-0001).
