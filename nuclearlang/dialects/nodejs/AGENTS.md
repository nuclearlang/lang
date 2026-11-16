# The `nodejs` dialect

**Postponed by the user: everything Node.js/Express. Do not touch this dialect until asked.** That includes
`use express as "express"` of the base language (§8), which does not parse. This file only says what the dialect
is today, because `nestjs` builds on it.

A dialect only decides HOW the same Nuclear code is written in one target, never what the Nuclear code is. This
one is TypeScript for Node.js: it extends [`typescript`](../typescript/AGENTS.md) and adds only what knowing the
target is Node.js gives. Paths here are relative to this folder (`nuclearlang/dialects/nodejs/`).

## What it holds today

`dialect.toml` (`extends = "typescript"`) and nothing else of its own: no templates, no `keywords.toml` (it
inherits TypeScript's), no `docs.toml`, no type definitions, no framework dialects.

| Section | Adds |
|---|---|
| `[imports]` | `use` shortcuts for the native modules, written without `node:`: `use fs/promises{ readFile }` → `import { readFile } from 'node:fs/promises';` (`fs`, `fs/promises`, `path`, `os`, `crypto`, `http`, `https`, `events`, `stream`, `url`, `util`, `child_process`, `worker_threads`, `zlib`, `test`... the full list is the section) |
| `[auto_imports]` | a symbol used in the code imports its module without a `use`: `readFile(...)` adds `import { readFile } from 'node:fs/promises'`. Listed for `node:fs/promises`, `node:fs`, `node:path`, `node:os`, `node:http`, `node:crypto`, `node:url`, `node:util`, `node:events`, `node:child_process`, `node:stream`, `node:stream/promises`, `node:readline`, `node:zlib`, `node:worker_threads` and `node:assert`. Each symbol lives in a single module |
| `[names] globals` | `process`, `Buffer`, `__dirname`, `__filename`, `require`, `module`, `exports`, `global` exist without being declared, besides TypeScript's |

## Who depends on it

- The `nestjs` dialect (`../typescript/frameworks/nestjs/`, `extends = "nodejs"`): a change here changes the
  backend platform's TypeScript output.
- The golden `../../examples/examples-nodejs/chat.nuc` → `chat.ts` (`cargo test` from the root of the tree).

## Documents

| You need | Read |
|---|---|
| The normative rules and equivalences of this dialect | `docs/07-reference/nodejs.md` (checked from `nuclearlang/` with `tools/spec-check/check.py dialects/nodejs/docs/07-reference/nodejs.md nodejs typescript`) |
| Everything it inherits | [../typescript/AGENTS.md](../typescript/AGENTS.md) |
| The other dialects | [../README.md](../README.md) |
| The format of a dialect file | [../../docs/07-reference/dialects.md](../../docs/07-reference/dialects.md) |
