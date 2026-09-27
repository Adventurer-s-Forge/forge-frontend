# Adventurer's Forge -- frontend

A D&D character creator. React 19 + TypeScript on Vite, with Firebase Authentication 
and game content served by [`forge-backend`](https://github.com/Adventurer-s-Forge/forge-backend) (FastAPI + Redis)

## Prerequisite

- **Node 22 or newer** (CI runs 22; `npm ci` needs the committed lockfile)
- A **Firebase project** with Authentication enabled
- **`forge-backend` running locally** for game content -- the character wizard 
cannot populate its race, class, background or item steps without it

## Setup

### 1. Install

```bash
npm ci
```

### 2. Environment
```sh
cp .env.example .env.local
```

Fill in all seven values. `.env.local` is gitignored; `.env.example` provides you naming convention.

| Variable | Where it comes from |
|-----|-----|
| `VITE_FIREBASE_*` (six) | Firebase console > Project settings > Your apps > Web app > SDK setup and config |
| `VITE_API_BASE_URL` | The content service, i.e. `http://localhost:8000` |
Vite reads env only at startup -- **restart the dev server** after editing it.

### 3. Firebase Authentication
Under **Authentication > Sign-in method**, enable:
- **Email/Password** - No further configuration
- **Google** -- set a support email; the OAuth client is created for you
- **GitHub** -- you create the OAuth app yourself:
  1. GitHub > Settings > Developer settings > OAuth Apps > New OAuth App
  2. Homepage URLL `http://localhost:5173`
  3. Authorization callback URL: Paste the `https://<project>.firebaseapp.com/__/auth/handler` URL that the Firebase GitHub panel shows -- it must match exactly
  4. Copy the client ID and secret into the Firebase panel

The GitHub client secret stays in the Firebase console. It is never an env var and never reaches the bundle.

Before deploying anywhere other than localhost, add that host under 
**Authenmtication > Settings > Authorized domains**, or sign-in fails with `auth/unauthorized-domain`.

### 4. Backend CORS
The content service must send `access-control-allow-origin` for the dev server's origin, 
or the browser discards every response -- request succeed server-side and fail in the app. In `forge-backend`:

```py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credential=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)
```

### 5. Run
```sh
npm run dev
```

## Scripts
| Command | Does |
|-----|-----|
| `npm run dev` | Dev server on `localhost:5173` |
| `npm run build` | Typecheck then production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest in watch mode |
| `npm run test:run` | Single test pass -- this is what CI runs |

## Layout
```
src/
  auth/         Firebase auth: provider, context, error mapping, OAuth + linking
  characters/   Rules engine -- ability maths, step validation, storage
  components/   Shared UI; character/ holds the creation wizard
  data/         Content catalog, API adapter, local SRD rules
  lib/          Firebase init and the typed API client
  pages/        Home, Login, Dashboard, NotFound
  routes/       Route guards
  theme/        Light/dark theme hook
  test/         Vitest suites
```