---
name: privacy-gdpr
description: Build privacy and GDPR duties into a Synapsis product: a personal data inventory, legal basis and consent, data export, erasure, retention, minimisation, encryption and processor agreements. Use when a feature collects, stores or shares personal data, or a user asks to see or delete theirs.
title: Privacy and GDPR
title_es: Privacidad y RGPD
description_es: Incorporar la privacidad y el RGPD en un producto Synapsis: inventario de datos personales, base legal y consentimiento, exportación, borrado, retención, minimización, cifrado y contratos con encargados. Úsalo cuando una función trata datos personales o un usuario pide ver o borrar los suyos.
kind: domain
tags: [privacy, gdpr, personal data, consent, data export, erasure, retention, dpa]
---
# Privacy and GDPR

## When to use

Any feature that touches personal data (anything that identifies a person directly or indirectly: name, email,
phone, ids, device ids, location, IP, photos), a consent banner, a "download my data" or "delete my account"
request. This skill is engineering practice, not legal advice: the legal basis and texts are decided with the
product's legal owner.

## Steps

1. **Inventory** (in the project's docs): for every entity and model with personal data, the fields, the purpose,
   the legal basis (contract, consent, legal obligation, legitimate interest), who can read it, where it is stored
   (database, local device tables, logs, backups, third parties) and how long it is kept. A field with no purpose
   is not collected.
2. **Minimise**: ask only what the feature needs; store the coarsest form (birth year instead of date, city
   instead of coordinates); keep personal data out of URLs, logs (`Log` masks `token`, `password`, `secret`,
   `cookie`, `authorization` keys in maps, nothing else), analytics properties and error reports.
3. **Consent** where it is the basis (marketing, non-essential analytics, precise location): `Consent` entity per
   user and purpose with `granted`, `version` of the text, `grantedAt`, `withdrawnAt?`, `source`. Opt-in, as easy
   to withdraw as to give, and checked before each use (`analytics-events`, `notifications`). Store proof.
4. **Access and export** (`GET me/export`): a use case gathers every component's data about the user through each
   component's facade (`appcomponent`), as JSON, and delivers it through a short-lived download link
   (`file-uploads`). Verify identity again before exporting; audit the export (`audit-logging`).
5. **Erasure** (`DELETE me`): a use case publishes `users.erasure_requested` (`~publish`); each component's
   `listener` (`@consumer`) deletes or anonymises its rows (replace with a tombstone id, drop free text) and
   reports done. Keep only what a law requires (invoices, audit records), minimised and documented. Revoke
   sessions and tokens; remove files; ask processors to delete. Finish within one month.
6. **Rectification**: the profile is editable (`user-profiles`); data the user cannot edit can be corrected on
   request through an admin use case, audited.
7. **Retention**: each table has a rule (e.g. inactive accounts after 24 months, logs after 30 days, tokens when
   expired); a guarded cleanup use case triggered by the operator's scheduler applies them (the backend platform
   has no background jobs yet). Backups expire on their own schedule, documented.
8. **Security**: TLS everywhere (`https://`, `wss://`), encrypted storage on devices (the mobile local database is
   AES-256 by default: keep `encrypted = true` for personal tables; `SessionManager` uses secure storage),
   secrets in `env(...)`, least-privilege database users, access to personal data behind roles (`@acl`, guards).
9. **Processors and transfers**: every third party that receives personal data (email, analytics, hosting, AI
   providers) needs a processor agreement (DPA) and a lawful transfer mechanism outside the EEA; list them in the
   inventory. Prefer providers in the EU or self-hosted (Ollama for AI) for sensitive data.
10. **Breaches**: log access to personal data so a breach can be scoped; the controller has 72 hours to notify
    the authority.
11. **Children and special categories** (health, religion, biometrics): stricter rules; stop and ask before building.

## The platform's tools

- `nuclear gen usecase privacy ExportMyData --route "GET me/export"`, `nuclear gen usecase privacy EraseMe --route "DELETE me"`.
- `nuclear make listener <component> ErasureRequests` in every component that holds personal data (backend).
- `nuclear gen resource privacy Consent --source db --fields "userId:int purpose:string version:string granted:boolean"`
- `nuclear migrate make <message>` for retention columns and indexes; `nuclear test` for export and erasure.
- `nuclear gen inspect` lists the project's components and declarations: start the inventory from it.

## Pitfalls

- Soft-deleting a user and calling it erasure; forgetting copies in logs, caches, local device tables, files and
  third parties.
- Pre-ticked consent boxes, or one consent for several purposes.
- Collecting "just in case"; free-text fields where people type health or other sensitive data.
- Personal data in analytics, URLs or crash reports.
- Exports sent by email as attachments; erasure that breaks foreign keys and crashes reports.
- Sending personal data to an AI or other provider with no DPA.

## Checklist

- [ ] The inventory lists every personal field with purpose, basis, location and retention.
- [ ] Consent is stored per purpose with its text version and is checked before use; withdrawal works (a test).
- [ ] Export returns every component's data for the user, behind re-authentication, and is audited.
- [ ] Erasure reaches every component (a test creates data in each, erases, and finds none left except what law keeps).
- [ ] Retention rules exist per table and run; device personal tables stay encrypted.
- [ ] Every processor is listed with a DPA; `nuclear check .` reports 0 errors; `nuclear test` is green.
