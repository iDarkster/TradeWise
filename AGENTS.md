# TradeWise — Project Master Instructions

**Read this file first. Every developer and coding agent must read it before touching the project.**

This file is the project's central map: product intent, architecture, repository structure, module boundaries, dependencies, current implementation state, module TODOs, and links to the supporting documents. Keep it accurate as the project evolves.

## 1. Product

TradeWise is a trading education and paper-trading web application, primarily for Indian markets. Its learning journey is:

**Learn → Visualize → Practice → Improve**

The MVP helps beginners learn trading concepts, explore market information, practise with virtual money, and review their progress. Paper trading is simulated; never present it as real-money brokerage execution.

Build a coherent MVP before optional features.

## 2. Read these supporting documents

| Document | Authority / purpose | Read when |
|---|---|---|
| [`docs/DECISIONS.md`](./docs/DECISIONS.md) | Approved product, architecture, data, financial and business-rule decisions; implementation status; unresolved questions | Before changing schema, APIs, business logic, data lifecycle or product behavior |
| [`frontend/DESIGN.md`](./frontend/DESIGN.md) | Frontend visual language, tokens, components and UI conventions | Before any frontend work |
| [`docs/TESTING.md`](./docs/TESTING.md) | How to run tests by module, minimum verification expectations, and concise module handoff notes | Before testing and before closing a module |
| [`README.md`](./README.md) | Project entry point and setup overview | On initial setup |

The as-built ER diagram is `docs/TradeWise_ER_v1_11.pdf`, reverse-engineered from the implemented Prisma schema and SQL migrations. Editable Graphviz sources live in `docs/er_source/`. Treat it as a structural snapshot: regenerate and review it whenever `backend/prisma/schema.prisma` or database migrations change. Where a structural diagram and a later explicitly approved decision differ, record and follow the approved decision; do not silently reconcile a conflict.

## 3. Technology and architecture

- **Frontend:** React + Vite + TypeScript.
- **Backend:** Node.js + Express + TypeScript.
- **API:** REST.
- **ORM:** Prisma 7.
- **Database:** PostgreSQL.
- **Architecture:** modular monolith — one backend and one PostgreSQL database, with clear functional boundaries.
- **Database runtime:** PostgreSQL is run locally through Docker Compose for this project.
- **Supabase is prohibited.** Do not introduce it for database, authentication, backend or hosting.
- **Market-data provider:** provider selection/integration is a separate M4 task. Hide provider-specific behavior behind backend adapters/services. Keep credentials server-side.

Do not introduce microservices or additional infrastructure without an explicit project decision.

## 4. Repository map

This describes the current starter-pack layout and the intended homes for upcoming code. A directory marked *planned* is not evidence that the feature already exists.

```text
TradeWise/
├── AGENTS.md                         # This file: master project map and agent instructions
├── README.md                         # Setup and project entry point
├── .nvmrc                            # Node version
├── package.json                      # Root workspace configuration
├── docker-compose.yml                # Local PostgreSQL service
├── frontend/
│   ├── DESIGN.md                     # Frontend design authority; teammate-owned
│   └── src/                          # Planned application source
│       ├── components/
│       │   ├── ui/                   # Generic reusable UI primitives
│       │   ├── layout/               # App shell, navigation, shared layouts
│       │   └── charts/               # Reusable chart presentation
│       ├── modules/                  # Feature-specific UI by M1–M7
│       ├── pages/                    # Route-level pages
│       ├── hooks/                    # Shared frontend hooks
│       └── services/                 # API clients and frontend service wrappers
├── backend/
│   ├── package.json                  # Backend scripts and dependencies
│   ├── tsconfig.json
│   ├── eslint.config.js
│   ├── prisma7.config.ts             # Prisma 7 configuration
│   ├── prisma/
│   │   ├── schema.prisma             # Database model and relations
│   │   └── migrations/               # Versioned PostgreSQL migrations
│   ├── src/
│   │   ├── app.ts                    # Express app configuration
│   │   ├── server.ts                 # HTTP server entry point
│   │   ├── config/                   # Environment/configuration (planned)
│   │   ├── middleware/               # Auth, validation, error handling (planned)
│   │   ├── routes/                   # REST route registration (planned)
│   │   ├── controllers/              # HTTP request/response handling (planned)
│   │   ├── services/                 # Business logic and domain operations
│   │   ├── utils/                    # Shared backend utilities (planned)
│   │   └── lib/
│   │       └── prisma.ts             # Shared Prisma client
│   └── tests/
│       └── orderExecution.test.ts    # PostgreSQL integration tests for M6 foundation
└── docs/
    ├── DECISIONS.md                  # Approved decisions and decision history
    └── TESTING.md                   # Module test commands and closing notes
```

