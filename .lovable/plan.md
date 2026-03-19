

# Ignition — Frontend Implementation Plan
## Prometheus Football Match Outcome Probability Engine

### Overview
Build the complete React/TypeScript/Vite frontend per the Prometheus spec. Dark-first, data-dense, Bloomberg-meets-Linear aesthetic. The calculator works without login. Backend API calls are stubbed with a local Monte Carlo simulation fallback until the FastAPI backend is connected.

---

### 1. Project Foundation & Theme
- Set up the design token system: dark palette (#0D1117 bg, #161B22 surface, #30363D border, #E36B00 orange, #1F6FEB blue, #238636 green)
- Import fonts: **Outfit** (display), **Inter** (body), **JetBrains Mono** (data) via self-hosted files
- Configure Tailwind with custom colors, 8px grid spacing, animation keyframes (probability bar fill, number counter, fade transitions)
- Add the uploaded Ignition logo to the project
- Glass-panel utility class for card surfaces

### 2. TypeScript Types & Validation
- Define all interfaces: `PredictionRequest`, `PredictionResponse` (with probabilities, value edges, confidence band, overround, duration, counts)
- Zod schemas for odds input validation (1.01–1000.00 float range, simulation count 100–100,000)
- Number formatting utilities (percentage, locale numbers)

### 3. State & API Layer
- **Zustand store** for auth state (token, user, login/logout actions)
- **API client** (Axios instance) with base URL config, JWT interceptor for auth headers, refresh token logic stub
- API functions: `postPredict()`, `getHistory()`, `login()`, `register()`, `logout()`
- **Local simulation fallback** (`useSimulation` hook) — runs the Monte Carlo algorithm client-side in a Web Worker so the calculator works without the backend

### 4. Layout Components
- **Header**: Logo (top-left), nav links (Calculator, History, About), auth buttons (top-right)
- **Sidebar** (desktop): collapsible, icon + label navigation
- **MobileNav**: bottom tab bar on small screens with hamburger → slide-in drawer
- **PageWrapper**: max-width 1280px, centered, consistent padding

### 5. Core Pages & Components

**Landing / Home Page**
- Hero section: "Prometheus Football Match Outcome Probability Engine" + one-line value prop
- Embedded calculator (usable immediately, no login wall)
- 3 feature cards: Speed, Transparency, Accuracy — clean, no bloat

**OddsInputPanel**
- Three numeric inputs (Home/Draw/Away odds) with optional team name fields
- Simulation count slider (logarithmic scale, 100→100,000)
- "Calculate" CTA button in Prometheus Orange, full-width on mobile
- Real-time validation: debounced 300ms, red border + inline error messages
- Keyboard accessible: Tab navigation, Enter submits

**ResultsPanel** (3 outcome cards)
- Large percentage in JetBrains Mono (48px), animated counter (400ms)
- Horizontal probability bar with animated fill (600ms ease-out, color-coded)
- Raw simulation count ("487 / 1,000 simulations")
- **ValueEdgeBadge**: green (+edge), grey (neutral), amber (negative)
- Overround display, confidence band (±%), simulation runtime
- "Share Result" button (copies URL with encoded params)
- "Export PDF" button (generates single-page summary)
- Skeleton loading states (not spinners)

**MathBreakdown** (collapsible)
- Step-by-step: odds → raw probability → normalization → Monte Carlo explanation
- Monospace font, code-block styling
- This is the transparency differentiator

**History Page** (auth-gated)
- Sortable table: match, date, odds, probabilities, actual result
- Accuracy tracker percentage
- CSV export button
- Login prompt if unauthenticated

**Login & Register Pages**
- Clean forms, dark-themed, validation with error states
- Password requirements displayed (12+ chars)

**About Page**
- Platform explanation, methodology, team info

### 6. Animations & Interactions
- Probability bars: fill from 0 → value (600ms, cubic-bezier(0.2, 0.8, 0.2, 1))
- Number counters: animate to final value (400ms)
- Page transitions: 150ms fade
- Hover states on all interactive elements
- Focus rings for accessibility
- Skeleton screens for all loading states

### 7. Performance & Accessibility
- Route-based code splitting (React.lazy)
- Self-hosted fonts with preload
- 44px minimum touch targets
- ARIA labels on all inputs
- `tabular-nums` on data values
- Keyboard navigation throughout

### 8. Security (Frontend Layer)
- No `dangerouslySetInnerHTML`
- No `eval()` — enforced by ESLint
- Only `VITE_` prefixed env vars (no secrets)
- Zod validation on all form inputs
- Strict TypeScript (`strict: true`, no `any`)

---

### File Structure (inside `src/`)
```
components/
  ui/          → Button, Input, Card, Badge, Skeleton, Tooltip
  prediction/  → OddsInputPanel, ResultsPanel, ProbabilityBar, OutcomeCard, ValueEdgeBadge, MathBreakdown, SimulationMeta
  layout/      → Sidebar, MobileNav, Header, PageWrapper
  history/     → HistoryTable, AccuracyTracker
pages/         → Home, Calculator, History, Login, Register, About, NotFound
hooks/         → usePrediction, useAuth, useSimulation
store/         → authStore (Zustand)
api/           → client, predict, auth
utils/         → probability, format, validation
types/         → index.ts
```

### Deliverable
A fully functional, dark-themed, responsive frontend that runs the prediction calculator locally (no backend dependency for core function), with all UI components, pages, animations, and the Ignition logo integrated. Ready to connect to the FastAPI backend when you build it.

