# TradeWise — Agent Instructions & Project Knowledge

**Read this file before making changes.** This is the shared starting point for every developer and coding agent.

## Product
TradeWise is a trading education and paper-trading web application, primarily for Indian markets. Its journey is **Learn → Visualize → Practice → Improve**. Help beginners learn trading, explore market information, practice with virtual money, and review their progress. Build a coherent MVP before optional features. Never imply paper trading is real-money execution.

## Stack and architecture
- Frontend: React + Vite
- Backend: Node.js + Express
- ORM: Prisma
- Database: PostgreSQL
- API: REST
- Architecture: modular monolith — one backend and one PostgreSQL database, with clear functional boundaries.
- Supabase is prohibited. Do not introduce it for database, auth, backend, or hosting.
- Market-data provider is undecided. Hide provider-specific behavior behind backend adapters/services. Never expose provider secrets in the browser.

## Agreed functional modules
- **M1 Identity & Access:** registration/login/logout, password handling, auth middleware, USER/ADMIN authorization, profiles, protected routes.
- **M2 Learning Management:** modules, lessons, educational examples/media references, publishing/admin content tools.
- **M3 Assessment & Progress:** quizzes, questions, options, attempts, answers, scoring, lesson progress, achievements and learning analytics. Depends on M2.
- **M4 Market Data:** instruments, provider integration, quotes, OHLC/candles, index data, normalization, caching, stale-data/error handling.
- **M5 Market Visualization:** instrument detail, chart workspace, candlesticks, timeframes, indicators, watchlists and chart configuration. Depends on M4.
- **M6 Paper Trading:** virtual portfolios, cash, orders, simulated execution, trades, holdings, ledger and P&L. Depends on M4, not M5.
- **M7 Dashboard & Analytics:** learning, assessment, portfolio and trading aggregation; user/admin dashboards. Complete data-driven views depend on their source modules.

## Dependency map
```text
00 Foundation
    |
    v
M1 Identity & Access
    |
    +------------------------------+
    |                              |
    v                              v
M2 Learning                    M4 Market Data
    |                           /          \
    v                          v            v
M3 Assessment                M5 Charts    M6 Paper Trading
    \                          |            /
     +--------------------------+-----------+
                                |
                                v
                       M7 Dashboard & Analytics
                                |
                                v
                       System Integration & QA
                                |
                                v
                           Deployment
```
M2 and M4 can proceed in parallel after foundational contracts are agreed. M5 and M6 are siblings: both depend on M4, neither depends on the other. M7's shell can start early; complete aggregations depend on source modules. Testing is continuous, not deferred to the QA phase. Deployment preparation can start early; production delivery follows QA.

## Repository conventions
```text
TradeWise/
├── AGENTS.md
├── README.md
├── docs/TESTING.md
├── frontend/
│   ├── DESIGN.md
│   └── src/
│       ├── components/{ui,layout,charts}/
│       ├── modules/
│       ├── pages/
│       ├── hooks/
│       └── services/
└── backend/
    ├── prisma/
    └── src/{config,controllers,middleware,routes,services,utils}/
```
This is the intended structure, not a claim that application code already exists. Use focused feature branches and PRs; keep `main` stable. Never commit `.env`, credentials or API keys. Maintain `.env.example` with safe placeholders.

## Mandatory agent workflow
Before coding:
1. Read this file.
2. Identify the target module, upstream dependencies and downstream consumers.
3. Inspect existing code, schema, APIs and shared components before creating alternatives.
4. For frontend work, read `frontend/DESIGN.md`.
5. For testing, follow `docs/TESTING.md`.
6. Confirm acceptance criteria; flag ambiguity instead of inventing broad behavior.

While coding:
- Reuse shared components, hooks, services, utilities and validators.
- Keep module business logic out of generic UI primitives.
- Validate untrusted input on the backend.
- Handle loading, empty, error, disabled and success states.
- Avoid unrelated refactors and uncoordinated changes to another module's contracts.
- Keep accessibility and responsive behavior in scope.

