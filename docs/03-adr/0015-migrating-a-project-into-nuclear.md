---
status: accepted
date: 2026-11-24
deciders: Julian Molina
---
# ADR-platform-0015: A project of another technology is migrated into Nuclear by an agent, with the tools

## Context and problem
Migrating existing software into Nuclear is one of the reasons the platform exists: a project written in
TypeScript, JavaScript, React, Express, NestJS, Dart, Flutter or Python becomes a Nuclear project that does what the
original did, in every dialect of its platform. The automatic importer (spec 010, `nuclear port`) is not built.
Meanwhile the rules said "no agent translates code of another language into Nuclear" (ADR-platform-0004, point 2)
and the knowledge base said "Nuclear cannot read TypeScript, Dart or Python": an agent asked to migrate the user's
projects refused, and read "Node.js/Express is postponed" as "an Express project cannot be migrated".

Two different things were one sentence: what the **transpiler** does (it reads only `.nuc`, one way, by design) and
what an **agent** may read to do its work (anything the user gives it).

## Decision
1. **A migration is a request of its own**, distinct from writing a feature: the user names an original project and
   asks for it in Nuclear. Its plan is the strategy `strategy:migration` of the Smart Graph.
2. **The agent reads the original project** (its code, its tests, its API, its screens, its schema) as the
   specification of its behaviour, in any technology. Reading it is allowed and expected.
3. **The agent rewrites it in Nuclear with the tools**, never line by line: `migration_inspect` (the inventory: each
   app, the Nuclear platform and dialect it becomes, the plugin of its database, what becomes of each dependency),
   a workspace with one app per original app (`workspace_create`, `app_add`), the generators for every resource
   (`generate_resource` with the original's models as `fields` or its API's answer as `from_json`), `nuclear add`
   for a library of the same language, Nuclear's standard library for everything else; only what they leave is
   written by hand, in Nuclear. A large migration is specs for Nuclear Builder, one component at a time.
4. **The original's language is a source, not a target.** Express, Sequelize, Prisma, React Native are read and
   become the platform's shapes (`backend` with `nestjs`; `mobile`): Node.js/Express stays postponed only as a
   dialect Nuclear writes.
5. **The proof is behaviour.** The original's tests become Nuclear tests; the original's API answers are the
   expected answers of the migrated backend.
6. **The transpiler still reads only `.nuc`** and target code is still never written for a feature
   (ADR-platform-0004, points 1, 3 and 4). When the importer of spec 010 exists, it does step 3's translation
   and the agent resolves only the points it lists.

This amends ADR-platform-0004, point 2: what it forbids is target code written by the agent, and a port that skips
the tools, not reading another project to rewrite it in Nuclear.

## Options considered
1. The agent migrates with the tools now; the importer replaces the hand-written part later (chosen).
2. No migration until the importer exists: the main use of the platform waits months.

## Consequences
- Positive: an agent can migrate the user's projects today, and every gap it meets is a gap of a tool, recorded
  in that tool's roadmap.
- Negative: a hand-written migration can miss behaviour the original's tests do not cover; the agent says what it
  could not prove.

## References
- Amends: ADR-platform-0004 (point 2). Related: ADR-platform-0016 (no agent changes Nuclear), spec 010.
