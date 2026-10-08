# Firebase Hosting – Bet Tracker Pro (frontend) telepítés

> A Firebase Hosting CSAK a React frontendet szolgálja ki.
> A FastAPI backend + MongoDB máshol fut (pl. Emergent Deploy / Cloud Run / Railway),
> és a frontend a `REACT_APP_BACKEND_URL`-en keresztül hívja azt.
> Így MINDEN funkció megmarad (auth, felhő PDF, kép-felismerés).

## 0) Előfeltétel: legyen egy publikus backend URL
A backendednek futnia kell egy elérhető HTTPS címen. Legegyszerűbb: Emergent felület → **Deploy**.
Jegyezd fel a backend URL-t, pl.: `https://bettracker-api.example.com`
(A backend CORS már engedélyezi a `*.web.app` és `*.firebaseapp.com` domaineket.)

## 1) Firebase CLI telepítése és belépés
```bash
npm install -g firebase-tools
firebase login
```

## 2) Projekt beállítása
Nyisd meg a `frontend/.firebaserc` fájlt, és írd be a Firebase projekt ID-det:
```json
{ "projects": { "default": "a-te-projekt-id-d" } }
```
(Ha még nincs projekted: https://console.firebase.google.com → Add project.)

## 3) Frontend build a helyes backend URL-lel
A `frontend` mappában állítsd be a backend URL-t, majd buildelj:
```bash
cd frontend
# a saját deployolt backended URL-je (NEM a preview URL):
echo 'REACT_APP_BACKEND_URL=https://a-te-backended-url.com' > .env.production
yarn install
yarn build
```
> A CRA a build pillanatában "beleégeti" a `REACT_APP_BACKEND_URL` értéket.

## 4) Deploy Firebase Hostingra
```bash
# a frontend mappából:
firebase deploy --only hosting
```
A deploy végén kapsz egy URL-t, pl.: `https://a-te-projekt-id-d.web.app`

## 5) Ellenőrzés
Nyisd meg a Firebase URL-t → belépés / regisztráció → Vezérlőpult.
Ha a hálózati hívás CORS hibát adna, ellenőrizd, hogy a backend fut és HTTPS-en elérhető.

---
### Fájlok, amiket ehhez létrehoztunk
- `frontend/firebase.json` – Hosting config (SPA rewrite: minden útvonal → index.html)
- `frontend/.firebaserc` – projekt azonosító (töltsd ki!)
- backend CORS – engedélyezi a `*.web.app` / `*.firebaseapp.com` domaineket

### Megjegyzés
Ha a backendet is Google-ön akarod futtatni: FastAPI → **Cloud Run** (konténer),
MongoDB → **MongoDB Atlas** (a Firestore NEM MongoDB). Ez több beállítást igényel.
A legegyszerűbb: backend az Emergent Deploy-on, frontend a Firebase-en.
