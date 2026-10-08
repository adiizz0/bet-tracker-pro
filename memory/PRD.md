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

## Live Odds eltávolítása (2026-06)
A teljes "Élő Szorzók" (Live Odds) funkció kikerült a projektből, user kérésére:
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
