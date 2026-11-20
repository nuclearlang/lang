# Changelog

All notable changes to synapsis-mobile are written here; versions follow [Semantic Versioning](https://semver.org).

## Unreleased

- Environments (spec 021): `env("NAME", "default")` in a mobile app reads the values of the environment it was built
  for, constants of the build (`nuclear build --env <name>`); a secret read by the app is N0311. The example
  `clean-flutter-project` reads `API_URL`.
- The flutter dialect's example `dart_extension` has its first comment in English (it was in Spanish), its output regenerated.
- Fixed: an `Http` connection whose `baseUrl` has no final `/` (`https://jsonplaceholder.typicode.com`, as `nuclear gen
  --source rest:<url>` writes it) sent every request to a wrong host. Found by the onboarding app `todos_app`.
- `examples/onboarding/todos_app` and the guide `onboarding-mobile.md`: a todos app made only by the tools.
- `nuclear add|remove <package>` is `flutter add|remove` (ADR-lang-0008); adding a package no longer fails in an app
  without the AI plugin.
- First public version.
- `[[generators]]` in the platform: `nuclear gen` writes a resource's models, repository, use cases, screen with its state manager and tests (ADR-codegen-0001).
- `[[generators.usecase]]`: `nuclear gen usecase` adds a use case's alias to its component's facade and, with `--calls`, writes a use case over a repository method (ADR-codegen-0001).
- `[[generators.resource]]`: the repository is merged (`merge = true`), so an action added to a resource that exists gets the members it lacks (ADR-developer-0001).
