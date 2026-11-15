# TradeWise — Module Test Commands & Handoff Notes

This file is intentionally practical and concise. It tells contributors how to run checks and gives each module's implementing agent a place to leave a short handoff at module completion. It is not a chronological terminal log.

## General rules

- Run checks from the relevant workspace.
- Use isolated test data and the module's documented test database.
- Never run destructive integration tests against the development database.
- Do not commit `.env`, `.env.test`, credentials or database dumps.
- Record only commands actually run and their real outcomes.
- Keep closing notes concise: implementation, verification, known gaps and next dependency.
- The backend test suite refuses to start unless `DATABASE_URL` points at a database whose name ends with `_test`.

## Environment variables

The backend validates its environment at startup and exits with a clear
message when a value is missing or invalid. Copy `.env.example` to `.env`
(development) and `.env.test` (integration tests) and fill in real values.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SESSION_SECRET` | yes | Keys the digest of the opaque session token (min. 32 characters) |
| `CSRF_SECRET` | yes | Derives the session-bound CSRF token (min. 32 characters) |
| `RATE_LIMIT_SECRET` | yes | Keys the HMAC digests of rate-limit identifiers (min. 32 characters) |
| `NODE_ENV` | no | `development` (default), `test` or `production` |
| `PORT` | no | HTTP port, default `5001` |
| `COOKIE_NAME` | no | Session cookie name, default `tw_session` |
| `COOKIE_SECURE` | no | Defaults to `true` in production, `false` otherwise |
| `COOKIE_SAME_SITE` | no | `lax` (default), `strict` or `none` (`none` requires `COOKIE_SECURE=true`) |
| `COOKIE_DOMAIN` | no | Unset keeps the cookie host-only |
| `CORS_ALLOWED_ORIGINS` | in production | Comma-separated allowed frontend origins; must not contain `*` |
| `TRUSTED_PROXIES` | no | Comma-separated IPs/CIDRs whose forwarded headers may be trusted |

## M0 — Project Foundation / backend database foundation

### Prerequisites

- Node version from `.nvmrc`.
- Docker Desktop running.
- Root environment files configured locally (not committed).
- PostgreSQL Docker service running from the repository root.

### Start PostgreSQL

From the repository root:

```bash
docker compose up -d
docker compose ps
```

The project PostgreSQL container maps host port `5433` to container port `5432`. Do not stop or reconfigure an unrelated local PostgreSQL service on port `5432`.

### Run backend checks

From `backend/`:

```bash
npm run typecheck
npm run build
npm run lint
```

### Run database integration tests safely

Create/configure a local root `.env.test` with a `DATABASE_URL` pointing only to the dedicated `tradewise_test` database, plus the `SESSION_SECRET`, `CSRF_SECRET` and `RATE_LIMIT_SECRET` values (see **Environment variables** above). Ensure that database exists and has the project's migrations deployed before running tests.

From `backend/`:

```bash
set -a
source ../.env.test
set +a
npx vitest run
```

**Never source the development `.env` for integration tests.** The order-execution suite creates, mutates and deletes test records, and the Module 1 suites create and remove accounts, sessions and rate-limit buckets.

The suite refuses to start when `DATABASE_URL` does not point at a database whose name ends with `_test`.

### Apply migrations

For the development database only, load the root `.env` and deploy:

```bash
set -a
source ../.env
set +a
npx prisma migrate deploy --config prisma7.config.ts
```

For a test database, source `.env.test` instead. Check the active `DATABASE_URL` target before running migration commands. Do not paste or print connection strings into chat or logs.

### Seed development test accounts

To populate the local development database with five standard test accounts (1 ADMIN + 4 USERs):

```bash
# From repository root:
npm run seed:dev

# Or from backend/:
npm run seed:dev
```

This operation is idempotent and safe for repeated local development runs. See [`docs/DEV_ACCOUNTS.md`](./DEV_ACCOUNTS.md) for the complete list of development credentials, roles, and testing scopes.

### Clear local registration rate limits

To clear local development registration rate-limit buckets (strictly guarded against production):

```bash
# From repository root:
npm run dev:ratelimit:clear

