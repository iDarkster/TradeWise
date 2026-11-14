# Frontend Engineering Specification — TradeWise

**Status:** Final frontend implementation standard  
**Design direction:** Groww-inspired retail investing experience  
**Applies to:** All TradeWise web frontend pages, components, themes, and interactions

This document is the single source of truth for frontend implementation. Implement the rules below consistently. Do not introduce a competing visual system, arbitrary styling, duplicate shared components, or undocumented frontend patterns.

The visual direction closely follows the supplied Groww reference specification: spacious layouts, restrained borders, rounded cards, green positive states, red negative states, compact market data, a persistent index ticker, and fully designed light and dark themes. TradeWise must use its own product name, logo, copy, market data, and brand assets. Do not copy Groww's logo, proprietary assets, private font files, or claim affiliation with Groww.

---

## 1. Product and frontend scope

TradeWise is a retail investing and trading education platform. The frontend presents market information, portfolio-related views, trading interfaces, educational and discovery content, and user account settings.

The frontend is responsible for:
- Rendering all application pages and shared navigation.
- Managing client-side navigation, UI state, forms, filters, sorting, and theme preference.
- Displaying backend-provided market, portfolio, account, and educational data.
- Validating user input before submission and displaying server validation results.
- Providing accessible loading, empty, error, offline, and success states.
- Adapting the experience to desktop, tablet, and mobile screens.

The frontend is not the authority for financial calculations, order validation, permissions, balances, prices, risk checks, or any other business-critical rule. The backend is authoritative for these. Never simulate a successful trade, deposit, withdrawal, authentication, or account update.

Use anonymised/demo account data in screenshots, fixtures, stories, and documentation. Never copy personal data from reference screenshots.

## 2. Technology stack

Use this stack for the frontend:

| Area | Standard |
|---|---|
| UI framework | React |
| Language | TypeScript with strict mode |
| Build tool | Vite |
| Styling | CSS Modules plus global CSS custom properties |
| Routing | React Router |
| Server/API state | TanStack Query |
| Client UI state | Zustand, only for genuinely shared client state |
| Forms | React Hook Form |
| Validation | Zod |
| Icons | Lucide React |
| Charts | TradingView Lightweight Charts for financial charts; custom React controls for surrounding tools |
| Date utilities | date-fns |
| Unit/component tests | Vitest and React Testing Library |
| End-to-end tests | Playwright |
| Linting | ESLint |
| Formatting | Prettier |
| Package manager | npm |

Do not add another framework or state-management library without first establishing that the current stack cannot meet the requirement. Pin dependencies through the lockfile and use compatible stable releases.

### 2.1 TypeScript rules
- Enable `strict`, `noImplicitAny`, and `strictNullChecks`.
- Do not use `any`. Use `unknown` and narrow it when data is not yet typed.
- Define API request and response types in a shared types area.
- Avoid non-null assertions. Handle missing values explicitly.
- Keep domain types separate from component prop types.

## 3. Design principles

The interface must follow these principles:

1. **Groww-inspired visual language:** clean, calm, spacious, data-first, minimal decoration.
2. **Consistent information hierarchy:** page title, section heading, supporting labels, then data.
3. **Low-noise surfaces:** use borders and subtle surface changes rather than heavy shadows.
4. **Financial clarity:** prices, percentages, signs, timestamps, and market status must be unambiguous.
5. **Responsive by design:** no page may require horizontal scrolling of the entire viewport.
6. **Accessible interactions:** every control must work with keyboard and assistive technology.
7. **Truthful data states:** never show fabricated live prices or imply that demo data is real.
8. **Reusable implementation:** shared patterns must be implemented as shared components.

## 4. Design system

All components must use semantic design tokens. Do not hard-code hex colours, spacing, radii, or shadows inside feature components.

### 4.1 Colour tokens

The supplied reference values are visual estimates. The values below are the final TradeWise implementation palette, selected to preserve the reference appearance while improving text contrast.

