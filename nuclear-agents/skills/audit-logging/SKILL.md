---
name: audit-logging
description: Build an audit log in a Synapsis backend: who did what to which record and when, written append-only in the same transaction, tamper-evident with a hash chain, searchable, with retention rules. Use when actions on money, permissions, personal data or settings must be traceable.
title: Audit logging
title_es: Registro de auditoría
description_es: Construir un registro de auditoría en un backend Synapsis: quién hizo qué, sobre qué y cuándo, solo por añadido en la misma transacción, con cadena de hashes, consultable y con retención. Úsalo cuando las acciones sobre dinero, permisos, datos personales o ajustes deben rastrearse.
kind: domain
tags: [audit, audit log, compliance, append-only, tamper evidence, history, security, retention]
---
# Audit logging

## When to use

Regulated or sensitive actions: money movements, role and permission changes, logins and failed logins, personal
data viewed or exported, settings and price changes, deletions. An audit log answers "who did what, to what, when,
from where, and what changed" to an auditor or an investigation. It is not the debug log (`Log`) nor telemetry.

## Steps

1. **List the audited actions** in the spec, each with its name (`account.frozen`, `role.granted`,
   `payment.refunded`, `profile.exported`). Not every read: the sensitive ones.
2. **The entry** (`nuclear gen resource audit AuditEntry --source db --actions list,get --fields "..."`):
   `id`, `occurredAt` (UTC, `@created`), `actorType` (`user` | `service` | `system`), `actorId`, `action`,
   `targetType`, `targetId`, `outcome` (`success` | `denied` | `failed`), `reason?`, `changes` (the fields that
   changed, before and after), `requestId`, `ip?`, `userAgent?`, `prevHash`, `hash`. **No create, update or
   delete route**: only `list` and `get`, behind an auditor guard.
3. **Write it in the same transaction** as the action: the use case is `@transactional` and saves the entry with
   the change, so an action never happens without its record (and a rolled-back action leaves none). For
   `denied` outcomes (an `@acl` refusal, a 403) write the entry outside the failed transaction.
4. **One place builds entries**: an aggregate (`nuclear make aggregate audit Auditor`) used by the use cases, so
   the fields and the hashing are written once. Listeners can audit events that are already facts
   (`@consumer("payments.event")`), but the critical ones belong in the transaction.
5. **Append-only**: the repository has no update or delete method; in production the database user of the app
   gets INSERT and SELECT only on the table (in the migration or the database's grants).
6. **Tamper evidence**: `hash = sha256(prevHash + canonical JSON of the entry)`, chained in insert order (one
   writer, or a per-day chain); a verification use case walks the chain and reports the first broken link.
   Periodically copy the latest hash somewhere the app cannot rewrite (write-once storage, a signed export).
7. **Minimise what is stored**: `changes` lists field names and values, but masks secrets (passwords, tokens) and
   keeps personal data only as needed (`privacy-gdpr`): an id instead of a name where possible.
8. **Retention**: keep as long as law or contract says (often 1-10 years per action type), then archive or delete
   by whole periods; erasure requests usually do not apply to legal audit records, but the personal data inside
   them must be the minimum (document the legal basis).
9. **Search**: index `(targetType, targetId)`, `actorId`, `occurredAt`, `action`; paginate (`paginate`) with
   filters (see `search`). Exports for auditors are themselves audited.

## The platform's tools

- `nuclear gen resource audit AuditEntry --source db --actions list,get --fields "actorId:string action:string targetType:string targetId:string outcome:string prevHash:string hash:string"`
- `nuclear make aggregate audit Auditor`, `nuclear make listener audit DomainEvents`.
- `nuclear gen usecase audit VerifyChain --route "GET audit/verify"` with a controller guard
  (`@controller("audit", guards = [Token(value = env("AUDITOR_TOKEN"))])`).
- `@transactional`, `@created`, `@column(index = true)`; `nuclear migrate make "audit log"`, `nuclear migrate`.
- There is no audit kind; telemetry spans (`plugins(telemetry = true)`) are operations data, not an audit trail.

## Pitfalls

- Writing the audit entry after the transaction commits (lost on a crash) or before it (a record of something that
  did not happen).
- An update or delete route on the audit table, or the app's database user able to rewrite it.
- Logging the whole request body (passwords, card data, personal data).
- Local times without a zone; the client's clock as `occurredAt`.
- Free-text `action` names that drift; no `requestId` to tie entries of one request together.
- Auditing only successes: denied attempts matter most in an investigation.

## Checklist

- [ ] Audited actions are listed in the spec; each writes an entry with actor, action, target, outcome, time.
- [ ] Entries are written inside the action's transaction; a test shows a rolled-back action leaves none.
- [ ] No route or repository method updates or deletes entries.
- [ ] The hash chain verifies; a test alters one row and the verification fails at it.
- [ ] Secrets are masked and personal data minimised in `changes`.
- [ ] Retention per action type is written down; `nuclear check .` reports 0 errors; `nuclear test` is green.
