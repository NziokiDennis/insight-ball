from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from statistics import median
from typing import Iterable, Mapping


OUTCOMES = ("home", "draw", "away")


@dataclass(frozen=True)
class OddsSet:
    home: float
    draw: float
    away: float
    source: str = "manual"

    def as_dict(self) -> dict[str, float]:
        return {"home": self.home, "draw": self.draw, "away": self.away}


def validate_decimal_odds(odds: Mapping[str, float]) -> None:
    for outcome in OUTCOMES:
        value = float(odds[outcome])
        if not isfinite(value) or value < 1.01:
            raise ValueError(f"{outcome} odds must be a decimal value >= 1.01")


def implied_probabilities(odds: Mapping[str, float]) -> dict[str, float]:
    validate_decimal_odds(odds)
    return {outcome: 1.0 / float(odds[outcome]) for outcome in OUTCOMES}


def normalize_probabilities(probabilities: Mapping[str, float]) -> dict[str, float]:
    total = sum(float(probabilities[outcome]) for outcome in OUTCOMES)
    if not isfinite(total) or total <= 0:
        raise ValueError("probabilities must have a positive finite total")
    return {outcome: float(probabilities[outcome]) / total for outcome in OUTCOMES}


def devig_odds(odds: Mapping[str, float]) -> dict[str, float]:
    """Remove bookmaker margin with proportional normalization."""
    return normalize_probabilities(implied_probabilities(odds))


def overround(odds: Mapping[str, float]) -> float:
    return sum(implied_probabilities(odds).values()) - 1.0


def expected_value(probability: float, decimal_odds: float) -> float:
    return probability * decimal_odds - 1.0


def consensus_probabilities(
    odds_sets: Iterable[OddsSet],
    *,
    max_source_deviation: float = 0.12,
) -> tuple[dict[str, float], list[str]]:
    """Build a robust fair-probability consensus from several bookmakers.

    Each bookmaker is devigged first. We then take the median probability for
    each outcome and ignore sources whose total absolute deviation from the
    first-pass median is extreme. This is deliberately simple and explainable;
    it protects the first backend version from one obviously strange feed.
    """
    sets = list(odds_sets)
    if not sets:
        raise ValueError("at least one odds set is required")

    fair_by_source = [(odds.source, devig_odds(odds.as_dict())) for odds in sets]
    first_pass = {
        outcome: median(probabilities[outcome] for _, probabilities in fair_by_source)
        for outcome in OUTCOMES
    }

    accepted: list[tuple[str, dict[str, float]]] = []
    rejected: list[str] = []
    for source, probabilities in fair_by_source:
        deviation = sum(abs(probabilities[outcome] - first_pass[outcome]) for outcome in OUTCOMES)
        if len(fair_by_source) > 2 and deviation > max_source_deviation:
            rejected.append(source)
        else:
            accepted.append((source, probabilities))

    pool = accepted or fair_by_source
    consensus = {
        outcome: median(probabilities[outcome] for _, probabilities in pool)
        for outcome in OUTCOMES
    }
    return normalize_probabilities(consensus), rejected