```css
:root {
  /* Brand primitives */
  --p-green-500: #00B386;
  --p-green-700: #007A5B;
  --p-green-400: #2FD3A5;
  --p-indigo-500: #5367FF;
  --p-indigo-300: #7B8AFF;
  --p-red-500: #EB4B3C;
  --p-red-700: #C93A2D;
  --p-red-400: #FF6B5E;

  /* Neutral primitives */
  --p-white: #FFFFFF;
  --p-grey-50: #F5F5F6;
  --p-grey-100: #EFF0F2;
  --p-grey-200: #E6E7EB;
  --p-grey-500: #9A9DA8;
  --p-grey-600: #6B6E7A;
  --p-grey-900: #2F3038;

  /* Typography */
  --font-sans: Inter, "DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --fw-regular: 400;
  --fw-medium: 500;
  --fw-semibold: 600;

  /* Type scale */
  --fs-display: 36px;
  --lh-display: 44px;
  --fs-h1: 28px;
  --lh-h1: 36px;
  --fs-h2: 24px;
  --lh-h2: 32px;
  --fs-h3: 20px;
  --lh-h3: 28px;
  --fs-h4: 18px;
  --lh-h4: 24px;
  --fs-body-lg: 16px;
  --lh-body-lg: 24px;
  --fs-body: 14px;
  --lh-body: 20px;
  --fs-caption: 12px;
  --lh-caption: 16px;

  /* Spacing: 4px base */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 28px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Shape */
  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-pill: 999px;

  /* Motion */
  --dur-fast: 120ms;
  --dur-base: 200ms;
  --ease-standard: cubic-bezier(.2, 0, 0, 1);

  /* Layout */
  --container-max: 1036px;
  --content-gutter: 28px;
  --header-height: 64px;
  --subnav-height: 56px;
  --ticker-height: 44px;
}

[data-theme="light"] {
  color-scheme: light;
  --color-bg-page: #FFFFFF;
  --color-bg-surface: #FFFFFF;
  --color-bg-surface-2: #F5F5F6;
  --color-bg-elevated: #FFFFFF;
  --color-bg-footer: #EFF0F2;
  --color-text-primary: #2F3038;
  --color-text-secondary: #6B6E7A;
  --color-text-muted: #6B6E7A;
  --color-text-on-accent: #FFFFFF;
  --color-border-default: #E6E7EB;
  --color-divider: #EDEEF1;
  --color-divider-dashed: #DCDDE2;
  --color-success: #00B386;
  --color-success-text: #007A5B;
  --color-success-bg: #E5F7F2;
  --color-danger: #EB4B3C;
  --color-danger-text: #C93A2D;
  --color-danger-bg: #FDECEA;
  --color-warning: #F5B829;
  --color-info: #5367FF;
  --color-link: #007A5B;
  --color-link-alt: #5367FF;
  --color-focus: #5367FF;
  --color-state-hover: rgba(0, 0, 0, .04);
  --color-state-pressed: rgba(0, 0, 0, .08);
  --color-chart-bg: #FFFFFF;
  --color-chart-grid: #EEEFF2;
  --color-chart-up: #00B386;
  --color-chart-down: #EB4B3C;
  --color-scrim: rgba(0, 0, 0, .4);
  --shadow-popover: 0 8px 24px rgba(0, 0, 0, .12);
}

[data-theme="dark"] {
  color-scheme: dark;
  --color-bg-page: #0A0B0D;
  --color-bg-surface: #121316;
  --color-bg-surface-2: #17181B;
  --color-bg-elevated: #17181B;
  --color-bg-footer: #0F1012;
  --color-text-primary: #F2F3F5;
  --color-text-secondary: #A0A3AD;
  --color-text-muted: #A0A3AD;
  --color-text-on-accent: #04140F;
  --color-border-default: #2A2C31;
  --color-divider: #24262A;
  --color-divider-dashed: #34363B;
  --color-success: #2FD3A5;
  --color-success-text: #2FD3A5;
  --color-success-bg: #12332B;
  --color-danger: #FF6B5E;
  --color-danger-text: #FF8A80;
  --color-danger-bg: #3A1B18;
  --color-warning: #F5C451;
  --color-info: #7B8AFF;
  --color-link: #2FD3A5;
  --color-link-alt: #7B8AFF;
  --color-focus: #7B8AFF;
  --color-state-hover: rgba(255, 255, 255, .06);
  --color-state-pressed: rgba(255, 255, 255, .10);
  --color-chart-bg: #111214;
  --color-chart-grid: #1C1D21;
  --color-chart-up: #2FD3A5;
  --color-chart-down: #FF6B5E;
  --color-scrim: rgba(0, 0, 0, .6);
  --shadow-popover: 0 8px 24px rgba(0, 0, 0, .6);
}
```

Use `--color-success-text` and `--color-danger-text` for small text. Use the brighter semantic colours for fills, chart marks, and larger visual indicators. Never communicate gain/loss through colour alone; include a sign and/or directional icon.

### 4.2 Typography

Use Inter as the bundled/default font family. The proprietary Groww font is not part of the project and must not be copied or fetched from unofficial sources.

