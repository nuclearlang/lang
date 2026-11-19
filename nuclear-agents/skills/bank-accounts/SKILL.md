---
name: bank-accounts
description: Build bank accounts and transfers in a Synapsis backend: IBAN validation, balances as double-entry ledger entries, transfer states, limits, idempotency and KYC hooks. Use when a feature holds money in accounts, moves it between them or shows balances.
title: Bank accounts and transfers
title_es: Cuentas bancarias y transferencias
description_es: Construir cuentas bancarias y transferencias en un backend Synapsis: validación de IBAN, saldos como asientos de un libro de doble entrada, estados de transferencia, límites, idempotencia y ganchos KYC. Úsalo cuando una función guarda dinero en cuentas, lo mueve entre ellas o muestra saldos.
kind: domain
tags: [bank, accounts, transfers, iban, ledger, double-entry, balance, kyc, fintech]
---
# Bank accounts and transfers

## When to use

The product keeps money for its users (a wallet, a bank, a marketplace balance) and moves it: internal transfers,
outgoing transfers to an IBAN, incoming credits, balances and statements. Card charges are the skill `payments`.

## Steps

1. **Accounts** (`nuclear gen resource accounts Account --source db --fields "..."`): `id`, `ownerId`,
   `iban: string` (unique, stored without spaces, upper case), `currency: string` (ISO 4217, fixed for the
   account's life), `status: string` (`pending_kyc` → `active` → `frozen` | `closed`), `createdAt`. **No balance
   column that is edited**: the balance is derived from the ledger.
2. **The ledger** (double entry): an entity `LedgerEntry` with `id`, `transactionId`, `accountId`,
   `amount: int` (minor units; positive credit, negative debit), `currency`, `createdAt`. Every money movement
   writes one `LedgerTransaction` and **at least two entries whose sum is 0** (the customer's account and a
   counter-account: an internal clearing, fees, the outgoing-transfers account). Entries are never updated or
   deleted; a mistake is corrected by a reversing transaction.
3. **Balances**: a repository query sums the entries of an account (`where({ "accountId": id })` + a sum in a
   service). When the sums get slow, keep a snapshot per account (balance + last entry id) written in the same
   transaction as the entries, and add only the newer entries.
4. **IBAN validation** in a service, before saving or sending: strip spaces, upper case, check the country's
   length, move the first four characters to the end, turn letters into numbers (A = 10 ... Z = 35) and check the
   number mod 97 equals 1 (do it in chunks to stay in `int`). A model field can add a first filter with
   `@pattern(r"^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$")` and `@maxLength(34)`.
5. **Transfers**: entity `Transfer` with `fromAccountId`, `toIban`, `amount: int`, `currency`, `reference`,
   `idempotencyKey` (unique), `status`: `created` → `pending_review` (over a threshold) → `processing` →
   `completed` | `rejected` | `returned`, `failureReason?`. The use case `CreateTransfer` is `@transactional`:
   repeated key → answer the first transfer; account `active`, same currency, amount > 0, limits pass, the
   available balance covers it (balance minus pending holds); then write the transfer and the hold entries.
6. **Limits**: per transfer, per day and per month for each account, checked by summing today's and this month's
   outgoing entries inside the same transaction, so two parallel requests cannot both pass.
7. **KYC hooks**: an account leaves `pending_kyc` only through the identity provider's answer (an HTTP repository
   to it, `--source rest:<url>`); outgoing transfers require `active`. Publish `accounts.kyc_changed` and
   `transfers.status_changed` with `~publish` so listeners (notifications, audit) react.
8. **External rails** (SEPA, a partner bank) are another API: an HTTP repository; its status callbacks move the
   transfer to `completed` or `returned` (a return writes the reversing transaction).
9. **Apps**: mobile and web get the accounts and transfers from the backend's contract (`contracts(...)` in
   `config.nuc`, `nuclear contracts update`); the transfer use case carries `@requires(session = true)` and `@acl`.

## The platform's tools

- `nuclear gen resource accounts Account --source db --fields "id:int ownerId:int iban:string currency:string status:string"`
- `nuclear make entity accounts LedgerEntry`, `nuclear make service accounts Iban`,
  `nuclear make aggregate accounts Ledger` (the rule "entries sum to 0" lives in one place).
- `nuclear gen usecase accounts CreateTransfer --route "POST accounts/{id}/transfers"`
- `nuclear migrate make "ledger"` then `nuclear migrate` (never `createTables` once data matters).
- Backend words: `@transactional`, `@column(unique = true)`, `@manyToOne`, `@pattern`, `@min`, `~publish`,
  `@consumer`, `Token` and `NoOrigin` guards for operator routes.
- There is no ledger or banking kind: everything above is entities, an aggregate and use cases. A partner bank's SDK
  is a target package (`nuclear add <package>`), which ties the code to that dialect.

## Pitfalls

- A mutable `balance` column updated with `balance = balance - x`: lost updates and no history.
- Entries that do not sum to zero; a transfer that writes the debit and fails before the credit (no transaction).
- Mixing currencies in one sum; converting without storing the rate used.
- Checking the balance outside the transaction, then writing: two transfers overdraw the account.
- Trusting the client for the source account: check that the session's user owns `fromAccountId`.
- Validating an IBAN with a regex only (no mod-97), or storing it with spaces (duplicates).
- Deleting a ledger row to "fix" it.

## Checklist

- [ ] No edited balance column; the balance is a sum of entries (or a snapshot written with them).
- [ ] Every `LedgerTransaction` has entries that sum to 0 (a test checks it after each use case).
- [ ] IBAN check digits are validated; a test with a valid and a mistyped IBAN.
- [ ] `CreateTransfer` is `@transactional`, idempotent by key, and refuses over-limit and insufficient funds.
- [ ] A test runs two transfers that together exceed the balance: only one passes.
- [ ] Only `active` accounts send money; KYC changes come from the provider.
- [ ] `nuclear check .` reports 0 errors and `nuclear test` is green.
