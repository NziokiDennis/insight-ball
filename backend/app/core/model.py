from __future__ import annotations

from dataclasses import dataclass
from math import exp
from time import perf_counter
from typing import Mapping

from app.core.odds import OUTCOMES, OddsSet, consensus_probabilities, devig_odds, expected_value, overround


@dataclass(frozen=True)
class PredictionInput:
    home_odds: float
    draw_odds: float
    away_odds: float
    home_team: str = ""
    away_team: str = ""
    simulations: int = 1000
    venue_type: str = "home"
    home_elo: float | None = None
    away_elo: float | None = None


def _elo_1x2_probabilities(
    home_elo: float,
    away_elo: float,
    *,
    venue_type: str,
    base_draw_probability: float,
) -> dict[str, float]:
    home_advantage = {
        "home": 65.0,
        "semi_neutral": 25.0,
        "neutral": 0.0,
        "away": -65.0,
    }.get(venue_type, 65.0)
    rating_gap = (home_elo + home_advantage) - away_elo
    non_draw_home_share = 1.0 / (1.0 + exp(-rating_gap / 220.0))

    draw = min(max(base_draw_probability, 0.18), 0.34)
    non_draw = 1.0 - draw
    return {
        "home": non_draw * non_draw_home_share,
        "draw": draw,
        "away": non_draw * (1.0 - non_draw_home_share),
    }


def predict(input_data: PredictionInput) -> dict:
    start = perf_counter()
    primary_odds = {
        "home": input_data.home_odds,
        "draw": input_data.draw_odds,
        "away": input_data.away_odds,
    }
    market_probabilities = devig_odds(primary_odds)
    model_probabilities = market_probabilities
    model_notes = ["Baseline uses devigged market probabilities."]

    if input_data.home_elo is not None and input_data.away_elo is not None:
        elo_probabilities = _elo_1x2_probabilities(
            input_data.home_elo,
            input_data.away_elo,
            venue_type=input_data.venue_type,
            base_draw_probability=market_probabilities["draw"],
        )
        market_weight = 0.65
        elo_weight = 0.35
        model_probabilities = {
            outcome: market_weight * market_probabilities[outcome] + elo_weight * elo_probabilities[outcome]
            for outcome in OUTCOMES
        }
        model_notes.append("Blended 65% market consensus with 35% Elo venue-adjusted strength.")

    ev = {
        outcome: expected_value(model_probabilities[outcome], primary_odds[outcome])
        for outcome in OUTCOMES
    }
    best_outcome = max(OUTCOMES, key=lambda outcome: model_probabilities[outcome])
    best_value = max(OUTCOMES, key=lambda outcome: ev[outcome])
    duration_ms = (perf_counter() - start) * 1000.0

    return {
        "home_probability": round(model_probabilities["home"] * 100, 2),
        "draw_probability": round(model_probabilities["draw"] * 100, 2),
        "away_probability": round(model_probabilities["away"] * 100, 2),
        "home_count": round(model_probabilities["home"] * input_data.simulations),
        "draw_count": round(model_probabilities["draw"] * input_data.simulations),
        "away_count": round(model_probabilities["away"] * input_data.simulations),
        "simulations": input_data.simulations,
        "home_value_edge": round(ev["home"] * 100, 2),
        "draw_value_edge": round(ev["draw"] * 100, 2),
        "away_value_edge": round(ev["away"] * 100, 2),
        "confidence_band": 0.0,
        "overround": round(overround(primary_odds) * 100, 2),
        "duration_ms": round(duration_ms, 1),
        "market_probabilities": {key: round(value * 100, 2) for key, value in market_probabilities.items()},
        "expected_value": {key: round(value * 100, 2) for key, value in ev.items()},
        "recommended_outcome": best_value if ev[best_value] > 0.03 else None,
        "most_likely_outcome": best_outcome,
        "model_notes": model_notes,
    }


def predict_from_bookmakers(
    odds_sets: list[OddsSet],
    *,
    simulations: int = 1000,
    home_elo: float | None = None,
    away_elo: float | None = None,
    venue_type: str = "home",
) -> dict:
    consensus, rejected_sources = consensus_probabilities(odds_sets)
    fair_decimal = {outcome: 1.0 / consensus[outcome] for outcome in OUTCOMES}
    prediction = predict(
        PredictionInput(
            home_odds=fair_decimal["home"],
            draw_odds=fair_decimal["draw"],
            away_odds=fair_decimal["away"],
            simulations=simulations,
            home_elo=home_elo,
            away_elo=away_elo,
            venue_type=venue_type,
        )
    )
    prediction["rejected_odds_sources"] = rejected_sources
    return prediction