| Style | Size / line height | Weight | Usage |
|---|---:|---:|---|
| Display | 36 / 44 | 600 | Large index/portfolio value |
| H1 | 28 / 36 | 600 | Page title |
| H2 | 24 / 32 | 600 | Section heading |
| H3 | 20 / 28 | 600 | Card heading |
| H4 | 18 / 24 | 600 | Menu/notification title |
| Body large | 16 / 24 | 400–500 | Main labels and table names |
| Body | 14 / 20 | 400 | Supporting copy |
| Body small | 13 / 18 | 400 | Secondary metadata |
| Caption | 12 / 16 | 500 | Timestamps and compact labels |
| Overline | 12 / 16 | 600 | Uppercase section labels |

Use `font-variant-numeric: tabular-nums` for prices, quantities, percentages, balances, and table values.

### 4.3 Spacing, grid, and sizing
- Use the spacing tokens in §4.1.
- Main desktop content max width is 1036px, centred.
- Desktop two-column dashboard layout: approximately 681px / 327px with a 28px gap.
- Use 24px minimum page side padding on desktop/tablet and 16px on mobile.
- Standard card padding is 20–24px; compact card padding is 16px.
- Standard card radius is 16px.
- Standard section spacing is 40px; closely related subsections use 24px.
- Do not use arbitrary one-off spacing values when a token is suitable.

### 4.4 Borders, shadows, and elevation
- Cards use a 1px semantic border and generally no shadow.
- Popovers use the theme's `--shadow-popover`.
- Light popovers are white; dark popovers use elevated charcoal with a visible border.
- Use dashed dividers only for summary separators or where the reference pattern calls for them.
- Do not add gradients to cards. The subtle green-to-lavender header wash is reserved for the compact sticky header.

## 5. Theme behaviour

Both Light and Dark themes are required across the entire application.

- Default first visit: follow the operating system `prefers-color-scheme`.
- After a user chooses a theme, persist that explicit choice in `localStorage`.
- Apply `data-theme="light"` or `data-theme="dark"` to the document root before the first paint to prevent theme flashing.
- Theme toggle lives in the profile menu footer. It shows a sun icon in Light mode and a moon icon in Dark mode.
- Switching themes updates all CSS-token-based UI immediately.
- Charts must receive the active theme and update their canvas, grid, labels, and series colours.
- Respect `prefers-reduced-motion`; disable theme transitions when it is enabled.
- There is no third “System” toggle state in the UI. System preference is used only until the user makes an explicit choice.

## 6. Responsive breakpoints

Use these breakpoints consistently:

| Name | Width |
|---|---:|
| Mobile | 320–767px |
| Tablet | 768–1023px |
| Laptop | 1024–1439px |
| Desktop | 1440px and above |

### 6.1 Layout behaviour

| Area | Desktop | Laptop | Tablet | Mobile |
|---|---|---|---|---|
| Main container | 1036px centred | Fluid with 24px gutters | Fluid with 24px gutters | Fluid with 16px gutters |
| Header | Expanded two-tier | Expanded two-tier | Search collapses to icon | Compact brand header; navigation becomes bottom tabs |
| Index ticker | Full horizontal strip | Scrollable | Scrollable | Scrollable with edge fade |
| Explore | Two columns | Two columns | Single column; investment summary first | Single column; investment summary first |
| Stock cards | 4 columns | 4 columns | 3 columns or horizontal rail | Horizontal snap carousel |
| Tables | Full columns | Full columns | Hide nonessential sparkline columns | Compact two-line rows; keep essential price/change |
| Holdings trade panel | Right column | Right column | Right drawer | Bottom sheet |
| Option chain | Full table | Full table | Hide OI bars before hiding values | Compact strike/LTP view with OI in expandable detail |
| Terminal | Chart + side panel + rail | Side panel overlays | Side panel overlays; drawing tools collapse | Simplified chart view; advanced workspace is not presented as a full desktop layout |
| Search | 680px overlay | 680px overlay | 600px overlay | Full-screen overlay |
| Profile/notifications | Anchored popover | Anchored popover | Anchored popover | Bottom sheet |
| Settings | Two columns | Two columns | Narrower menu | Master/detail navigation |
| Footer | Three zones | Three zones | Two columns | Accordion link groups |

### 6.2 Touch and overflow
- Touch targets must be at least 44×44px.
- Do not rely on hover. Every hover action must have a click/tap equivalent.
- Only tickers, chip rails, and intentionally horizontal card carousels may scroll horizontally.
- Tables may scroll inside their own bounded container on tablet where necessary; the page itself must not overflow horizontally.
- Mobile cards use horizontal snap scrolling where the reference uses card rows.

## 7. Application shell and navigation

Build one shared `AppShell` and one `GlobalHeader` component with route-driven variants. Do not create separate unrelated headers for each page.

### 7.1 Global shell

