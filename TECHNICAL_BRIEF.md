# Ignition — Football Probability Engine
## Technical Brief v2.0

---

## 1. What This System Is

Ignition is a football match probability engine built on the premise that bookmaker odds are not an accurate reflection of true outcome probabilities — they are a commercial product with a built-in margin. The system's job is to strip that margin out, layer in independent statistical signals, and identify the narrow set of situations where the model's probability estimate meaningfully exceeds what the market is pricing.

The output is not tips. It is a structured probability framework that surfaces whether a given bet has **positive expected value** — which is the only mathematically sound basis for any long-term wagering decision.

The system is divided into two parts:

- A **Python FastAPI backend** that does all statistical computation
- A **React/TypeScript frontend** (hosted at `insight-ball.vercel.app`) that provides the interface

The backend runs the models. The frontend runs in the browser without a backend connection by falling back to a simplified local calculation, ensuring the tool is always usable.

---

## 2. The Core Problem: What Odds Really Mean

When a bookmaker prices a match at:

```
Home: 2.10   Draw: 3.40   Away: 3.60
```

Each price implies a probability via `P = 1 / odds`:

```
Home:  1 / 2.10 = 47.6%
Draw:  1 / 3.40 = 29.4%
Away:  1 / 3.60 = 27.8%
──────────────────────────
Total:           104.8%
```

The total exceeds 100% by **4.8 percentage points**. This excess is the **overround** (also called the vig or juice). It is how bookmakers guarantee a long-run profit regardless of which outcome occurs.

If you bet on all three outcomes in the right proportions, you are guaranteed to lose 4.8% of your stake. Any individual bet on these prices faces the same negative expectation unless your estimate of the true probability is higher than the bookmaker's implied probability by enough to overcome the overround.

---

## 3. Layer 1 — De-vigging the Market

The first computation the system performs on any set of odds is to remove the bookmaker's margin and recover **fair probabilities**.

```
raw_home = 1 / home_odds
raw_draw = 1 / draw_odds
raw_away = 1 / away_odds
total    = raw_home + raw_draw + raw_away   # e.g. 1.048

fair_home = raw_home / total   # 47.6% / 1.048 = 45.4%
fair_draw = raw_draw / total   # 29.4% / 1.048 = 28.1%
fair_away = raw_away / total   # 27.8% / 1.048 = 26.5%
```

These **devigged probabilities** now sum to 100% and represent the market's best estimate of true probabilities, stripped of commercial bias. They serve as the **baseline signal** in all downstream blending — because the market aggregates enormous amounts of information and is generally hard to beat.

---

## 4. Layer 2 — Elo Ratings

Elo is a rating system originally designed for chess that quantifies team strength as a single number updated after every result. A stronger team has a higher number; the gap between two numbers predicts match outcome probabilities.

### How the rating is sourced

Elo ratings are fetched live from **ClubElo** (`clubelo.com/api`), a public database that maintains historically calibrated Elo ratings for European football clubs.

### How Elo converts to match probabilities

A home advantage of **65 Elo points** is applied (configurable for neutral venue or away leg):

```python
advantage = 65.0   # for a home match
gap = (home_elo + advantage) - away_elo
home_share = 1 / (1 + exp(-gap / 220.0))
```

The logistic function maps the gap to a probability between 0 and 1. The draw probability is taken from the market baseline and clamped to the realistic range of 18–34%. The remainder is split proportionally:

```
home = (1 - draw) × home_share
away = (1 - draw) × (1 - home_share)
```

Elo provides a **team-strength signal** independent of any specific match odds.

---

## 5. Layer 3 — Poisson Goal Model (Dixon-Coles)

The Poisson model treats goals scored as random events at a fixed average rate (λ). If a team's expected goals in a match is λ = 1.5, the number of goals they actually score follows a Poisson distribution around that value.

### Computing expected goals

Team **attack and defence ratings** are computed relative to league averages from historical CSV data (four seasons of Premier League: 2021/22 through 2024/25):

