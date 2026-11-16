---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: []
---
# Working with the user and between sessions

## The user
PHP developer, author of CodeBuilder, new to Rust and compilers. Writes in Spanish: **the chat is always in
Spanish**, step by step, with concrete examples from the project (analogies with CodeBuilder are allowed in the
chat, never in the documents). Thinks of Nuclear like Elixir (modules, everything is a value, `if` and `match`
return) and prefers clear errors to inference by magic. Wants vivid, bright syntax colors.

Frequent mistakes in the Nuclear the user writes: comment lines without ` * ` (N0021), `title: x` in arguments
(it is `title = x`), `!` before a value (it is `not`; `x!` after a value exists), `const` and `new` (they do not
exist), indentation that is not 2 spaces.

## Sessions
Several sessions may work in the tree at once. One owns a project while it works on it; another asks it for a
change by message, or makes the change itself when the owner is not active and the user asks, and then updates
that project's documents.

## Questions
A doubt about a rule is asked in the chat and written in the reference once the user decides. A reference holds
no question, no history and nothing pending.
