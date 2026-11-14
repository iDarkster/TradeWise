# TradeWise — Module Test Commands & Handoff Notes

This file is intentionally practical and concise. It tells contributors how to run checks and gives each module's implementing agent a place to leave a short handoff at module completion. It is not a chronological terminal log.

## General rules

- Run checks from the relevant workspace.
- Use isolated test data and the module's documented test database.
- Never run destructive integration tests against the development database.
- Do not commit `.env`, `.env.test`, credentials or database dumps.
- Record only commands actually run and their real outcomes.
- Keep closing notes concise: implementation, verification, known gaps and next dependency.

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

Create/configure a local root `.env.test` with a `DATABASE_URL` pointing only to the dedicated `tradewise_test` database. Ensure that database exists and has the project's migrations deployed before running tests.

From `backend/`:

```bash
set -a
source ../.env.test
set +a
npx vitest run
```

**Never source the development `.env` for integration tests.** The order-execution suite creates, mutates and deletes test records.

### Apply migrations

For the development database only, load the root `.env` and deploy:

```bash
set -a
source ../.env
set +a
npx prisma migrate deploy --config prisma7.config.ts
```

For a test database, source `.env.test` instead. Check the active `DATABASE_URL` target before running migration commands. Do not paste or print connection strings into chat or logs.

### M0 closing note — supplied project snapshot

- **Implemented:** PostgreSQL/Docker and Prisma 7 foundation; schema; five migrations; database checks/indexes/FK policies; ledger immutability triggers; portfolio creation service; order execution service.
- **Verified in the latest reported run:** 28/28 PostgreSQL integration tests passed; backend typecheck passed; backend production build passed; project owner confirmed all migrations were applied to the development database.
- **Known gaps / handoff:** frontend foundation is owned by the frontend teammate and must be confirmed separately. M6 still needs authenticated REST endpoints and integration with M4's market-data contract. Quiz/account lifecycle workflows are not yet fully implemented.
- **Closing status:** backend/database foundation complete; overall M0 frontend ownership confirmation remains with teammate.

## Module closing notes

The implementing agent for each module must replace the placeholder with a concise final handoff when the module is complete. Do not write a running terminal diary here.

### M1 — Identity & Access

- **Implemented:** Pending.
- **Verification actually run:** Pending.
- **Known gaps / next dependency:** Pending.
- **Closing agent / date:** Pending.

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