```text
AppShell
├── GlobalHeader
│   ├── BrandMark
│   ├── ProductSwitcher
│   ├── GlobalSearch / SearchIconButton
│   ├── AssistantButton
│   ├── NotificationsButton
│   └── ProfileAvatar
├── SubNavigation
├── IndexTickerStrip
├── MainContent
└── Footer
```

### 7.2 Header variants
- **Expanded:** logo, product switcher, search, assistant, notifications, avatar; second row for Stocks sub-navigation and Terminal action.
- **Compact sticky:** logo/product label, sub-navigation, Terminal, search icon, assistant, notifications, avatar. Use a subtle theme-aware green-to-lavender wash.
- **Index detail:** Stocks label and sub-navigation inline with search on the right.
- **F&O:** F&O product label with Explore, Positions, Orders, and Terminal.
- **Terminal:** logo, Terminal title/status, wide search, notifications, avatar; no normal sub-navigation.

The compact header appears after scrolling past the expanded header. Use a single implementation with variants and shared markup.

### 7.3 Navigation items
- Product switcher: Stocks, F&O, Mutual Funds.
- Stocks navigation: Explore, Holdings, Positions, Orders, Watchlist.
- F&O navigation: Explore, Positions, Orders.
- Terminal is a distinct workspace entry.
- Active navigation uses a 3px underline in Light and a white underline in Dark.
- On mobile, primary section navigation uses a fixed bottom tab bar with accessible labels.

### 7.4 Index ticker strip
- Display relevant market indices in a horizontally scrollable strip.
- Each item shows index name, value, and percentage/absolute change.
- Use green/red semantic text and sign/direction.
- Include a globe control for the global-market menu.
- Clicking an index opens its index detail page.
- A separate menu action provides Option Chain and Terminal links.
- The menu must work on touch and keyboard, not only hover.

## 8. Routes and page specifications

Use React Router. Route paths are the canonical paths below. Protect authenticated routes through route guards, but always enforce authorization on the backend too.

| Page | Route | Access |
|---|---|---|
| Explore | `/stocks/explore` | Public shell; personalised data when signed in |
| Holdings | `/stocks/holdings` | Authenticated |
| Positions | `/stocks/positions` | Authenticated |
| Orders | `/stocks/orders` | Authenticated |
| Watchlist | `/stocks/watchlist` | Authenticated |
| Index detail | `/indices/:symbol` | Public |
| Option chain | `/fno/option-chain/:symbol` | Public data; trading actions require auth |
| F&O Explore | `/fno/explore` | Public |
| F&O Positions | `/fno/positions` | Authenticated |
| F&O Orders | `/fno/orders` | Authenticated |
| Terminal | `/terminal/:symbol` | Public chart view; trading actions require auth |
| Search | Overlay, not a route | Public |
| Notifications | `/notifications` | Authenticated |
| Profile/settings | `/settings/basic-details` | Authenticated |
| Reports | `/settings/reports` | Authenticated |
| Change password | `/settings/change-password` | Authenticated |
| Change PIN | `/settings/change-pin` | Authenticated |
| Trading controls | `/settings/trading-controls` | Authenticated |
| Trading APIs | `/settings/trading-apis` | Authenticated |
| Sell authorisation | `/settings/sell-authorisation` | Authenticated |

### 8.1 Explore
Purpose: market discovery and portfolio snapshot.

Desktop layout:
- Left column: Most bought stocks, Top movers today, Most traded stocks in MTF, Top intraday stocks, Sectors trending today, Popular US Stocks & ETFs, Popular Bonds, Stocks in news today.
- Right column: Your investments summary, Products & Tools, Trading screens.
- Top movers filters: Gainers, Losers, Volume shockers; index selector defaults to NIFTY 100.
- Stock cards show logo, name, price, and daily change.
- Tables show company, sparkline where relevant, price/change, and volume.
- News cards show company, change, headline excerpt, and timestamp.
- Trading-screen rows show Bullish/Bearish tag, screen name, and thumbnail.

### 8.2 Holdings
- Asset tabs: Stocks, US Stocks, Bonds.
- Portfolio summary shows current value, invested value, 1D returns, and total returns.
- Summary actions: Analyse, hide/show values, more menu.
- Holdings table supports sorting.
- Selecting a holding opens its detail/trade panel on the right.
- Empty trade panel shows “Select a stock to get started”.
- Balance and Add money are displayed in the panel footer.
- Hidden-value mode masks all monetary values consistently across the holdings view.

### 8.3 Positions
- Show open positions grouped by supported instrument/category.
- When there are no positions, show an illustration, “No open positions”, and explanatory copy.
- Below the empty state, show Top Gainers with Large, Mid, and Small filters.
- Populated position rows must use the shared table system and display only backend-provided values.

