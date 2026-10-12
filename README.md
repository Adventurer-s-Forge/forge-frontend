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
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

### 5. Run
```sh
npm run dev
```

## Character Persistence

Game content is read anonymously. Characters are per-user and require authentication.

> **Status:** not yet implemented backend-side. `POST /characters` currently accepts only
> `{character_name, user_name}`, `PUT /characters/{id}` and `DELETE /characters/{id}` do not exist,
> and the API requires an `X-User-Id` header rather than the bearer token the client sends.
> The client code below is in plkace and will work once the routes match.

### Endpoints

| Method | Path | Used by |
|--------|------|---------|
| `GET`  | `/characters` | Dashboard, on load |
| `POST` | `/characters` | First save of a new character -- the Name step |
| `PUT`  | `/characters/{id}` | Every later step, full replace |
| `DELETE` | `/characters/{id}` | The delete button on a character card |

### Lifecycle (New change 10/12)

The wizard writes **twice**: once on the Name step, so the character exists and can be resumed,
and once at the end. The six steps between do not touch the network anymore.

1. **Name step** -- `POST /characters` with the full payload. The **client** generates the `id`
  (`crypto.randomUUID()`), so a retried POST is safe; the server should `409` on a collision
  rather than mint a second record.
2. **Steps 2-7** -- no requests. The draft lives in React state.
3. **Finish, or "Save and close" from the exit prompt** -- one `PUT /characters/{id}`

Dismissing the wizard with unsaved steps prompts rather than discarding: save and close, discard,
or keep editing. A PUT may therefore arrive **partial** -- closing on step 4 sends `classId` set 
and `spellIds` still empty.

There are no per-step routes. Steps cascade: changing class prunes skills and spells, changing
background also clears the allocation and the equipment choice. The client computes the whole
consistent document and replaces it.

### Payload

`src/characters/storage.ts` sends an explicit allow-list, because the server uses `extra="forbid"`:

```json
{
  "id": "0f8c1a7e-3d52-4b91-a7c8-6e2f91b40d35",
  "name": "Gandalf",
  "level": 1,
  "raceId": "srd-2024_gnome",
  "sizeChoice": "Small",
  "classId": "srd-2024_wizard",
  "backgroundId": "srd-2024_sage",
  "abilities": {
    "method": "standard",
    "base": { "STR": 10, "DEX": 12, "CON": 14, "INT": 15, "WIS": 13, "CHA": 8 },
    "rolled": [],
    "originBonuses": { "INT": 2, "CON": 1 }
  },
  "proficientSkillIds": ["arcana", "history"],
  "spellIds": ["srd-2024_fire-bolt", "srd-2024_shield"],
  "equipmentChoice": { "class": "A", "background": "B" },
  "purchasedItemIds": ["srd-2024_rope", "srd-2024_rope"],
  "completedSteps": ["name", "race", "class", "background", "equipment", "attributes", "skills", "spells"]
}

```

`proficientSkillIds` holds **class picks only** -- background-granted are derived from `backgroundId`,
so a class change can prune picks without destroying grants.

`equipmentChoice` records which starting-equipment option was taken from each source; the items
themselves are derived from it.

`purchaseItemIds` is a multiset -- buying two of something lists it twice.

Derived values are never stores: ability totals and modifiers, the proficiency bonus, every skill
modifier, armor class, hit points, the spell save DC, and the coin purse are all computed on render.
Money is held as integer copper (`src/character/currency.ts`)

`completedSteps` is not a completion flag. It can be **shorter than the step list on a finished character**
-- a non-caster never vists Spells, so a complete Fighter has seven entries and no "`spells`".

Server-owned and never sent: `ownerUid`, `createdAt`, `updatedAt`, `schemaVersion`.

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
  characters/   Rules engine -- ability maths, step validation, currency, storage
  components/   Shared UI; character/ holds the creation wizard
  data/         Content catalog, API adapter, local SRD rules
  lib/          Firebase init and the typed API client
  pages/        Home, Login, Dashboard, NotFound
  routes/       Route guards
  theme/        Light/dark theme hook
  test/         Vitest suites
```