```python
attack_home  = avg_goals_scored_at_home   / league_avg_home_goals
defense_home = avg_goals_conceded_at_home / league_avg_away_goals
attack_away  = avg_goals_scored_away      / league_avg_away_goals
defense_away = avg_goals_conceded_away    / league_avg_home_goals
```

Expected goals for a given fixture:

```python
λ_home = home.attack_home × away.defense_away × league.avg_home_goals
λ_away = away.attack_away × home.defense_home × league.avg_away_goals
```

This is the **Dixon-Coles** formulation: your attack rating multiplied by your opponent's defensive vulnerability, scaled to the league average.

### Building the scoreline matrix

A full 9×9 probability matrix is computed for all scorelines 0–0 through 8–8:

```python
P(home scores i goals) = (λ_home^i × e^-λ_home) / i!
P(away scores j goals) = (λ_away^j × e^-λ_away) / j!
P(scoreline i:j)       = P(i) × P(j)
```

Summing across the matrix:
- `P(home win) = Σ P(i:j)` where `i > j`
- `P(draw)     = Σ P(i:j)` where `i == j`
- `P(away win) = Σ P(i:j)` where `i < j`

The top 5 most probable scorelines are returned to the UI.

### Monte Carlo simulation

In addition to the exact calculation, the system simulates N matches (default 1,000) using Knuth's algorithm to sample from Poisson distributions:

```python
# Sample one goal tally from Poisson(λ)
L = exp(-λ)
k, p = 0, 1.0
while p > L:
    k += 1
    p *= random.random()
return k - 1
```

Simulating N matches provides the raw win/draw/loss counts displayed in the UI, and generates a **95% Wilson confidence band** (±1.96 × √(p(1-p)/N)) around the home win probability.

---

## 6. Layer 4 — Form Signal

Form captures recent momentum — something Elo ratings and historical averages are slow to reflect after injuries, managerial changes, or fixture congestion.

### Venue-specific form

A critical design decision: the form signal uses **venue-separated records**:

- The home team's form is computed from their **home matches only**
- The away team's form is computed from their **away matches only**

This prevents the model from overestimating away-team strength (a team might be in great overall form but perform poorly on the road).

### Form score computation

Each team's last 5 matches in the relevant venue context are extracted from the historical dataset. A single **form score** (0–1) is derived:

```
form_score = 0.6 × win_rate
           + 0.2 × min(avg_goals_scored / 2.0, 1.0)
           + 0.2 × max(0, 1 - avg_goals_conceded / 2.0)
```

Win rate has the heaviest weight. Attack and defence contributions are normalised around a benchmark of 2 goals per game.

### Converting form scores to probabilities

The two form scores are mapped to 1X2 probabilities via a logistic function mimicking an Elo-like gap:

```python
gap = (home_form_score - away_form_score) × 400.0
non_draw_home_share = 1 / (1 + exp(-gap / 200.0))
draw = clamp(base_draw_probability, 0.18, 0.34)
home = (1 - draw) × non_draw_home_share
away = (1 - draw) × (1 - non_draw_home_share)
```

---

## 7. The Blending Engine

Each signal (market, Elo, Poisson, form) produces its own 1X2 probability distribution. The final model probability is a **weighted linear blend** depending on which signals are available for the match:

| Signals available              | Market | Poisson | Elo   | Form  |
|--------------------------------|--------|---------|-------|-------|
| All four                       | 40%    | 25%     | 20%   | 15%   |
| Poisson + Elo                  | 45%    | 30%     | 25%   | —     |
| Poisson + Form                 | 45%    | 30%     | —     | 25%   |
| Poisson only                   | 55%    | 45%     | —     | —     |
| Elo + Form                     | 55%    | —       | 25%   | 20%   |
| Elo only                       | 65%    | —       | 35%   | —     |
| Form only                      | 70%    | —       | —     | 30%   |
| None                           | 100%   | —       | —     | —     |