### 8.4 Index detail
- Show index logo/tile, name, current value, and 1D change.
- Actions: Create Alert, Watchlist.
- Provide Overview, F&O, and ETFs tabs.
- Overview includes an interactive line chart, range selector (1D, 1W, 1M, 3M, 6M, 1Y, 3Y, 5Y, All), chart-type control, and Terminal link.
- F&O tab includes Option Chain link, Open Interest summary, futures cards, and Top Options table with All/Put/Call filters.
- Show market status and “As of” timestamp for delayed, closed-market, or unavailable data.

### 8.5 Option chain
- Full-width market-data table.
- Columns: Call OI, Call LTP, Strike, Put LTP, Put OI.
- OI bars: red for calls and green for puts; bar length is proportional to the returned OI values.
- Clearly mark the at-the-money (ATM) strike and spot price.
- Expiry and underlying selectors are interactive.
- Basket and Greeks controls sit in a floating bottom toolbar on desktop.
- When Greeks is enabled, show Delta, Gamma, Theta, and Vega using backend-provided values.
- On mobile, show a compact strike/LTP layout with OI and Greeks in an expandable detail view.

### 8.6 Terminal
- Full-screen charting workspace.
- Header: brand, Terminal label/status, symbol search, notifications, profile.
- Ticker strip for selected instruments.
- Chart toolbar: symbol, compare, interval, chart type, indicators, undo/redo, replay, screenshot, layout, alert.
- Left drawing toolbar: cursor, trendline, Fibonacci, patterns, brush, text, ruler, zoom, magnet, lock, visibility, delete.
- Chart canvas with OHLC, volume, and selected indicators.
- Footer controls: range, timezone, percentage/log/auto.
- Right panel tabs: Positions, Chain, Orders, Watchlist, Depth, Holdings, Balance, Layout.
- Side rail uses icons with labels and a clear active state.
- Use TradingView Lightweight Charts for chart rendering and implement the surrounding drawing/control experience in TradeWise. Do not use unlicensed proprietary chart assets or logos.

### 8.7 Search overlay
- Open from the global search field, search icon, or Ctrl+K / Cmd+K.
- Search panel is centred near the top on desktop and full-screen on mobile.
- Filters: All, Stocks, F&O, Mutual Funds, ETF, FAQs.
- Empty query shows Trending Searches.
- Results show an icon/logo, name, and category.
- Debounce requests by 250ms and cancel stale requests.
- Support keyboard navigation: Up/Down to move, Enter to select, Escape to close.
- Include explicit loading, no-results, and error states.

### 8.8 Profile menu
- Anchored below the avatar; 360px desktop width.
- Show anonymised user identity, settings shortcut, account/balance links, orders, bank details, support, and reports.
- Footer contains theme toggle on the left and Log out on the right.
- Close on outside click, Escape, route navigation, or selecting an item.

### 8.9 Notifications
- Popover width 360–400px on desktop.
- Each row shows icon, title, relative time, and body.
- Successful events may show a green check badge.
- Include a View All link to `/notifications`.
- Full page includes loading, empty, error, and populated states.

### 8.10 Settings
- Desktop: 300px navigation card on the left and detail card on the right.
- Basic Details shows personal detail labels and values.
- Only fields explicitly marked editable show an edit control.
- Read-only fields never show a misleading edit affordance.
- Sensitive data must be masked in display and never placed in client logs.
- Mobile uses a master/detail pattern with a back control.

### 8.11 Footer
- Three desktop zones: TradeWise brand/contact/app links/social links; company links; product links.
- Include copyright and version.
- Include SEO link categories and expandable link lists where relevant.
- Include legal/regulatory links supplied by the product team; do not fabricate regulatory claims, addresses, or external URLs.
- Back-to-top control appears after the user scrolls down.
- Mobile footer groups collapse into accessible accordions.

## 9. Shared component inventory

Implement these as reusable components before duplicating their patterns in pages:

- `AppShell`, `GlobalHeader`, `SubNavigation`, `ProductSwitcher`, `IndexTickerStrip`
- `Button`, `IconButton`, `Avatar`, `Badge`, `Tooltip`
- `Card`, `SummaryCard`, `StockCard`, `BondCard`, `NewsCard`
- `DataTable`, `TableHeader`, `TableRow`, `SortableHeader`
- `FilterPill`, `ChipGroup`, `SegmentedTabs`, `UnderlineTabs`, `DropdownPill`
- `SearchField`, `SearchOverlay`, `Popover`, `Modal`, `BottomSheet`
- `NotificationItem`, `EmptyState`, `Skeleton`, `ErrorState`, `OfflineBanner`, `Toast`
- `Price`, `PriceDelta`, `CurrencyValue`, `IndianNumber`
- `LineChart`, `Sparkline`, `OptionChainTable`, `OIBar`
- `ThemeProvider`, `ThemeToggle`, `BackToTop`

