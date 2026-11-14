# TradeWise

Trading education and paper-trading web application, primarily for Indian markets.

**Product journey:** Learn → Visualize → Practice → Improve.

## Start here

1. Read [`AGENTS.md`](./AGENTS.md) first. It is the master project map, module roadmap, dependency guide and shared contributor instructions.
2. Read [`docs/DECISIONS.md`](./docs/DECISIONS.md) before changing product rules, database schema, migrations or domain behavior.
3. Read [`docs/TESTING.md`](./docs/TESTING.md) for module-specific commands and handoff notes.
4. Frontend contributors must also read [`frontend/DESIGN.md`](./frontend/DESIGN.md).

## Stack

React + Vite + TypeScript; Node.js + Express + TypeScript; Prisma 7; PostgreSQL; REST API. The backend is a modular monolith. Supabase is prohibited.

## Repository state

The project is being built module by module. `AGENTS.md` distinguishes implemented foundation from planned module work. Do not assume an intended directory or feature is already implemented.

## Local setup

- Use the Node version specified in `.nvmrc`.
- Start the local PostgreSQL service with `docker compose up -d`.
- Configure local environment variables using safe local files. Never commit `.env`, `.env.test`, credentials or API keys.
- Follow `docs/TESTING.md` for safe test-database setup and backend commands.
