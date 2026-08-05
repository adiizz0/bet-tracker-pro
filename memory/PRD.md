# Bet Tracker Pro — Vercel Deploy Setup

## Problem statement
Meglévő `github.com/adiizz0/bet-tracker-pro` repót előkészíteni teljes Vercel deployhoz — frontend és FastAPI backend **egy Vercel projektben**, MongoDB Atlas külső adatbázissal.

## Architektúra
```
Vercel Project (Services)
├── frontend service   → React (frontend/, framework: create-react-app)
└── backend  service   → FastAPI (backend/server.py, framework: fastapi, entrypoint: server:app)
        └──> MongoDB Atlas (Vercel Marketplace-en át provisionálva)
```

## Elkészült komponensek (2026-01, második iteráció)
1. **Repo 2 klón**: `/app/clones/bet-tracker-pro-1` és `/app/clones/bet-tracker-pro-2` — mindkettőben azonos állapot, 2 commit
2. **`vercel.json`** — új **Services** formátum (`services` + `rewrites` `type: service`), ahogy a Vercel dashboard javasolja monorepo felismeréskor
3. **`backend/requirements.txt`** — 127-ről 13 csomagra csökkentve (serverless bundle méret miatt): fastapi, motor, pymongo, bcrypt, PyJWT, reportlab, httpx, requests, pydantic, email-validator, python-multipart, python-dotenv, starlette
4. **`backend/.python-version`** = `3.12`
5. **`DEPLOY_VERCEL.md`** — átírva az új Services architektúrához
6. **Törölve**: `api/index.py`, root `requirements.txt`, root `.python-version` (nem kellenek Services módban)

## Env változók, amiket a user Vercel Dashboard-on beállít
- `MONGO_URL` (a `MONGODB_URI` másolataként, az Atlas Marketplace integráció után)
- `DB_NAME` = `bettracker`
- `JWT_SECRET` (előre generált: `JApHbcqIb_lfcvWI4y0WowSYpvKPIgUQbXc3nO_AvrJ28Yz5Rs-OHtsvhTxY2ZEdNcm_pY5CnXRDujfPlxn_1w`)
- `ODDS_API_KEY` (user birtokolja)
- `CORS_ORIGINS` = Vercel deploy URL
- `ADMIN_EMAIL` = `admin@bettracker.pro`, `ADMIN_PASSWORD` = `admin123` (első login után csere)
- `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`

## Amit a user csinál (mi nem tettünk meg, mert nem volt megbízás rá)
- `git push` a saját fork-jára / GitHub-ra
- Vercel projekt Import (Framework: Other, Root Directory: `.`)
- MongoDB Atlas Marketplace integráció aktiválása
- Env változók bevitele Vercel dashboardra
- Redeploy → verifikáció

## Nyitott (későbbi iteráció)
- Custom domain hozzáadása (`*.vercel.app` egyelőre elég)
- Admin jelszó csere UI-ból (jelenleg csak env vagy DB módosítás)
- Cold start optimalizáció (motor connection reuse, ha kellene)

## Nem érintettük a kódbázist
- `backend/server.py` érintetlen — a `startup` event automatikusan létrehozza az indexeket és beszúrja az admin usert, ez idempotens és serverless-kompatibilis
- Frontend kód érintetlen — `REACT_APP_BACKEND_URL=""` esetén az `api.js` same-origin `/api` hívásokat használ, ami épp a Vercel setup