### 9.1 Component rules
- Components must have typed props and one clear responsibility.
- Prefer composition over boolean-prop overload.
- Keep business/data fetching out of presentational components.
- Use feature-level containers/hooks to fetch and transform data.
- Shared components must not import feature-specific modules.
- Use `data-state` attributes for selected/open/disabled states where useful.
- All icon-only buttons require accessible names and tooltips.
- Do not create a second component if an existing shared component can be extended cleanly.

## 10. Frontend architecture and folder structure

Use feature-based organisation:

```text
src/
├── app/
│   ├── App.tsx
│   ├── router/
│   ├── providers/
│   └── layouts/
├── assets/
│   ├── icons/
│   ├── images/
│   └── illustrations/
├── components/
│   ├── ui/
│   ├── navigation/
│   ├── data-display/
│   ├── charts/
│   └── feedback/
├── features/
│   ├── auth/
│   ├── explore/
│   ├── holdings/
│   ├── positions/
│   ├── orders/
│   ├── watchlist/
│   ├── indices/
│   ├── option-chain/
│   ├── terminal/
│   ├── notifications/
│   └── settings/
├── hooks/
├── lib/
│   ├── api/
│   ├── formatters/
│   ├── validation/
│   └── constants/
├── stores/
├── styles/
│   ├── tokens.css
│   ├── themes.css
│   └── globals.css
├── types/
└── main.tsx
```

Feature folders own their page components, feature hooks, local components, schemas, and types. Shared components belong under `components/`. Shared API client and formatters belong under `lib/`.

### 10.1 Naming
- React components: PascalCase (`StockCard.tsx`).
- Hooks: `use` + camelCase (`useHoldings.ts`).
- Utilities: camelCase (`formatIndianCurrency.ts`).
- CSS Modules: matching component name (`StockCard.module.css`).
- Types: descriptive PascalCase (`Holding`, `OptionChainRow`).
- Constants: UPPER_SNAKE_CASE for true constants.
- Avoid vague names such as `data`, `item`, `helper`, or `common` when a domain-specific name is available.

## 11. State management

Use the smallest suitable state scope.

| State category | Implementation |
|---|---|
| Component-only UI state | React `useState` / `useReducer` |
| Server data/cache | TanStack Query |
| Shared client UI state | Zustand |
| Form state | React Hook Form |
| Validation | Zod |
| Navigable filters/sort/search | URL search parameters |
| Theme preference | Theme provider + localStorage |

Do not copy server state into Zustand. Do not persist market prices, balances, positions, orders, or other server-owned data in localStorage. Cache invalidation must follow successful backend mutations and server responses.

## 12. API integration

- Use one typed API client and one base URL from environment configuration.
- Keep endpoint paths and request/response contracts in the API integration layer, not scattered through components.
- Do not invent endpoint names, payload fields, response structures, or authentication mechanisms. Implement against the backend contract provided by the project.
- Use `VITE_API_BASE_URL` for the API base URL. Keep secrets out of all `VITE_` variables because they are exposed to the browser.
- Handle HTTP errors centrally and convert them into typed application errors.
- Use TanStack Query for caching, retries, cancellation, and invalidation.
- Cancel obsolete search/chart requests.
- Never treat a frontend calculation as authoritative for price, margin, fees, P&L, balance, order validity, or permissions.
- Do not use mock data as a fallback in production. Demo fixtures must be explicitly labelled as demo data and isolated from production API paths.

### 12.1 API states
Every data-driven page must implement:
- Initial loading state.
- Refreshing/background-fetch state where appropriate.
- Empty state.
- Error state with retry where safe.
- Stale-data indication where relevant.
- Market-closed/delayed-data indication where relevant.

## 13. Authentication, authorisation, and security

- Authentication state is derived from the backend session/auth response.
- Protected routes redirect unauthenticated users to the sign-in flow.
- Frontend role/permission checks are for presentation only; backend checks are mandatory.
- Never store passwords, PINs, secrets, or access tokens in application logs.
- Prefer secure, HttpOnly, SameSite cookies when supported by the backend architecture.
- Do not place sensitive credentials in localStorage.
- Clear user-specific cached queries on logout.
- Do not render untrusted HTML.
- Validate and encode user-controlled content appropriately.
- Do not expose server secrets or private API keys in frontend bundles.
- Confirm high-impact actions with a clear review step and show the backend result; never optimistically claim success for financial actions.

