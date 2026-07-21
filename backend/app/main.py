from __future__ import annotations

import difflib
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.core.backtest import BacktestConfig, backtest_rows
from app.core.form import compute_team_form
from app.core.model import PredictionInput, predict
from app.core.poisson import compute_league_stats, compute_team_ratings, expected_goals, LeagueStats
from app.data_sources.clubelo import fetch_current_elo
from app.data_sources.football_data import read_csv
from app.schemas import BacktestRequest, PredictionRequest

_SUPABASE_URL = os.getenv("SUPABASE_URL", "")
_SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")


def _supa_insert(data: dict) -> tuple[bool, str]:
    """Returns (success, error_message)."""
    if not _SUPABASE_URL or not _SUPABASE_KEY:
        return False, "SUPABASE_URL or SUPABASE_KEY env var not set"
    try:
        req = Request(
            f"{_SUPABASE_URL}/rest/v1/predictions",
            data=json.dumps(data).encode(),
            headers={
                "Content-Type": "application/json",
                "apikey": _SUPABASE_KEY,
                "Authorization": f"Bearer {_SUPABASE_KEY}",
                "Prefer": "return=minimal",
            },
            method="POST",
        )
        with urlopen(req, timeout=6) as r:
            return r.status in (200, 201), ""
    except Exception as e:
        return False, str(e)


def _supa_fetch(limit: int = 100) -> list[dict]:
    if not _SUPABASE_URL or not _SUPABASE_KEY:
        return []
    try:
        req = Request(
            f"{_SUPABASE_URL}/rest/v1/predictions?order=created_at.desc&limit={limit}",
            headers={
                "apikey": _SUPABASE_KEY,
                "Authorization": f"Bearer {_SUPABASE_KEY}",
                "Accept": "application/json",
            },
        )
        with urlopen(req, timeout=6) as r:
            return json.loads(r.read())
    except Exception:
        return []


def _supa_fetch_pending() -> list[dict]:
    """Fetch predictions that have no actual result yet."""
    if not _SUPABASE_URL or not _SUPABASE_KEY:
        return []
    try:
        req = Request(
            f"{_SUPABASE_URL}/rest/v1/predictions?actual_result=is.null&order=created_at.desc&limit=500",
            headers={
                "apikey": _SUPABASE_KEY,
                "Authorization": f"Bearer {_SUPABASE_KEY}",
                "Accept": "application/json",
            },
        )
        with urlopen(req, timeout=6) as r:
            return json.loads(r.read())
    except Exception:
        return []


def _supa_update_result(prediction_id: str, result: str) -> bool:
    if not _SUPABASE_URL or not _SUPABASE_KEY:
        return False
    try:
        data = {
            "actual_result": result,
            "result_fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        req = Request(
            f"{_SUPABASE_URL}/rest/v1/predictions?id=eq.{prediction_id}",
            data=json.dumps(data).encode(),
            headers={
                "Content-Type": "application/json",
                "apikey": _SUPABASE_KEY,
                "Authorization": f"Bearer {_SUPABASE_KEY}",
                "Prefer": "return=minimal",
            },
            method="PATCH",
        )
        with urlopen(req, timeout=6) as r:
            return r.status in (200, 204)
    except Exception:
        return False


def _supa_health() -> dict:
    if not _SUPABASE_URL or not _SUPABASE_KEY:
        return {"ok": False, "error": "env vars missing", "url_set": bool(_SUPABASE_URL), "key_set": bool(_SUPABASE_KEY)}
    try:
        req = Request(
            f"{_SUPABASE_URL}/rest/v1/predictions?limit=1&order=created_at.desc",
            headers={
                "apikey": _SUPABASE_KEY,
                "Authorization": f"Bearer {_SUPABASE_KEY}",
                "Accept": "application/json",
            },
        )
        with urlopen(req, timeout=6) as r:
            body = json.loads(r.read())
            return {"ok": True, "http_status": r.status, "row_count_sample": len(body), "sample": body[:1]}
    except Exception as e:
        return {"ok": False, "error": str(e), "url_prefix": _SUPABASE_URL[:40]}


_RESULT_LEAGUES = [
    "eng.1",               # Premier League
    "fifa.world",          # World Cup 2026
    "fifa.world.2026",
    "uefa.champions",      # Champions League
    "uefa.champions_qual", # Champions League qualifying
    "uefa.europa",         # Europa League
    "uefa.europa.conf",    # Conference League
    "eng.2",               # Championship
    "esp.1",               # La Liga
    "ger.1",               # Bundesliga
    "ita.1",               # Serie A
    "fra.1",               # Ligue 1
    "ned.1",               # Eredivisie
    "por.1",               # Primeira Liga
    "tur.1",               # Super Lig
    "sco.1",               # Scottish Premiership
]


