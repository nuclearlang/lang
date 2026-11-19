---
name: tdd-in-nuclear
description: Test-driven development in a Nuclear project - the tests first, see them fail, the smallest code that passes, then clean up.
title_es: TDD en Nuclear
description_es: Desarrollo guiado por tests en un proyecto Nuclear: primero los tests, verlos fallar, el código más pequeño que pasa, y luego limpiar.
---
# TDD in Nuclear

1. **The generators first.** Run the plan's `nuclear gen` and `nuclear make` calls: they write the standard code
   and its tests. Read what they wrote before writing anything.
2. **Red.** For each acceptance criterion the generated tests do not cover, write a `@test("<the criterion>")` in
   `test/<name>_test.nuc` (the skill `write-tests`), with exactly the names and signatures the plan gives. Run
   `nuclear test`: each new test must fail because the code it needs is missing or wrong. A test that does not
   compile is fixed first (`nuclear check . --json`, apply each `fix`).
3. **Green.** Write the smallest code that makes the failing tests pass, one piece at a time in the plan's order
   (the skill `write-a-piece`), `nuclear check .` after each one.
4. **Refactor.** With every test green, remove what is repeated and rename what reads badly, `nuclear test` after
   each step; never change a test's meaning.
5. Write `work-log.md`: the commands run and their results, the files written, what is left.

A test is never deleted or weakened to make it pass; a criterion no test can check is said in the work log, for QA.
