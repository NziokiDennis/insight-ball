from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping

from app.core.model import PredictionInput, predict


@dataclass(frozen=True)
class BacktestConfig:
    min_edge: float = 0.03
    stake: float = 1.0


def actual_outcome(row: Mapping[str, str]) -> str | None:
    result = row.get("FTR") or row.get("result")
    if result == "H":
        return "home"
    if result == "D":
        return "draw"
    if result == "A":
        return "away"
    return None


def odds_from_row(row: Mapping[str, str]) -> tuple[float, float, float] | None:
    candidates = [
        ("B365H", "B365D", "B365A"),
        ("PSH", "PSD", "PSA"),
        ("MaxH", "MaxD", "MaxA"),
        ("AvgH", "AvgD", "AvgA"),
    ]
    for home_key, draw_key, away_key in candidates:
        try:
            return float(row[home_key]), float(row[draw_key]), float(row[away_key])
        except (KeyError, TypeError, ValueError):
            continue
    return None


def backtest_rows(rows: Iterable[Mapping[str, str]], config: BacktestConfig | None = None) -> dict:
    cfg = config or BacktestConfig()
    bets = 0
    wins = 0
    profit = 0.0
    evaluated = 0

    for row in rows:
        outcome = actual_outcome(row)
        odds = odds_from_row(row)
        if outcome is None or odds is None:
            continue

        evaluated += 1
        prediction = predict(PredictionInput(home_odds=odds[0], draw_odds=odds[1], away_odds=odds[2]))
        ev_by_outcome = {
            "home": prediction["expected_value"]["home"] / 100.0,
            "draw": prediction["expected_value"]["draw"] / 100.0,
            "away": prediction["expected_value"]["away"] / 100.0,
        }
        pick = max(ev_by_outcome, key=ev_by_outcome.get)
        if ev_by_outcome[pick] < cfg.min_edge:
            continue

        bets += 1
        picked_odds = {"home": odds[0], "draw": odds[1], "away": odds[2]}[pick]
        if pick == outcome:
            wins += 1
            profit += cfg.stake * (picked_odds - 1.0)
        else:
            profit -= cfg.stake

    roi = profit / (bets * cfg.stake) if bets else 0.0
    return {
        "evaluated_matches": evaluated,
        "bets": bets,
        "wins": wins,
        "hit_rate": round(wins / bets, 4) if bets else 0.0,
        "profit": round(profit, 2),
        "roi": round(roi, 4),
    }

