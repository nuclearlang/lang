---
name: notifications
description: Build push, email and in-app notifications in a Synapsis product: one notification model, channels, user preferences, quiet hours, deduplication, retries and device tokens. Use when a feature tells users that something happened, by any channel.
title: Notifications
title_es: Notificaciones
description_es: Construir notificaciones push, por email y en la app en un producto Synapsis: un modelo de notificación, canales, preferencias, horas de silencio, deduplicación, reintentos y tokens de dispositivo. Úsalo cuando una función avisa a los usuarios de que algo pasó, por cualquier canal.
kind: domain
tags: [notifications, push, email, in-app, preferences, quiet hours, device tokens, alerts]
---
# Notifications

## When to use

Something happened that a user should know: an order shipped, a message arrived, a payment failed, a reminder.
Delivered as a push to the phone, an email, or a line in an in-app inbox.

## Steps

1. **One event in, many channels out.** The component where the thing happens only publishes a domain event
   (`~publish("orders.shipped", {...})`). A `notifications` component has a `listener` with `@consumer` per topic
   that decides who is told, by which channel, and writes a `Notification` row. Business code never sends an email.
2. **The notification** (`nuclear gen resource notifications Notification --source db --fields "..."`): `id`,
   `userId`, `type` (`"order.shipped"`), `title`, `body` (or a template key + data, rendered in the user's
   locale), `data` (ids for the deep link), `dedupeKey` (unique), `createdAt`, `readAt?`.
3. **Deliveries**: one row per channel (`notificationId`, `channel`: `push` | `email` | `inapp`, `status`:
   `queued` → `sent` | `failed` | `skipped`, `attempts`, `lastError?`, `sentAt?`). Retry `failed` with growing
   waits up to a limit; a permanent error (invalid token, bounced address) stops and cleans up.
4. **Preferences** (`NotificationPreference`: `userId`, `type`, `channel`, `enabled`): defaults per type, editable by
   the user. Security and legal messages (password changed, receipts) cannot be turned off; marketing is off until
   the user opts in (`privacy-gdpr`).
5. **Quiet hours**: `quietStart`, `quietEnd` and the IANA `timeZone` of the user's profile. A non-urgent push inside
   them is delayed to the end (or folded into the in-app inbox); urgent types (security) go through. Compute in
   the user's time zone, not the server's.
6. **Deduplicate and group**: `dedupeKey` (`"order.shipped:<orderId>"`) stops repeats when an event is delivered
   twice; group bursts ("3 new messages") within a short window.
7. **Device tokens** (`DeviceToken`: `userId`, `token` unique, `platform`, `lastSeenAt`): registered after login,
   refreshed when the push service rotates it, deleted on logout and when the service says it is invalid.
8. **Providers**: email (an SMTP relay or an email API) and push (the platform's push service) are other APIs:
   HTTP repositories (`--source rest:<url>`) with keys from `env(...)`. Respect rate limits; batch where the API
   allows.
9. **In-app**: a `GET notifications` paginated (`paginate(page, size)`), `POST notifications/{id}/read`, an unread
   count. With the app's WebSocket (`WebSocketServer`, plugin `websocket`) the backend pushes new ones by topic;
   the web app listens with `@on("notifications.${userId}")` on a repository method returning `Stream<T>`.
10. **Mobile**: receiving pushes needs the dialect's push package (`nuclear add <package>`, which ties that code to
    the dialect); a handler running in another engine publishes a Synapsis `event` (they travel as JSON for that
    reason), and a global `component` with `@on(...)` reacts. Ask the OS permission at a meaningful moment, not at
    first launch.

## The platform's tools

- `nuclear make component notifications`, `nuclear make listener notifications OrderEvents` (backend).
- `nuclear gen resource notifications Notification --source db --fields "userId:int type:string title:string body:string dedupeKey:string"`
- `nuclear gen usecase notifications MarkRead --route "POST notifications/{id}/read"`
- Mobile: `nuclear make event <name>`, `nuclear make global <name>` (a global component and its event).
- Plugins `events` (or `kafka`) and `websocket` in `config.nuc`; `nuclear migrate make "notifications"`.
- There is no notifications or push kind; no background jobs in the backend platform yet, so retries run from a
  listener or an operator-triggered route.

## Pitfalls

- Sending from inside the business use case: a slow email provider slows the order; a failure rolls it back.
- No dedupe: at-least-once event delivery sends the same push twice.
- Quiet hours computed in UTC; preferences ignored for one channel.
- Stale device tokens never cleaned; tokens kept after logout (another user gets the push).
- Personal or sensitive data in push text (it shows on the lock screen).
- Building the deep link from untrusted data without checking the user can open it.

## Checklist

- [ ] Business components only publish events; the notifications component decides and sends.
- [ ] `dedupeKey` is unique; a test delivers the same event twice and gets one notification.
- [ ] Preferences and quiet hours are checked per channel, in the user's time zone; tests for both.
- [ ] Mandatory types cannot be disabled; marketing needs opt-in.
- [ ] Invalid device tokens and bounced addresses are removed.
- [ ] Provider keys come from `env(...)`; `nuclear check .` reports 0 errors; `nuclear test` is green.