## 14. Forms and validation

- Use React Hook Form and Zod.
- Every field has a visible label; placeholders are supplementary only.
- Show validation messages adjacent to the field and connect them using `aria-describedby`.
- Disable duplicate submission while a request is in progress.
- Preserve user input when a recoverable server error occurs.
- Map server validation errors to the corresponding fields.
- Use confirmation dialogs for destructive or high-impact actions.
- Never invent OTP, PIN, or verification flows; implement the exact flow defined by the backend/API contract.

## 15. Financial data presentation and formatting

- Locale: `en-IN`.
- Currency: INR (`₹`) for Indian market/account values unless the instrument is explicitly denominated in another currency.
- Use `Intl.NumberFormat('en-IN')` for Indian digit grouping.
- Use explicit currency codes for non-INR instruments.
- Use tabular numerals for all financial values.
- Show sign and direction for gains/losses.
- Positive values use the success semantic token; negative values use danger.
- Zero/unchanged values use neutral text, not green or red.
- Never infer missing prices or changes.
- Show the timestamp and market status when data is delayed, stale, or from a closed market.
- Distinguish `0`, unavailable (`—`), and not applicable (`N/A`).
- Value masking must cover every monetary value in the relevant view, including summary cards and table cells.

Centralise formatting in utilities and shared display components. Do not format currency independently in each page.

## 16. Charts and market visualisation

- Use TradingView Lightweight Charts for index, stock, and terminal chart rendering.
- Implement surrounding toolbars, range selectors, indicator controls, and drawing interaction in TradeWise components.
- Use theme tokens for chart background, grid, text, crosshair, up/down candles, and volume.
- Update chart theme when the application theme changes.
- Charts must resize with their parent container and clean up observers/listeners on unmount.
- Display loading, no-data, and error states.
- Never fabricate historical OHLC values or live ticks.
- Tooltips must show formatted time, OHLC, and volume only when the data source provides those fields.
- Use green for up and red for down; include numerical/sign information as well.
- Provide a text alternative or accessible summary for important chart information.

## 17. Interaction standards

### 17.1 Buttons and controls
Every interactive control must support:
- Default
- Hover
- Pressed
- Focus-visible
- Disabled
- Loading, when an action is asynchronous

Use a 2px focus ring with 2px offset. Disabled controls must not look active or respond to input.

### 17.2 Popovers and overlays
- Open on click/keyboard activation.
- Close on Escape, outside click, or successful navigation.
- Keep only one global header popover open at a time.
- Return focus to the trigger on close.
- Trap focus inside modal dialogs and full-screen mobile overlays.
- Prevent background scrolling for modal/full-screen overlays.

### 17.3 Search
- Debounce by 250ms.
- Cancel stale requests.
- Support keyboard navigation and Enter selection.
- Keep recent/trending searches clearly distinguished from actual results.
- Show an explicit no-results message.

### 17.4 Filters and sorting
- Single-select chips use one selected value at a time.
- Filter changes update the displayed dataset and reset pagination when applicable.
- Sort cycles through none, ascending, descending.
- Store shareable filters/sort in URL search parameters when useful.

### 17.5 Feedback
- Use toasts for brief success/failure feedback.
- Use inline errors for page-level data failures.
- Use skeletons for loading cards/tables/charts.
- Use empty-state illustrations and concise guidance when there is no data.
- Do not use a success toast until the backend confirms success.

## 18. Accessibility

Target WCAG 2.2 AA.

- Use semantic landmarks: `header`, `nav`, `main`, and `footer`.
- Use one clear page-level `h1`.
- Use native buttons, links, inputs, and tables where appropriate.
- All functionality must be keyboard accessible.
- Focus indicators must be visible in both themes.
- Provide accessible names for icon-only controls.
- Do not rely on colour alone to convey financial direction or status.
- Ensure text contrast of at least 4.5:1 for normal text and 3:1 for large text.
- Ensure meaningful non-text UI indicators have sufficient contrast.
- Respect `prefers-reduced-motion`.
- Use correct table headers and scopes.
- Associate form labels, descriptions, and errors programmatically.
- Announce important asynchronous updates through appropriate live regions without overwhelming screen readers.

## 19. Loading, empty, error, and offline states

Every feature must provide a complete state design.

