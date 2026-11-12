# TradeWise — Design System & Visual Guidelines

**Read before creating or materially changing frontend UI.** This document is the visual source of truth for all modules.

## 1. Objective
TradeWise must feel like one coherent product, not independently designed module websites. Learning can feel approachable and explanatory; market/trading can feel analytical and information-dense. Both must share typography, color logic, spacing, components, navigation and interaction patterns.

## 2. Provisional visual direction
- Modern, clean fintech interface.
- Clear hierarchy and readable financial information.
- Meaningful color; avoid decoration for its own sake.
- Avoid excessive gradients, glassmorphism, glowing borders and oversized rounded cards.
- Consistent alignment and spacing.
- Responsive core workflows and accessible interactions.

This is a direction, **not a finalized brand palette**. Do not invent final values per module.

## 3. Team decisions to finalize
| Decision | Agreed value |
|---|---|
| Overall theme | TBD |
| Primary / secondary / accent colors | TBD |
| Background / surface / border colors | TBD |
| Text / muted text colors | TBD |
| Success / warning / danger colors | TBD |
| Font family and type scale | TBD |
| Spacing scale | TBD |
| Radius and elevation scale | TBD |
| Responsive breakpoints | TBD |
| Icon library | TBD |
| Chart library | TBD |

When a decision is made, update this table and central tokens. Do not let separate modules make conflicting choices.

## 4. Centralized design tokens
Implement tokens centrally (for example CSS custom properties in a shared stylesheet). Components should consume tokens rather than repeat raw values.

Suggested categories:
```css
:root {
  --color-brand: /* approved value */;
  --color-accent: /* approved value */;
  --color-background: /* approved value */;
  --color-surface: /* approved value */;
  --color-border: /* approved value */;
  --color-text: /* approved value */;
  --color-text-muted: /* approved value */;
  --color-success: /* approved value */;
  --color-warning: /* approved value */;
  --color-danger: /* approved value */;
  --font-family-base: /* approved value */;
  --radius-sm: /* approved value */;
  --radius-md: /* approved value */;
  --radius-lg: /* approved value */;
  --space-1: /* approved value */;
  --space-2: /* approved value */;
  --space-3: /* approved value */;
  --space-4: /* approved value */;
}
```
These are placeholders, not production CSS values. Replace only after team agreement.

## 5. Shared React component library
Location: `frontend/src/components/`

- `ui/`: Button, Input, Select, Checkbox, Card, Badge, Modal, Tabs, table primitives, Tooltip, Skeleton, Spinner, EmptyState, Alert.
- `layout/`: AppShell, Sidebar, Topbar, PageHeader, Breadcrumbs, MainContent and responsive navigation.
- `charts/`: ChartContainer, shared tooltip/legend, formatting helpers, loading/empty/error chart states.

A component belongs here when it is genuinely reusable or represents a product-wide pattern. Keep module-specific business compositions inside the relevant module.

## 6. Component rules
- Search for an existing component before creating one.
- Prefer composition and documented variants over duplicate components.
- Use consistent prop naming and predictable APIs.
- Generic UI components should not contain module-specific business rules or hidden data fetching.
- Use semantic HTML, accessible names, keyboard behavior and visible focus.
- Handle disabled, loading, error and empty states where relevant.
- Avoid fragile DOM-dependent styling and unapproved second styling systems.

## 7. Layout and navigation
- Use a shared application shell for authenticated areas.
- Keep sidebar/topbar behavior consistent.
- Use consistent page headers, content widths and section spacing.
- Responsive layouts must preserve important actions and financial information.
- Do not create unrelated navigation systems per module.

## 8. Charts and financial UI
- Format currency, numbers, dates and percentages consistently; make currency explicit (MVP primarily INR).
- Positive/negative values need consistent semantic treatment; never rely on color alone.
- Distinguish provider market data, simulated paper-trading data and synthetic educational scenarios.
- Show freshness/staleness when relevant.
- Keep chart colors, gridlines, tooltips and timeframes consistent.
- Clearly label paper trading as simulated.

## 9. Interaction and accessibility states
Consider default, hover, focus, active, disabled, loading, success and error. Data-driven views should also handle initial loading, empty results, stale data, API failure and permission denial.

Support agreed viewports, avoid horizontal overflow in core journeys, maintain contrast, provide keyboard access and meaningful labels, and respect reduced-motion preferences.

## 10. Visual review checklist
- [ ] Looks like TradeWise, not a separate website.
- [ ] Reuses shared layout/components where appropriate.
- [ ] Uses approved tokens.
- [ ] Typography, spacing, radii and colors are consistent.
- [ ] Loading, empty and error states are handled.
- [ ] Responsive behavior checked.
- [ ] Keyboard focus and accessible labels present.
- [ ] Financial values and charts formatted consistently.
- [ ] PR includes screenshots or visual notes when useful.

## 11. Changing the design system
Before adding a shared token/component/pattern: check for an existing equivalent, explain the need, update this document if the project-wide rule changes, implement centrally when appropriate, and mention the change in the PR. Do not make a product-wide visual decision inside one module without recording it here.
