# TradeWise Database Changelog

Records structural database changes, the constraints and indexes that enforce
them, and the verification that was performed. Visual ER diagrams are
maintained separately by the project owner.

---

## 2026-11-14 — M1 identity database foundation

**Migration:** `20261114033942_m1_identity_database_foundation`

### Added

- `User.lastLoginAt` and `User.lastActivityAt`, both nullable. Existing users
  remain `NULL`; no historical activity is inferred.
- `AuthSession` for independent, database-backed user sessions. It stores only
  keyed digests of the session and CSRF tokens, plus optional User-Agent data.
- `AuthRateLimit` for atomic PostgreSQL-backed authentication throttling. It
  stores keyed HMAC identifier digests rather than raw account, email or IP
  identifiers.
- `SecurityAuditLog`, separate from `AdminActivityLog`, with nullable `User`
  and `AuthSession` references that detach with `SET NULL` to preserve history.
- `AuthRateLimitIdentifierType` enum: `ACCOUNT`, `EMAIL` and `IP`.

### Relations and retention

- `User` → `AuthSession`: `CASCADE`; sessions are operational records and user
  soft deletion remains the normal lifecycle path.
- `SecurityAuditLog` → `User` / `AuthSession`: nullable `SET NULL`, preserving
  security-audit history after relation detachment.
- Existing `AdminActivityLog` fields and its `RESTRICT` user foreign key are
  unchanged.

### SQL-only integrity

- Canonical lowercase/trimmed email storage check.
- Trimmed username check and case-insensitive unique functional index.
- SHA-256 digest format checks; session lifecycle and rate-limit window checks.
- Append-only triggers for `AdminActivityLog` and `SecurityAuditLog`.

### Backfill and identity safety

- No identity values were normalized by the migration.
- Nullable activity fields are not backfilled.
- Preflight before migration found no case-insensitive email/username
  collisions, no noncanonical emails, and no usernames requiring trim
  normalization.

### Verification

- `prisma migrate status` reports the database schema up to date against
  both `tradewise` and `tradewise_test`.
- A database built from the migration history reproduces the live development
  schema exactly (verified by comparing `pg_dump --schema-only` output).

---

## 2026-11-14 — M1 security audit detach-safe trigger

**Migration:** `20261114042500_m1_security_audit_log_detach_safe_trigger`

### Rationale

`SecurityAuditLog.userId` and `SecurityAuditLog.sessionId` use
`ON DELETE SET NULL` so that historical security events survive the detachment
of a `User` or `AuthSession`. PostgreSQL implements `ON DELETE SET NULL` as an
internal `UPDATE`, which the strict append-only trigger installed by the
foundation migration rejected. That made legitimate foreign-key deletion fail
with `Security audit log entries are immutable.`

The trigger installed by this migration keeps the append-only guarantee for
every write that actually changes an audit record, and permits exactly one
narrow class of `UPDATE`: detaching a single foreign key (`userId` or
`sessionId`) to `NULL` while leaving `eventType`, `metadata`, `createdAt` and
the other foreign key untouched.

### Effect

- No table, column, index or constraint is added or removed.
- The function body is byte-identical to the one already present in the
  development and test databases, so applying the migration is a no-op there.
- A database built from the migration history now reproduces the live
  development schema exactly.

### Verification

- `pg_dump --schema-only` of a freshly migrated database is identical to the
  development database (excluding physical storage attributes).
- The append-only behaviour is covered by integration tests: `UPDATE` and
  `DELETE` on `SecurityAuditLog` are rejected, while deleting a `User` keeps
  the audit history and detaches the references.

---

## 2026-11-14 — M1 account creation timestamps

**Migration:** `20261114050000_m1_user_creation_timestamps`

### Rationale

Module 1 requires account creation and update timestamps:

- the administrator user list sorts newest-first by default and supports
  `createdFrom` / `createdTo` filters,
- the administrator user details report created/updated timestamps and a
  registration date.

The Module 0 `User` model has neither column, and the approved Module 1
foundation migration did not add them. They are therefore introduced here as
an additive change.

### Added

| Column | Type | Null | Default |
|---|---|---|---|
| `User.createdAt` | `TIMESTAMPTZ(6)` | not null | `CURRENT_TIMESTAMP` |
| `User.updatedAt` | `TIMESTAMPTZ(6)` | not null | none (managed by Prisma `@updatedAt`) |

### Backfill

Existing rows are backfilled from the earliest available registration
evidence, in order:

1. the earliest `USER_REGISTERED` row in `SecurityAuditLog`,
2. otherwise the earliest `AuthSession.createdAt` of the account,
3. otherwise the time of the migration.

`updatedAt` is initialised from `createdAt`.

### Indexes

- `User_createdAt_idx` on `User(createdAt)` — supports the default
  newest-first ordering and the creation-date range filters.

### Effect

- No existing row is deleted and no existing column is modified.
- No Module 0 migration was changed.

### Verification

- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`
  reports no difference between the migrated database and the Prisma datamodel.
- The administrator listing tests cover the default ordering, both sort
  directions, the creation-date range filters and stable ordering.

---

## Verification performed for Module 1

| Check | Command | Outcome |
|---|---|---|
| Migration history | `npx prisma migrate status --config prisma7.config.ts` | `Database schema is up to date!` for `tradewise` and `tradewise_test` |
| Schema generation | `npm run db:generate` | Client generated without drift |
| Datamodel/database parity | `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` | `No difference detected.` |
| Fresh-build parity | `pg_dump --schema-only` of a scratch database built from the migration history versus the live development database | Identical |
| Type safety | `npm run typecheck` | Passed |
| Lint | `npm run lint` | Passed |
| Build | `npm run build` | Passed |
| Automated tests | `npx vitest run` | 201 passed (including the 28 Module 0 regression tests) |
