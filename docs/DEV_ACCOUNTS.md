# TradeWise — Development Test Accounts

> [!CAUTION]
> **DEVELOPMENT AND LOCAL TESTING ONLY**
> These accounts and credentials are strictly intended for local development, staging tests, and QA verification. They must **never** be used in production. The seed command is permanently blocked from executing under `NODE_ENV=production`.

---

## 1. How to Seed Accounts

To create or refresh the five development test accounts in your local PostgreSQL database, run:

```bash
# From repository root:
npm run seed:dev

# Or from backend directory:
npm --prefix backend run seed:dev
# or
npm --prefix backend run db:seed
```

This operation is **fully idempotent**: running it repeatedly will verify existing accounts and will not duplicate records, overwrite passwords, or reset existing user data.

---

## 2. Documented Development Credentials

All passwords satisfy the authoritative TradeWise password policy (minimum 8 characters, at least 1 digit, at least 1 special character, no whitespace). Passwords are never stored in plaintext and are hashed with Argon2id.

| Role | Full Name | Username | Email | Development Password | Intended Testing Scope |
|:---:|:---|:---|:---|:---|:---|
| **ADMIN** | TradeWise Admin | `admin_dev` | `admin@tradewise.local` | `DevAdmin123!` | Admin portal (`/admin/users`, `/admin/audit-logs`), user suspension/reactivation, system logs. |
| **USER** | Alice Trader | `user1_dev` | `user1@tradewise.local` | `DevUser123!` | Primary learner testing, profile updates, session management, multi-device logins. |
| **USER** | Bob Trader | `user2_dev` | `user2@tradewise.local` | `DevUser123!` | Secondary learner account (concurrent testing, session revocations). |
| **USER** | Charlie Trader | `user3_dev` | `user3@tradewise.local` | `DevUser123!` | Account lifecycle testing (suspension, reactivation by admin). |
| **USER** | Diana Trader | `user4_dev` | `user4@tradewise.local` | `DevUser123!` | Clean slate user (pristine activity, initial onboarding). |

---

## 3. Account Characteristics & Invariants

- **Authentication Identifiers:** Each account can authenticate using either its **email** (`user1@tradewise.local`) or its **username** (`user1_dev`).
- **Authorization:** Only `admin_dev` (`admin@tradewise.local`) has the `ADMIN` role. The four learner accounts (`user1_dev` through `user4_dev`) have the `USER` role and will be rejected with HTTP 403 `FORBIDDEN` if attempting to access `/api/admin/*` endpoints or frontend `/admin` routes.
- **Audit Trails:** Account creations append an immutable audit record to `SecurityAuditLog` with `source: "seed_dev_accounts"`.
- **Database Status:** All seeded accounts are initially created with `isActive: true` and `deletedAt: null`.
