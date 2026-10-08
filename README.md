# Bet Tracker Pro v4

Sportfogadási bankroll követő — **monorepo**: React frontend + FastAPI backend + PostgreSQL (SQLAlchemy 2 + asyncpg + Alembic).

> ⚠️ A repo GYÖKERÉBEN nincs futtatható alkalmazás. Ne futtass itt `npm install`-t!
> A frontend a `frontend/`, a backend a `backend/` mappában van.
> A frontend **yarn**-t használ (van `yarn.lock`), NE használj npm-et hozzá.

## 🚀 Leggyorsabb indítás — Docker (egy paranccsal)
Ha van Docker (a GitHub Codespace-ben alapból van), a repo gyökeréből:
```bash
docker compose up --build
```
Ez elindítja egyszerre: **PostgreSQL 16 + backend (8001) + frontend (3000)**.
A `.env`-et a repo gyökerében a `backend/.env.example` alapján hozd létre (POSTGRES_USER, POSTGRES_PASSWORD, DATABASE_URL, JWT_SECRET, CORS_ORIGINS, ADMIN_EMAIL, ADMIN_PASSWORD).
Nyisd meg: **http://localhost:3000** (Codespace-ben a „Ports” fülön a 3000-es port).
Leállítás: `Ctrl+C`, majd `docker compose down` (adatok megmaradnak a `postgres_data` kötetben).

Belépés: az `ADMIN_EMAIL` / `ADMIN_PASSWORD` env változókkal seedelt admin fiók.


## Mappaszerkezet
```
bet-tracker-pro/
├── frontend/     # React (CRA + Craco) — yarn
├── backend/      # FastAPI (Python) + PostgreSQL (SQLAlchemy/Alembic)
├── netlify.toml  # Netlify deploy config (base: frontend)
└── package.json  # csak kényelmi szkriptek (nem valódi app)
```

## Frontend futtatása (fejlesztés)
```bash
cd frontend
yarn install
# hozz létre .env fájlt a backend címével:
echo 'REACT_APP_BACKEND_URL=http://localhost:8001' > .env
yarn start          # http://localhost:3000
```

## Backend futtatása (fejlesztés)
```bash
cd backend
pip install -r requirements.txt
# .env szükséges változók:
#   DATABASE_URL=postgresql+asyncpg://USER:PASS@localhost:5432/bettracker
#   JWT_SECRET=valami-hosszu-titok
#   CORS_ORIGINS=http://localhost:3000
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
> Kell egy futó PostgreSQL (helyben vagy managed, pl. Neon/Supabase/RDS — állítsd be a `DATABASE_URL`-t).
> A migrációk induláskor automatikusan lefutnak (`alembic upgrade head`); kézzel: `cd backend && python -m alembic upgrade head`.

## Gyökér kényelmi szkriptek (opcionális)
A repo gyökeréből:
```bash
npm run install:frontend     # = cd frontend && yarn install
npm run start                # = cd frontend && yarn start
npm run build                # = cd frontend && yarn build
npm run start:backend        # = uvicorn a backenden (8001)
```

## Telepítés (deploy)
- **Vercel (frontend + backend, TELJES STACK):** lásd `DEPLOY_VERCEL.md` ⭐ ajánlott
- **Netlify (csak frontend):** lásd `DEPLOY_NETLIFY.md` *(deprecated — a Vercel a jelenlegi teljes megoldás)*
- **Firebase (csak frontend):** lásd `frontend/DEPLOY_FIREBASE.md`
- **Google teljes stack (Cloud Run + Firebase + Atlas):** lásd `DEPLOY_GOOGLE.md`

A frontend production build a helyes `REACT_APP_BACKEND_URL`-t igényli (a deployolt backend URL-je).