### Placement rules

- Routes define endpoints and connect middleware/controllers.
- Controllers translate HTTP input/output; keep business rules out of controllers.
- Services own domain behavior and orchestration.
- `lib/` contains shared infrastructure clients such as Prisma.
- `config/` owns validated environment/configuration, not feature logic.
- `middleware/` owns cross-cutting request behavior such as authentication, authorization, validation and error handling.
- `utils/` is for genuinely shared helpers; do not use it as a dumping ground.
- Frontend generic primitives stay in `components/ui`; shared shell/navigation stays in `components/layout`; reusable chart rendering stays in `components/charts`.
- Feature-specific compositions belong in `frontend/src/modules/<module>/`, not in the generic component library.
- Keep tests close to the backend test convention unless a module establishes a clearer shared convention. Update `docs/TESTING.md` with the actual command.

## 5. Functional modules, prerequisites and current state

Module numbering is the project roadmap. Module completion means its own acceptance criteria and handoff are complete; it does not imply the entire product is complete.

### M0 — Project Foundation

**Purpose:** establish the shared repository, architecture, design contract, development environment and database foundation.

**Prerequisites:** none.

**Completed in the supplied project state:**
- Product scope, stack and modular-monolith architecture documented.
- Repository and collaboration conventions documented.
- Functional module boundaries and dependency map documented.
- PostgreSQL Docker setup and Prisma 7 configuration.
- Prisma schema and five migrations.
- Database constraints, indexes, foreign-key policies and ledger immutability trigger.
- Portfolio creation and order-execution service foundations.
- PostgreSQL-backed integration tests: 28/28 passed in the latest reported run.
- Backend typecheck and production build passed in the latest reported run.
- User confirmed all migrations were applied to the development database.

**Remaining / ownership:**
- Frontend foundation is being handled by the frontend teammate. `frontend/DESIGN.md` is the visual authority; do not overwrite or redesign it as part of backend/documentation work.
- Reconfirm frontend foundation completion with its owner before declaring every M0 workstream closed.
- API surface, authentication, feature routes and full application flows belong to their functional modules, not to M0 merely because the server scaffold exists.

**M0 exit:** shared contracts and environment are usable; schema/migrations are reproducible; baseline services compile and tests pass; docs accurately describe the project.

### M1 — Identity & Access

**Prerequisite:** M0.

**Scope:** registration, login, logout/session lifecycle, password hashing, authentication middleware, USER/ADMIN authorization, profile management, protected routes and account lifecycle enforcement.

**TODO:**
- Implement registration/login/logout and session/token strategy.
- Hash passwords; never store or return plaintext passwords.
- Implement authentication and role/ownership middleware.
- Enforce `isActive = true` and `deletedAt IS NULL` for eligible account actions.
- Implement profile APIs and ownership checks.
- Implement account soft-deletion workflow, session revocation and pending-order handling in accordance with `docs/DECISIONS.md`.
- Add API and security tests.

### M2 — Learning Management

**Prerequisite:** M1 for authenticated/admin operations. Can be developed in parallel with M4 once shared contracts are respected.

**Scope:** modules, lessons, educational examples/media references, learner content APIs, admin content CRUD and publishing/archive workflows.

