from __future__ import annotations

import json
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.backtest import BacktestConfig, backtest_rows
from app.core.form import compute_team_form
from app.core.model import PredictionInput, predict
from app.core.poisson import compute_league_stats, compute_team_ratings, expected_goals, LeagueStats
from app.data_sources.clubelo import fetch_current_elo
from app.data_sources.football_data import read_csv
from app.schemas import BacktestRequest, PredictionRequest

_ESPN_TO_FD: dict[str, str] = {
    "Manchester United": "Man United",
    "Manchester City": "Man City",
    "Tottenham Hotspur": "Tottenham",
    "Newcastle United": "Newcastle",
    "Wolverhampton Wanderers": "Wolves",
    "West Bromwich Albion": "West Brom",
    "Brighton & Hove Albion": "Brighton",
    "Nottingham Forest": "Nott'm Forest",
    "Sheffield United": "Sheffield Utd",
    "Luton Town": "Luton",
    "Ipswich Town": "Ipswich",
    "Leicester City": "Leicester",
    "Crystal Palace": "Crystal Palace",
    "Brentford": "Brentford",
}

_DATA_DIR = Path(__file__).parent.parent / "data" / "football-data"
_form_rows: list[dict[str, str]] = []
_league_stats: LeagueStats | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _form_rows, _league_stats
    csv_path = _DATA_DIR / "E0.csv"
    if csv_path.exists():
        _form_rows = read_csv(csv_path)
        _league_stats = compute_league_stats(_form_rows)
    yield


app = FastAPI(
    title="Ignition Football Probability Engine",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://insight-ball.vercel.app",  # production
        "http://localhost:8080",             # Vite dev server
        "http://127.0.0.1:8080",
        "http://localhost:5173",             # legacy Vite port
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health() -> dict:
    return {
        "status": "ok",
        "form_rows_loaded": len(_form_rows),
        "league_avg_home_goals": round(_league_stats.avg_home_goals, 3) if _league_stats else None,
        "league_avg_away_goals": round(_league_stats.avg_away_goals, 3) if _league_stats else None,
    }


@app.get("/api/v1/elo/{team_name}")
def elo_lookup(team_name: str) -> dict:
    elo = fetch_current_elo(team_name)
    if elo is None:
        raise HTTPException(status_code=404, detail=f"Elo rating not found for '{team_name}'")
    return {"team": team_name, "elo": elo}


@app.post("/api/v1/predict")
def prediction(request: PredictionRequest) -> dict:
    # --- Elo ---
    home_elo = request.home_elo
    away_elo = request.away_elo
    auto_fetched: list[str] = []

    if home_elo is None and request.home_team:
        home_elo = fetch_current_elo(request.home_team)
        if home_elo is not None:
            auto_fetched.append(f"{request.home_team} {home_elo:.0f}")
    if away_elo is None and request.away_team:
        away_elo = fetch_current_elo(request.away_team)
        if away_elo is not None:
            auto_fetched.append(f"{request.away_team} {away_elo:.0f}")

    # --- Form (venue-specific: home team home record, away team away record) ---
    home_form = (
        compute_team_form(_form_rows, request.home_team, venue="home")
        or compute_team_form(_form_rows, request.home_team)
    ) if request.home_team else None
    away_form = (
        compute_team_form(_form_rows, request.away_team, venue="away")
        or compute_team_form(_form_rows, request.away_team)
    ) if request.away_team else None

    # --- Poisson ---
    lambda_home = lambda_away = None
    if _league_stats and request.home_team and request.away_team:
        home_ratings = compute_team_ratings(_form_rows, request.home_team, _league_stats)
        away_ratings = compute_team_ratings(_form_rows, request.away_team, _league_stats)
        if home_ratings and away_ratings:
            lambda_home, lambda_away = expected_goals(home_ratings, away_ratings, _league_stats)

    result = predict(
        PredictionInput(
            home_odds=request.home_odds,
            draw_odds=request.draw_odds,
            away_odds=request.away_odds,
            simulations=request.simulations,
            home_team=request.home_team,
            away_team=request.away_team,
            venue_type=request.venue_type,
            home_elo=home_elo,
            away_elo=away_elo,
            home_form=home_form,
            away_form=away_form,
            lambda_home=lambda_home,
            lambda_away=lambda_away,
        )
    )

    if auto_fetched:
        result["model_notes"].append(f"Elo auto-fetched from ClubElo: {', '.join(auto_fetched)}.")

    return result


@app.get("/api/v1/datasets")
def list_datasets() -> dict:
    """List CSV datasets available for backtesting."""
    if not _DATA_DIR.exists():
        return {"datasets": []}
    datasets = [
        {"key": f.stem, "rows": sum(1 for _ in open(f)) - 1}
        for f in sorted(_DATA_DIR.glob("*.csv"))
    ]
    return {"datasets": datasets}


def _parse_espn_fixtures(data: dict, name_map: dict | None = None) -> list[dict]:
    """Shared ESPN scoreboard parser. name_map remaps display names if supplied."""
    fixtures = []
    for event in data.get("events", []):
        comp = (event.get("competitions") or [{}])[0]
        status_name = ((comp.get("status") or {}).get("type") or {}).get("name", "")
        if status_name not in ("STATUS_SCHEDULED", "STATUS_IN_PROGRESS"):
            continue
        competitors = comp.get("competitors", [])
        home = next((c for c in competitors if c.get("homeAway") == "home"), None)
        away = next((c for c in competitors if c.get("homeAway") == "away"), None)
        if not home or not away:
            continue
        raw_home = (home.get("team") or {}).get("displayName") or (home.get("team") or {}).get("name", "")
        raw_away = (away.get("team") or {}).get("displayName") or (away.get("team") or {}).get("name", "")
        fixtures.append({
            "id": event.get("id", ""),
            "date": event.get("date", ""),
            "home_team": (name_map or {}).get(raw_home, raw_home),
            "away_team": (name_map or {}).get(raw_away, raw_away),
        })
    return fixtures[:10]


@app.get("/api/v1/fixtures")
def get_fixtures() -> dict:
    """Fetch upcoming Premier League fixtures from ESPN."""
    try:
        url = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard"
        with urlopen(url, timeout=5) as r:
            data = json.loads(r.read())
        return {"fixtures": _parse_espn_fixtures(data, _ESPN_TO_FD)}
    except (URLError, OSError, json.JSONDecodeError, KeyError):
        return {"fixtures": []}


@app.get("/api/v1/fixtures/wc")
def get_wc_fixtures() -> dict:
    """Fetch upcoming FIFA World Cup 2026 fixtures from ESPN."""
    for slug in ("fifa.world", "fifa.world.2026"):
        try:
            url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard"
            with urlopen(url, timeout=6) as r:
                data = json.loads(r.read())
            fixtures = _parse_espn_fixtures(data)  # no name remapping for national teams
            if fixtures:
                return {"fixtures": fixtures}
        except (URLError, OSError, json.JSONDecodeError, KeyError):
            continue
    return {"fixtures": []}


@app.post("/api/v1/backtest")
def backtest(request: BacktestRequest) -> dict:
    all_rows: list[dict] = []
    for key in request.datasets:
        path = _DATA_DIR / f"{key}.csv"
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"Dataset '{key}' not found")
        all_rows.extend(read_csv(path))
    return backtest_rows(
        all_rows,
        BacktestConfig(
            min_edge=request.min_edge,
            stake=request.stake,
            min_home_matches=request.min_home_matches,
            min_away_matches=request.min_away_matches,
            max_odds=request.max_odds,
        ),
    )
