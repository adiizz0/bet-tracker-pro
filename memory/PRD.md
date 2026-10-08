# Bet Tracker Pro — PRD / állapot

## Eredeti kérés
Az `adiizz0/bet-tracker-pro` repó top 5 biztonsági hibájának javítása — funkció-változtatás,
refaktor és új feature NÉLKÜL. Felhasználó nyelve: magyar.

## Stack
React 19 (CRA+Craco, Tailwind/shadcn) + FastAPI (`backend/server.py`, /api prefix) + MongoDB (motor).
JWT (HS256) + bcrypt auth, opcionális Google OAuth. ODDS API integráció (the-odds-api.com).

## Elvégezve (2026-06)
- GitHub repó (main) behúzva a /app-ba (backend + frontend + deploy configok), preview-ban fut.
- JWT_SECRET: kötelező env, fallback törölve → import-time RuntimeError, ha hiányzik.
- CORS: `*` és a széles `allow_origin_regex` (vercel/netlify/web.app) törölve; csak explicit
  `CORS_ORIGINS` env lista engedélyezett, hiányzó érték esetén RuntimeError.
- Login rate limit: in-memory, IP+email kulcs, 5 próba / 15 perc (LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_SECONDS env-ből), sikeres belépés nullázza → 429 + magyar hibaüzenet.
- docker-compose.yml: default `admin123` ADMIN_PASSWORD és a placeholder JWT_SECRET kivéve,
  `${...}` env-referenciák lettek; CORS_ORIGINS is env-ből.
- Backend .env: CORS_ORIGINS, JWT_SECRET, ADMIN_EMAIL/ADMIN_PASSWORD, rate-limit paraméterek.

## Live Odds eltávolítása (2026-06)A teljes "Élő Szorzók" (Live Odds) funkció kikerült a projektből, user kérésére:
- Backend: `/api/odds/sports` és `/api/odds/{sport}` endpointok, `DEMO_SPORTS`, `demo_odds()`,
  `ODDS_API_KEY` / `ODDS_API_BASE` config törölve (httpx megmarad a Google OAuth-hoz).
- Frontend: `pages/LiveOdds.jsx` törölve, App.js route + import, Layout nav item (`Radio` ikon) törölve.
- Config/doc: docker-compose ODDS env-ek, README / DEPLOY_VERCEL / DEPLOY_GOOGLE / DEPLOY_FIREBASE
  odds-hivatkozásai törölve. `backend/tests/test_bettracker.py` `TestOdds` osztály törölve.
- A fogadások `odds` (szorzó) mezője, profit-számítás, statisztikák, bankroll, auth változatlan.

## Backlog (P1/P2)
- Google OAuth callback token a query stringben (napló-szivárgás) → cookie/fragment.
- PDF riportok base64-ben a Mongóban → object storage.
- Rate limit perzisztens tárolóban (Mongo/Redis), ha több backend instance lesz.

## MongoDB -> PostgreSQL migráció (2026-06)
Stack: FastAPI + SQLAlchemy 2.1 (async) + asyncpg + Alembic + PostgreSQL.
- `backend/db.py`: async engine + connection pool (DB_POOL_SIZE/MAX_OVERFLOW/RECYCLE env), `SessionLocal`,
  `run_migrations()` (alembic upgrade head, startupkor `RUN_MIGRATIONS_ON_STARTUP=true` mellett).
- `backend/models.py`: normalizált schema — surrogate BIGSERIAL PK + `public_id` business key
  (user_/br_/bet_/rep_ prefix, így az API contract nem változott).
  users, user_sessions, bankrolls, settings (1:1 user, active_bankroll_id FK SET NULL),
  bets (FK users+bankrolls ON DELETE CASCADE, CHECK a result értékekre), reports (pdf_data BYTEA).
  created_at/updated_at minden fő táblán; indexek: bets(user_id,bankroll_id,bet_date),
  bets(bankroll_id), bankrolls(user_id,created_at), reports(user_id,created_at),
  user_sessions(user_id), user_sessions(expires_at), unique: users.email, *.public_id.
- `backend/alembic/` + `alembic.ini`: initial migration `163d14bd6f54_initial_schema.py` (async env.py).
- `server.py`: minden Mongo query SQLAlchemy-re cserélve, user isolation minden query WHERE-jében
  (user_id), `/bets` és `/reports` server-side `limit`/`offset` paraméterrel (default = korábbi viselkedés),
  analytics/export `stream_scalars(yield_per=500)`-szal olvas.
- Mongo eltávolítva: motor/pymongo kivéve a requirements.txt-ből, nincs Mongo kód.
  (A `backend/.env`-ben a platform által védett MONGO_URL/DB_NAME kulcsok benne maradtak, de nincsenek használva.)
- Preview: lokális PostgreSQL 15 a konténerben (PGDATA=/app/.pgdata, supervisor program: postgresql).
  FIGYELEM: Emergent Deploy után ez NEM indul el — ott managed Postgres DATABASE_URL kell.
- docker-compose: postgres:16 + healthcheck (pg_isready) + persistent volume `postgres_data`,
  backend `depends_on: service_healthy`, minden credential env-referencia. `.env.example` a gyökérben és backendben.
- Teszt: `tests/pg_migration_smoke.py` — 34/34 PASS (auth, JWT, /me, bankrollok, bets CRUD,
  analytics, limits, pagination, user isolation, CSV import/export, PDF create/list/download/delete, cascade).

## Docker backend fix (2026-06)
- Bug: `exec: "uvicorn": executable file not found in $PATH` — a `backend/requirements.txt`-ből hiányzott az uvicorn
  (a preview podban globálisan telepítve volt, a Docker image-ben nem).
- Fix: `uvicorn[standard]==0.30.6` a requirements.txt-be; indítás `python -m uvicorn ...` formában a
  `docker-compose.yml`-ben és a `backend/Dockerfile` CMD-ben (nem függ a console-script PATH-tól).
- Validálás (Docker nincs a podban): tiszta venv-be telepített requirements.txt + üres `bettracker_docker` DB
  -> alembic `163d14bd6f54 (head)`, 7 tábla létrejött, smoke test 34/34 PASS a 8002-es porton,
  majd a supervisor backenden (8001) is 34/34 PASS. testing_agent: backend 100%, 0 issue.
- `tests/test_pg_migration_smoke.py`: pytest wrapper (a smoke scriptet subprocessként futtatja, nincs enyhítés).
