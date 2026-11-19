---
name: plan-the-checks
description: Write the test plan - functional and non-functional checks, edge cases, security, good practices, load - for the user to approve before anything runs.
title_es: Planificar las comprobaciones
description_es: Escribir el plan de pruebas (comprobaciones funcionales y no funcionales, casos límite, seguridad, buenas prácticas, carga) para que el usuario lo apruebe antes de que corra nada.
---
# Plan the checks

1. One **functional** check per acceptance criterion: what is done, what must happen, the test or command that
   shows it.
2. The **edge cases** of each action (the skill `find-the-edge-cases`).
3. **Security**: the security review of the change (the skill `review-security`), and one check per trust boundary
   it touches (a route, a form, a file, a secret).
4. **Good practices**: the review of the skill `review-good-practices`.
5. **Non-functional**: what the analysis names in numbers (time, load, size), each with its tool and its threshold
   (the skill `measure-load-and-performance`). A criterion without a number gets none: ask instead.
6. For each check: `id`, title, kind, who runs it (`role`, or `user` when it needs the user's machine, an account,
   a device or a judgment), the command or the steps, and what passes. Switch on by default what is cheap and safe;
   a load test is off until the user switches it on.
7. Write `test-plan.md`, put the checks in the run's list and stop: the user approves, changes, adds and runs theirs.
