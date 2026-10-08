# bet-tracker-pro — Gyors audit jelentés

Sportfogadási bankroll-követő monorepo (React + FastAPI + MongoDB). Csak olvasási audit — semmi nem módosult.

## STACK
- **Frontend:** React 19 (CRA + Craco, `yarn`), Tailwind + Radix/shadcn UI, Recharts, framer-motion, react-router-dom 7, axios/swr, jsPDF.
- **Backend:** FastAPI (Python), egyetlen `backend/server.py`, `APIRouter(prefix="/api")`, uvicorn a 8001 porton.
- **Monorepo:** `frontend/`, `backend/`, plusz deploy configok (Vercel/Netlify/Firebase/Google) és `.emergent/`.

## BACKEND
- Egy fájlban (`server.py`) minden logika: auth, bets, bankrolls, settings, analytics, limits, export, PDF reports, odds.
- Env betöltés `python-dotenv`-vel, safe default-okkal.
- Külső API: the-odds-api.com (ha nincs kulcs → demo adat fallback).

## DATABASE
- **MongoDB**, `motor` async driver (`AsyncIOMotorClient`), `MONGO_URL` + `DB_NAME` env-ből.
- Collections: `users`, `user_sessions`, `bets`, `bankrolls`, `settings`, `reports`.
- Indexek startupkor (`users.email` unique, user_id, bankroll_id, session_token).
- Fő API endpointok: `/api/auth/{register,login,me,logout,google/*}`, `/api/settings`, `/api/bankrolls` (CRUD + activate), `/api/bets` (CRUD + import CSV), `/api/analytics`, `/api/limits/status`, `/api/export/csv`, `/api/reports` (PDF CRUD), `/api/odds/*`.

## AUTH
- **JWT** (PyJWT, HS256, 7 nap lejárat) + **bcrypt** jelszó-hash.
- Token httpOnly cookie-ban ÉS `Authorization: Bearer` fejlécben is elfogadva.
- Opcionális **Google OAuth 2.0** (csak ha `GOOGLE_CLIENT_ID/SECRET` beállítva).
- Admin user auto-seed `ADMIN_EMAIL` / `ADMIN_PASSWORD` env alapján.

## DEPLOYMENT
- **Van Docker Compose** (`docker-compose.yml`): mongo:7 + backend + frontend egy paranccsal (`docker compose up --build`).
- `backend/Dockerfile` + `.dockerignore` megvan.
- Deploy dokumentációk: Vercel (teljes stack, ajánlott), Netlify (deprecated), Firebase, Google Cloud Run.

## SECURITY
> A valódi értékeket nem írom ki, csak a tényt.
- ⚠️ **Bekcommitolt valódi titok:** a `docker-compose.yml` tartalmaz egy éles `ODDS_API_KEY` értéket, plusz default `ADMIN_PASSWORD` (gyenge) és egy placeholder `JWT_SECRET`.
- ⚠️ **Nem biztonságos JWT fallback:** ha `JWT_SECRET` nincs env-ben, a kód `CHANGE_ME...` default titkot használ → tokenek hamisíthatók.
- ⚠️ **Túl megengedő CORS:** default `allow_origins="*"` + `allow_credentials=True`, és széles regex (`*.vercel.app/netlify.app/web.app/firebaseapp.com`) bármely ilyen domaint beenged.
- ⚠️ **Google token az URL-ben:** a callback `?google_token=...` query paraméterként adja vissza (napló/history szivárgás kockázat).
- ⚠️ **Nincs rate limit / brute-force védelem** a login endpointon; PDF-ek base64-ként a Mongóban (adatbázis-hízás).

## TOP 5 PROBLEM
1. **Bekommitolt éles Odds API kulcs + default admin jelszó** a `docker-compose.yml`-ben (azonnali rotáció kell).
2. **Nem biztonságos `JWT_SECRET` fallback** — ha az env hiányzik, a tokenek hamisíthatók.
3. **Túl laza CORS** `allow_credentials=True` mellett (CSRF/credential-visszaélés kockázat).
4. **Gyenge, auto-seedelt admin** (`admin123` jellegű default) éles környezetben.
5. **Hiányzó alapvédelmek:** nincs login rate limit, és a Google JWT az URL query-ben utazik.

## NEXT STEP — saját VPS-en Emergent nélkül
Az app futásához Emergent NEM szükséges, önállóan fut. Teendők:
1. **Rotáld** a kiszivárgott Odds API kulcsot, és vedd ki a titkokat a compose-ból env/secret fájlba.
2. Állíts be erős `JWT_SECRET`-et, saját `ODDS_API_KEY`-t, erős `ADMIN_PASSWORD`-öt, `CORS_ORIGINS`-t a saját domainedre, `COOKIE_SECURE=true`.
3. `backend/.env`: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `ODDS_API_KEY`, `CORS_ORIGINS`. `frontend/.env`: `REACT_APP_BACKEND_URL` a backend publikus címére.
4. Indítás: `docker compose up --build` (mongo+backend+frontend), VAGY kézzel uvicorn + `yarn build` statikus kiszolgálás.
5. Tedd **nginx reverse proxy + TLS (HTTPS)** mögé, és futtass menedzselt vagy saját MongoDB-t (Atlas vagy helyi).
