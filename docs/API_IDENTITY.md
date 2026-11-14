# TradeWise — Module 1 API (Identity & Access)

Focused reference for the Module 1 endpoints. All routes are unversioned and
mounted under `/api`. Responses always use the shared envelope:

```json
{ "success": true, "data": {} }
```

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": { "fields": {} } } }
```

## Authentication model

- The session is carried in an HTTP-only cookie (`tw_session` by default).
  The cookie value is an opaque random token; the database stores only a
  keyed digest of it.
- State-changing authenticated requests must send the session's CSRF token in
  the `X-CSRF-Token` header. Read-only requests do not need it.
- Fetch the CSRF token once with `GET /api/auth/csrf` and keep it in memory.
  The token is stable for the lifetime of the session, so a page reload can
  simply fetch it again.

### Error codes

| Code | HTTP | Meaning |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | Request fields failed validation; `details.fields` lists them |
| `MALFORMED_REQUEST` | 400 | Body is not valid JSON |
| `INVALID_CREDENTIALS` | 401 | Email/username or password is wrong |
| `UNAUTHENTICATED` | 401 | No session, or the session is expired or revoked |
| `FORBIDDEN` | 403 | Authenticated but not permitted |
| `CSRF_TOKEN_INVALID` | 403 | Missing or invalid `X-CSRF-Token` |
| `NOT_FOUND` | 404 | Unknown route or resource |
| `CONFLICT` | 409 | Duplicate email/username, or an invalid state transition |
| `RATE_LIMITED` | 429 | Too many attempts; `details.retryAfterSeconds` is advisory |
| `INTERNAL_ERROR` | 500 | Unexpected failure; no internal detail is exposed |

---

## Public endpoints

### `POST /api/auth/register`

Creates a `USER` account, its profile, its first session and the registration
audit event in one transaction. Sets the session cookie.

| Field | Rules |
|---|---|
| `email` | Required, valid address, trimmed and lower-cased, unique case-insensitively |
| `password` | 8–128 characters, at least one digit and one special character; spaces and whitespace forbidden anywhere |
| `username` | 3–20 characters, letters/digits/underscore, unique case-insensitively |
| `fullName` | Required, at most 100 characters |

`201` returns `{ "user": {...}, "csrfToken": "..." }`. Public registration can
never create an administrator account.

### `POST /api/auth/login`

| Field | Rules |
|---|---|
| `identifier` | Email address **or** username; matched case-insensitively |
| `password` | Required |

`200` returns `{ "user": {...}, "csrfToken": "..." }` and sets the session
cookie. An unknown identifier and a wrong password return the identical
`401 INVALID_CREDENTIALS` response, so the endpoint never discloses whether
an account exists. Suspended and soft-deleted accounts cannot authenticate.

---

## Session endpoints

All of these require an authenticated session.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/auth/csrf` | Returns `{ "csrfToken": "..." }` for the current session |
| `GET` | `/api/auth/sessions` | Lists the caller's active sessions |
| `DELETE` | `/api/auth/sessions/:id` | Revokes one session of the caller |
| `POST` | `/api/auth/logout` | Revokes the current session, `204` |
| `POST` | `/api/auth/logout-others` | Revokes every session except the current one, `204` |
| `POST` | `/api/auth/logout-all` | Revokes every active session, `204` |

The session list contains the session id, a coarse client label derived from
the User-Agent, the creation date, the last activity, the expiry and a
`isCurrent` flag. It never contains tokens or token digests, and no IP
addresses are collected.

---

## Profile endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/me` | Returns the caller's account |
| `PATCH` | `/api/me/profile` | Updates `username`, `fullName` and `avatarUrl` |
| `POST` | `/api/me/password` | Changes the password |

`PATCH /api/me/profile` only accepts `username`, `fullName` and `avatarUrl`.
`avatarUrl` may be `null` to clear it. Attempting to send `email` or
`password` is rejected with `400 VALIDATION_ERROR`.

`POST /api/me/password` takes `currentPassword` and `newPassword`. The new
password must satisfy the registration password rules. On success every
other active session is revoked and the caller's own session stays valid.

---

## Administrator endpoints

All of these require an `ADMIN` session. State-changing routes also require
the CSRF token.

### `GET /api/admin/users`

| Parameter | Default | Rules |
|---|---|---|
| `page` | 1 | Integer ≥ 1 |
| `limit` | 20 | Integer 1–100 |
| `search` | — | Matched against email and username, case-insensitively |
| `status` | — | `ACTIVE`, `SUSPENDED` or `DELETED` |
| `role` | — | `USER` or `ADMIN` |
| `createdFrom` | — | ISO-8601 date |
| `createdTo` | — | ISO-8601 date |
| `sortBy` | `createdAt` | `createdAt`, `username` or `email` |
| `order` | `desc` | `asc` or `desc` |

Soft-deleted accounts are excluded unless `status=DELETED` is requested. The
ordering always has a stable secondary sort by id. The response contains
`users` and `pagination` (`page`, `limit`, `total`, `totalPages`).

### `GET /api/admin/users/:id`

Returns the account id, email, username, full name, role, derived status,
created/updated timestamps, registration date, last successful login, last
activity, the active session count and a session-activity summary. Password
hashes, session tokens and token digests are never returned, and historical
login information stays visible for suspended and deleted accounts.

### `POST /api/admin/users/:id/suspend`

Suspends a regular learner account. The status change, the revocation of
every active session and the audit event are committed together.

### `POST /api/admin/users/:id/reactivate`

Restores the right to log in. Sessions revoked while the account was
suspended are not restored.

Administrators cannot suspend themselves or another administrator, cannot
change roles, cannot delete accounts and cannot revoke an individual user's
sessions through these endpoints.

### `GET /api/admin/audit-logs`

| Parameter | Default | Rules |
|---|---|---|
| `page` | 1 | Integer ≥ 1 |
| `limit` | 20 | Integer 1–100 |
| `actorId` | — | User id of the acting administrator or user |
| `targetId` | — | User id the event concerns |
| `action` | — | Event type, for example `USER_SUSPENDED` |
| `createdFrom` | — | ISO-8601 date |
| `createdTo` | — | ISO-8601 date |

Returns `events` and `pagination`. Each event contains the event id, the
actor id and a safe actor summary, the target id and a safe target summary
(nullable), the action, the timestamp and safe metadata. Metadata never
contains passwords, hashes, tokens or secrets.

---

## Account status

`isActive` and `deletedAt` remain independent fields. The derived status is:

| Status | Condition |
|---|---|
| `ACTIVE` | `isActive = true` and `deletedAt IS NULL` |
| `SUSPENDED` | `isActive = false` and `deletedAt IS NULL` |
| `DELETED` | `deletedAt IS NOT NULL`, regardless of `isActive` |

Suspending an account revokes its sessions immediately. Reactivating it does
not restore them.
