---
name: payments
description: Build card and wallet payments in a Synapsis product: amounts in minor units, idempotency keys, provider tokens, signed webhooks, refunds and reconciliation. Use when a feature charges money, adds a checkout, or handles refunds or payment webhooks.
title: Payments
title_es: Pagos
description_es: Construir pagos con tarjeta y monedero en un producto Synapsis: importes en unidades menores, claves de idempotencia, tokens del proveedor, webhooks firmados, reembolsos y conciliación. Úsalo cuando una función cobra dinero, añade un checkout o maneja reembolsos o webhooks de pago.
kind: domain
tags: [payments, checkout, refunds, webhooks, money, stripe, idempotency, card]
---
# Payments

## When to use

A feature takes money from a customer: a checkout, a one-off charge, a refund, a payment webhook, a payout report.
For recurring plans read the skill `subscriptions-billing`; for money held in accounts, `bank-accounts`.

## Steps

1. **Decide the split.** The backend owns every payment rule and every call to the provider; the mobile and web
   apps only collect the card or wallet through the provider's own SDK or hosted page and send the backend a
   **token** (a payment method id). The app never sees a card number, and neither does the backend.
2. **Model the payment** as an entity, with `nuclear gen resource payments Payment --source db --fields "..."`:
   - `id`, `orderId`, `customerId`;
   - `amount: int` in **minor units** (cents), never a `double`; `currency: string` (ISO 4217, `"EUR"`), stored
     per payment, never assumed;
   - `status: string`: `pending` → `requires_action` → `succeeded` | `failed` | `canceled`; then
     `partially_refunded` | `refunded`. Write the allowed transitions once, in a service, and refuse any other;
   - `providerId: string` (the provider's payment id, `unique`), `idempotencyKey: string` (`unique`),
     `failureCode: string?`, `createdAt`, `updatedAt` (`@created`, `@updated`).
   Add a `Refund` entity (`paymentId`, `amount`, `reason`, `status`, `providerId`) and a `PaymentEvent` entity
   (`providerEventId` `unique`, `type`, `receivedAt`, `payload`) for the webhooks.
3. **Talk to the provider** through an HTTP repository: `nuclear gen resource payments ProviderPayment --source
   rest:<the provider's base url> --actions get,create` gives the models and an `Http(baseUrl, headers)`
   connection; the secret key goes in `headers` from `env("PAYMENTS_SECRET_KEY")`, never in a `.nuc` literal.
4. **Charge with an idempotency key.** The use case `CreatePayment` (`@transactional`) takes the order id and the
   client's idempotency key: if a payment with that key exists, answer it as it is (no second charge); otherwise
   save it `pending`, call the provider with the same key, store `providerId` and the status. Compute the amount
   on the server from the order, never from the client's body.
5. **Webhooks are the truth.** A controller route receives the provider's events. Verify the signature header
   against the raw body with the webhook secret (`env("PAYMENTS_WEBHOOK_SECRET")`) before reading anything;
   refuse an old timestamp (replay). A controller parameter is a parsed model, and the platform documents no raw
   body nor request headers for a route: until it does, verify by fetching the event back from the provider by id
   (an HTTP repository call) and record the missing raw-body access in the backend roadmap. Store the event by `providerEventId` and ignore a repeat (the provider retries);
   answer 2xx fast and do the work in a listener (`~publish("payments.event", ...)` + `@consumer`).
6. **Refunds**: a use case checks `sum(refunds) + amount <= payment.amount`, the currency matches and the payment
   is `succeeded` or `partially_refunded`; it calls the provider with its own idempotency key; the final status
   comes from the webhook.
7. **Reconciliation**: the backend platform has no background jobs yet (its roadmap); expose a use case behind a
   `Token` guard and let the operator's scheduler call it daily. It compares the provider's balance report with the `Payment` rows by `providerId`
   and lists the differences (missing rows, status or amount mismatch) for a person; it never fixes money silently.
8. **Show it in the apps**: `nuclear gen resource payments Payment --from-json <a sample answer>` (or the backend's
   contract, `nuclear contracts update`) for the payment history; format the amount with the currency's minor
   digits (JPY has 0, EUR 2, KWD 3).
9. Test every state and failure (§ Checklist), then `nuclear check .` and `nuclear test`.

## The platform's tools

- `nuclear gen resource <component> <Name> --source db --fields "..."`: entity, repository, use cases, controller,
  tests. `--source rest:<url>`: an HTTP repository to the provider.
- `nuclear gen usecase payments RefundPayment --route "POST payments/{id}/refunds"`: wires a hand-written use case
  into the facade and the controller.
- `nuclear make listener payments PaymentEvents`, `nuclear make service payments PaymentStates`.
- `nuclear migrate make "payments"` then `nuclear migrate`: the tables, with `unique` on `providerId`,
  `idempotencyKey`, `providerEventId`.
- Backend words: `@transactional`, `@column(unique = true)`, `@consumer`, `~publish`, `env(...)`, guards `Token`
  for a private admin route (`nuclear help backend`).
- Mobile and web: `@acl` and `@requires(session = true)` on the pay use case; `@post(retry = ...)` is off by
  default for writes, and stays off for a charge.
- **There is no payments kind.** The provider's checkout SDK on the device is a target package:
  `nuclear add <package>` ties that code to the dialect (say so in the project's docs). A missing piece is recorded
  in the platform's roadmap, never written as target code by hand.

## Pitfalls

- Floats for money (`19.99 * 3`): rounding errors. Integers in minor units, always with the currency.
- Trusting the client's "payment succeeded" redirect: only the verified webhook (or a server fetch) changes status.
- Retrying a POST to the provider without the same idempotency key: a double charge.
- Acting on a webhook before verifying it, or verifying a re-serialized body instead of the raw one.
- Logging the full provider answer or headers: secrets and personal data in the logs.
- One currency hard-coded; converting currencies at display time with a stale rate.
- Refunding more than was captured through two concurrent refund requests: check inside the transaction.

## Checklist

- [ ] No card number, CVC or full PAN in any entity, model, log or test fixture.
- [ ] Every amount is an `int` in minor units next to its `currency`.
- [ ] `idempotencyKey`, `providerId` and `providerEventId` are unique columns; a repeated request answers the first result.
- [ ] The webhook route acts only on a verified event (signature or fetched back), refuses an old one, and ignores a repeat.
- [ ] Status changes only through the allowed transitions; a test tries an illegal one.
- [ ] Refunds can never exceed the captured amount (a test with two refunds).
- [ ] Secrets come from `env(...)`; `testEnv(...)` in `config.nuc` holds test values only.
- [ ] `nuclear check .` reports 0 errors and `nuclear test` is green.
