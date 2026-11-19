---
name: subscriptions-billing
description: Build subscriptions and billing in a Synapsis product: plans, trials, upgrades with proration, dunning, entitlements, invoices and store receipts on mobile. Use when a product charges a recurring fee, gates features by plan or sells in-app subscriptions.
title: Subscriptions and billing
title_es: Suscripciones y facturación
description_es: Construir suscripciones y facturación en un producto Synapsis: planes, pruebas, prorrateo, recobro, derechos de acceso, facturas y recibos de las tiendas en móvil. Úsalo cuando un producto cobra una cuota recurrente, limita funciones por plan o vende suscripciones en la app.
kind: domain
tags: [subscriptions, billing, plans, trials, proration, dunning, entitlements, in-app purchases, receipts]
---
# Subscriptions and billing

## When to use

A SaaS plan, a premium tier in an app, seats per team, usage-based add-ons, in-app subscriptions bought through
the App Store or Google Play. One-off charges are the skill `payments`.

## Steps

1. **Let a billing provider run the clock.** Renewals, retries, taxes and invoices are hard; the provider (or the
   store) is the source of truth, reached as HTTP repositories (`--source rest:<url>`, keys from `env(...)`).
   Your backend mirrors its state from **verified webhooks** and decides entitlements.
2. **Plans** (`nuclear gen resource billing Plan --source db --fields "..."`): `id`, `code` (`"pro_monthly"`),
   `priceAmount: int` (minor units), `currency`, `interval` (`month` | `year`), `trialDays: int`, `active`,
   `providerPriceId`. Never delete a plan with subscribers; mark it inactive.
3. **Subscriptions**: `customerId`, `planId`, `status`: `trialing` → `active` → `past_due` → `canceled` |
   `expired` (plus `paused` if offered), `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd: boolean`,
   `trialEnd?`, `providerSubscriptionId` (unique), `source` (`web` | `app_store` | `play_store`).
4. **Entitlements, not plan names, in code**: a table or a map from plan to features (`"export"`, `"seats:10"`);
   use cases ask "has entitlement X" (an aggregate). Mobile and web hide or lock features with a `guard` whose
   `canActivate` reads the entitlements, used in `@screen(acl = {...})` and `@acl(guards = [...])`; the backend
   enforces the same rule, because a hidden button is not a check.
5. **Trials**: one per customer (check by customer and payment fingerprint, not by email); remind before it ends;
   decide whether a card is needed upfront.
6. **Upgrades and downgrades**: upgrade at once with proration (the provider computes the credit for unused time
   and charges the difference); downgrade at period end, so paid features stay until then. Show the amount before
   the user confirms.
7. **Dunning**: a failed renewal moves to `past_due`; the provider retries on a schedule; email the user with a link
   to update the card (`notifications`); keep access during a grace period (e.g. 7 days), then restrict. Recovery
   moves back to `active`.
8. **Cancel**: by default at period end (`cancelAtPeriodEnd = true`); access stays until `currentPeriodEnd`. Make
   cancellation as easy as sign-up (consumer law in many countries).
9. **Store receipts on mobile**: in-app subscriptions must use the store's billing (store rules). The app buys
   through the dialect's purchase package (`nuclear add <package>`, tied to the dialect), sends the receipt or
   purchase token to the backend, and the backend **verifies it with the store's server API** and listens to the
   store's server notifications for renewals, refunds and cancellations. Never unlock from the device's word.
10. **Webhooks**: verify, store by event id (ignore repeats), apply in order of the provider's timestamps, and
    re-fetch the subscription from the provider when unsure.

## The platform's tools

- `nuclear gen resource billing Subscription --source db --fields "customerId:int planId:int status:string providerSubscriptionId:string"`
- `nuclear gen resource billing ProviderSubscription --source rest:<provider base url> --actions get,create,update`
- `nuclear make aggregate billing Entitlements`, `nuclear make listener billing ProviderEvents` (backend).
- `nuclear make guard <name>` (mobile, web) for plan-gated screens; `nuclear add <package>` for a store SDK.
- `nuclear migrate make "billing"`, `nuclear migrate`; `nuclear test`.
- There is no billing kind and no background jobs in the backend platform: period ends and reminders come from the
  provider's webhooks, not from your own timers.

## Pitfalls

- Checking `plan == "pro"` all over the code instead of entitlements.
- Granting access from the client's purchase callback without server verification.
- Ending access the moment a renewal fails (no grace period) or never ending it (no `past_due` handling).
- Computing proration yourself and disagreeing with the provider's invoice.
- Time zones and month lengths in period math: use the provider's period dates.
- Selling digital subscriptions in a mobile app through an outside payment link (store rejection).

## Checklist

- [ ] Plan prices are `int` minor units with a currency; plans are never deleted.
- [ ] Code checks entitlements; the backend enforces them, not only the UI.
- [ ] Subscription state changes only from verified, deduplicated webhooks or store notifications.
- [ ] Store receipts are verified server-side; a test feeds a forged receipt and gets no access.
- [ ] Past-due grace, cancel at period end and downgrade at period end each have a test.
- [ ] `nuclear check .` reports 0 errors and `nuclear test` is green.
