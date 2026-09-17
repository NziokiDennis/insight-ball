from __future__ import annotations

from dataclasses import asdict, dataclass
from math import exp, sqrt
from time import perf_counter

from app.core.form import TeamForm, form_1x2_probabilities
from app.core.odds import OUTCOMES, OddsSet, consensus_probabilities, devig_odds, expected_value, overround
from app.core.poisson import poisson_1x2, simulate_matches, top_scorelines


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
    home_form: TeamForm | None = None
    away_form: TeamForm | None = None
    lambda_home: float | None = None  # Poisson expected goals
    lambda_away: float | None = None


def _elo_1x2(
    home_elo: float,
    away_elo: float,
    *,
    venue_type: str,
    base_draw: float,
) -> dict[str, float]:
    advantage = {"home": 65.0, "semi_neutral": 25.0, "neutral": 0.0, "away": -65.0}.get(venue_type, 65.0)
    gap = (home_elo + advantage) - away_elo
    home_share = 1.0 / (1.0 + exp(-gap / 220.0))
    draw = min(max(base_draw, 0.18), 0.34)
    nd = 1.0 - draw
    return {"home": nd * home_share, "draw": draw, "away": nd * (1.0 - home_share)}


def _blend(signals: dict[str, dict[str, float]], weights: dict[str, float]) -> dict[str, float]:
    return {o: sum(weights[s] * signals[s][o] for s in weights) for o in OUTCOMES}


def predict(inp: PredictionInput) -> dict:
    start = perf_counter()
    primary_odds = {"home": inp.home_odds, "draw": inp.draw_odds, "away": inp.away_odds}
    market = devig_odds(primary_odds)
    notes: list[str] = []

    elo_probs = None
    if inp.home_elo is not None and inp.away_elo is not None:
        elo_probs = _elo_1x2(inp.home_elo, inp.away_elo, venue_type=inp.venue_type, base_draw=market["draw"])

    form_probs = None
    if inp.home_form is not None and inp.away_form is not None:
        form_probs = form_1x2_probabilities(inp.home_form, inp.away_form, base_draw_probability=market["draw"])

    poisson_probs = None
    scorelines: list[dict] = []
    home_count = draw_count = away_count = 0
    if inp.lambda_home is not None and inp.lambda_away is not None:
        poisson_probs = poisson_1x2(inp.lambda_home, inp.lambda_away)
        scorelines = top_scorelines(inp.lambda_home, inp.lambda_away)
        # Real simulation: each iteration is a Poisson-sampled match scoreline
        home_count, draw_count, away_count = simulate_matches(
            inp.lambda_home, inp.lambda_away, inp.simulations
        )

    # --- determine blend ---
    active = {
        "elo": elo_probs is not None,
        "form": form_probs is not None,
        "poisson": poisson_probs is not None,
    }
    n_active = sum(active.values())

    if n_active == 3:
        model = _blend(
            {"market": market, "poisson": poisson_probs, "elo": elo_probs, "form": form_probs},
            {"market": 0.40, "poisson": 0.25, "elo": 0.20, "form": 0.15},
        )
        notes.append("Blend: 40% market + 25% Poisson + 20% Elo + 15% form.")
    elif active["poisson"] and active["elo"]:
        model = _blend(
            {"market": market, "poisson": poisson_probs, "elo": elo_probs},
            {"market": 0.45, "poisson": 0.30, "elo": 0.25},
        )
        notes.append("Blend: 45% market + 30% Poisson + 25% Elo.")
    elif active["poisson"] and active["form"]:
        model = _blend(
            {"market": market, "poisson": poisson_probs, "form": form_probs},
            {"market": 0.45, "poisson": 0.30, "form": 0.25},
        )
        notes.append("Blend: 45% market + 30% Poisson + 25% form.")
    elif active["poisson"]:
        model = _blend({"market": market, "poisson": poisson_probs}, {"market": 0.55, "poisson": 0.45})
        notes.append("Blend: 55% market + 45% Poisson.")
    elif active["elo"] and active["form"]:
        model = _blend({"market": market, "elo": elo_probs, "form": form_probs}, {"market": 0.55, "elo": 0.25, "form": 0.20})
        notes.append("Blend: 55% market + 25% Elo + 20% form.")
    elif active["elo"]:
        model = _blend({"market": market, "elo": elo_probs}, {"market": 0.65, "elo": 0.35})
        notes.append("Blend: 65% market + 35% Elo.")
    elif active["form"]:
        model = _blend({"market": market, "form": form_probs}, {"market": 0.70, "form": 0.30})
        notes.append("Blend: 70% market + 30% form.")
    else:
        model = market
        notes.append("Baseline: devigged market probabilities only.")

    # Use Poisson simulation counts when available; otherwise deterministic estimate
    if not active["poisson"]:
        home_count = round(model["home"] * inp.simulations)
        draw_count = round(model["draw"] * inp.simulations)
        away_count = round(model["away"] * inp.simulations)

    ev = {o: expected_value(model[o], primary_odds[o]) for o in OUTCOMES}
    best_outcome = max(OUTCOMES, key=lambda o: model[o])
    best_value = max(OUTCOMES, key=lambda o: ev[o])
    duration_ms = (perf_counter() - start) * 1000.0

    p_home = model["home"]
    confidence_band = round(1.96 * sqrt(p_home * (1.0 - p_home) / inp.simulations) * 100.0, 2)

    return {
        "home_probability": round(model["home"] * 100, 2),
        "draw_probability": round(model["draw"] * 100, 2),
        "away_probability": round(model["away"] * 100, 2),
        "home_count": home_count,
        "draw_count": draw_count,
        "away_count": away_count,
        "simulations": inp.simulations,
        "home_value_edge": round(ev["home"] * 100, 2),
        "draw_value_edge": round(ev["draw"] * 100, 2),
        "away_value_edge": round(ev["away"] * 100, 2),
        "confidence_band": confidence_band,
        "overround": round(overround(primary_odds) * 100, 2),
        "duration_ms": round(duration_ms, 1),
        "market_probabilities": {k: round(v * 100, 2) for k, v in market.items()},
        "expected_value": {k: round(v * 100, 2) for k, v in ev.items()},
        "recommended_outcome": best_value if ev[best_value] > 0.03 else None,
        "most_likely_outcome": best_outcome,
        "model_notes": notes,
        # Elo
        "home_elo": inp.home_elo,
        "away_elo": inp.away_elo,
        "elo_active": active["elo"],
        # Form
        "home_form": asdict(inp.home_form) if inp.home_form else None,
        "away_form": asdict(inp.away_form) if inp.away_form else None,
        "form_active": active["form"],
        # Poisson
        "lambda_home": round(inp.lambda_home, 3) if inp.lambda_home is not None else None,
        "lambda_away": round(inp.lambda_away, 3) if inp.lambda_away is not None else None,
        "poisson_active": active["poisson"],
        "most_likely_scoreline": scorelines[0]["scoreline"] if scorelines else None,
        "scoreline_probabilities": scorelines,
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
