# TradeWise — Architecture & Product Decision Register

**Status:** Living, authoritative decision register
**Project:** TradeWise — trading education and paper-trading platform
**Current baseline:** Decisions 1–9, including subsequent refinements recorded below
**Structural reference:** [`TradeWise_ER_v1_11.pdf`](./TradeWise_ER_v1_11.pdf), generated as an as-built ER diagram from the implemented Prisma schema and SQL migrations. Editable Graphviz sources: [`er_source/`](./er_source/).
**Implementation snapshot:** Prisma schema, five migrations, portfolio/order-execution services and 28 PostgreSQL integration tests are present in the supplied Module 00 project snapshot. See each decision's status and `docs/TESTING.md`; do not infer that all future module behavior is implemented.

## How to use this register

- **Approved** means the rule is part of the project contract.
- **Implemented** means the rule is represented in code/schema/migrations.
- **Verified** means a relevant check or test was actually run.
- A decision may be approved without being fully implemented or verified.
- Read this file before changing schema, migrations, APIs, financial logic, account lifecycle, learning/quiz behavior or retention.
- Do not silently change an approved decision. Propose the change, explain impact, obtain project-owner approval, then update this register and its history.
- Keep this register aligned with `AGENTS.md`, Prisma schema/migrations, services, tests and module handoffs.
- Prisma validation alone does not prove PostgreSQL constraints, triggers, transactional rules or authorization are enforced.
- Open items below are not approved requirements. Do not guess.

## Decision status vocabulary

| Status | Meaning |
|---|---|
| Proposed | Under discussion; not binding |
| Approved | Explicitly agreed project contract |
| Implemented | Reflected in code/schema/migrations |
| Verified | Tested against intended behavior |
| Superseded | Replaced by a later recorded decision |

---

## 1. Monetary precision and rounding

**Decision: Approved · Implementation: Partially implemented · Verification: Selected accounting/rounding boundaries verified; cumulative cost-basis precision needs follow-up**

| Data | PostgreSQL precision |
|---|---|
| Portfolio initial/cash balance | `DECIMAL(20,2)` |
| Ledger amount/balance after | `DECIMAL(20,2)` |
| Trade total value | `DECIMAL(20,2)` |
| Trade realized P&L | `DECIMAL(20,2)` |
| Execution price | `DECIMAL(18,4)` |
| Holding average buy price | `DECIMAL(18,4)` |
| Trade cost basis amount | `DECIMAL(20,4)` |

Rules:
- Use decimal arithmetic throughout financial calculations; never JavaScript floating-point `Number` for money.
- Apply `ROUND_HALF_UP` at accounting boundaries.
- Calculate quantity × execution price first, then round the final INR amount to two decimal places.
- Cost basis retains four-decimal internal precision; do not reconstruct it from repeatedly rounded average prices.
- **Implementation review note:** the current `orderExecution.service.ts` calculates SELL cost basis from the stored `Holding.averageBuyPrice` (four-decimal scale). The current tests verify selected rounding cases, but do not establish that cumulative cost basis is preserved without repeated-average rounding. Resolve this discrepancy before claiming exact long-run cost-basis precision; do not silently change the model or approved rule.
- Realized P&L = rounded accounting proceeds − rounded cost basis, rounded to two decimals.
- Fees/brokerage are excluded from MVP calculations. Any P&L presentation must not imply fees have been deducted.

## 2. PostgreSQL CHECK constraints

**Decision: Approved · Implementation: Implemented in custom SQL migration · Verification: Verified with database-level negative tests**

Enforce in PostgreSQL:
- Scenario candle OHLC values are positive.
- `high >= low`, `high >= open`, `high >= close`; `low <= open`, `low <= close`.
- Candle volume is non-negative; zero volume is allowed.
- Order quantity is positive.
- A supplied `limitPrice` is positive.
- LIMIT requires a non-NULL positive `limitPrice`; MARKET requires `limitPrice IS NULL`.
- Trade executed quantity, execution price and total value are positive.
- Holding quantity and average buy price are positive; zero-quantity holdings are removed.

