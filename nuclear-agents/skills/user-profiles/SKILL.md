---
name: user-profiles
description: Build user profiles in a Synapsis product: the profile resource, ownership checks, editable and read-only fields, avatars, email change with verification and account deletion. Use when a feature shows or edits a user's own data, settings or public profile.
title: User profiles
title_es: Perfiles de usuario
description_es: Construir perfiles de usuario en un producto Synapsis: el recurso perfil, propiedad, campos editables y de solo lectura, avatares, cambio de email verificado y borrado de cuenta. Úsalo cuando una función muestra o edita los datos propios, ajustes o el perfil público de un usuario.
kind: domain
tags: [profile, user, account, settings, avatar, personal data, preferences]
---
# User profiles

## When to use

A "my account" screen, a public profile page, user settings, changing name, email, phone or avatar, deleting the
account. Sign-in itself is the skill `authentication`; personal-data duties are `privacy-gdpr`.

## Steps

1. **Separate the profile from the credentials.** The `User` (email, password hash, status) belongs to
   authentication; a `Profile` entity holds what the user shows and edits: `userId` (unique), `displayName`,
   `avatarUrl?`, `bio?`, `locale` (`"en"`), `timeZone` (`"Europe/Madrid"`), `updatedAt`. Generate it with
   `nuclear gen resource profiles Profile --source db --fields "..."`.
2. **Three models, not one**: the stored entity, `ProfileView` (what the owner sees), `PublicProfile` (what others
   see: no email, no phone, no time zone) and `ProfileChanges` with only the editable fields, all optional, with
   their rules: `@minLength(1)`, `@maxLength(50)` on `displayName`, `@maxLength(500)` on `bio`, `@url` on links.
   Fields like `roles`, `status`, `email` are never in `ProfileChanges`.
3. **Ownership**: the use case takes the caller's id from the session or token (per-user identity in the backend
   is built as the skill `authentication` says: the platform has no users yet), never from the body or the path;
   `PATCH profiles/me` instead of `PATCH profiles/{id}`. An admin route is a separate controller with its own guard.
4. **Partial update**: `PATCH` applies only the fields present; validate, then save; answer the new `ProfileView`.
   Use `@updated` for `updatedAt` and, if two devices edit, refuse a change whose `updatedAt` is older (409).
5. **Email change**: never in `ProfileChanges`. A use case stores `pendingEmail` and sends a single-use link to the
   new address and a notice to the old one; the change happens when the link is opened.
6. **Phone**: store it in E.164 (`+34600111222`) after validation; verify with a code before trusting it.
7. **Avatar**: the skill `file-uploads` (type and size limits, a resized copy, the URL stored, the old file removed).
8. **Locale and time zone** feed `i18n` and `notifications`; validate them against the supported lists.
9. **Delete the account**: a confirmation, then anonymise or erase as `privacy-gdpr` says, revoke every session,
   and publish `users.deleted` (`~publish`) so other components clean up.
10. **Apps**: `nuclear gen resource profiles Profile --from-json <sample>` (or the backend's contract) gives the
    repository, use cases and with `--screen` a screen; the edit screen is a `form` with the same rules as the
    backend model and a `formmanager`. The use cases carry `@requires(session = true)`.

## The platform's tools

- `nuclear gen resource profiles Profile --source db --fields "userId:int displayName:string bio:string? locale:string timeZone:string"`
- `nuclear gen usecase profiles UpdateMyProfile --route "PATCH profiles/me"`
- `nuclear make model profiles PublicProfile`, `nuclear make listener profiles UserEvents` (backend).
- Mobile: `nuclear make screen profiles edit`; forms with `@required`, `@maxLength`, `@email`, `@url`.
- `nuclear migrate make "profiles"`, `nuclear migrate`; `nuclear test`.

## Pitfalls

- Mass assignment: saving the request body into the entity lets a user set `roles` or `status`.
- IDOR: `GET profiles/{id}` answering private fields for any id.
- Returning the full entity as the public answer (email, phone leak).
- Changing the email without verifying the new address (account takeover).
- Caching a public profile and serving it after the user made it private or deleted the account: purge on change.
- Avatars and display names shown to others without moderation or a report button where users meet strangers.
- Storing the time zone as an offset (`+01:00`): it breaks at daylight saving. Store the IANA name.

## Checklist

- [ ] Separate models for owner view, public view and changes; `ProfileChanges` has no privileged field.
- [ ] The caller's id comes from the session or token; a test edits another user's profile and gets 403/404.
- [ ] Validation rules are the same in the backend model and the app's form.
- [ ] Email change needs the new address confirmed; the old one is notified.
- [ ] Public answers carry only `PublicProfile` fields (a test reads another user's profile and finds no email).
- [ ] Phone numbers are stored in E.164 and verified before use.
- [ ] Account deletion revokes sessions and publishes an event other components handle.
- [ ] `nuclear check .` reports 0 errors and `nuclear test` is green.
