# Teljes telepítés Google-re (Firebase Hosting + Cloud Run + MongoDB Atlas)

Cél: MINDEN a te Google-fiókodban fusson, egyetlen Firebase domain alatt.
- Frontend → **Firebase Hosting**
- Backend (FastAPI) → **Google Cloud Run** (konténer)
- Adatbázis → **MongoDB Atlas** (GCP régió)
- A Firebase Hosting a `/api/**` kéréseket a Cloud Run backendre irányítja (rewrite),
  így a frontend és backend AZONOS domainen van → nincs CORS gond, és a
  `REACT_APP_BACKEND_URL` üresen hagyható (relatív `/api` hívások).

---

## 1) MongoDB Atlas (adatbázis)
1. https://www.mongodb.com/atlas → hozz létre egy ingyenes M0 klasztert (GCP, pl. `europe-west1`).
2. Database Access → hozz létre egy DB usert (user + jelszó).
3. Network Access → engedélyezd `0.0.0.0/0`-t (vagy a Cloud Run kimenő IP-jét).
4. Másold ki a connection stringet, pl.:
   `mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority`

## 2) Backend → Google Cloud Run
Előfeltétel: telepített `gcloud` CLI és bejelentkezés (`gcloud auth login`), kiválasztott projekt (`gcloud config set project A-TE-PROJEKTED`).

```bash
cd backend

# Engedélyezd a szükséges API-kat (egyszer):
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# Build + deploy egy lépésben (a serviceId legyen 'bettracker-api', a firebase.json ezt hívja):
gcloud run deploy bettracker-api \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars "DB_NAME=bettracker,JWT_SECRET=CSERELD_LE_EGY_HOSSZU_TITKOSRA,EMERGENT_LLM_KEY=sk-emergent-e2979869f61C9Fe997,ADMIN_EMAIL=admin@bettracker.pro,ADMIN_PASSWORD=valami-eros-jelszo,CORS_ORIGINS=https://A-TE-PROJEKTED.web.app" \
  --set-env-vars "^@^MONGO_URL=mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority"
```
> A `^@^` szeparátor azért kell, mert a MONGO_URL vesszőt tartalmazhat.
> A régió (`europe-west1`) egyezzen a `frontend/firebase.json` rewrite régiójával és a `serviceId`-vel (`bettracker-api`).

## 3) Frontend → Firebase Hosting
```bash
cd ../frontend

# Ugyanazon a domainen lesz a backend (a /api rewrite miatt), ezért ÜRES a backend URL:
echo 'REACT_APP_BACKEND_URL=' > .env.production

yarn install
yarn build

npm install -g firebase-tools
firebase login
# írd be a projekt ID-t a .firebaserc-be, majd:
firebase deploy --only hosting
```
Végén kapsz egy URL-t: `https://A-TE-PROJEKTED.web.app` — itt fut az egész app.

## 4) Ellenőrzés
Nyisd meg a Firebase URL-t → regisztráció/belépés → Vezérlőpult → fogadás rögzítés → kép beolvasás → felhő PDF. Minden a te Google-infrastruktúrádon fut.

---

## Megjegyzés a teljes függetlenséghez (opcionális)
Két funkció jelenleg az Emergent kulcson/szervereken keresztül megy (működik a Cloud Run-ról is):
- **Kép-felismerés** (OpenAI gpt-5.4) → `EMERGENT_LLM_KEY` + emergentintegrations.
- **Felhő PDF tárolás** → Emergent Object Storage.

Ha 100%-ban Emergent-mentes, tisztán Google-alapú megoldást szeretnél:
- Kép-felismerés: saját **OpenAI** kulcs (openai SDK) vagy **Vertex AI Gemini**.
- Fájltárolás: **Firebase Storage / Google Cloud Storage**.
Szólj, és átírom ezt a két részt a saját Google/OpenAI kulcsaidra.
