# Netlify telepítés (frontend)

> A Netlify a React frontendet szolgálja ki. A FastAPI backend + MongoDB
> egy külön elérhető HTTPS URL-en fut (pl. Emergent Deploy / Cloud Run / Railway),
> és a frontend a `REACT_APP_BACKEND_URL`-en keresztül hívja azt.
> A backend CORS már engedélyezi a `*.netlify.app` domaint (credentials-szel), a
> bejelentkezési süti SameSite=None; Secure, így cross-site is működik.

## Előfeltétel
Legyen egy publikus backend URL (a backended deployolva). Jegyezd fel, pl.:
`https://a-te-backended.example.com`

## Netlify UI-ból (legegyszerűbb)
1. https://app.netlify.com → **Add new site → Import an existing project** → kösd be a GitHub repót.
2. A `netlify.toml` (a repo gyökerében) már beállítja:
   - Base directory: `frontend`
   - Build command: `yarn build`
   - Publish directory: `build`
   - SPA redirect: `/* → /index.html`
3. **Site settings → Environment variables** → add hozzá:
   - `REACT_APP_BACKEND_URL = https://a-te-backended.example.com`
4. **Deploy site.** A végén kapsz egy URL-t: `https://a-te-oldalad.netlify.app`

## Netlify CLI-ből (alternatíva)
```bash
npm install -g netlify-cli
netlify login
netlify init        # kösd a repóhoz / hozz létre site-ot
netlify env:set REACT_APP_BACKEND_URL https://a-te-backended.example.com
netlify deploy --build --prod
```

## Ellenőrzés
Nyisd meg a Netlify URL-t → regisztráció/belépés → Vezérlőpult → fogadások, import, jelentések.
A PDF jelentések a fiókodhoz (adatbázisba) mentődnek, nem felhő tárolóba.
