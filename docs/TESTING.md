# TradeWise — Shared Testing Plan & Engineering Test Log

This is a living document. Update it when implementation introduces or changes behavior. **Never claim a test passed unless it was actually executed.**

## 1. Purpose
Share testing conventions, module scenarios, integration journeys, actual results, known gaps and agent observations. This document complements automated test files; it does not replace them.

## 2. Principles
- Test acceptance criteria and behavior.
- Add regression coverage for bug fixes.
- Test failure paths and edge cases, not only happy paths.
- Enforce authorization on the backend.
- Use isolated, repeatable test data.
- Mock external market providers for deterministic tests.
- Label manual, automated, planned and executed checks clearly.
- Do not use live provider availability as a dependency for ordinary unit tests.

## 3. Status vocabulary
| Status | Meaning |
|---|---|
| Planned | Scenario identified; no test implemented |
| Implemented | Test or procedure exists |
| Executed — Passed | Actually run and passed |
| Executed — Failed | Actually run and failed |
| Blocked | Could not run; reason recorded |
| Not Run | Exists but has not been executed |

## 4. Test layers
- **Unit:** validators, calculations, scoring, normalization and isolated services.
- **API/integration:** routes, response contracts, auth, database constraints, transactions and mocked provider adapters.
- **Frontend component:** user-visible behavior, form validation, loading/error/empty states, keyboard behavior.
- **End-to-end:** complete user journeys across frontend, backend and database.
- **Manual/visual:** responsive layout, chart usability and cross-module visual consistency. Record browser/device/viewport.

## 5. Cross-project baseline
- [ ] Frontend production build succeeds.
- [ ] Backend starts with documented environment variables.
- [ ] Migrations apply to a clean database.
- [ ] Seed process works as intended.
- [ ] Malformed API input is rejected.
- [ ] Protected APIs reject unauthenticated requests.
- [ ] Role-restricted APIs reject unauthorized roles.
- [ ] Secrets are not committed or exposed in frontend bundles.
- [ ] Shared components render consistently.
- [ ] Data-driven pages handle loading, empty and error states.
- [ ] Responsive behavior checked at agreed viewports.
- [ ] Critical end-to-end journeys pass.
- [ ] No unresolved critical regression remains.

## 6. Initial module test scenarios
These are planned scenarios, **not claims that tests exist or have passed**. Expand them during implementation.

### M1 — Identity & Access
- [ ] Valid registration; invalid input rejected.
- [ ] Duplicate email rejected.
- [ ] Valid login succeeds; incorrect credentials rejected safely.
- [ ] Logout clears/invalidates expected auth state.
- [ ] Protected API rejects missing/invalid auth.
- [ ] USER cannot access ADMIN-only actions.
- [ ] Profile ownership enforced.
- [ ] Passwords never stored or returned in plaintext.

### M2 — Learning Management
- [ ] Published modules/lessons are listed.
- [ ] Draft content is not exposed to ordinary users.
- [ ] Lesson belongs to requested module.
- [ ] Missing/empty content handled.
- [ ] Admin content actions require authorization.
- [ ] Missing media handled gracefully.

### M3 — Assessment & Progress
- [ ] Quiz questions belong to the requested quiz.
- [ ] Option/question ownership is validated.
- [ ] Invalid or unavailable quiz attempts rejected.
- [ ] Scoring handles all-correct, all-wrong and boundary cases.
- [ ] Passing-score boundary is correct.
- [ ] Retry/duplicate submission behavior is safe.
- [ ] Progress unique per user and lesson.
- [ ] Progress transitions are valid.
- [ ] Achievement is not awarded repeatedly.
- [ ] Users cannot access others' attempts/progress.

### M4 — Market Data
- [ ] Valid and unknown instrument lookup.
- [ ] Provider response normalized to internal contract.
- [ ] Timeout, provider error and rate limit handled.
- [ ] Missing/malformed provider fields handled.
- [ ] Cache freshness/expiry correct.
- [ ] Stale data is not silently shown as fresh.
- [ ] Provider credentials remain server-side.
- [ ] Exchange timestamps/timezone conventions consistent.

