from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.backtest import BacktestConfig, backtest_rows
from app.core.model import PredictionInput, predict
from app.data_sources.football_data import read_csv
from app.schemas import BacktestRequest, PredictionRequest


app = FastAPI(title="Ignition Football Probability Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/predict")
def prediction(request: PredictionRequest) -> dict:
    return predict(
        PredictionInput(
            home_odds=request.home_odds,
            draw_odds=request.draw_odds,
            away_odds=request.away_odds,
            simulations=request.simulations,
            home_team=request.home_team,
            away_team=request.away_team,
            venue_type=request.venue_type,
            home_elo=request.home_elo,
            away_elo=request.away_elo,
        )
    )


@app.post("/api/v1/backtest")
def backtest(request: BacktestRequest) -> dict:
    path = Path(request.csv_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="CSV file not found")
    rows = read_csv(path)
    return backtest_rows(rows, BacktestConfig(min_edge=request.min_edge, stake=request.stake))

