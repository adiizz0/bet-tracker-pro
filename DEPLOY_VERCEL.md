# Deploy Bet Tracker Pro to Vercel (Multi-Service)

Ez a repo a Vercel **új Services** architektúráját használja: **frontend + FastAPI backend + MongoDB Atlas**, minden egy Vercel projektben.

```
Vercel Project (Services)
├── frontend service   → React (frontend/, create-react-app)
└── backend  service   → FastAPI (backend/server.py, "fastapi" framework)
        └──> MongoDB Atlas (Vercel Marketplace-en át provisionálva)
```

Kulcs fájlok:
- **`vercel.json`** — a `services` blokk definiálja mindkettőt, a `rewrites` a `/api/*`-t a backendre, minden mást a frontendre irányít
- **`backend/server.py`** — FastAPI app, `app = FastAPI()` a modul szinten (Vercel auto-detektálja)
- **`backend/requirements.txt`** — minimál Python deps (~13 csomag)
- **`backend/.python-version`** = `3.12`
- **`frontend/`** — CRA + craco (érintetlen)

---

## 1) MongoDB Atlas — a Vercel Marketplace-ből

1. Vercel Dashboard → a projekt neve → **Storage** fül → **Create Database** → **MongoDB Atlas**
2. Válaszd az **M0 (Free)** klasztert, régió pl. `Frankfurt (eu-central-1)`
3. **Connect** — az integráció automatikusan létrehoz egy `MONGODB_URI` env változót minden környezetben
4. Másold át `MONGODB_URI` értékét a **`MONGO_URL`** nevű env változóba is (a backend ezt olvassa):
   - Settings → Environment Variables → Add
   - Név: `MONGO_URL`, Érték: ugyanaz mint `MONGODB_URI`
   - Environments: Production, Preview, Development
5. Redeploy szükséges, hogy az env változó életbe lépjen.

> Alternatíva: saját [MongoDB Atlas](https://cloud.mongodb.com) fiókkal M0 klaszter, hálózati whitelist `0.0.0.0/0`, connection stringet közvetlenül `MONGO_URL`-be.

---

## 2) Environment Variables (Vercel Dashboard)

Settings → **Environment Variables** → Add for **Production + Preview + Development**:

| Név              | Érték                                                                                          |
|------------------|------------------------------------------------------------------------------------------------|
| `MONGO_URL`      | (MongoDB Atlas connection string — a `MONGODB_URI`-ból másolva)                                |
| `DB_NAME`        | `bettracker`                                                                                   |
| `JWT_SECRET`     | `JApHbcqIb_lfcvWI4y0WowSYpvKPIgUQbXc3nO_AvrJ28Yz5Rs-OHtsvhTxY2ZEdNcm_pY5CnXRDujfPlxn_1w`       |
| `ODDS_API_KEY`   | (a the-odds-api kulcsod)                                                                       |
| `CORS_ORIGINS`   | `https://<a-vercel-doméned>.vercel.app`                                                        |
| `ADMIN_EMAIL`    | `admin@bettracker.pro`                                                                         |
| `ADMIN_PASSWORD` | `admin123` (első deploy után **CSERÉLD LE** az admin UI-ból)                                    |
| `COOKIE_SECURE`  | `true`                                                                                         |
| `COOKIE_SAMESITE`| `lax`                                                                                          |

> A frontend nem igényel külön env változót — same-origin `/api` hívásokat használ.

Új JWT_SECRET generálás helyben:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

---

## 3) Deploy lépések

1. **Push GitHubra**:
   ```bash
   git add .
   git commit -m "Add Vercel Services config (frontend + backend)"
   git push origin main
   ```

2. **Vercel Import** (ha még nincs projekt):
   - vercel.com → Add New… → **Project** → Import a `bet-tracker-pro` repót
   - **Build setting: Services** (a Vercel automatikusan felismeri a `vercel.json` `services` blokkját)
   - Root Directory: **.** (a repo gyökere)
   - Deploy

3. **MongoDB Atlas integráció** (első deploy után): lásd 1. pont

4. **Redeploy** miután minden env változó a helyén van: Deployments → utolsó → ⋯ → **Redeploy**

---

## 4) Verifikáció

Nyisd meg: `https://<a-vercel-doméned>.vercel.app`

- Login: `admin@bettracker.pro` / `admin123`
- API health-check: `https://<a-vercel-doméned>.vercel.app/api/` → `{"message":"Bet Tracker Pro API"}`
- Regisztrálj egy új usert, adj hozzá bet-et, generálj PDF jelentést

**Első dolog deploy után**: cseréld le az admin jelszót.

---

## 5) Hibaelhárítás

- **`vercel.json required to deploy projects with multiple services`**: ez a repo már tartalmazza. Ha mégis látod, csekkold hogy a `vercel.json` a repo gyökerében van és a `services` kulccsal kezdődik.
- **500 error `/api/*`-on**: Vercel Dashboard → Deployments → aktív → válaszd a **backend** service-t → **Logs**. Leggyakoribb: `MONGO_URL` vagy `JWT_SECRET` nincs beállítva → redeploy.
- **`Deployment size exceeded`**: a `backend/requirements.txt` már a minimál 13 csomag. Ha növelnéd, nézd meg a Vercel limitet (250MB uncompressed).
- **Cold start lassú**: első hívás 2-5s (serverless natúra). Következő hívások gyorsak, amíg a function melegen marad.
- **CORS hiba**: a frontend és a backend ugyanazon a doménen van, így nem szabadna. Ha mégis: állítsd be `CORS_ORIGINS`-t a pontos Vercel URL-lel.
- **`ODDS_API_KEY` limit**: enélkül (vagy limit felett) a `/api/odds/*` automatikusan demó adatokat ad vissza, nem tör el az UI.

---

## 6) Custom domain (opcionális)

Vercel → Settings → Domains → Add — DNS beállítás után automatikusan HTTPS-t kap. Ne felejtsd frissíteni a `CORS_ORIGINS` env változót az új doménnel.