The market always receives the highest individual weight. The rationale: bookmaker lines aggregate information from professional traders and are difficult to systematically beat. Independent signals are layered on top to shift probabilities where strong evidence warrants it.

---

## 8. Expected Value and the Betting Signal

With model probabilities in hand, expected value (EV) is computed for each outcome:

```
EV(outcome) = model_probability × decimal_odds − 1
```

An EV of +0.05 means that for every £1 staked, the model estimates you gain £0.05 in expectation over many bets.

**The system only recommends a bet when EV > 3%** (i.e. EV > 0.03). This threshold is chosen because:

- Values below 3% can easily be explained by model noise
- The threshold provides enough margin above the typical bookmaker overround

### Kelly Criterion

When a bet is recommended, the system computes the **Kelly criterion** — the theoretically optimal fraction of bankroll to stake:

```
f* = (p × O − 1) / (O − 1)
```

where `p` is the model probability and `O` is the decimal odds.

Because full Kelly requires perfect model calibration (which no model has), the UI displays **¼ Kelly** as the practical recommendation:

```
quarter_kelly = f* × 0.25
```

This reduces variance to a manageable level while still being proportional to edge size.

---

## 9. The Backtest Engine

The backtest answers the question: *would this model have made money over historical data?*

### Rolling-window methodology

For each match in the historical dataset, the model is rebuilt using **only matches that occurred before that fixture**. This eliminates data leakage — the model cannot see future results when making its prediction.

```
Match 1:  model trained on 0 prior matches  → skip (insufficient data)
Match 2:  model trained on 1 prior match    → skip (insufficient data)
...
Match 20: model trained on 19 prior matches → predict
Match 21: model trained on 20 prior matches → predict
```

The minimum data threshold before a bet is placed:
- At least **4 home matches** for the home team
- At least **4 away matches** for the away team

### Blend in backtest

Inside the backtest, only Poisson and form are used (Elo is excluded because historical Elo ratings for every match would require a separate data pipeline). The blend is:

```
P_final = 0.60 × P_poisson + 0.40 × P_form
```

### Bet selection

A bet is placed when:
1. `EV > min_edge` (configurable, default 5%)
2. `odds ≤ max_odds` (configurable, default 4.0)

The `max_odds` cap was a critical finding during development. Without it, the model placed bets at odds of 5.0+ where the Poisson model's EV estimates are poorly calibrated, producing an ROI of −10%. With `max_odds = 4.0`, the model focuses on the range where it has genuine edge:

```
Without cap:   ROI ≈ −10%  (697 bets, heavy away-bet bias at avg 5.76 odds)
With cap:      ROI ≈ +1.0%  (570 bets, more balanced across outcomes)
```

### Dataset

Four seasons of Premier League data (Football-Data.co.uk format):

| Dataset   | Season  | Matches |
|-----------|---------|---------|
| E0-2122   | 2021/22 | 380     |
| E0-2223   | 2022/23 | 380     |
| E0-2324   | 2023/24 | 380     |
| E0-2425   | 2024/25 | 380     |

Backtest can be run across any combination of these seasons.

---

## 10. The Parlay / Accumulator Builder

The Parlay Builder computes every possible outcome combination across multiple selected matches — what bookmakers call an accumulator.

### Combination generation

For N matches, each with 3 possible outcomes (home win, draw, away win), there are **3^N total combinations**:

| Matches | Combinations |
|---------|-------------|
| 1       | 3           |
| 2       | 9           |
| 3       | 27          |
| 4       | 81          |
| 5       | 243         |
| 6       | 729         |

For each combination:

```
joint_probability = P(outcome_1) × P(outcome_2) × ... × P(outcome_N)
combined_odds     = odds_1 × odds_2 × ... × odds_N
EV                = (joint_probability × combined_odds − 1) × 100
```

### Probability source

