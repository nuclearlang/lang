---
name: write-user-stories
description: Write one user story per thing a user can do after the change, with its acceptance criteria.
title_es: Escribir historias de usuario
description_es: Escribir una historia de usuario por cada cosa que un usuario puede hacer después del cambio, con sus criterios de aceptación.
---
# Write user stories

One story per thing a user (a person, or a program that calls the API) can do now that they could not before:

    As <who>, I want <what>, so that <why>.

Under each story, the acceptance criteria of the analysis it covers, as they were checked (with the check's id).
Use the names the user sees (the screen, the route, the button), not the code's. A change that a user cannot see (a
refactor, a fix of the build) gets no story: say so in one line.