Mandatory fields must also be `NOT NULL`; CHECK constraints alone do not reject NULL. Prisma does not express these custom checks in the schema language, so retain them in reviewed SQL migrations.

## 3. No short selling

**Decision: Approved · Implementation: Implemented in order-execution service · Verification: Verified, including concurrent SELL tests**

- Reject a SELL when the portfolio does not hold enough units of the instrument.
- No short selling in MVP.
- A SELL may liquidate part of an existing holding, provided requested quantity does not exceed the available quantity.
- Each order is still an all-or-reject execution; partial order fills are not supported.
- Holding sufficiency check and execution occur in the same transaction with concurrency protection.
- A rejected SELL must not create a Trade, mutate a Holding, change cash or append a successful execution ledger entry.

## 4. Append-only portfolio ledger

**Decision: Approved · Implementation: Implemented in service/schema and PostgreSQL triggers · Verification: Verified for UPDATE/DELETE rejection and portfolio-funding rollback**

- Ledger entries are append-only. Existing entries are never edited or deleted.
- Corrections use compensating entries.
- Signed amounts: initial funding positive; SELL proceeds positive; BUY cost negative.
- Every entry records `balanceAfter`.
- Portfolio creation creates an `INITIAL_FUNDING` entry equal to initial virtual funding; it has no Trade link.
- Database triggers reject UPDATE and DELETE. Keep service behavior consistent with this invariant.

## 5. Atomic and idempotent order execution

**Decision: Approved · Implementation: Implemented in `orderExecution.service.ts` · Verification: Verified for rollback, retries and concurrent execution**

An order executes at most once. Retrying an executed order returns its existing result and must not duplicate financial effects.

One database transaction must:
1. Lock the order row and read its current state.
2. Return the existing Trade/result for an already executed order.
3. Serialize financial operations for the portfolio using a portfolio-row lock.
4. Validate account eligibility, order state, limit condition, cash or holdings.
5. Create the Trade.
6. Update or remove the Holding.
7. Update portfolio cash.
8. Append the ledger entry.
9. Mark the Order EXECUTED and set its execution timestamp.
10. Commit all changes together.

Any failure rolls back all financial changes. Enforce one Trade per Order with uniqueness. The service accepts a validated execution-price decimal string from its caller; it does not fetch market data itself.

### LIMIT behavior

- BUY LIMIT remains pending when execution price is above the limit price.
- SELL LIMIT remains pending when execution price is below the limit price.
- Otherwise the order may execute, subject to the other validations.
- MARKET orders have no limit price.

## 6. Account lifecycle: suspension and soft deletion

**Decision: Approved · Implementation: Fields and trading/portfolio service checks implemented · Verification: Verified for inactive and soft-deleted account restrictions; full closure workflow remains outstanding**

The account lifecycle has two independent concepts:
- `isActive`: administrative suspension/reactivation.
- `deletedAt`: soft-deletion timestamp; NULL means not soft-deleted.

Login and trading/portfolio creation require `isActive = true` and `deletedAt IS NULL`. Do not remove or repurpose either field without approval.

Retention rules:
- Preserve portfolios, orders, trades, ledger entries, quiz attempts and required admin activity history.
- User → Profile: CASCADE.
- User → Watchlists: CASCADE.
- User → ChartConfigurations: CASCADE.
- User → Portfolios: RESTRICT.
- User → QuizAttempts: RESTRICT/preserve.
- User → AdminActivityLogs: RESTRICT/preserve.
- Pending BUY/SELL orders are cancelled and any reserved resources released; preserve order/cancellation history.
- Do not erase open positions as a shortcut to account closure.
- Automatic simulated SELL requires explicit user consent. If settlement cannot be completed, deletion remains pending; manual settlement is possible.
- Privacy erasure/anonymization is separate from soft deletion.

**Not yet implemented in the supplied snapshot:** complete account closure orchestration, session revocation, pending-order cancellation/release and open-position settlement workflow.

## 7. Quiz, assessment and learning integrity

