from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping

from app.core.poisson import (
    compute_league_stats,
    compute_team_ratings,
    expected_goals,
    poisson_1x2,
)


@dataclass(frozen=True)
class BacktestConfig:
    min_edge: float = 0.03
    stake: float = 1.0
    min_home_matches: int = 4   # minimum home matches before trusting Poisson
    min_away_matches: int = 4   # minimum away matches before trusting Poisson


def _actual_outcome(row: Mapping[str, str]) -> str | None:
    r = row.get("FTR") or row.get("result")
    return {"H": "home", "D": "draw", "A": "away"}.get(r or "")


def _odds_from_row(row: Mapping[str, str]) -> tuple[float, float, float] | None:
    for hk, dk, ak in [
        ("B365H", "B365D", "B365A"),
        ("PSH", "PSD", "PSA"),
        ("MaxH", "MaxD", "MaxA"),
        ("AvgH", "AvgD", "AvgA"),
    ]:
        try:
            return float(row[hk]), float(row[dk]), float(row[ak])
        except (KeyError, TypeError, ValueError):
            continue
    return None


def _count_home_matches(rows: list[Mapping[str, str]], team: str) -> int:
    t = team.lower()
    return sum(1 for r in rows if (r.get("HomeTeam") or "").lower() == t and r.get("FTR"))


def _count_away_matches(rows: list[Mapping[str, str]], team: str) -> int:
    t = team.lower()
    return sum(1 for r in rows if (r.get("AwayTeam") or "").lower() == t and r.get("FTR"))


def backtest_rows(
    rows: Iterable[Mapping[str, str]],
    config: BacktestConfig | None = None,
) -> dict:
    """Rolling-window Poisson backtest.

    For each match, we compute Poisson ratings from only the matches that
    preceded it in the list, so there is no data leakage.
    """
    cfg = config or BacktestConfig()
    completed: list[Mapping[str, str]] = []
    bet_log: list[dict] = []
    evaluated = 0

    for row in rows:
        outcome = _actual_outcome(row)
        odds = _odds_from_row(row)
        if outcome is None or odds is None:
            completed.append(row)
            continue

        evaluated += 1
        home_team = row.get("HomeTeam", "")
        away_team = row.get("AwayTeam", "")

        if (
            completed
            and home_team
            and away_team
            and _count_home_matches(completed, home_team) >= cfg.min_home_matches
            and _count_away_matches(completed, away_team) >= cfg.min_away_matches
        ):
            league = compute_league_stats(completed)
            if league:
                hr = compute_team_ratings(completed, home_team, league)
                ar = compute_team_ratings(completed, away_team, league)
                if hr and ar:
                    lh, la = expected_goals(hr, ar, league)
                    probs = poisson_1x2(lh, la)
                    ev = {
                        "home": probs["home"] * odds[0] - 1.0,
                        "draw": probs["draw"] * odds[1] - 1.0,
                        "away": probs["away"] * odds[2] - 1.0,
                    }
                    pick = max(ev, key=lambda k: ev[k])
                    if ev[pick] >= cfg.min_edge:
                        picked_odds = {"home": odds[0], "draw": odds[1], "away": odds[2]}[pick]
                        won = pick == outcome
                        pnl = round(cfg.stake * (picked_odds - 1.0) if won else -cfg.stake, 2)
                        bet_log.append({
                            "date": row.get("Date", ""),
                            "home_team": home_team,
                            "away_team": away_team,
                            "pick": pick,
                            "odds": round(picked_odds, 2),
                            "ev": round(ev[pick] * 100, 2),
                            "actual": outcome,
                            "won": won,
                            "pnl": pnl,
                            "xg_home": round(lh, 2),
                            "xg_away": round(la, 2),
                        })

        # Add to history AFTER evaluation — no leakage
        completed.append(row)

    total = len(bet_log)
    wins = sum(1 for b in bet_log if b["won"])
    profit = sum(b["pnl"] for b in bet_log)
    roi = profit / (total * cfg.stake) if total else 0.0

    return {
        "evaluated_matches": evaluated,
        "bets": total,
        "wins": wins,
        "hit_rate": round(wins / total, 4) if total else 0.0,
        "profit": round(profit, 2),
        "roi": round(roi, 4),
        "bets_detail": bet_log,
    }
