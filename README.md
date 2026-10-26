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

Fill in all seven values. `.env.local` is gitignored; `.env.example` provides the naming convention.

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
  2. Homepage URL: `http://localhost:5173`
  3. Authorization callback URL: Paste the `https://<project>.firebaseapp.com/__/auth/handler` URL that the Firebase GitHub panel shows -- it must match exactly
  4. Copy the client ID and secret into the Firebase panel

The GitHub client secret stays in the Firebase console. It is never an env var and never reaches the bundle.

Before deploying anywhere other than localhost, add that host under 
**Authentication > Settings > Authorized domains**, or sign-in fails with `auth/unauthorized-domain`.

### 4. Backend CORS
The content service must send `access-control-allow-origin` for the dev server's origin, 
or the browser discards every response -- requests succeed server-side and fail in the app. In `forge-backend`:

```py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
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

> **Status:** implemented on both sides. `POST`, `PUT` and `DELETE /characters` all exist, the
> service verifies the Firebase ID token on every character request, and records are namespaced per
> user -- a character you do not own returns `404` rather than `403`, so its existence is not
> disclosed. The payload below was reconciled field by field against the live `/openapi.json`.

### Endpoints

| Method | Path | Used by |
|--------|------|---------|
| `GET`  | `/characters` | Dashboard, on load |
| `POST` | `/characters` | First save of a new character -- the Name step |
| `PUT`  | `/characters/{id}` | Every later step, full replace |
| `DELETE` | `/characters/{id}` | The delete button on a character card |

### Lifecycle

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
  "fightingStyleId": null,
  "toolChoiceId": null,
  "backgroundId": "srd-2024_sage",
  "abilities": {
    "method": "standard",
    "base": { "STR": 10, "DEX": 12, "CON": 14, "INT": 15, "WIS": 13, "CHA": 8 },
    "rolled": [],
    "originBonuses": { "INT": 2, "CON": 1 }
  },
  "proficientSkillIds": ["arcana", "history"],
  "expertiseIds": [],
  "spellIds": ["srd-2024_fire-bolt", "srd-2024_shield"],
  "equipmentChoice": {
    "class": {
      "key": "A",
      "label": "Quarterstaff, Calligrapher's Supplies, and 5 GP",
      "goldCp": 500,
      "grants": [
        { "text": "Quarterstaff", "quantity": 1, "itemId": "srd-2024_quarterstaff", "choosableFrom": null }
      ]
    },
    "background": null
  },
  "walletCp": 400,
  "purchasedItemIds": ["srd-2024_rope", "srd-2024_rope"],
  "completedSteps": ["name", "race", "class", "background", "equipment", "attributes", "skills", "spells"]
}

```

`proficientSkillIds` holds **class picks only** -- background-granted are derived from `backgroundId`,
so a class change can prune picks without destroying grants.

`expertiseIds` records which proficiencies the player chose to double, and expertise can double
background-granted skills -- so an id may appear there while absent from `proficientSkillIds`. Only
Rogue qualifies at level 1; the level comes from the class data's `Expertise` feature rather than a
local table. Expertise doubles the **proficiency bonus**, not the whole modifier.

`equipmentChoice` stores the **resolved** option taken from each source, not just its letter: the
label, the coin grant and every item it confers. A letter alone cannot be turned back into an
inventory, which is why the shape changed. Records written before that change are detected on load
and the Equipment step is re-asked.

`walletCp` is the one derived-looking value that is genuinely stored. It starts as the granted gold
and moves with every purchase and sale, so it cannot be recomputed from the choices alone.

`fightingStyleId` is set only by classes whose Fighting Style lands at level 1; `toolChoiceId` only
by backgrounds offering a tool *category* ("choose one kind of Gaming Set") rather than a fixed tool.

`purchasedItemIds` is a multiset -- buying two of something lists it twice.

Everything else derived is never stored: ability totals and modifiers, the proficiency bonus, every
skill modifier, armor class, hit points and the spell save DC are all computed on render, so a score
change cannot leave a stale modifier behind. Money is integer copper throughout
(`src/characters/currency.ts`) -- in floating point `0.07 * 100` is not `7`.

`completedSteps` is not a completion flag. It can be **shorter than the step list on a finished character**
-- a non-caster never visits Spells, so a complete Fighter has seven entries and no "`spells`".

Server-owned and never sent: `ownerUid`, `createdAt`, `updatedAt`, `schemaVersion`.

## Scripts
| Command | Does |
|-----|-----|
| `npm run dev` | Dev server on `localhost:5173` |
| `npm run build` | Typecheck then production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest in watch mode |
| `npm run test:run` | Single test pass |

CI runs four gates on every push and on pull requests to `main`: `npx tsc -b`, `npm run lint`,
`npx vitest run`, `npm run build`.

> **`tsc --noEmit` checks nothing here.** The root `tsconfig.json` is solution-style, so it only
> points at the project references. Use **`npx tsc -b`** -- that is what CI runs and the only
> invocation that type-checks the source.

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