**Decision: Approved · Schema/composite integrity partly implemented · Service behavior not yet implemented in the supplied snapshot**

Authorization and answer integrity:
- Backend validates that the selected Option belongs to the answered Question.
- Question belongs to the Quiz associated with the attempt.
- QuizAttempt belongs to the authenticated user.
- Composite foreign keys enforce attempt/quiz, question/quiz and option/question relationships in the database.
- Backend authorization is mandatory; frontend controls are not security boundaries.

Attempt lifecycle:
- Statuses: `IN_PROGRESS`, `SUBMITTED`, `ABANDONED`.
- Answers are editable only while IN_PROGRESS; submitted attempts and answers are immutable.
- Refresh, browser crash, navigation and network interruption resume the same in-progress attempt; timer continues.
- Only explicit **Abandon Quiz** marks an attempt ABANDONED; abandoned attempts cannot resume.
- Backend enforces `expiresAt`; timeout auto-submits saved answers; unanswered questions score zero.
- Retakes create new attempts; preserve all attempts.
- Unlimited retakes. Track best and latest results separately.
- Passing any attempt marks the quiz as passed.
- No negative marking.
- XP is awarded only once per quiz; duplicate/concurrent submissions must not award it repeatedly.

### Quiz content change policy — refined decision

- Published quiz content is immutable.
- Any change to a published quiz's questions, options, correct answers, points or marking configuration requires creating a **replacement Quiz**.
- New attempts use the replacement once it is published and made current/available through the content workflow.
- Existing attempts remain associated with the original Quiz and its unchanged content.
- MVP does **not** introduce quiz version numbers, version-group IDs, or a separate quiz-version management system.
- This replaces the earlier proposal to version/group an entire quiz. Do not implement the earlier grouping design.

**Implementation gaps:** attempt creation/resume/deadline/submission/scoring services, published-content immutability enforcement, replacement-quiz workflow, best/latest result logic and one-time XP persistence/uniqueness.

## 8. Query-driven indexes

**Decision: Approved · Implementation: Implemented for the selected query patterns · Verification: Database indexes confirmed**

Selected indexes:
- Module `(status, orderIndex)`.
- Lesson `(moduleId, status)`.
- Quiz `(lessonId, status)`.
- Order `(portfolioId, status, createdAt DESC)`.
- Order `(portfolioId, instrumentId, createdAt DESC)`.
- QuizAttempt `(userId, quizId, createdAt DESC)`.

Avoid redundant indexes where a composite index covers the leading-column access pattern. Add further indexes only when supported by query patterns and review representative query plans with `EXPLAIN ANALYZE`.

## 9. Foreign-key deletion policies

**Decision: Approved · Implementation: Applied in schema/migrations for reviewed relations · Verification: Selected FK behavior tested; full matrix still needs module-level coverage**

| Relationship | Policy |
|---|---|
| User → Profile | CASCADE |
| User → Watchlists | CASCADE |
| User → ChartConfigurations | CASCADE |
| User → Portfolios | RESTRICT |
| Portfolio → Orders | RESTRICT |
| Portfolio → Holdings | RESTRICT |
| Portfolio → Ledger entries | RESTRICT |
| Order → Trade | RESTRICT |
| Instrument → Orders | RESTRICT |
| Instrument → Holdings | RESTRICT |
| MarketScenario → ScenarioCandles | CASCADE |
| Lesson ↔ MarketScenario links | CASCADE |
| Question/Option → UserAnswer | RESTRICT |
| Quiz → Questions | RESTRICT |
| User → QuizAttempts | RESTRICT |
| User → AdminActivityLogs | RESTRICT |
| Module → Lessons | RESTRICT |
| Lesson → Quizzes | RESTRICT |

Additional rules:
- PostgreSQL RESTRICT is unconditional. Where the product allows physical deletion only when no historical references exist, enforce the conditional check in a controlled application workflow; otherwise archive/deactivate.
- Preserve submitted historical answer meaning. Published quiz content is immutable; replacements are separate Quiz records.
- Scenario candle deletion follows its scenario; lesson-scenario link rows cascade when either linked parent is removed.