def _normalise_name(name: str) -> str:
    name = name.lower()
    for token in (" fc", " sc", " ac", " cf", " utd", " united", " city",
                  " town", " wanderers", " rovers", " athletic", " albion",
                  " hotspur", " wednesday", " county"):
        name = name.replace(token, "")
    return name.strip()


def _names_match(a: str, b: str, threshold: float = 0.78) -> bool:
    return difflib.SequenceMatcher(None, _normalise_name(a), _normalise_name(b)).ratio() >= threshold


def _fetch_completed_for_date(date_str: str) -> list[dict]:
    """Return all STATUS_FINAL matches across known leagues for YYYYMMDD."""
    matches: list[dict] = []
    for league in _RESULT_LEAGUES:
        try:
            url = (
                f"https://site.api.espn.com/apis/site/v2/sports/soccer"
                f"/{league}/scoreboard?dates={date_str}"
            )
            with urlopen(url, timeout=6) as r:
                data = json.loads(r.read())
            for event in data.get("events", []):
                comp = (event.get("competitions") or [{}])[0]
                status = ((comp.get("status") or {}).get("type") or {}).get("name", "")
                if not (status.startswith("STATUS_FINAL") or status in ("STATUS_FULL_TIME", "STATUS_FT")):
                    continue
                competitors = comp.get("competitors", [])
                home = next((c for c in competitors if c.get("homeAway") == "home"), None)
                away = next((c for c in competitors if c.get("homeAway") == "away"), None)
                if not home or not away:
                    continue
                try:
                    hs = int(home.get("score", -1))
                    as_ = int(away.get("score", -1))
                except (ValueError, TypeError):
                    continue
                if hs < 0 or as_ < 0:
                    continue
                matches.append({
                    "home_team": (home.get("team") or {}).get("displayName", ""),
                    "away_team": (away.get("team") or {}).get("displayName", ""),
                    "home_score": hs,
                    "away_score": as_,
                })
        except (URLError, OSError, json.JSONDecodeError, KeyError):
            continue
    return matches


class SavePredictionRequest(BaseModel):
    home_team: str = ""
    away_team: str = ""
    home_odds: float = 0
    draw_odds: float = 0
    away_odds: float = 0
    simulations: int = 1000
    home_prob: float = 0
    draw_prob: float = 0
    away_prob: float = 0
    recommended_outcome: str | None = None
    model_notes: list[str] = []
    league: str = "unknown"


_ESPN_TO_FD: dict[str, str] = {
    "Manchester United": "Man United",
    "Manchester City": "Man City",
    "Tottenham Hotspur": "Tottenham",
    "Newcastle United": "Newcastle",
    "Wolverhampton Wanderers": "Wolves",
    "West Bromwich Albion": "West Brom",
    "Brighton & Hove Albion": "Brighton",
    "Nottingham Forest": "Nott'm Forest",
    "Sheffield United": "Sheffield Utd",
    "Luton Town": "Luton",
    "Ipswich Town": "Ipswich",
    "Leicester City": "Leicester",
    "Crystal Palace": "Crystal Palace",
    "Brentford": "Brentford",
}

_DATA_DIR = Path(__file__).parent.parent / "data" / "football-data"
_form_rows: list[dict[str, str]] = []
_league_stats: LeagueStats | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _form_rows, _league_stats
    csv_path = _DATA_DIR / "E0.csv"
    if csv_path.exists():
        _form_rows = read_csv(csv_path)
        _league_stats = compute_league_stats(_form_rows)
    yield


