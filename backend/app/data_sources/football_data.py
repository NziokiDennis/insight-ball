from __future__ import annotations

import csv
from pathlib import Path
from urllib.request import urlretrieve


FOOTBALL_DATA_BASE_URL = "https://www.football-data.co.uk/mmz4281"


LEAGUE_CODES = {
    "premier_league": "E0",
    "championship": "E1",
    "bundesliga": "D1",
    "serie_a": "I1",
    "la_liga": "SP1",
    "ligue_1": "F1",
    "eredivisie": "N1",
    "portugal": "P1",
}


def season_to_code(season: str) -> str:
    """Convert '2025-2026' or '2025/26' to Football-Data's '2526' code."""
    cleaned = season.replace("/", "-")
    start, end = cleaned.split("-", 1)
    return f"{start[-2:]}{end[-2:]}"


def csv_url(season: str, league_code: str) -> str:
    return f"{FOOTBALL_DATA_BASE_URL}/{season_to_code(season)}/{league_code}.csv"


def download_csv(season: str, league_code: str, destination_dir: Path) -> Path:
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = destination_dir / f"{season_to_code(season)}_{league_code}.csv"
    urlretrieve(csv_url(season, league_code), destination)
    return destination


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))