**TODO:**
- Implement admin create/update/publish/archive flows for modules and lessons.
- Implement learner listing/detail APIs exposing published content only.
- Enforce module–lesson ownership and ordering.
- Support external media references; do not store media binaries in ordinary relational columns.
- Preserve historical learning content where progress/attempt references exist.
- Add validation, authorization, API and content-lifecycle tests.

### M3 — Assessment & Progress

**Prerequisite:** M2.

**Scope:** quizzes, questions, options, attempts, answers, scoring, lesson progress, achievements and learning analytics.

**TODO:**
- Implement quiz/question/option authoring and publishing.
- Implement attempt creation, resume, deadline enforcement, submission and explicit abandonment.
- Validate attempt ownership, question-to-quiz and option-to-question integrity.
- Implement single-choice scoring, pass threshold, unlimited retakes, best/latest results and no-negative-marking rules.
- Preserve submitted attempts and their historical quiz content.
- Decide and implement one-time quiz XP persistence before awarding XP.
- Add timeout, retry, concurrency, immutability and authorization tests.

**Important current decision:** published quiz content is immutable; edits require a replacement quiz. Do not introduce a quiz-version grouping system unless the decision register is explicitly changed.

### M4 — Market Data

**Prerequisite:** M1 for user-facing protected operations; may proceed in parallel with M2.

**Scope:** instrument catalogue, provider integration, quotes, OHLC/candles, index data, normalization, caching, stale-data and provider-error handling.

**TODO:**
- Finalize provider selection and supported instrument scope.
- Implement provider adapter(s) behind an internal market-data contract.
- Normalize provider identifiers and instrument data.
- Implement instrument lookup, quote and candle APIs.
- Implement caching, freshness metadata, timeouts, rate-limit and stale-data behavior.
- Keep provider secrets on the backend.
- Add deterministic tests using mocked provider responses.

**Boundary:** synthetic `MarketScenario`/`ScenarioCandle` data is educational content, not live exchange data. Keep it distinct from provider-sourced market data.

### M5 — Market Visualization

**Prerequisite:** M4. Independent of M6.

**Scope:** instrument detail, chart workspace, candlesticks, timeframes, indicators, watchlists and saved chart configurations.

**TODO:**
- Build instrument detail and chart workspace using the market-data contract.
- Render candle data and timeframe selections.
- Implement indicators with validation for insufficient/invalid input.
- Implement watchlist CRUD and ownership enforcement.
- Persist chart configurations.
- Handle loading, empty, stale and error states.
- Follow `frontend/DESIGN.md`; test responsive behavior and chart usability.

### M6 — Paper Trading

**Prerequisite:** M4 for validated execution prices and instrument data. Does not depend on M5.

**Scope:** virtual portfolios, cash, orders, simulated execution, trades, holdings, append-only ledger and P&L.

**Implemented foundation in the supplied state:**
- `backend/src/services/portfolio.service.ts`
- `backend/src/services/orderExecution.service.ts`
- Prisma models/migrations and database invariants.
- Integration tests covering BUY/SELL accounting, weighted average, partial liquidation, LIMIT behavior, idempotency, concurrency, account restrictions, constraints/FKs, ledger immutability and rounding.

**Remaining / TODO:**
- Expose portfolio/order/trade/holding/ledger operations through authenticated REST APIs.
- Add request validation and portfolio ownership checks at API boundaries.
- Connect execution to the M4 market-data/execution-price contract; the execution service accepts a validated decimal price and must not fetch provider prices itself.
- Implement order listing/detail/cancellation where allowed by the agreed lifecycle.
- Implement account settlement/closure workflow and any remaining lifecycle requirements.
- Add API-level and end-to-end tests.
- Ensure UI clearly communicates simulated paper trading and P&L-before-fees.

**MVP rules:** INR virtual funds; MARKET/LIMIT; DELIVERY/INTRADAY; immediate simulated full fills; no short selling; one trade per order; no brokerage charges; atomic/idempotent financial updates. SELL may liquidate part of an existing holding, but an order is fully executed or rejected.

### M7 — Dashboard & Analytics