app = FastAPI(
    title="Ignition Football Probability Engine",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://insight-ball.vercel.app",  # production
        "http://localhost:8080",             # Vite dev server
        "http://127.0.0.1:8080",
        "http://localhost:5173",             # legacy Vite port
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health() -> dict:
    return {"ok": 1}


@app.get("/api/v1/elo/{team_name}")
def elo_lookup(team_name: str) -> dict:
    elo = fetch_current_elo(team_name)
    if elo is None:
        raise HTTPException(status_code=404, detail=f"Elo rating not found for '{team_name}'")
    return {"team": team_name, "elo": elo}


@app.post("/api/v1/predict")
def prediction(request: PredictionRequest) -> dict:
    # --- Elo ---
    home_elo = request.home_elo
    away_elo = request.away_elo
    auto_fetched: list[str] = []

    if home_elo is None and request.home_team:
        home_elo = fetch_current_elo(request.home_team)
        if home_elo is not None:
            auto_fetched.append(f"{request.home_team} {home_elo:.0f}")
    if away_elo is None and request.away_team:
        away_elo = fetch_current_elo(request.away_team)
        if away_elo is not None:
            auto_fetched.append(f"{request.away_team} {away_elo:.0f}")

    # --- Form (venue-specific: home team home record, away team away record) ---
    home_form = (
        compute_team_form(_form_rows, request.home_team, venue="home")
        or compute_team_form(_form_rows, request.home_team)
    ) if request.home_team else None
    away_form = (
        compute_team_form(_form_rows, request.away_team, venue="away")
        or compute_team_form(_form_rows, request.away_team)
    ) if request.away_team else None

    # --- Poisson ---
    lambda_home = lambda_away = None
    if _league_stats and request.home_team and request.away_team:
        home_ratings = compute_team_ratings(_form_rows, request.home_team, _league_stats)
        away_ratings = compute_team_ratings(_form_rows, request.away_team, _league_stats)
        if home_ratings and away_ratings:
            lambda_home, lambda_away = expected_goals(home_ratings, away_ratings, _league_stats)

    result = predict(
        PredictionInput(
            home_odds=request.home_odds,
            draw_odds=request.draw_odds,
            away_odds=request.away_odds,
            simulations=request.simulations,
            home_team=request.home_team,
            away_team=request.away_team,
            venue_type=request.venue_type,
            home_elo=home_elo,
            away_elo=away_elo,
            home_form=home_form,
            away_form=away_form,
            lambda_home=lambda_home,
            lambda_away=lambda_away,
        )
    )

    if auto_fetched:
        result["model_notes"].append(f"Elo auto-fetched from ClubElo: {', '.join(auto_fetched)}.")

    return result


@app.get("/api/v1/datasets")
def list_datasets() -> dict:
    """List CSV datasets available for backtesting."""
    if not _DATA_DIR.exists():
        return {"datasets": []}
    datasets = [
        {"key": f.stem, "rows": sum(1 for _ in open(f)) - 1}
        for f in sorted(_DATA_DIR.glob("*.csv"))
    ]
    return {"datasets": datasets}


def _parse_espn_fixtures(data: dict, name_map: dict | None = None) -> list[dict]:
    """Shared ESPN scoreboard parser. name_map remaps display names if supplied."""
    fixtures = []
    for event in data.get("events", []):
        comp = (event.get("competitions") or [{}])[0]
        status_name = ((comp.get("status") or {}).get("type") or {}).get("name", "")
        if status_name not in ("STATUS_SCHEDULED", "STATUS_IN_PROGRESS"):
            continue
        competitors = comp.get("competitors", [])
        home = next((c for c in competitors if c.get("homeAway") == "home"), None)
        away = next((c for c in competitors if c.get("homeAway") == "away"), None)
        if not home or not away:
            continue
        raw_home = (home.get("team") or {}).get("displayName") or (home.get("team") or {}).get("name", "")
        raw_away = (away.get("team") or {}).get("displayName") or (away.get("team") or {}).get("name", "")
        fixtures.append({
            "id": event.get("id", ""),
            "date": event.get("date", ""),
            "home_team": (name_map or {}).get(raw_home, raw_home),
            "away_team": (name_map or {}).get(raw_away, raw_away),
        })
    return fixtures[:10]


@app.get("/api/v1/fixtures")
def get_fixtures() -> dict:
    """Fetch upcoming Premier League fixtures from ESPN."""
    try:
        url = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard"
        with urlopen(url, timeout=5) as r:
            data = json.loads(r.read())
        return {"fixtures": _parse_espn_fixtures(data, _ESPN_TO_FD)}
    except (URLError, OSError, json.JSONDecodeError, KeyError):
        return {"fixtures": []}


@app.get("/api/v1/fixtures/wc")
def get_wc_fixtures() -> dict:
    """Fetch upcoming FIFA World Cup 2026 fixtures from ESPN."""
    for slug in ("fifa.world", "fifa.world.2026"):
        try:
            url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard"
            with urlopen(url, timeout=6) as r:
                data = json.loads(r.read())
            fixtures = _parse_espn_fixtures(data)  # no name remapping for national teams
            if fixtures:
                return {"fixtures": fixtures}
        except (URLError, OSError, json.JSONDecodeError, KeyError):
            continue
    return {"fixtures": []}


@app.get("/api/v1/fixtures/cl")
def get_cl_fixtures() -> dict:
    """Fetch upcoming Champions League qualifying fixtures from ESPN."""
    for slug in ("uefa.champions_qual", "uefa.champions"):
        try:
            url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard"
            with urlopen(url, timeout=6) as r:
                data = json.loads(r.read())
            fixtures = _parse_espn_fixtures(data)
            if fixtures:
                return {"fixtures": fixtures}
        except (URLError, OSError, json.JSONDecodeError, KeyError):
            continue
    return {"fixtures": []}


@app.get("/api/v1/results/debug")
def debug_results(date: str = "", league: str = "fifa.world") -> dict:
    """Debug: show raw ESPN completed matches for a given date (YYYYMMDD) and league."""
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y%m%d")
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard?dates={date}"
    try:
        with urlopen(url, timeout=8) as r:
            data = json.loads(r.read())
        events = []
        for event in data.get("events", []):
            comp = (event.get("competitions") or [{}])[0]
            status = ((comp.get("status") or {}).get("type") or {}).get("name", "")
            competitors = comp.get("competitors", [])
            home = next((c for c in competitors if c.get("homeAway") == "home"), {})
            away = next((c for c in competitors if c.get("homeAway") == "away"), {})
            events.append({
                "status": status,
                "home": (home.get("team") or {}).get("displayName", ""),
                "away": (away.get("team") or {}).get("displayName", ""),
                "score": f"{home.get('score','?')}-{away.get('score','?')}",
            })
        unique_statuses = list({e["status"] for e in events})
        return {"url": url, "total_events": len(events), "unique_statuses": unique_statuses, "events": events}
    except Exception as e:
        return {"url": url, "error": str(e)}


@app.get("/api/v1/results/scan-statuses")
def scan_statuses(start: str = "", days: int = 30, league: str = "fifa.world") -> dict:
    """Scan a date range and return every unique ESPN status seen — useful for discovering new status codes."""
    if not start:
        start = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y%m%d")
    start_dt = datetime.strptime(start, "%Y%m%d")
    all_statuses: set[str] = set()
    for i in range(days):
        date_str = (start_dt + timedelta(days=i)).strftime("%Y%m%d")
        url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard?dates={date_str}"
        try:
            with urlopen(url, timeout=6) as r:
                data = json.loads(r.read())
            for event in data.get("events", []):
                comp = (event.get("competitions") or [{}])[0]
                status = ((comp.get("status") or {}).get("type") or {}).get("name", "")
                if status:
                    all_statuses.add(status)
        except Exception:
            continue
    return {"league": league, "start": start, "days_scanned": days, "unique_statuses": sorted(all_statuses)}


@app.patch("/api/v1/predictions/{prediction_id}/result")
def set_result_manually(prediction_id: str, body: dict) -> dict:
    """Manually set actual_result for a prediction."""
    result = body.get("result")
    if result not in ("home", "draw", "away"):
        raise HTTPException(status_code=400, detail="result must be home, draw or away")
    ok = _supa_update_result(prediction_id, result)
    return {"updated": ok}


@app.post("/api/v1/predictions/save")
def save_prediction(request: SavePredictionRequest) -> dict:
    ok, err = _supa_insert(request.model_dump())
    return {"saved": ok, "error": err if not ok else None}


@app.get("/api/v1/supabase/health")
def supabase_health() -> dict:
    return _supa_health()


@app.get("/api/v1/predictions")
def get_predictions(limit: int = 100) -> dict:
    rows = _supa_fetch(limit)
    return {"predictions": rows}


@app.get("/api/v1/results/update")
@app.post("/api/v1/results/update")
def update_results() -> dict:
    """Scan ESPN for completed scores and fill actual_result on pending predictions."""
    pending = _supa_fetch_pending()
    if not pending:
        return {"checked": 0, "updated": 0, "details": [], "note": "no pending predictions found in supabase"}

    date_cache: dict[str, list[dict]] = {}
    updated = 0
    details = []

    for pred in pending:
        home = pred.get("home_team", "").strip()
        away = pred.get("away_team", "").strip()
        if not home or not away:
            continue

        try:
            match_dt = datetime.fromisoformat(pred["created_at"].replace("Z", "+00:00"))
        except (ValueError, KeyError, TypeError):
            continue

        # Check 14 days forward and 14 days back — handles predictions made before/after the game
        result_found: str | None = None
        for delta in (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14):
            date_str = (match_dt + timedelta(days=delta)).strftime("%Y%m%d")
            if date_str not in date_cache:
                date_cache[date_str] = _fetch_completed_for_date(date_str)
            for m in date_cache[date_str]:
                if _names_match(home, m["home_team"]) and _names_match(away, m["away_team"]):
                    hs, as_ = m["home_score"], m["away_score"]
                    result_found = "home" if hs > as_ else ("draw" if hs == as_ else "away")
                    break
            if result_found:
                break

        if result_found:
            ok = _supa_update_result(pred["id"], result_found)
            if ok:
                updated += 1

    return {"checked": len(pending), "updated": updated}


@app.post("/api/v1/backtest")
def backtest(request: BacktestRequest) -> dict:
    all_rows: list[dict] = []
    for key in request.datasets:
        path = _DATA_DIR / f"{key}.csv"
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"Dataset '{key}' not found")
        all_rows.extend(read_csv(path))
    return backtest_rows(
        all_rows,
        BacktestConfig(
            min_edge=request.min_edge,
            stake=request.stake,
            min_home_matches=request.min_home_matches,
            min_away_matches=request.min_away_matches,
            max_odds=request.max_odds,
        ),
    )
