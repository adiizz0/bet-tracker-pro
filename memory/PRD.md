# Bet Tracker Pro — Vercel Deploy Setup

## Problem statement
Meglévő `github.com/adiizz0/bet-tracker-pro` repót előkészíteni teljes Vercel deployhoz — frontend és FastAPI backend **egy Vercel projektben**, MongoDB Atlas külső adatbázissal.

## Architektúra
```
Vercel Project (monorepo)
├── /              → React (frontend/, static-build, distDir=build)
└── /api/*         → FastAPI Serverless Function (api/index.py, @vercel/python)
        └──> MongoDB Atlas (Vercel Marketplace-en át provisionálva)
```

## Elkészült komponensek (2026-01)
1. **Repo 2 klón**: `/tmp/clones/bet-tracker-pro-1` és `/tmp/clones/bet-tracker-pro-2` — mindkettőben ugyanaz a Vercel setup commit
2. **`vercel.json`** — `@vercel/python` (api/) + `@vercel/static-build` (frontend/), route: `/api/(.*)` → api function, minden más → SPA index.html fallback (filesystem handle-lel)
3. **`api/index.py`** — vékony ASGI wrapper: `sys.path`-hoz adja a `backend/` mappát és importálja a `server:app` FastAPI példányt
4. **`requirements.txt`** (root) — Minimal Python deps a serverless futáshoz: fastapi, motor, pymongo, bcrypt, PyJWT, reportlab, httpx, requests, pydantic, email-validator, python-multipart, python-dotenv
5. **`.python-version`** = `3.12`
6. **`.vercelignore`** — kizárja: docker-compose, netlify.toml, tests/, memory/, __pycache__, node_modules
7. **`DEPLOY_VERCEL.md`** — lépésről lépésre útmutató (MongoDB Atlas Marketplace, env változók, deploy, verifikáció, hibaelhárítás)
8. **`README.md`** frissítve, hogy a Vercel legyen az ajánlott deploy útvonal

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
