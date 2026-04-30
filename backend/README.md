# Ignition Backend

Python backend foundation for the football prediction engine.

## Data Choice

Start with Football-Data.co.uk CSVs because they include historical results,
match stats, and betting odds in a format that is easy to backtest.

Use ClubElo as a second input for team strength. StatsBomb Open Data is useful
later for xG/event-level research, but it is not broad enough to be the first
production betting dataset.

## Run Locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then set the frontend environment variable:

```bash
VITE_API_URL=http://127.0.0.1:8000
```

## Prediction Philosophy

The engine should not say a team is certain to win. It estimates probability
and looks for value:

```text
expected_value = model_probability * decimal_odds - 1
```

A bet is only interesting when the model probability is meaningfully higher
than the market probability and the edge survives backtesting.

## First Data Download

Football-Data URLs follow this shape:

```text
https://www.football-data.co.uk/mmz4281/2526/E0.csv
```

Where `2526` is the season and `E0` is the Premier League.

Supported starter league codes live in:

```text
backend/app/data_sources/football_data.py
```

