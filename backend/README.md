# LifeStrategy FastAPI + SQLite backend

The frontend stays React/Phaser/Zustand. This service is the durable persistence layer:

```text
React + Phaser → Zustand → frontend persistence services → FastAPI → SQLite
```

## Configuration

The service reads normal process environment variables. For local convenience, it also loads an optional `backend/.env` file (copy the included `.env.example`; never commit credentials).

| Variable | Local behavior | Production behavior |
| --- | --- | --- |
| `APP_ENV` | Defaults to `development`; Vite's same-origin `/api` proxy needs no CORS exception. | Set to `production`; the service refuses to start without an explicit frontend origin. |
| `DATABASE_URL` | Defaults to `backend/lifestrategy.db` when omitted. | Set to `sqlite:////app/data/lifestrategy.db` on a Railway volume mounted at `/app/data`. |
| `FRONTEND_URL` | Optional canonical Vite URL. | Required: the exact `https://…vercel.app` origin that may call the API. |
| `FRONTEND_ORIGINS` | Optional comma-separated extra origins. | Optional only for intentionally supported preview/custom domains. |

`LIFESTRATEGY_DATABASE_URL` remains a compatibility fallback for an older local setup, but new configuration should use `DATABASE_URL`.

## Start locally

From the project root, create and activate a virtual environment, then run the API:

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Start the UI separately from the project root:

```bash
npm install
npm run dev
```

The frontend's committed `.env.development` uses a same-origin `/api` URL and Vite proxies it to this local FastAPI process. To use a remote API during local frontend work, create a root `.env.local` with an absolute URL:

```bash
VITE_API_BASE_URL=https://your-railway-service.up.railway.app/api
```

## Deploy to Railway

1. Create a Railway service from this repository and set **Root Directory** to `backend`.
2. Use the included [`railway.json`](railway.json). It starts [`start.sh`](start.sh), which executes `python -m uvicorn main:app --host 0.0.0.0 --port "$PORT"`, and Railway checks `GET /health` before routing traffic.
3. Attach a Railway Volume at `/app/data`. Railway mounts volumes at runtime, and this service creates the SQLite directory on startup.
4. Set these Railway Variables:

```text
APP_ENV=production
DATABASE_URL=sqlite:////app/data/lifestrategy.db
FRONTEND_URL=https://your-vercel-project.vercel.app
```

The production service intentionally fails to start until `FRONTEND_URL` (or a deliberate `FRONTEND_ORIGINS` list) is set; it never falls back to a localhost origin in production. After the frontend's domain is known, set that exact origin and redeploy this service. If previews need API access, add their exact origins as a comma-separated `FRONTEND_ORIGINS` value.

Use a single Railway replica with SQLite. The persistent volume makes saves survive restarts and redeployments, but SQLite is not a multi-writer shared database.

## Database

The database is a standard SQLite file. The API creates its tables on startup: `backend/lifestrategy.db` by default locally, or the `/app/data/lifestrategy.db` file configured for Railway.

| Table | Purpose |
| --- | --- |
| `players` | Stable lightweight player ID and display name. |
| `game_saves` | Latest resumable full Zustand snapshot plus visible month, balances, scores, level and location columns. |
| `game_actions` | Chronological major game actions used by Journey. Client action IDs make retries idempotent. |
| `transactions` | Separate financial movements with month, category, amount and balance-after. |
| `completed_events` | Event decisions and saved consequence data. |

Inspect it with the SQLite CLI after playing:

```bash
sqlite3 lifestrategy.db ".tables"
sqlite3 lifestrategy.db "SELECT game_month, action_type, action_title, amount FROM game_actions ORDER BY id;"
sqlite3 lifestrategy.db "SELECT current_month, cash, savings, investments, debt, current_location FROM game_saves;"
```

## API flow

1. The browser creates or resumes a stable local player ID with `POST /api/players`.
2. On launch, `GET /api/save/{player_id}` hydrates the complete game snapshot if one exists.
3. Meaningful Zustand changes are debounced into `POST /api/save`.
4. New journal entries, transactions and event choices are posted to their chronological tables.
5. Journey reads `GET /api/history/{player_id}` so history remains real after a browser restart.

No game-critical fetch is required to move around the town. If the service is temporarily offline, Zustand and its local cache continue to run and a later save retry resumes normal persistence.

## Development reset and test

Reset only the current resumable save while retaining the audit history:

```bash
curl -X DELETE http://localhost:8000/api/save/YOUR_PLAYER_ID
```

Run backend API tests:

```bash
cd backend
pytest
```

The test creates an isolated SQLite database, verifies save/resume, idempotent history, transactions, completed events and persisted strategy data, then removes the test database.