Before finishing:
1. Run relevant tests, lint and build commands available in the repo.
2. Report exactly what ran and its outcome. Never claim an unrun test passed.
3. Update `docs/TESTING.md` with test cases, actual results, gaps and useful observations.
4. Update documentation when shared APIs, schema, dependencies, components or design decisions change.
5. Summarize changed files, behavior, tests, limitations and follow-up work.

## Frontend rules
- Every module must feel like the same TradeWise product.
- `frontend/DESIGN.md` is the visual source of truth.
- `components/ui/`: generic UI primitives. `components/layout/`: shared app shell/navigation. `components/charts/`: reusable chart presentation.
- Module-specific compositions belong inside that module, not in the shared library.
- Extend existing components with justified variants rather than duplicating them.
- Use shared tokens; avoid one-off colors, spacing, radii and typography.
- Module layouts can differ, but visual language must remain consistent.

## Backend and database rules
- Use Express, Prisma and PostgreSQL consistently.
- Keep routes/controllers/services responsibilities clear.
- Validate at API boundaries and enforce invariants in the database where appropriate.
- Use PostgreSQL DECIMAL/NUMERIC for prices and money, not floating point.
- Keep provider secrets server-side.
- Use transactions for multi-record financial updates.
- Do not persist live quote ticks as trade records; record simulated execution details in Trade.
- Coordinate schema changes; do not silently rename or repurpose agreed fields.

## Agreed MVP domain decisions
### Learning and assessment
- Lessons belong to modules; educational examples belong to lessons.
- Quizzes belong to lessons; questions belong to quizzes; options belong to questions.
- Attempts belong to users and quizzes; answers belong to attempts and questions.
- `LessonProgress` is unique on `(userId, lessonId)`, with status `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED` and nullable `completedAt`. Do not add timestamps without revisiting the decision.
- MVP uses single-choice MCQs. Multi-select requires a deliberate model change.

### Market data
- Normalize provider-specific instrument identifiers behind an internal instrument model.
- `MarketScenario`/`ScenarioCandle` are synthetic educational data, not live or historical exchange data.
- Render charts from candle data; do not store chart screenshots as market data.
- Media URLs reference external/object storage, not binary blobs in ordinary relational columns.

### Paper trading
- MVP is virtual-money trading, primarily INR; no real-money brokerage execution.
- MVP assumes immediate simulated full fills, no partial fills and no short selling.
- `Order.type` is MARKET/LIMIT; `productType` is DELIVERY/INTRADAY.
- `limitPrice` is required for LIMIT and absent for MARKET.
- MVP order statuses: PENDING, EXECUTED, REJECTED, CANCELLED. Add partial-fill states only if partial fills are implemented.
- One order has zero or one trade in the MVP full-fill model.
- Reject SELL quantities greater than current holdings.
- Weighted-average cost: BUY recalculates `(oldQty*oldAvg + buyQty*buyPrice)/(oldQty+buyQty)`. SELL allocates `soldQty*currentAverage`; realized P&L is net proceeds minus allocated cost basis. Remaining shares retain the same average cost.
- Unrealized P&L = current market value minus remaining cost basis. Keep realized and unrealized P&L separate.
- Update order, trade, holding, cash and ledger atomically. Make execution idempotent to prevent duplicate financial effects.
- Ledger convention: deposit and SELL positive, BUY negative; initial deposit has no trade link.
- Position is a calculated view, not a separate stored entity in the current MVP design.
- If fees are excluded, label P&L as excluding fees.

## Testing is part of implementation
Every agent must update `docs/TESTING.md` when behavior changes. Distinguish tests actually executed from recommended/unrun tests. Preserve other contributors' notes; do not record secrets or personal data.

## Definition of done
Acceptance criteria met; relevant tests run or explicitly marked unrun; UI states handled; design/architecture followed; docs and testing notes updated where needed; no unexplained unrelated changes; handoff summarizes changes and remaining work.

## Conflicting instructions
Current explicit team decisions take precedence. This file defines cross-project conventions; `frontend/DESIGN.md` governs visual design; `docs/TESTING.md` governs testing records. If authoritative documents conflict, flag the conflict and ask the team rather than guessing.
