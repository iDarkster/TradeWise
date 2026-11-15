# TradeWise — Frontend Design Entry Point

**Read this file before frontend work, then read [`SPECIFICATION.md`](./SPECIFICATION.md) in full.**

## Authority

[`SPECIFICATION.md`](./SPECIFICATION.md) is the **single canonical frontend engineering specification** for TradeWise. It supersedes the provisional visual placeholders and earlier layout assumptions previously recorded in this file.

Use the specification for:
- Product-facing frontend scope and technical stack.
- Light and dark themes, design tokens, typography, spacing and breakpoints.
- Application shell, navigation, canonical routes and responsive behavior.
- Shared component architecture and domain feature-slice organization.
- Forms, validation, API state, accessibility and interaction behavior.
- Loading, empty, error, offline and success states.
- Frontend testing and implementation standards.

## Shared product principles

- TradeWise is a trading education and paper-trading application, primarily for Indian markets.
- The product journey remains **Learn → Visualize → Practice → Improve**.
- Learning experiences should be approachable and explanatory; market and trading experiences may be more analytical and information-dense. They must still use one coherent design system.
- Paper trading is simulated. Never imply that the application executes real-money brokerage transactions.
- The frontend presents data and gathers user input; the backend remains authoritative for permissions, financial calculations, balances, prices, risk checks, order validation and other business-critical rules.
- Never fake successful authentication, account changes, deposits, withdrawals or trades. Show honest loading, success and failure states based on actual API responses.
- Use TradeWise-owned branding and assets. Groww is a visual reference only; do not copy its logo, proprietary assets or claim affiliation.

## Scope and conflict handling

`SPECIFICATION.md` defines how frontend work should be implemented. It does **not** change the product roadmap, backend contracts, approved business rules or module ownership in the repository-level [`AGENTS.md`](../AGENTS.md) and [`docs/DECISIONS.md`](../docs/DECISIONS.md).

In particular, the M2 learning and M3 assessment experiences remain part of the product journey and must use the same tokens, shared components, accessibility standards and responsive patterns defined in `SPECIFICATION.md`, even where a route or screen is not illustrated there.

If this entry point and `SPECIFICATION.md` appear to disagree, follow `SPECIFICATION.md`. If the frontend specification conflicts with an explicitly approved product or business decision, stop and raise the conflict rather than silently changing product scope or backend behavior.