When the backend is available, each match in the slip calls the full prediction endpoint. When the backend is unreachable, probabilities are computed locally via the devig calculation only. This ensures the Parlay Builder always functions.

### Output

Combinations are displayed in a sortable, filterable table:
- Sort by **probability**, **combined odds**, or **EV**
- Filter to **positive-EV combinations only** (green rows)
- Paginated at 50 rows; expandable to full set

This tells you immediately which accumulator combinations the model considers worth considering — and what the realistic joint probability is before you commit to a combined bet.

---

## 11. Application Pages

### Predict (/)

The main page. Users enter the home, draw, and away decimal odds for any match and optionally the team names. On submission:

1. The backend fetches live Elo ratings from ClubElo
2. It reads historical league stats and computes Poisson ratings
3. It extracts recent form from the dataset
4. The blend engine combines all signals
5. The UI displays probabilities, EV for each outcome, the most probable scorelines, a form summary, and the Kelly criterion stake recommendation

If no backend is available (e.g. on Vercel where only the frontend is hosted), a local fallback simulation runs the devig + Monte Carlo directly in the browser. The mode indicator in the header shows **"Local fallback"** when this is active.

Predictions are automatically saved to **localStorage** (up to 15 entries) and displayed in a "Recent" panel so past analyses can be reviewed without re-entering.

Upcoming Premier League fixtures are displayed in the empty state via the ESPN API (proxied through the backend when available). Clicking a fixture prefills the team name fields.

### Backtest (/backtest)

The historical validation page. Users configure:
- **Seasons**: any combination of the four available Premier League seasons
- **Minimum edge**: the EV threshold required before placing a simulated bet
- **Minimum data requirement**: how many prior matches each team must have played before the model bets on them
- **Max odds cap**: the highest odds at which the model will place a bet

The results display:
- Total bets placed, win count, hit rate
- Total profit (in stake units) and ROI percentage
- A full bet-by-bet breakdown table with date, teams, pick, odds, EV, result, and P&L

This page is the quality-assurance mechanism — it grounds expectations in historical performance rather than theoretical projections.

### Parlay (/parlay)

The accumulator builder described in Section 10. Users enter up to 6 matches with odds and team names. The model analyses each match individually, then generates all 3^N combinations. The table shows which accumulators are probability-ranked, what combined odds they offer, and whether the model considers them positive-EV.

---

## 12. Technical Architecture

```
┌─────────────────────────────────┐
│  Browser (insight-ball.vercel.app)│
│                                  │
│  React 18 + TypeScript + Vite   │
│  TailwindCSS + shadcn/ui        │
│                                  │
│  Pages: Predict / Backtest / Parlay │
│  Hooks: usePrediction, useIsMobile  │
│  Utils: devig, Kelly, history    │
└──────────────┬───────────────────┘
               │ HTTP (VITE_API_URL or relative)
               ▼
┌─────────────────────────────────┐
│  Python FastAPI Backend         │
│  (localhost:8000 in dev)        │
│                                  │
│  Endpoints:                     │
│  POST /api/v1/predict           │
│  POST /api/v1/backtest          │
│  GET  /api/v1/fixtures          │
│  GET  /api/v1/elo/{team}        │
│                                  │
│  Core modules:                  │
│  model.py   — blend engine      │
│  poisson.py — Dixon-Coles       │
│  form.py    — venue form        │
│  backtest.py — rolling window   │
│                                  │
│  Data sources:                  │
│  ClubElo API  — live Elo        │
│  ESPN API     — upcoming        │
│  Football-Data CSV — historical │
└─────────────────────────────────┘
```

### Data flow for a single prediction

```
User enters odds →
  POST /api/v1/predict →
    1. Devig market odds → fair probabilities
    2. Fetch Elo (ClubElo API)
    3. Compute team ratings from CSV
    4. Compute expected goals (Dixon-Coles)
    5. Build Poisson scoreline matrix
    6. Compute venue-specific form
    7. Blend all signals by weight table
    8. Compute EV and Kelly for each outcome
    9. Return JSON →
  UI renders probabilities, scorelines, form, Kelly
```

