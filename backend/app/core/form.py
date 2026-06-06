from __future__ import annotations

from dataclasses import dataclass
from math import exp
from typing import Mapping


FORM_WINDOW = 5  # number of recent matches to use


@dataclass(frozen=True)
class TeamForm:
    matches: int
    wins: int
    draws: int
    losses: int
    goals_scored: float
    goals_conceded: float
    form_string: str  # e.g. "WWDLW", oldest first


def compute_team_form(
    rows: list[Mapping[str, str]],
    team_name: str,
    n: int = FORM_WINDOW,
) -> TeamForm | None:
    """Extract the last N completed matches for a team and compute form stats.

    Matches both home and away appearances. Team name comparison is
    case-insensitive so "Arsenal" and "arsenal" both resolve.
    """
    target = team_name.strip().lower()
    completed: list[tuple[str, float, float]] = []  # (W/D/L, scored, conceded)

    for row in rows:
        home = (row.get("HomeTeam") or "").strip().lower()
        away = (row.get("AwayTeam") or "").strip().lower()
        ftr = (row.get("FTR") or "").strip()
        fthg_raw = row.get("FTHG") or ""
        ftag_raw = row.get("FTAG") or ""

        if home != target and away != target:
            continue
        if ftr not in ("H", "D", "A"):
            continue

        try:
            hg = float(fthg_raw)
            ag = float(ftag_raw)
        except (ValueError, TypeError):
            continue

        if home == target:
            scored, conceded = hg, ag
            result = "W" if ftr == "H" else ("D" if ftr == "D" else "L")
        else:
            scored, conceded = ag, hg
            result = "W" if ftr == "A" else ("D" if ftr == "D" else "L")

        completed.append((result, scored, conceded))

    if not completed:
        return None

    recent = completed[-n:]
    wins = sum(1 for r, _, _ in recent if r == "W")
    draws = sum(1 for r, _, _ in recent if r == "D")
    losses = sum(1 for r, _, _ in recent if r == "L")
    goals_scored = sum(s for _, s, _ in recent)
    goals_conceded = sum(c for _, _, c in recent)
    form_string = "".join(r for r, _, _ in recent)

    return TeamForm(
        matches=len(recent),
        wins=wins,
        draws=draws,
        losses=losses,
        goals_scored=goals_scored,
        goals_conceded=goals_conceded,
        form_string=form_string,
    )


def _form_score(form: TeamForm) -> float:
    """Convert form stats to a 0–1 strength score.

    60% win rate + 20% attack (goals scored, normed to 2 per game) +
    20% defense (goals conceded, normed to 2 per game).
    """
    if form.matches == 0:
        return 0.5
    win_rate = form.wins / form.matches
    avg_scored = form.goals_scored / form.matches
    avg_conceded = form.goals_conceded / form.matches
    attack = min(avg_scored / 2.0, 1.0)
    defense = max(0.0, 1.0 - avg_conceded / 2.0)
    return 0.6 * win_rate + 0.2 * attack + 0.2 * defense


def form_1x2_probabilities(
    home_form: TeamForm,
    away_form: TeamForm,
    *,
    base_draw_probability: float,
) -> dict[str, float]:
    """Derive 1X2 probabilities from form scores via a logistic function."""
    home_score = _form_score(home_form)
    away_score = _form_score(away_form)

    # Scale gap to elo-like range so the logistic gives useful spread
    gap = (home_score - away_score) * 400.0
    non_draw_home_share = 1.0 / (1.0 + exp(-gap / 200.0))

    draw = min(max(base_draw_probability, 0.18), 0.34)
    non_draw = 1.0 - draw
    return {
        "home": non_draw * non_draw_home_share,
        "draw": draw,
        "away": non_draw * (1.0 - non_draw_home_share),
    }
