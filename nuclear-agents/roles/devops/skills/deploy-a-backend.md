---
name: deploy-a-backend
description: Deploy a project with the deploy command of its line, one environment at a time, production only after the user's approval, with a way back.
title_es: Desplegar un backend
description_es: Desplegar un proyecto con el comando deploy de su línea, un entorno cada vez, producción solo tras la aprobación del usuario, con una forma de volver atrás.
---
# Deploy a backend

1. Build what is deployed with the platform: `nuclear build` (the line's `artifacts`); the target code always comes
   from the transpiler.
2. The line's `seed`, `integration` and `deploy` commands are the deployment, in that order
   (`nuclear-builder ci deploy` runs them). Each environment the project names (for example staging and production)
   gets its own command, reading its address and keys from the environment.
3. A container image: only from what the platform builds. Where the platform cannot write the container file yet,
   say so to the user and record the missing capability in the roadmap of the tool that should write it; never
   ship a hand-written one as the decision.
4. Deploy to a test environment first; check that it answers (its health route, a request of the acceptance
   criteria).
5. Production: only from the default branch, only after the user approves, never from this station on its own.
6. Write in `deployment.md` the environments, their commands, who approves each, and how to roll back (the previous
   artifact, the migration that undoes it).