# Or from backend/:
npm run ratelimit:clear:dev
```

### M0 closing note — supplied project snapshot

- **Implemented:** PostgreSQL/Docker and Prisma 7 foundation; schema; five migrations; database checks/indexes/FK policies; ledger immutability triggers; portfolio creation service; order execution service.
- **Verified in the latest reported run:** 28/28 PostgreSQL integration tests passed; backend typecheck passed; backend production build passed; project owner confirmed all migrations were applied to the development database.
- **Known gaps / handoff:** frontend foundation is owned by the frontend teammate and must be confirmed separately. M6 still needs authenticated REST endpoints and integration with M4's market-data contract. Quiz/account lifecycle workflows are not yet fully implemented.
- **Closing status:** backend/database foundation complete; overall M0 frontend ownership confirmation remains with teammate.

## Module closing notes

The implementing agent for each module must replace the placeholder with a concise final handoff when the module is complete. Do not write a running terminal diary here.

### M1 — Identity & Access

- **Implemented:**
  - Backend: Registration, login, logout and password change; opaque database-backed sessions with sliding 30-day expiry and throttled activity writes; session-bound CSRF protection; profile read/update; PostgreSQL-backed login and registration rate limiting with keyed HMAC identifiers and trusted-proxy handling; a separate append-only `SecurityAuditLog`; interactive `admin:bootstrap` command; admin user management (search by full name, email, username; status/role filters; suspension and reactivation); admin audit-log inspection (case-insensitive substring action search); dev test account seeder (`npm run seed:dev`); dev rate-limit clearing utility (`npm run dev:ratelimit:clear`).
  - Frontend: Reconstructed foundation according to `SPECIFICATION.md` and `DESIGN.md`; complete auth flows (Login, Register with live password validation and human-readable rate-limit retry feedback); Settings pages (Profile with immutable email, Change Password, Active Sessions with revocation); Admin Portal (direct landing for admin role, User Management with combined filter form, loading states, and reset, User Details with suspend/reactivate modals, and Security Audit Logs with partial action search and clear filters); route guards; global navigation and profile dropdown.
- **Verification actually run:**
  - Backend integration tests: **232 passed / 232 total** across 13 test files (including 28 M0 regression tests, seed tests, and rate-limit clear tests).
  - Backend typecheck: passed (0 errors).
  - Backend lint: passed (0 errors).
  - Backend build: passed (production output generated).
  - Frontend unit/integration tests: **59 passed / 59 total** across 4 test suites.
  - Frontend typecheck: passed (0 errors).
  - Frontend lint: passed (0 errors).
  - Frontend build: passed (`tsc -b && vite build` succeeded).
  - Live API testing: verified against running server (`http://localhost:5001`) with cookie session authentication for `GET /api/admin/users?search=Alice` and `GET /api/admin/audit-logs?action=login` / `action=suspend`.
- **Known gaps / next dependency:**
  - Email verification, email change, forgot-password and password-reset flows are out of scope by decision; email is immutable through profile endpoints.
  - Account-closure workflow is tracked as an open decision in `docs/DECISIONS.md`.
  - M2 (Learning Management) and M4 (Market Data) are the next unblocked modules on the dependency roadmap.
- **Closing agent / date:** Antigravity, 2026-11-15.

### M2 — Learning Management

- **Implemented:** Pending.
- **Verification actually run:** Pending.
- **Known gaps / next dependency:** Pending.
- **Closing agent / date:** Pending.

### M3 — Assessment & Progress

- **Implemented:** Pending.
- **Verification actually run:** Pending.
- **Known gaps / next dependency:** Pending.
- **Closing agent / date:** Pending.

### M4 — Market Data

- **Implemented:** Pending.
- **Verification actually run:** Pending.
- **Known gaps / next dependency:** Provider choice and integration must be explicitly resolved during this module.
- **Closing agent / date:** Pending.

### M5 — Market Visualization

- **Implemented:** Pending.
- **Verification actually run:** Pending.
- **Known gaps / next dependency:** Pending.
- **Closing agent / date:** Pending.

### M6 — Paper Trading

- **Implemented:** Service/database foundation exists in M0; authenticated API and full M4 integration remain.
- **Verification actually run:** M0 order-execution PostgreSQL integration suite: 28/28 passed in the latest reported run.
- **Known gaps / next dependency:** Portfolio/order REST APIs, API authorization/validation, M4 execution-price integration and account-closure workflow.
- **Closing agent / date:** Pending final M6 completion.

### M7 — Dashboard & Analytics

- **Implemented:** Pending.
- **Verification actually run:** Pending.
- **Known gaps / next dependency:** Complete aggregations depend on M2/M3/M4/M6 source data.
- **Closing agent / date:** Pending.

## Handoff format

Use this format and keep it brief:

```md
### Mx — Module Name
- **Implemented:** Main features and important files/services.
- **Verification actually run:** Exact commands and pass/fail result.
- **Known gaps / next dependency:** Remaining work, limitations or upstream dependency.
- **Closing agent / date:** Agent/model identifier and date.
```
