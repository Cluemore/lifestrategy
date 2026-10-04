# LifeStrategy

**Plan. Decide. Experience. Grow.**

LifeStrategy is a complete browser-playable 12-month financial life simulation. The player explores a compact illustrated town, receives a salary, allocates money, experiences consequential events, pursues goals, meets four financial characters, and studies the genuine strategic structure behind later disagreements.

## Local development

LifeStrategy runs as two local processes: Vite serves the React/Phaser client and FastAPI owns durable saves.

```bash
# Terminal 1 — API
cd backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS / Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

```bash
# Terminal 2 — frontend, from the project root
npm install
npm run dev
```

The committed [`.env.development`](.env.development) makes the browser call `/api`; Vite proxies that path to the local FastAPI process. Nothing in a production build falls back to localhost.

For a production build against a deployed API, set `VITE_API_BASE_URL` first:

```bash
VITE_API_BASE_URL=https://your-railway-service.up.railway.app/api npm run build
```

On Windows PowerShell, use `$env:VITE_API_BASE_URL = "https://your-railway-service.up.railway.app/api"` before `npm run build`.

Production build and tests:

```bash
npm test
npm run build
npm run preview
```

## Deploy: Vercel frontend + Railway API

The project is prepared for this split deployment. Vercel hosts the static Vite output; Railway runs the FastAPI service and mounts the SQLite database on persistent storage.

### 1. Deploy the FastAPI service to Railway

1. Create a Railway service from the repository and set its **Root Directory** to `backend`.
2. Set the config file to `backend/railway.json` if Railway does not auto-detect it. It runs `sh start.sh`, which binds Uvicorn to Railway's runtime `$PORT`, and checks `/health`.
3. Attach a Railway Volume to that service with mount path `/app/data`.
4. Add these Railway Variables:

| Variable | Production value |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_URL` | `sqlite:////app/data/lifestrategy.db` |
| `FRONTEND_URL` | `https://your-vercel-project.vercel.app` |

`DATABASE_URL` has four slashes after `sqlite:` because `/app/data/lifestrategy.db` is an absolute SQLite file path. The backend creates the parent folder when it starts, after the volume is mounted. Keep this SQLite service to one replica so concurrent containers cannot write the same file.

After Railway creates a public domain, confirm `https://your-railway-service.up.railway.app/health` returns an `ok` response.

### 2. Deploy the Vite client to Vercel

1. Import the repository in Vercel with the root directory set to the project root.
2. Vercel can use the committed [`vercel.json`](vercel.json): build command `npm run build`, output directory `dist`, and SPA fallback are already declared.
3. In **Project Settings → Environment Variables**, add this for both **Production** and any Preview environments you intend to test:

```text
VITE_API_BASE_URL=https://your-railway-service.up.railway.app/api
```

4. Deploy or redeploy after setting the variable. Vite injects `VITE_*` values during the build, so changing it does not update an already-built deployment.
5. Put the final Vercel origin (without a trailing slash) in Railway's `FRONTEND_URL`, then redeploy the Railway service once so production CORS accepts only that frontend origin.

For deliberately supported preview URLs, add them as a comma-separated `FRONTEND_ORIGINS` Railway variable. Do not use a wildcard CORS origin for this game.

## Controls

- Click buildings and signs to enter locations.
- Use WASD or arrow keys to move around town.
- Use the side menu or bottom dock for journals, goals, achievements, settings and Strategy Lab.
- Keyboard focus and visible focus rings are supported for core controls.

## Gameplay loop

Each simulated month is a chapter: salary → explore → allocate → event → consequence → strategy (Months 7–12) → reflection. A normal run lasts about 25–45 minutes. Active progress is saved automatically. Presentation Mode uses a fixed seed and curated event order while preserving real calculations, making the core loop demonstrable in 7–10 minutes.

## Architecture

- `src/game/phaser`: interactive town and player movement
- `src/game/engine`: financial calculations and scoring
- `src/game/data`: 36 events and goal definitions
- `src/gameTheory`: strategies, adaptive agents, utilities, negotiation, payoff matrix, best responses, Nash and Pareto calculations
- `src/store`: Zustand session with browser persistence and IndexedDB checkpoint
- `src/services`: centralized API client, save, history, transaction and event persistence services
- `src/app`: React game shell and overlays
- `src/audio`: Howler-compatible sound architecture and original synthesized cue
- `backend`: FastAPI, SQLAlchemy and readable SQLite persistence database

Phaser owns the world. React owns the notebook-like decision interfaces. Engines remain independent from presentation for maintainability and viva explanation.

## Financial model

Cash, savings, emergency fund, investments, debt, monthly income and essential expenses are tracked separately. Allocations cannot exceed salary. Events update real state, and opportunities can schedule delayed consequences. Wealth, Security, Lifestyle, Growth and Goals are normalized scores rather than currencies.

## Game Theory

Four strategies map to normalized allocation vectors. The human and current agent independently choose strategies; the negotiated allocation is their equal blend. State-dependent logarithmic utility provides diminishing returns. The app derives all 16 payoffs, tied best responses, every pure-strategy Nash equilibrium, and the Pareto frontier. See `docs/game-theory-explanation.md` for the formula and viva guide.

## Save, replay and accessibility

Zustand remains the responsive in-browser state layer, while FastAPI + SQLite is the normal durable path. Launch checks the stable lightweight player ID, hydrates the full save, and debounced meaningful changes update a versioned `game_saves` record plus chronological action, transaction and completed-event rows. If the API is briefly unavailable, the game remains playable from its local cache and safely retries. Final results classify actual behavior and produce deterministic insights. Reduced motion, mute controls, readable contrast, keyboard navigation and non-color-only Nash markers are included.

## Persistence and deployment

The Vite build remains the frontend output in `dist/`, while FastAPI owns durable game data. In local development it writes `backend/lifestrategy.db`; on Railway it writes `/app/data/lifestrategy.db` on the attached persistent volume. The UI can use its local cache during a temporary API outage; that fallback is not the primary persistence path. See [`backend/README.md`](backend/README.md) for environment details, the database schema, API flow, reset command and SQLite inspection examples.

## Functionality pass

The current build is a persistent, fully playable 12-month browser game rather than a visual prototype. The salary ledger, allocation lock, event resolution, delayed effects, debt servicing, goals, learning, agent state, strategy history, achievements, inventory, charts, final result, and run comparison all use the same saved game state. See [`docs/functionality-audit.md`](docs/functionality-audit.md) for the completed feature audit.

The town remains deliberately lightweight and illustrated: it uses runtime-drawn scenes, keyboard/click movement, nine usable places, and small state-reactive environmental details instead of a large sprite atlas. Its ambient music player uses original browser-synthesized loops, so the project remains self-contained and deployable without bundled copyrighted audio.
