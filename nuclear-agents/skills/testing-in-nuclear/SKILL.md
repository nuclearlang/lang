---
name: testing-in-nuclear
description: Write and run tests in Nuclear for each Synapsis platform: test/<name>_test.nuc, @test, mocks of repositories, state and widget tests, the backend's appClient, and nuclear test. Use when a task adds tests, a test fails, or code must be proven before it is done.
title: Testing in Nuclear
title_es: Tests en Nuclear
description_es: Escribir y ejecutar tests en Nuclear para cada plataforma de Synapsis: test/<nombre>_test.nuc, @test, mocks de repositorios, tests de estados y de widgets, el appClient del backend y nuclear test. Úsalo cuando una tarea añade tests, un test falla o hay que probar el código antes de darlo por hecho.
kind: technology
tags: [testing, tests, unit tests, mock, nuclear test, widget test, states, appclient]
---
# Testing in Nuclear

## When to use

Every change: tests are written in Nuclear, in `test/`, and `nuclear test` runs them through the dialect's runner
(pytest or node:test on the backend, flutter test on mobile, vitest on the web). Never write a test in the target
language.

## Steps

1. **Let the generators write the first tests.** `nuclear gen resource` writes them (a database resource on the
   backend; on mobile and web, a test with the repository mocked). A new file: `nuclear make tests <component>
   <Name>` (backend, web) or `nuclear make test <component>` (mobile).
2. **Write one `@test("what it checks")` per behaviour**, the description saying the rule in words.
3. **Backend** (`nuclear help backend` §2.14): `tests Name`; the app runs with its connections and databases in
   memory; `inject<X>()` gives an instance; `expect(condition)` asserts; `FakeModel(["answer"])` replaces a chat
   model; `appClient()` calls the app over HTTP and its WebSocket (`~app.get(path, headers = ...)`, `post`, `put`,
   `patch`, `delete`, `~app.socket(...)`). `testEnv(NAME = "value")` in `config.nuc` sets the tests' environment.
4. **Mobile** (`nuclear help flutter` §8): a file is one group, no header word; `@mock([CharacterRepository])` on the
   group; `when(() => CharacterRepository.getPage(1)).thenReturnAsync(Ok(page()))`; a `Result` is compared with
   `isOk`, `isErr`, `isOkWith(v)`, `isErrWith(e)`; `@states("...", expect = [...])` tests a manager; `@widget` a
   screen; `@offline` disconnects the network; `setUp()`/`tearDown()` hooks. Integration tests in
   `integration_test/` (`nuclear make integration <name>`) run with `nuclear test --integration -- -d <device>`.
5. **Web** (`nuclear help web` §4): `@mock([Class])` with `when(Class.method).thenReturn(value)` and `verify`;
   `okOf(result)`, `errOf(result)`; `@states`; `@widget` renders a screen (`renderScreen(...)`) and reads it with
   `screen`; `beforeEach()`/`afterEach()` hooks; `SynapsisTest.respondWith` cans HTTP answers.
6. **Run**: `nuclear check --json` first (a test that does not compile is fixed before anything else), then
   `nuclear test`. Arguments for the runner go after `--`: `nuclear test -- -k repeated`.
7. **Read a failure on its `.nuc` lines**: pipe the output into `nuclear explain`.

A backend test, from the reference:

```nuclear
tests Tasks
  @test("a repeated title is a conflict")
  repeatedTitle() void
    tasks = inject<TasksAppComponent>()
    ~tasks.create(NewTask(title = "call mom"))
    again = ~tasks.create(NewTask(title = "call mom"))
    expect(again.error.status == 409)
```

## The platform's tools

- `nuclear test [--integration] [-- <args>]`, `nuclear check --json`, `nuclear explain`.
- Mobile apps also get `test/synapsis_generated_test.dart` without writing it: models round-trip, repository paths,
  guarded screens' forwards, screens open, form validations.
- MCP: `developer_test(task, code, platform)` drafts the tests of a piece; `nuclear_project` runs `test`.
- Skills: `tdd` (the order), `find-the-edge-cases` of QA (what to test).

## Pitfalls

- The mock syntax differs between mobile and web; copy it from the platform's reference, not from the other one.
- Backend: `nuclear test` before `nuclear install` fails with a missing virtual environment.
- Backend: an `Http` connection takes no fake transport, so a use case calling another API is tested only on models
  built by hand (roadmap).
- Backend (fastapi): listeners of one test receive the events of the next (roadmap); assert on counts with care.
- A user's real token in `testEnv`: only test values there.
- Deleting or weakening a test to make it pass. A failing test is a finding: fix the code, or say why the test is
  wrong.
- Testing the generated target code, or snapshotting `build/`: test behaviour in Nuclear.

## Checklist

- [ ] Every acceptance criterion has a `@test` (or is listed as not testable, with why).
- [ ] Each error path (404, 409, invalid body, refused guard) has a test, not only the happy path.
- [ ] New state managers have `@states` tests; changed screens a `@widget` test (mobile, web).
- [ ] Tests run offline: mocks, `FakeModel`, in-memory databases.
- [ ] `nuclear check --json` prints `[]` and `nuclear test` is green.
- [ ] No test was deleted or weakened in the change.
