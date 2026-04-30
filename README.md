# Ignition

Football match probability tool with a React frontend and a Python backend
foundation for odds normalization, value detection, historical CSV ingestion,
and backtesting.

## Frontend

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `http://127.0.0.1:8000`.

## Backend

```bash
cd backend
pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8000
```

See [backend/README.md](backend/README.md) for the data-source and modelling
notes.
