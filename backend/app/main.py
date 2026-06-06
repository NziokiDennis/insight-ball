from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.backtest import BacktestConfig, backtest_rows
from app.core.form import compute_team_form
from app.core.model import PredictionInput, predict
from app.core.poisson import compute_league_stats, compute_team_ratings, expected_goals, LeagueStats
from app.data_sources.clubelo import fetch_current_elo
from app.data_sources.football_data import read_csv
from app.schemas import BacktestRequest, PredictionRequest

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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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

    # --- Form ---
    home_form = compute_team_form(_form_rows, request.home_team) if request.home_team else None
    away_form = compute_team_form(_form_rows, request.away_team) if request.away_team else None

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


@app.post("/api/v1/backtest")
def backtest(request: BacktestRequest) -> dict:
    path = _DATA_DIR / f"{request.dataset}.csv"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset '{request.dataset}' not found")
    rows = read_csv(path)
    return backtest_rows(
        rows,
        BacktestConfig(
            min_edge=request.min_edge,
            stake=request.stake,
            min_home_matches=request.min_home_matches,
            min_away_matches=request.min_away_matches,
        ),
    )