---

## 13. Development Stages

### Stage 1 — Foundation
Market devigging only. The system stripped the bookmaker margin and returned normalised fair probabilities. No independent signals. This established the data contract and API shape.

### Stage 2 — Elo integration
Live Elo ratings fetched from ClubElo. The blend engine was introduced: market (65%) + Elo (35%) when Elo is available. The predict endpoint now returned Elo context alongside probabilities.

### Stage 3 — Poisson goal model
The Dixon-Coles framework was implemented. Historical CSV data was integrated. Expected goals, the full scoreline matrix, and Monte Carlo simulation were added. Most likely scoreline display added to the UI.

### Stage 4 — Form signal + backtest
Venue-specific form extraction added. The backtest engine built with rolling-window methodology to validate historical performance. Four seasons of data downloaded. The `max_odds` cap was identified as the key parameter for positive ROI.

### Stage 5 — Frontend completeness
- **Prediction history**: predictions saved to localStorage; recent panel on home page
- **Upcoming fixtures**: ESPN API integration; click to prefill
- **Kelly criterion**: stake sizing displayed alongside EV
- **Backtest UI**: season checkboxes, config panel, results table
- **Parlay Builder**: full accumulator combination analysis page

### Stage 6 — Mobile and deployment
- **Vercel deployment**: `insight-ball.vercel.app` — fixed routing conflict that caused blank page (catch-all rewrite was intercepting JS asset requests)
- **ErrorBoundary**: prevents silent crashes; shows reload prompt
- **Mobile navigation**: fixed bottom nav bar (Predict / Backtest / Parlay)
- **Local fallback**: browser-side devig + Monte Carlo when backend is unreachable
- **Defensive API handling**: `fetchFixtures` validated to always return a typed array, preventing state corruption when Vercel's catch-all returns HTML instead of JSON

---

## 14. Key Findings and Limitations

### What the model does well
- The Poisson + form blend identifies a consistent positive-EV segment in the odds range 1.5–4.0
- The `max_odds` cap is the single most impactful parameter: removing poorly-calibrated high-odds bets moves ROI from −10% to +1%
- Venue-specific form eliminates a systematic bias where combined form overestimated away-team strength

### Limitations
- The +1.0% backtest ROI is measured over ~1,500 matches (4 seasons). A larger sample is needed to be confident this is genuine edge rather than variance
- The model has no access to squad injury data, which is one of the strongest short-term predictors of match outcome
- Elo ratings from ClubElo are historically calibrated but lag real-world form by definition
- The Poisson independence assumption (treating home and away goals as uncorrelated) is known to underestimate 0-0 draws; a full Dixon-Coles correction factor has not been implemented

### What positive EV means in practice
The model recommending a bet does not mean the bet will win. It means that, given the model's probability estimate and the offered odds, the expected return over many identical bets is positive. Any single bet can and will lose. The Kelly criterion stake sizing is designed to survive the inevitable losing streaks while compounding over a winning edge.

---

## 15. Current State

| Component | Status |
|-----------|--------|
| Predict page (devig + local fallback) | Live at vercel.app |
| Predict page (full backend model) | Local dev only |
| Backtest page | Local dev only (backend required) |
| Parlay Builder | Live at vercel.app (devig fallback) |
| Mobile navigation | Live |
| Backend hosting | Pending (Render / Railway) |
| Backend CORS for Vercel origin | Pending |
| `VITE_API_URL` env var in Vercel | Pending |

The immediate next step to make the full model available on the hosted site is deploying the FastAPI backend to Render or Railway, setting the `VITE_API_URL` environment variable in Vercel's project settings to the deployed backend URL, and updating the `allow_origins` list in `main.py` to include `https://insight-ball.vercel.app`.

---

*Ignition — Football Probability Engine | Technical Brief v2.0*
