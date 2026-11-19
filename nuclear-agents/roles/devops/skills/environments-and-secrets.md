---
name: environments-and-secrets
description: Name every variable and secret a change needs and where each one is set (environment, CI secret store, keyring, testEnv), without ever writing a value into the repository.
title_es: Entornos y secretos
description_es: Nombrar cada variable y secreto que necesita un cambio y dónde se define cada uno (entorno, almacén de secretos de la CI, llavero, testEnv), sin escribir nunca un valor en el repositorio.
---
# Environments and secrets

1. List what the change reads: every `env("NAME", default)` in `config.nuc`, the connections and the guards.
2. For each name, where it is set: the environment of each place it runs, the CI's own secret store for the
   pipeline, `testEnv(NAME = "fake")` in `config.nuc` for the tests (a fake value, never a real one), the system's
   keyring for a provider's API key on the developer's machine (`nuclear-builder vault`).
3. A default in `env(...)` is only for what is safe to be public (a local address, a file name); a key or a
   password has no default.
4. Search the change for a value that should be a secret (a key, a token, a password, a connection string with a
   password): in the code, the tests, the documents, the CI file, the logs. One found is removed and rotated: the
   user is told, since it may already be in the history.
5. Write the names, never the values, in `deployment.md`.
