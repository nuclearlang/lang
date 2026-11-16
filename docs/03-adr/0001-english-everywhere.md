---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0001: Everything is written in English

## Context and problem
The platform is open source and is read by agents and by people of any country. Documentation was first written
in Spanish while the code was in English, so two languages lived in one tree.

## Decision
Everything is in English: code, comments, test names, diagnostics, the output of the command line tools, dialects
(comments, notes, templates), examples, references, guides, context documents, ADRs and the website. Spanish is a
later translation of the website. The chat with the user is in Spanish.

Exceptions: localization data (the `es` translations, the CLI motto with an `es` locale) and the tests of unicode.

## Options considered
1. Documentation in Spanish, code in English: two languages to keep in step, and half the readers lost.
2. Everything in English.

## Consequences
- Positive: one language for every reader; an agent reads the same words in the code and in the documents.
- Negative: the user writes in Spanish and reads the documents in a second language.

## References
- Replaces: ADR-0075, ADR-0082