### M5 — Market Visualization
- [ ] Chart renders valid candle data.
- [ ] Empty/insufficient candle data handled.
- [ ] Timeframe requests correct data range.
- [ ] OHLC values displayed consistently.
- [ ] Watchlist add/remove works; duplicates prevented.
- [ ] Users cannot access another user's private watchlist/config.
- [ ] Indicators handle insufficient/invalid input.
- [ ] Chart usable at agreed responsive sizes.

### M6 — Paper Trading
- [ ] Portfolio initialized with agreed virtual balance.
- [ ] BUY updates cash, trade, holding and ledger.
- [ ] SELL updates cash, trade, holding and ledger.
- [ ] Overselling rejected.
- [ ] Invalid quantity/price rejected.
- [ ] LIMIT requires limitPrice; MARKET does not.
- [ ] Invalid order state transitions rejected.
- [ ] Weighted-average cost correct after multiple BUYs.
- [ ] Partial SELL preserves remaining average cost.
- [ ] Full SELL follows agreed zero-quantity/deletion policy.
- [ ] Realized and unrealized P&L calculated separately.
- [ ] Transaction rollback prevents partial financial updates.
- [ ] Retry does not duplicate trade/ledger effects.
- [ ] Ledger sign convention respected.
- [ ] Portfolio ownership enforced.
- [ ] UI clearly labels simulation/paper trading.

### M7 — Dashboard & Analytics
- [ ] Empty learning activity handled.
- [ ] Empty portfolio/trade history handled.
- [ ] Learning summaries match source data.
- [ ] Portfolio summaries match source calculations.
- [ ] Realized/unrealized P&L remain distinct.
- [ ] Missing/delayed market prices handled.
- [ ] User sees only their own data.
- [ ] Admin analytics enforce authorization.

## 7. Cross-module end-to-end journeys

### Journey A — Learn and assess
1. Register/login.
2. Open a published module and lesson.
3. Complete lesson.
4. Attempt its quiz.
5. View score and progress.
6. Confirm dashboard reflects learning state.

### Journey B — Explore and practice
1. Login and search an instrument.
2. Open instrument detail and view quote/candles.
3. Add it to a watchlist.
4. Open paper portfolio and place a valid simulated order.
5. Inspect order, trade, holding, cash and ledger.
6. Confirm dashboard reflects trading information.

### Journey C — Authorization
1. Login as USER and attempt an ADMIN-only action.
2. Confirm backend rejects it.
3. Login as ADMIN and confirm permitted action succeeds.
4. Confirm users cannot access each other's private records.

## 8. Test execution log
Append entries; preserve history.

| Date | Module/area | Branch or PR | Tests/commands actually executed | Result | Notes |
|---|---|---|---|---|---|
| Initial scaffold | Documentation only | — | No application tests executed | Not Run | This pack documents planned coverage only. |

## 9. Known issues and gaps
| ID | Module | Issue/gap | Severity | Status | Owner/reference |
|---|---|---|---|---|---|
| — | — | No issues recorded yet | — | — | — |

## 10. Agent remarks
Append concise, actionable observations. Do not present hypotheses as verified bugs.

```md
### YYYY-MM-DD — Mx — Short observation
- **Discovered by:** developer / agent / branch / PR
- **Observation:** What was found?
- **Risk:** What could go wrong?
- **Suggested test/action:** What should be added or changed?
- **Status:** Open / Addressed / Won't fix (with reason)
```

## 11. Mandatory update instructions for agents
When behavior changes:
1. Add/update relevant test scenarios.
2. Record tests actually executed and results.
3. Mark tests not run or blocked, with reasons.
4. Add meaningful edge cases and risks.
5. Do not delete another contributor's notes without discussion.
6. Raise product/contract ambiguity instead of silently choosing behavior.