**Prerequisite:** M1 for shell/identity; complete data-driven aggregations depend on M2/M3/M4/M5/M6 source modules. Shell can start earlier.

**Scope:** learner and admin dashboards; learning, assessment, portfolio and trading summaries.

**TODO:**
- Establish dashboard shell and role-specific navigation.
- Add learning summaries from M2/M3.
- Add market/portfolio/trading summaries from M4/M6.
- Keep realized and unrealized P&L distinct.
- Handle empty, delayed and unavailable source data.
- Enforce user ownership and admin authorization.
- Add aggregation and cross-module tests.

## 6. Dependency map

```text
                         M0 — Foundation
                                |
                                v
                       M1 — Identity & Access
                         /              \
                        v                v
              M2 — Learning         M4 — Market Data
                        |              /       \
                        v             v         v
              M3 — Assessment    M5 — Charts  M6 — Paper Trading
                        \             |         /
                         \            |        /
                          +-----------+-------+
                                      |
                                      v
                           M7 — Dashboard & Analytics
                                      |
                                      v
                           System Integration & QA
                                      |
                                      v
                                  Deployment
```

- M2 and M4 can proceed in parallel after M0 contracts are stable.
- M3 follows M2.
- M5 and M6 are siblings; both depend on M4, neither depends on the other.
- M7's shell can begin early; complete aggregations wait for source modules.
- Testing is continuous, not a final-phase activity.
- Deployment preparation can begin early; production delivery follows integration and QA.

## 7. Cross-project engineering rules

### Before coding
1. Read this file.
2. Identify the target module, its prerequisites and downstream consumers.
3. Inspect existing code, schema, APIs, tests and shared components before creating alternatives.
4. Read the relevant supporting document(s) linked in Section 2.
5. Confirm acceptance criteria. Raise ambiguity rather than inventing broad behavior.

### While coding
- Follow approved decisions in `docs/DECISIONS.md`.
- Reuse shared components, services, hooks, validators and utilities.
- Validate untrusted input at API boundaries.
- Enforce authorization on the backend; never rely on hidden frontend controls.
- Handle loading, empty, error, disabled and success states.
- Keep provider credentials server-side.
- Use PostgreSQL `DECIMAL`/`NUMERIC` and decimal arithmetic for money; never JS floating-point `Number` for monetary calculations.
- Use transactions for multi-record financial updates.
- Preserve ledger append-only behavior and historical learning/trading records.
- Avoid unrelated refactors and uncoordinated contract changes.
- Keep accessibility and responsive behavior in scope.

### Before closing a module
1. Run the relevant test, typecheck, lint and build commands available for that module.
2. Update `docs/TESTING.md` with how to run the module's checks and a concise closing note: what was implemented, what was actually verified, known gaps and follow-up work.
3. Update `docs/DECISIONS.md` if a decision was added, refined or superseded; record the reason and affected areas.
4. Update this `AGENTS.md` module status/TODOs if project state materially changed.
5. Report exactly what ran and its outcome. Never claim an unrun test passed.

## 8. Security and repository hygiene

- Never commit `.env`, `.env.test`, credentials, tokens, API keys, database dumps or personal data.
- Keep safe placeholders in `.env.example`; never copy real values into documentation.
- Keep generated output, dependencies and local runtime data out of source control unless explicitly required.
- Use focused branches/PRs and keep `main` stable.
- Do not expose secrets in frontend bundles or logs.

## 9. Definition of done

A module is done when its documented scope and acceptance criteria are met, relevant checks have actually run (or unrun checks are clearly stated), known gaps are recorded, architecture/design conventions are followed, and its concise handoff note is present in `docs/TESTING.md`.

## 10. Conflict handling

Explicitly approved project-owner decisions take precedence over assumptions or generic recommendations. `docs/DECISIONS.md` is authoritative for approved product/data/business rules; `frontend/DESIGN.md` is authoritative for visual design; `docs/TESTING.md` is authoritative for test commands and module handoff notes. If two authoritative sources conflict and no later approved decision resolves it, stop and raise the conflict rather than guessing.