## 10. Market-data boundary and execution-price ownership

**Decision: Approved architectural boundary; provider choice remains open**

- Market data is an upstream domain (M4), separate from paper-trading execution (M6).
- Provider-specific identifiers and behavior must be hidden behind an internal adapter/service contract.
- Provider secrets remain server-side.
- M6 execution receives a validated execution price from its caller/upstream integration. It must not call a market-data provider directly.
- TradingView is the intended market-data/charting direction discussed by the team; exact integration method, plan/permissions and supported data coverage must be confirmed during M4. Do not invent an alternate provider or claim integration already exists.
- Synthetic `MarketScenario`/`ScenarioCandle` data is educational scenario data, not live or exchange historical data.

## 11. MVP paper-trading scope

**Decision: Approved**

- Virtual-money simulation, primarily INR; no real-money brokerage execution.
- MARKET and LIMIT orders; DELIVERY and INTRADAY product types.
- Immediate simulated full fills; no partial fills at the order-execution level.
- No short selling.
- One Trade per Order.
- No brokerage charges/fees in MVP.
- A valid SELL may partially liquidate an existing Holding; the SELL order itself fills fully or is rejected.
- Unrealized P&L is current market value minus remaining cost basis. Keep it separate from realized P&L.
- `Position` is a calculated view, not a separate persisted entity in the current MVP model.
- INTRADAY session/square-off semantics must be specified before implementing any automatic intraday square-off behavior; `productType` alone does not define it.

## 12. Remaining explicit implementation questions

These are not settled by the decisions above and must not be guessed:

1. **Quiz XP persistence:** exact durable representation and uniqueness strategy for one-time XP awards.
2. **Instrument identity:** provider ID uniqueness and symbol-change handling beyond the current `(exchange, symbol)` uniqueness.
3. **Instrument scope:** confirm exact MVP coverage across NSE/BSE equities, ETFs, indices and other instrument types.
4. **INTRADAY lifecycle:** session hours, expiry and square-off rules.
5. **Ledger entry vocabulary:** current implementation uses a string `entryType`; finalize the allowed vocabulary if additional entry types are introduced.
6. **Initial funding policy:** service currently accepts a positive initial balance; decide platform/user limits and defaults before exposing the API.
7. **Account closure orchestration:** session revocation, pending order cancellation/resource release, settlement consent and anonymization workflow.
8. **Quiz publishing/current replacement workflow:** define how the system identifies which replacement quiz is currently available to learners, without introducing version-grouping unless approved.
9. **Conditional content deletion/archive workflow:** enforce the historical-reference checks described in Decision 9.

## Decision history

| Date | Decision/change | Status | Rationale / affected areas |
|---|---|---|---|
| 2026-11-14 | Decisions 1–9 initially agreed | Approved | Monetary precision, constraints, short selling, ledger, execution, account lifecycle, quiz integrity, indexes and FK policies |
| 2026-11-14 | Clarified `isActive` and `deletedAt` as independent lifecycle fields | Approved; implemented in schema/services | `isActive` is administrative suspension; `deletedAt` is soft deletion |
| 2026-11-14 | Replaced proposed quiz version grouping with immutable published Quiz + replacement Quiz | Approved; schema uses no version grouping | Simpler MVP; existing attempts remain tied to unchanged original Quiz |
| 2026-11-14 | Confirmed LIMIT execution condition and validated-price boundary for M6 | Approved; implemented in execution service | M6 receives validated price upstream and does not fetch provider data |
| 2026-11-14 | Confirmed partial liquidation is allowed while partial order fills are not | Approved; implemented and tested | SELL order is full execution or rejection; remaining Holding keeps average cost |

## Change log

| Date | Change | Reason |
|---|---|---|
| 2026-11-14 | Register reconciled with the implemented Module 00 database/services snapshot | Previous status and open-question sections were stale; reflect actual schema, five migrations, services and 28-test evidence |
