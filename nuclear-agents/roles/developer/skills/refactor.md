---
name: refactor
description: Change the structure of the code without changing what it does, every step green.
title_es: Refactorizar
description_es: Cambiar la estructura del código sin cambiar lo que hace, cada paso en verde.
prompt: refactor
---
# Use case: a refactor

Change the structure of the code named in the spec without changing what it does.

1. Run `synapsis_test` first: the tests that pass now must pass at the end, and none may be deleted.
2. Find every caller of what you move or rename (search the project; `nuclear_check` after each step tells you
   what broke). Keep the architecture of the platform: a use case is only used from its appcomponent; other
   components only see the appcomponent.
3. Make the change in small steps, each one green (`nuclear_check` reports `ok`).
4. Hand mechanical rewrites (rename a field in N files, split a file) to the local developer one file at a time.
5. Report what moved, what was deleted and why.
