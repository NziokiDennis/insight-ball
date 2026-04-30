from __future__ import annotations

import csv
from pathlib import Path
from urllib.request import urlretrieve


CLUBELO_API = "http://api.clubelo.com"


def club_history_url(club_name: str) -> str:
    safe_name = club_name.strip().replace(" ", "%20")
    return f"{CLUBELO_API}/{safe_name}"


def download_club_history(club_name: str, destination_dir: Path) -> Path:
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = destination_dir / f"{club_name.strip().replace(' ', '_')}.csv"
    urlretrieve(club_history_url(club_name), destination)
    return destination


def read_latest_elo(path: Path) -> float | None:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        return None
    try:
        return float(rows[-1]["Elo"])
    except (KeyError, TypeError, ValueError):
        return None

