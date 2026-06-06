from __future__ import annotations

import csv
import io
from pathlib import Path
from time import time
from urllib.error import URLError
from urllib.request import urlopen, urlretrieve


CLUBELO_API = "http://api.clubelo.com"
_ELO_CACHE_TTL = 3600.0  # 1 hour
_elo_cache: dict[str, tuple[float, float]] = {}  # lower_name -> (elo, timestamp)


def club_history_url(club_name: str) -> str:
    safe_name = club_name.strip().replace(" ", "%20")
    return f"{CLUBELO_API}/{safe_name}"


def fetch_current_elo(team_name: str) -> float | None:
    """Fetch the latest Elo rating for a team from the ClubElo API.

    Results are cached for ELO_CACHE_TTL seconds. Returns None if the team
    is not found or the API is unreachable.
    """
    key = team_name.lower().strip()
    cached = _elo_cache.get(key)
    if cached and (time() - cached[1]) < _ELO_CACHE_TTL:
        return cached[0]

    url = club_history_url(team_name)
    try:
        with urlopen(url, timeout=5) as response:
            content = response.read().decode("utf-8-sig")
    except (URLError, OSError):
        return None

    rows = list(csv.DictReader(io.StringIO(content)))
    if not rows:
        return None

    try:
        elo = float(rows[-1]["Elo"])
    except (KeyError, TypeError, ValueError):
        return None

    _elo_cache[key] = (elo, time())
    return elo


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
