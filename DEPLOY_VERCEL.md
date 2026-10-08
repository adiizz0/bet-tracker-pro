# Deploy Bet Tracker Pro to Vercel (Multi-Service)

Ez a repo a Vercel **Services** architektúráját használja: **frontend + FastAPI backend + MongoDB Atlas**, minden egy Vercel projektben.

```
Vercel Project (Services)
├── frontend service   → React (frontend/, framework: create-react-app, yarn install)
└── backend  service   → FastAPI (backend/server.py, framework: fastapi)
        └──> MongoDB Atlas (Vercel Marketplace-en át provisionálva)
```

---

## ⚡ KRITIKUS — ELÖSZÖR OLVASD EL

Az első deploy után az összes `/api/*` **500 hibát** dob, ha az env változók hiányoznak. A backend log egyértelmű: `KeyError: 'DB_NAME'`, `MONGO_URL` stb. — a Python modul importja már bukik.

**Minimális env változó lista, ami nélkül SEMMI nem működik:**

| Név | Érték | Kritikus |
|-----|-------|----------|
| `DATABASE_URL` | PostgreSQL connection string (`postgresql+asyncpg://...`) | 🔴 KELL |
| `JWT_SECRET` | 64 karakteres random string | 🔴 KELL |
| `ADMIN_EMAIL` | `admin@bettracker.pro` | 🟡 admin seedhez |
| `ADMIN_PASSWORD` | `admin123` | 🟡 admin seedhez |
| `COOKIE_SECURE` | `true` | 🟢 default true |
| `COOKIE_SAMESITE` | `lax` | 🟢 default lax |
| `CORS_ORIGINS` | Vercel URL vagy `*` | 🟢 default `*` |

**Google Sign-In opcionális env változói** (csak ha akarod):
| Név | Érték |
|-----|-------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console Client Secret |

Ha ezek nincsenek beállítva, a Google button **automatikusan eltűnik** a Login képernyőről. Nem tör el semmit.

---

## 1) MongoDB Atlas — a Vercel Marketplace-ből

1. Vercel Dashboard → projekt → **Storage** fül → **Create Database** → **MongoDB Atlas**
2. **M0 (Free)** klaszter, régió pl. `Frankfurt (eu-central-1)`
3. **Connect** — auto-létrehoz `MONGODB_URI` env változót
4. Másold át `MONGODB_URI` értékét **`MONGO_URL`** nevű env változóba (a backend ezt olvassa)
5. Add hozzá **`DB_NAME=bettracker`** env változót

> Alternatíva: saját [MongoDB Atlas](https://cloud.mongodb.com) fiók → M0 klaszter → Network Access → whitelist `0.0.0.0/0` → connection stringet közvetlenül `MONGO_URL`-be.

---

## 2) Google OAuth 2.0 setup (opcionális, ha kell "Belépés Google-lel")

1. [Google Cloud Console](https://console.cloud.google.com/) → új projekt (pl. "Bet Tracker Pro")
2. **APIs & Services → OAuth consent screen** → External → alap adatok kitöltése
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. **Authorized JavaScript origins**:
   - `https://<your-vercel-domain>.vercel.app`
   - `http://localhost:3000` (opcionális, lokál devhez)
6. **Authorized redirect URIs**:
   - `https://<your-vercel-domain>.vercel.app/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback` (opcionális)
7. Create → másold ki a **Client ID** és **Client Secret** értékeket
8. Vercel → Settings → Environment Variables → add:
   - `GOOGLE_CLIENT_ID` = a Client ID
   - `GOOGLE_CLIENT_SECRET` = a Client Secret
9. Redeploy

---

## 3) Deploy lépések

1. **Push GitHubra** (Save to Github → Force Push)
2. **Vercel Import** (ha még nincs projekt): Framework: **Other**, Root Directory: `.`
3. **Env változók beírása** (2. szekció fenti táblázata)
4. **MongoDB Atlas hozzácsatolása** (1. szekció)
5. **Deployments → Redeploy** (kikapcsolni: "Use existing Build Cache")

---

## 4) Verifikáció

Nyisd meg: `https://<your-vercel-domain>.vercel.app`

- Register: új email + jelszó → belépés, bankroll létrejön
- Login: `admin@bettracker.pro` / `admin123`
- (Ha Google OAuth beállítva) "Belépés Google-lel" gomb megjelenik
- API health-check: `https://<your-vercel-domain>.vercel.app/api/` → `{"message":"Bet Tracker Pro API"}`

**Első dolog deploy után**: cseréld le az admin jelszót új admin userrel (regisztrálj magadnak, majd DB-ben töröld az `admin@bettracker.pro`-t vagy tartsd a saját userednek).

---

## 5) Hibaelhárítás

### 500 error a `/api/*`-on
- **Ha `KeyError: 'MONGO_URL'` vagy `KeyError: 'DB_NAME'`**: env változó hiányzik. Add be Vercel Settings → Env Vars-ba → Redeploy
- **Ha `pymongo.errors.ServerSelectionTimeoutError`**: MongoDB Atlas → Network Access → whitelist nem `0.0.0.0/0`
- **Ha `jwt.InvalidTokenError`**: `JWT_SECRET` nincs beállítva, vagy megváltoztattad (kilépteti az összes usert — normális)

### Google login hibák
- **"Google bejelentkezés nincs konfigurálva"**: `GOOGLE_CLIENT_ID` vagy `GOOGLE_CLIENT_SECRET` hiányzik Vercel env-ből
- **Redirect URI mismatch**: Google Cloud Console → Credentials → OAuth Client → Authorized redirect URIs-ban NEM SZEREPEL a pontos Vercel URL + `/api/auth/google/callback`
- **"Access blocked: App is not verified"**: OAuth consent screen még nem publikáltál — Test users listába add hozzá a saját Google email-ed

### Frontend nem éri el a backendet
- **`REACT_APP_BACKEND_URL`**: HAGYD ÜRESEN vagy ne is állítsd be — same-origin `/api` hívásokat használ

### Vercel deploy build fail
- **`Error: Cannot find module 'ajv/dist/compile/codegen'`** vagy hasonló: nézd meg hogy a `vercel.json` `frontend` service-ben `installCommand: yarn install --frozen-lockfile` be van-e írva
- **`Command "npm install" exited with 1`**: ugyanaz — a repóban van `.npmrc` `legacy-peer-deps=true`-val, ez fedi
