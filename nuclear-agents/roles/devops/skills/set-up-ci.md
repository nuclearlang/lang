---
name: set-up-ci
description: Set up or fix the project's CI from its line with nuclear-builder line and nuclear-builder export; never write the CI file by hand.
title_es: Montar la CI
description_es: Montar o arreglar la CI del proyecto desde su línea con nuclear-builder line y nuclear-builder export; nunca escribir el fichero de CI a mano.
---
# Set up CI

The library's skill `ci-pipelines` has the details; this is the station's part.

1. Read the line: `nuclear-builder line show`. Its `commands` (check, build, test, security, artifacts, seed,
   integration, deploy) are what every stage runs; its `branches` are where the CI runs.
2. A command missing or wrong: `nuclear-builder line set commands=<json>`; never edit the exported file.
3. Export the CI the project uses: `nuclear-builder export github`, `gitlab` or `bitbucket`. Each stage of the file is
   one `nuclear-builder ci <stage>`.
4. Run the stages here before pushing: `nuclear-builder ci check`, then `ci test`, `ci security`, `ci artifacts`.
5. A pipeline that fails on the server: read the stage that failed, run it here, fix the cause (the code, or the
   line's command), export again when the line changed.
6. Say in `deployment.md` which stages run and on which branches.
