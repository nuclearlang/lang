---
name: tdd
description: Practice red-green-refactor in a Nuclear project with the platform's tools: generators first, a failing @test for each criterion, the smallest Nuclear that passes, then clean up with nuclear check and nuclear test after each step. Use when building a feature or fixing a bug test-first.
title: Test-driven development
title_es: Desarrollo guiado por tests
description_es: Practicar rojo-verde-refactorizar en un proyecto Nuclear con las herramientas de la plataforma: primero los generadores, un @test que falla por cada criterio, el Nuclear más pequeño que pasa y luego limpiar con nuclear check y nuclear test tras cada paso. Úsalo al construir una función o corregir un error con los tests primero.
kind: practice
tags: [tdd, test first, red green refactor, tests, bug fix, nuclear test, quality]
base: true
---
# Test-driven development

## When to use

Every feature with acceptance criteria and every bug fix. The tests are Nuclear (skill `testing-in-nuclear`); the
cycle is the classic one, with one difference: the standard code and its tests come from the generators before the
first red test.

## Steps

1. **Generators first.** Run the `nuclear gen resource`, `nuclear gen usecase` and `nuclear make` calls the plan
   names. They write finished code and, often, its tests. Read what they wrote: what they cover is not written
   again.
2. **List the behaviours** the generated tests do not cover: each acceptance criterion, each error path (skill
   `find-the-edge-cases` of QA), the bug's reproduction.
3. **Red.** Write one `@test("<the criterion in words>")` in `test/<name>_test.nuc`, using exactly the names and
   signatures the plan gives. Run `nuclear test`: it must **fail for the right reason** (the rule is missing or
   wrong). A test that does not compile is not red: `nuclear check --json`, apply each `fix` (`nuclear fix .`), and
   declare the missing piece's skeleton with `nuclear make` so the test compiles and fails on behaviour.
4. **Green.** Write the smallest Nuclear that makes that test pass, in the right kind and layer (a rule in a use
   case, a calculation in a service, a query in the repository). `nuclear check --json` after each file; `nuclear
   test` until green. Wire a new use case with `nuclear gen usecase`.
5. **Refactor.** With everything green: remove repetition, rename what reads badly, move logic to its layer.
   `nuclear fmt .`, `nuclear check --json` and `nuclear test` after each step. Never change a test's meaning.
6. **Repeat** for the next behaviour. One red test at a time.
7. **A bug**: first a test that reproduces it (red), then the fix (green). The test stays as the regression guard.
8. **Log**: the commands run and their results, the files written, what is left (a criterion no test can check is
   said, for QA).

## The platform's tools

- `nuclear test [-- <runner args>]`: one test by name with the runner's filter after `--`.
- `nuclear check --json`, `nuclear fix .`, `nuclear fmt .`, `nuclear explain` (a failure on its `.nuc` lines).
- `nuclear make <kind> ...`: the skeleton a red test needs to compile.
- Backend: `inject<X>()`, `appClient()`, `FakeModel([...])`; mobile and web: `@mock`, `@states`, `@widget`.
- MCP: `developer_task` runs the same cycle with the local agents (plan, tests first, code, verification, review).
- The software factory's *Tests first* station (`nuclear-builder run`) writes the red tests before *Code*; QA's
  plan of the run is `nuclear-builder checks <id>`.

## Where each test goes

| What fails | The test |
|---|---|
| A rule of a use case | `@test` calling the facade through `inject<X>()` (backend) or the class (mobile, web) |
| A route's status or guard | backend `appClient()` with and without headers |
| The states of a screen | `@states("...", expect = [...])` on its manager |
| What a screen shows | `@widget` (mobile, web) |

## Pitfalls

- Writing the code first and the test after, then calling it TDD: the test was never seen failing, so it may test
  nothing.
- A red test that is red because it does not compile: that proves nothing about behaviour.
- Writing by hand what a generator writes (a CRUD, its tests): wasted work and code the platform does not know.
- Big steps: several behaviours green at once hide which line made which test pass.
- Refactoring with a red test: the safety net is gone.
- Weakening an assertion, or deleting a test, to get green. Never.
- Testing the generated target code or `build/`: test behaviour, in Nuclear.

## Checklist

- [ ] The generators ran before the first hand-written test.
- [ ] Each new test was seen failing for the right reason before its code existed.
- [ ] Each criterion maps to at least one `@test` whose description says it.
- [ ] `nuclear check --json` prints `[]`, `nuclear fmt --check .` lists nothing, `nuclear test` is green.
- [ ] No test was deleted or weakened.
- [ ] The work log lists the commands, the files and any criterion left to QA.
