from __future__ import annotations

import random
from dataclasses import dataclass
from math import exp, factorial
from typing import Mapping


MAX_GOALS = 8  # truncate scoreline matrix at 8 goals per side


@dataclass(frozen=True)
class LeagueStats:
    avg_home_goals: float
    avg_away_goals: float
    total_matches: int


@dataclass(frozen=True)
class TeamRatings:
    attack_home: float   # relative attack strength when playing at home
    defense_home: float  # relative defense when playing at home (lower = stronger)
    attack_away: float
    defense_away: float


def compute_league_stats(rows: list[Mapping[str, str]]) -> LeagueStats | None:
    home_goals: list[float] = []
    away_goals: list[float] = []
    for row in rows:
        if not (row.get("FTR") in ("H", "D", "A")):
            continue
        try:
            home_goals.append(float(row["FTHG"]))
            away_goals.append(float(row["FTAG"]))
        except (KeyError, ValueError, TypeError):
            continue
    if not home_goals:
        return None
    return LeagueStats(
        avg_home_goals=sum(home_goals) / len(home_goals),
        avg_away_goals=sum(away_goals) / len(away_goals),
        total_matches=len(home_goals),
    )


def compute_team_ratings(
    rows: list[Mapping[str, str]],
    team_name: str,
    league: LeagueStats,
) -> TeamRatings | None:
    """Compute attack/defense ratings for a team relative to league averages."""
    target = team_name.strip().lower()
    home_scored: list[float] = []
    home_conceded: list[float] = []
    away_scored: list[float] = []
    away_conceded: list[float] = []

    for row in rows:
        if row.get("FTR") not in ("H", "D", "A"):
            continue
        home = (row.get("HomeTeam") or "").strip().lower()
        away = (row.get("AwayTeam") or "").strip().lower()
        try:
            hg = float(row["FTHG"])
            ag = float(row["FTAG"])
        except (KeyError, ValueError, TypeError):
            continue

        if home == target:
            home_scored.append(hg)
            home_conceded.append(ag)
        elif away == target:
            away_scored.append(ag)
            away_conceded.append(hg)

    if not home_scored or not away_scored:
        return None

    return TeamRatings(
        attack_home=(sum(home_scored) / len(home_scored)) / league.avg_home_goals,
        defense_home=(sum(home_conceded) / len(home_conceded)) / league.avg_away_goals,
        attack_away=(sum(away_scored) / len(away_scored)) / league.avg_away_goals,
        defense_away=(sum(away_conceded) / len(away_conceded)) / league.avg_home_goals,
    )


def expected_goals(
    home_ratings: TeamRatings,
    away_ratings: TeamRatings,
    league: LeagueStats,
) -> tuple[float, float]:
    """Dixon-Coles expected goals: attack × opponent defense × league average."""
    lam_h = home_ratings.attack_home * away_ratings.defense_away * league.avg_home_goals
    lam_a = away_ratings.attack_away * home_ratings.defense_home * league.avg_away_goals
    return max(lam_h, 0.05), max(lam_a, 0.05)


def _pmf(k: int, lam: float) -> float:
    return (lam ** k) * exp(-lam) / factorial(k)


def poisson_1x2(lambda_home: float, lambda_away: float) -> dict[str, float]:
    """Exact 1X2 probabilities from Poisson distributions (no sampling noise)."""
    p_home = p_draw = p_away = 0.0
    for i in range(MAX_GOALS + 1):
        pi = _pmf(i, lambda_home)
        for j in range(MAX_GOALS + 1):
            p = pi * _pmf(j, lambda_away)
            if i > j:
                p_home += p
            elif i == j:
                p_draw += p
            else:
                p_away += p
    return {"home": p_home, "draw": p_draw, "away": p_away}


def top_scorelines(
    lambda_home: float,
    lambda_away: float,
    n: int = 5,
) -> list[dict]:
    """Return the n most probable scorelines with their probabilities."""
    scores = [
        {"scoreline": f"{i}-{j}", "probability": round(_pmf(i, lambda_home) * _pmf(j, lambda_away) * 100, 2)}
        for i in range(MAX_GOALS + 1)
        for j in range(MAX_GOALS + 1)
    ]
    scores.sort(key=lambda x: x["probability"], reverse=True)
    return scores[:n]


def _poisson_sample(lam: float) -> int:
    """Knuth's algorithm for sampling from Poisson(lambda)."""
    L = exp(-lam)
    k, p = 0, 1.0
    while p > L:
        k += 1
        p *= random.random()
    return k - 1


def simulate_matches(
    lambda_home: float,
    lambda_away: float,
    n: int = 1000,
) -> tuple[int, int, int]:
    """Simulate n matches from Poisson distributions. Returns (home_wins, draws, away_wins)."""
    home_wins = draws = away_wins = 0
    for _ in range(n):
        hg = _poisson_sample(lambda_home)
        ag = _poisson_sample(lambda_away)
        if hg > ag:
            home_wins += 1
        elif hg == ag:
            draws += 1
        else:
            away_wins += 1
    return home_wins, draws, away_wins
