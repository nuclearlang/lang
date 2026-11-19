---
name: authentication
description: Build sign-in and sessions in a Synapsis product: the backend's guards, password hashing, access and refresh tokens, lockout, and the apps' SessionManager and ACL. Use when a feature adds login, sign-up, logout, password reset or protects routes and screens.
title: Authentication and sessions
title_es: Autenticación y sesiones
description_es: Construir el login y las sesiones en un producto Synapsis: guards del backend, hash de contraseñas, tokens de acceso y refresco, bloqueo, y el SessionManager y la ACL de las apps. Úsalo cuando una función añade login, registro, logout, recuperación de contraseña o protege rutas y pantallas.
kind: domain
tags: [authentication, login, sessions, passwords, tokens, refresh token, jwt, lockout, acl]
---
# Authentication and sessions

## When to use

Login, sign-up, logout, password reset, "remember me", protecting backend routes or app screens by role.

## What the platform has today

- **Backend**: guards in `appConfig` (`guards: Guard[]`) and per controller (`@controller("x", guards = [...])`):
  `Token(value, header)` (a shared secret in a header: service to service, an operator route) and `NoOrigin()`.
  **There are no users, password hashing, per-user tokens nor a guard kind for checks beyond headers yet** (the
  backend platform's roadmap; the first provider, JWT or cookie sessions, is still to decide). Build them as below,
  and say so in the project's docs.
- **Mobile and web**: `SessionManager(timeout = ...)` in `globals` (secure storage on mobile, browser storage on web),
  `~session.start(data, token, roles, permissions, expiresAt)`, `~session.destroy()`, `SessionInterceptor`
  (sends `Authorization: Bearer <token>` and ends the session on a 401), `Acl(inherits, permissions)`,
  `@screen(loggedIn = {...}, acl = {...})`, `@acl(...)` and `@requires(session = true)` on a use case,
  `guard` with `canActivate()`, the events `SessionStarted` and `SessionEnded` (`nuclear help flutter`, §6.12-6.13).

## Steps

1. **Users** (`nuclear gen resource users User --source db --fields "..."`): `id`, `email` (unique, stored lower
   case), `passwordHash`, `status` (`unverified` | `active` | `locked` | `disabled`), `failedLogins: int`,
   `lockedUntil: DateTime?`, `roles`, `createdAt`. The answer model never carries `passwordHash`.
2. **Hash passwords** with a slow, salted algorithm (argon2id, or bcrypt with cost >= 12) in a service. Nuclear's
   standard library has no password hash: add the dialect's package with `nuclear add <package>` (this ties the
   service to the dialect; keep it in that one service) and record the missing portable word in the platform's
   roadmap. Never a plain or fast hash (MD5, SHA-1, SHA-256 alone).
3. **Sign-up**: model with `@email`, `@minLength(12)` on the password; check it against a breached-password list if
   possible; answer the same message whether the email exists or not; send a verification link with a single-use,
   expiring token (store its hash, not the token).
4. **Login** use case: find by email, compare the hash in constant time, then issue a short **access token** (5-15
   min) and a long **refresh token** (days). Store only the refresh token's hash, with `userId`, `expiresAt`,
   `revokedAt?`, `familyId`. Every failure answers the same `Unauthorized("wrong email or password")`.
5. **Refresh with rotation**: each refresh revokes the used token and issues a new one in the same family; a reused
   (already revoked) token revokes the whole family (it was stolen).
6. **Lockout**: increment `failedLogins`; after N (5-10) set `lockedUntil` with a growing wait; reset on success.
   Rate-limit by IP too, so one attacker cannot lock every account.
7. **Logout** revokes the refresh token; "log out everywhere" revokes every token of the user.
8. **Password reset**: a single-use token (hash stored, 15-60 min), the same answer for unknown emails, and every
   refresh token revoked after the change.
9. **Checking a token on a route**: until the platform has a guard kind for it, the use case receives the token's
   claims through its parameters and checks them; never trust a user id sent in the body.
10. **Apps**: `nuclear make component session`, a login screen (`nuclear make screen session login`), a form with
    `@email` and `@required`, and a `LoginUseCase` that calls the backend and `~session.start(auth, token =
    auth.token, roles = auth.roles, expiresAt = ...)`. Protected screens use `loggedIn = { forward: LoginScreen }`;
    a 401 ends the session by itself. Logout calls the backend, then `~session.destroy()`.

## The platform's tools

- `nuclear gen resource users User --source db --fields "id:int email:string passwordHash:string status:string"`
- `nuclear gen usecase auth Login --route "POST auth/login"`, likewise `auth/refresh`, `auth/logout`.
- `nuclear make guard <name>` (mobile, web: a `canActivate` check), `nuclear make component session`.
- `nuclear migrate make "users and tokens"`, `nuclear migrate`.
- `testEnv(...)` in `config.nuc` for the tests' secrets; `appClient()` in tests to call routes with and without headers.

## Pitfalls

- Saying "unknown email" vs "wrong password": account enumeration.
- Tokens in URLs or query strings (they reach access logs; the guards read only headers for this reason).
- Long-lived access tokens with no refresh rotation; refresh tokens stored in plain text.
- Keeping the token anywhere but `SessionManager` on the device (it uses the secure storage).
- Logging passwords or tokens: `Log` masks `password` and `token` keys in maps, but not inside a message string.
- A signing secret in code instead of `env(...)`.

## Checklist

- [ ] Passwords hashed with argon2id or bcrypt; no hash field in any answer model.
- [ ] Login and reset answer the same message for unknown and known emails.
- [ ] Refresh tokens are stored hashed, rotate on use, and reuse revokes the family.
- [ ] Lockout after N failures and a rate limit per IP; tests for both.
- [ ] Every protected route and screen is checked by a test without a session (401 / forward to login).
- [ ] Secrets come from `env(...)`; `nuclear check .` reports 0 errors; `nuclear test` is green.
