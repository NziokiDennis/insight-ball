from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    home_odds: float = Field(ge=1.01)
    draw_odds: float = Field(ge=1.01)
    away_odds: float = Field(ge=1.01)
    simulations: int = Field(default=1000, ge=100, le=100_000)
    home_team: str = ""
    away_team: str = ""
    venue_type: Literal["home", "away", "neutral", "semi_neutral"] = "home"
    home_elo: float | None = None
    away_elo: float | None = None


class BacktestRequest(BaseModel):
    dataset: str = "E0"
    min_edge: float = Field(default=0.03, ge=0.0, le=1.0)
    stake: float = Field(default=1.0, gt=0.0)
    min_home_matches: int = Field(default=4, ge=1, le=10)
    min_away_matches: int = Field(default=4, ge=1, le=10)
