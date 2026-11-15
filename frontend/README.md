# TradeWise Frontend

The frontend client for **TradeWise**, an Indian market trading education and paper-trading web application.

> Canonical engineering and visual specifications are documented in [`SPECIFICATION.md`](./SPECIFICATION.md).
> System-wide decisions and product architecture are tracked in [`../docs/DECISIONS.md`](../docs/DECISIONS.md) and [`../AGENTS.md`](../AGENTS.md).

---

## 1. Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 8
- **Routing:** React Router v7 (`react-router-dom`)
- **Server State & Cache:** TanStack Query v5 (`@tanstack/react-query`)
- **Client State:** Zustand v5 (`zustand`)
- **Forms & Validation:** React Hook Form + Zod
- **Icons:** Lucide React (`lucide-react`)
- **Financial Charting:** TradingView Lightweight Charts (`lightweight-charts`)
- **Date Utilities:** `date-fns`
- **Unit & Component Testing:** Vitest + React Testing Library + jsdom
- **End-to-End Testing:** Playwright

---

## 2. Directory Architecture

The codebase follows the canonical feature-slice architecture defined in `SPECIFICATION.md`:

```text
frontend/src/
├── app/                  # Application root, router configuration, layout, providers
│   ├── layouts/          # Root layout shell
│   ├── providers/        # ThemeProvider, QueryProvider, consolidated AppProviders
│   ├── router/           # React Router declarative routes
│   └── App.tsx           # Top-level application component
├── assets/               # Static assets
│   ├── icons/
│   ├── illustrations/
│   └── images/
├── components/           # Shared, domain-agnostic UI and layout components
│   ├── charts/           # Generic chart wrappers and indicators
│   ├── data-display/     # Tables, badges, stats displays
│   ├── feedback/         # Modals, toasts, empty states, 404 handler
│   ├── navigation/       # Top navigation, sidebar, tabs, breadcrumbs
│   └── ui/               # Base design system primitives (buttons, inputs, cards)
├── features/             # Domain feature slices
│   ├── auth/             # M1: Registration, login, session management
│   ├── explore/          # Market overview & dashboard landing
│   ├── holdings/         # M6: Portfolio holdings
│   ├── indices/          # M4/M5: Index quotes & charts (NIFTY 50, SENSEX)
│   ├── learning/         # M2: Educational modules & lesson viewer
│   ├── notifications/    # Alert center & trade toasts
│   ├── option-chain/     # Option chain matrix view
│   ├── orders/           # M6: Order placement & order book
│   ├── positions/        # M6: Intraday positions & P&L
│   ├── quizzes/          # M3: Knowledge assessments & quiz engine
│   ├── settings/         # User preferences & profile settings
│   ├── terminal/         # M5/M6: Trade execution terminal
│   └── watchlist/        # M5: Watchlists & symbol management
├── hooks/                # Shared application hooks (useTheme, etc.)
├── lib/                  # Shared utilities and core infrastructure
│   ├── api/              # Typed fetch client, CSRF handling, ApiError
│   ├── constants/        # Environment and domain constants
│   ├── formatters/       # Currency (INR), percentages, date formatting
│   └── validation/       # Shared validation schemas
├── stores/               # Global Zustand stores
├── styles/               # CSS tokens, light/dark themes, and global reset
│   ├── globals.css       # Base CSS reset, typography, tabular numbers
│   ├── themes.css        # Light and dark mode theme definitions
│   └── tokens.css        # Primitive color, typography, spacing, and radius tokens
├── test/                 # Test setup and test utilities
└── types/                # Global and shared TypeScript definitions
```

---

## 3. Design System & Theming

- **Tokens:** Defined in `src/styles/tokens.css` and `src/styles/themes.css`.
- **Themes:** Supports **Dark Mode** (default) and **Light Mode**, persisted via `localStorage` and synchronised with `data-theme` on the root `<html>` element.
- **Typography:** `Inter` variable font with strict tabular numbers (`font-variant-numeric: tabular-nums`) for prices, quantities, and financial calculations.
- **Currency & Numbers:** All monetary amounts follow Indian conventions via `lib/formatters/currency.ts` (`₹12,34,567.89`).

---

## 4. API & Authentication Boundary

- The frontend communicates with the backend via `lib/api/client.ts`.
- **Session Authentication:** Handled via HTTP-only cookies; all requests include `credentials: 'include'`.
- **CSRF Protection:** State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) automatically attach the `X-CSRF-Token` header.
- **Error Handling:** Standardized `ApiError` captures HTTP status code, API error messages, and structured validation payload.
- **Environment:** Base URL defaults to `http://localhost:3000` or `VITE_API_BASE_URL`.

---

## 5. Development & Testing Commands

Run from the `frontend/` directory (or use `npm --prefix frontend <command>` from the root):

| Command | Action |
|---|---|
| `npm run dev` | Start Vite local development server |
| `npm run build` | Compile TypeScript and build production bundle |
| `npm run typecheck` | Run TypeScript type checking without emitting files |
| `npm run lint` | Run ESLint across TypeScript and TSX files |
| `npm run test` | Run Vitest unit and component tests |
| `npm run preview` | Preview production build locally |
