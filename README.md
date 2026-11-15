# TradeWise

Trading education and paper-trading web application, primarily for Indian markets.

**Product journey:** Learn → Visualize → Practice → Improve.

## Start here

1. Read [`AGENTS.md`](./AGENTS.md) first. It is the master project map, module roadmap, dependency guide and shared contributor instructions.
2. Read [`docs/DECISIONS.md`](./docs/DECISIONS.md) before changing product rules, database schema, migrations or domain behavior.
3. Read [`docs/TESTING.md`](./docs/TESTING.md) for module-specific commands and handoff notes.
4. Frontend contributors must read [`frontend/DESIGN.md`](./frontend/DESIGN.md) and the complete canonical [`frontend/SPECIFICATION.md`](./frontend/SPECIFICATION.md).

## Stack

React + Vite + TypeScript; Node.js + Express + TypeScript; Prisma 7; PostgreSQL; REST API. The backend is a modular monolith. Supabase is prohibited.

## Repository state

The project is being built module by module. `AGENTS.md` distinguishes implemented foundation from planned module work. Do not assume an intended directory or feature is already implemented.

## Local setup

- Use the Node version specified in `.nvmrc`.
- Start the local PostgreSQL service with `docker compose up -d`.
- Configure local environment variables using safe local files. Never commit `.env`, `.env.test`, credentials or API keys.
- Copy `.env.example` to `.env` (development) and to `.env.test` (integration tests) and fill in real values. The backend validates its environment at startup and exits with a clear message when a value is missing or invalid.
- Follow `docs/TESTING.md` for safe test-database setup and backend commands.

## Backend commands

From the repository root:

```bash
npm run dev:backend     # development server
npm run typecheck       # TypeScript check for both workspaces
npm run lint            # ESLint for both workspaces
npm run build           # production build for both workspaces
```

From `backend/`:

```bash
npm run admin:bootstrap # interactive creation of the first administrator
```

`admin:bootstrap` is interactive: the password is read without echo, it is never accepted as a command-line argument, and it refuses to run when an administrator already exists.

## Module 1 (Identity & Access)

The Module 1 API reference is [`docs/API_IDENTITY.md`](./docs/API_IDENTITY.md). Database structure changes are recorded in [`docs/DATABASE_CHANGELOG.md`](./docs/DATABASE_CHANGELOG.md).
