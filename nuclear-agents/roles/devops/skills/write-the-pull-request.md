---
name: write-the-pull-request
description: After the user approves, make the branch, the commit in the user's name and the pull request with gh; never merge.
title_es: Escribir el pull request
description_es: Cuando el usuario aprueba, crear la rama, el commit a nombre del usuario y el pull request con gh; nunca fusionar.
---
# Write the pull request

1. Write `specs/<id>/pr.md` from the template: what changed, why (the spec), how it was checked (the checks and
   their results), what is left, the documents changed.
2. Stop at the gate: the user reads `pr.md` and the change, and approves or asks for changes.
3. Approved: a branch named after the spec (`spec/<id>-<short-title>`) from the current one, never the default
   branch itself; a commit of the change in the user's name (the git identity of the project), with the spec's title
   as its subject and no co-author line unless the user asks for one.
4. `git push -u origin <branch>`, then `gh pr create --title "<title>" --body-file specs/<id>/pr.md`; give the user
   the link.
5. Never merge, never approve the pull request, never push to the default branch: the merge is the user's.