| State | Required presentation |
|---|---|
| Loading | Skeleton matching the final content layout |
| Empty | Relevant illustration or icon, concise explanation, useful next action |
| Error | Clear message and retry action when retry is safe |
| Offline | Persistent but unobtrusive connection banner |
| Stale data | “Last updated” timestamp or stale-data label |
| Market closed | Market-closed label and last available timestamp |
| Success | Confirmation only after server success |
| Unauthorized | Sign-in or access-denied route |
| Not found | Branded 404 page with route back to Explore |

Skeleton animation duration is 1.2s. Disable shimmer when reduced motion is enabled.

## 20. Performance

- Lazy-load route-level pages and heavy chart modules.
- Split code by feature/route.
- Avoid unnecessary React renders and broad global subscriptions.
- Use list virtualization for genuinely large tables.
- Debounce search and expensive filters.
- Cancel obsolete network requests.
- Optimise and appropriately size images and SVGs.
- Avoid layout shifts by reserving image/chart dimensions.
- Keep chart rendering isolated from unrelated page state.
- Do not add memoisation without a measurable reason.

## 21. Testing and quality gates

Use:
- Vitest for utility and unit tests.
- React Testing Library for component behaviour.
- Playwright for end-to-end flows.

Required test coverage includes:
- Theme persistence and theme switching.
- Header navigation and route guards.
- Search open/close, keyboard controls, results, and no-results.
- Filters and sorting.
- Holdings value masking.
- Popover and modal keyboard behaviour.
- Loading, empty, error, and offline states.
- Responsive layouts at 375px, 768px, 1024px, and 1440px.
- Financial formatters for INR, percentages, zero, negative, and missing values.

Before considering a change complete, run:
1. TypeScript type checking.
2. ESLint.
3. Relevant unit/component tests.
4. Relevant Playwright tests for changed user flows.
5. Production build.

Do not suppress lint/type errors merely to make a build pass.

## 22. Environment and configuration

Use:
- `.env.example` containing variable names and safe example values.
- `VITE_API_BASE_URL` for the backend API base URL.
- Separate development, test, and production environment configuration.
- No secrets in frontend environment variables.
- No environment-specific URLs hard-coded in components.

The application must start, test, and build through the npm scripts defined in `package.json`. Keep those scripts documented in the project README.

## 23. AI coding-agent implementation rules

Any AI coding agent working in this repository must follow these rules:

1. Read this file before making frontend changes.
2. Inspect the existing codebase before creating or modifying files.
3. Reuse existing components, hooks, utilities, and tokens.
4. Follow the specified stack, folder structure, naming, and design tokens.
5. Do not introduce arbitrary colours, fonts, spacing, shadows, or radii.
6. Do not add dependencies when the existing stack can solve the problem.
7. Do not invent API endpoints, payloads, response fields, market values, or backend behaviour.
8. Do not use fake data in production paths.
9. Implement loading, empty, error, and success states for data-driven features.
10. Implement both Light and Dark themes for every new component and page.
11. Ensure responsive behaviour at all defined breakpoints.
12. Ensure keyboard and screen-reader accessibility.
13. Do not modify unrelated files or rewrite working architecture without a clear need.
14. Do not claim a feature is complete unless type checking, linting, relevant tests, and build pass.
15. Update this document when an approved frontend architecture or design-system decision changes.
16. If the existing code conflicts with this specification, report the exact conflict and recommend the smallest safe change. Do not silently introduce a third pattern.
17. If a required backend contract or asset is absent, implement the frontend boundary/interface and report the missing dependency. Do not invent the missing contract or asset.

## 24. Definition of done

A frontend task is complete only when:
- It follows this specification and reuses shared components.
- It works in Light and Dark themes.
- It works at mobile, tablet, laptop, and desktop widths.
- It has loading, empty, error, and disabled states where applicable.
- It is keyboard accessible and has visible focus states.
- It uses typed data and the agreed API integration layer.
- It contains no fabricated production data or fake success states.
- Type checking, linting, relevant tests, and production build pass.
- No unrelated files or visual patterns were introduced.

---

## Final implementation decisions

The following decisions are final for the frontend:
- Visual direction is Groww-inspired, using TradeWise branding and assets.
- Inter is the application font.
- Light and Dark themes are both mandatory; first visit follows system preference, then the user's explicit choice persists.
- React + TypeScript + Vite is the frontend foundation.
- CSS Modules and semantic CSS variables are the styling standard.
- React Router, TanStack Query, Zustand, React Hook Form, and Zod are the selected supporting libraries.
- TradingView Lightweight Charts is the chart-rendering library.
- INR/Indian number formatting uses `en-IN`.
- The desktop content max width is 1036px.
- Responsive breakpoints are 768px, 1024px, and 1440px.
- The backend remains authoritative for financial and account data.
- The frontend must never invent missing API contracts, production market data, legal copy, or proprietary assets.
