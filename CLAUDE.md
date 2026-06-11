# DiningLens — Codebase Orientation

> This file is for AI assistants (Claude, Codex, etc.). It is loaded automatically
> by Claude Code on every session. Keep it accurate and concise.

---

## What this project is

DiningLens is an iOS macro-tracking app. The user photographs a meal → the image
is sent to an Express proxy server → Claude Haiku analyzes it → estimated calories
and macros are returned and stored locally on-device.

There is no user login. Each install gets an anonymous install ID stored in
AsyncStorage and sent as `X-DiningLens-Install-Id` on every API request.

---

## Repository layout

```
dininglens/
├── App.tsx                     Root navigator; runs storage migration on boot
├── app.json                    Expo config (bundle ID, permissions, plugins)
├── eas.json                    EAS Build profiles (dev / preview / production)
├── render.yaml                 Render deployment config for the Express backend
├── server/
│   ├── index.js                ALL Express routes live here — single-file backend
│   ├── middleware/
│   │   ├── identity.js         Reads X-DiningLens-Install-Id; sets req.actor
│   │   ├── requireActiveEntitlement.js  Blocks anonymous / expired requests
│   │   └── requireCoachQuota.js         Enforces daily /chat limit
│   └── services/
│       ├── aiProvider.js       All Anthropic API calls; prompt constants live here
│       └── entitlementService.js  In-memory trial/paid store (NOT persisted)
├── src/
│   ├── config/api.ts           API_BASE_URL — reads EXPO_PUBLIC_PROXY_URL
│   ├── context/MealContext.tsx Global state: today's meals, goals, profile, venue
│   ├── data/
│   │   ├── campuses.ts         CAMPUS_REGISTRY — supported dining halls + coords
│   │   └── chainMenus.ts       Static chain restaurant menus (McDonald's, etc.)
│   ├── hooks/
│   │   ├── useBackendHealth.ts Polls /health; shows banner when server is down
│   │   └── useEntitlement.ts   Fetches /entitlements/me; cached in component state
│   ├── navigation/MainTabNavigator.tsx  Bottom tab bar + "+" action sheet
│   ├── screens/                One file per screen (Camera, Estimate, Dashboard, …)
│   ├── services/
│   │   ├── apiClient.ts        apiFetch() — attaches install ID header
│   │   ├── billingService.ts   STUB — RevenueCat not yet integrated
│   │   ├── entitlementService.ts  fetchEntitlement() — calls /entitlements/me
│   │   ├── identityService.ts  getInstallId() — generates + caches UUID
│   │   ├── menuService.ts      fetchMenu() / fetchVenueMenu() — DineOnCampus + CS50
│   │   ├── restaurantService.ts  detectNearbyRestaurant() — Places + chain match + scrape
│   │   ├── venueService.ts     detectVenueFull() — GPS → dining hall or restaurant
│   │   ├── visionService.ts    analyzeImage() — calls /analyze
│   │   └── providers/
│   │       ├── types.ts        FoodProvider interface (not yet used in production)
│   │       └── NutritionixProvider.ts  Stub (API not yet licensed)
│   ├── storage/
│   │   ├── migrations.ts       Renames legacy AsyncStorage keys on first run
│   │   ├── schema.ts           TypeScript types for every stored value
│   │   ├── storageClient.ts    getJSON / setJSON / getEnvelope / setEnvelope helpers
│   │   └── storageKeys.ts      STORAGE_KEYS constants; toDateKey() helper
│   ├── types/
│   │   ├── nutrition.ts        Shared nutrition types (MacroItem, NutritionTotals, …)
│   │   └── storage.ts          StoredMeal, StoredCustomFood, StoredSavedMeal, …
│   └── utils/
│       ├── menuMatcher.ts      tokenSimilarity() + findBestMenuMatch() (Jaccard)
│       └── nutritionCalculator.ts  calculateBMR/TDEE/macros (Mifflin-St Jeor)
```

---

## Build and run commands

```bash
# Install dependencies
npm install

# Start Expo dev server (use phone or simulator)
npm start

# Start Express backend locally
npm run server

# TypeScript check (app) + Node syntax check (server)
npm run check

# Production-safe audit (no devDependencies)
npm run audit:prod
```

### Environment variables

Copy `.env.example` to `.env` and fill in:

```
EXPO_PUBLIC_PROXY_URL=http://<your-local-ip>:3001   # points app at local server
ANTHROPIC_API_KEY=...
USDA_API_KEY=...                                     # optional; falls back to DEMO_KEY
GOOGLE_PLACES_API_KEY=...                            # needed for /detect-restaurant
CORS_ORIGINS=                                        # leave blank to allow all origins in dev
```

`EXPO_PUBLIC_*` variables are bundled into the app at EAS build time.
**Never put secrets in `EXPO_PUBLIC_*` variables.**

For EAS builds, all three environments in `eas.json` hardcode
`EXPO_PUBLIC_PROXY_URL=https://dininglens-api.onrender.com`.

---

## Key rules — do NOT do these

- **Never run `npm audit fix --force`** — it upgrades packages without review and
  has broken Expo compatibility before. Use `npm run audit:prod` to check; fix
  vulnerabilities by hand.
- **Never commit `.env`** — it contains `ANTHROPIC_API_KEY`. The file is in
  `.gitignore`; keep it there.
- **Never change the Expo SDK version** (`"expo": "^54.0.0"` in package.json)
  without a deliberate upgrade plan. Expo SDK upgrades require matching peer
  dependency bumps across `expo-camera`, `expo-image-picker`, `expo-location`,
  `react-native`, and `react`. A mismatched SDK causes silent runtime failures
  on device. Pin changes to a dedicated branch and test on real hardware.
- **Never set `SCRAPE_MENU_ENABLED=false` in render.yaml** without first
  checking whether restaurant detection falls back gracefully — the CameraScreen
  depends on scrape results for mom-and-pop venues.
- **Never write business logic in `CLAUDE.md`** — this file is orientation only.

---

## Coding conventions

### Server (`server/`)
- Plain JavaScript (CommonJS, `require`/`module.exports`).
- All routes live in `server/index.js` — do not split into separate route files
  without explicit direction to refactor.
- Every route must call `validate()` with a Zod schema before using `req.body`.
- All external HTTP calls must use `AbortSignal.timeout(N)`.
- Use `logDebug()` for verbose output (suppressed in production); use
  `console.log()` for request traces that are always visible.

### Mobile app (`src/`)
- TypeScript with `strict: true` (extends `expo/tsconfig.base`).
- All AsyncStorage access goes through `src/storage/storageClient.ts`
  (`getJSON` / `setJSON` / `getEnvelope` / `setEnvelope`). Do not call
  `AsyncStorage` directly outside of `storageClient.ts`.
- All API calls go through `apiFetch()` in `src/services/apiClient.ts` so the
  install ID header is always attached.
- Dark theme: background `#0F0F0F`, surface `#1A1A1A`, border `#2A2A2A`,
  accent `#00E5A0`, destructive `#FF4444`.
- Screen files are self-contained — inline `StyleSheet.create` at the bottom.
  Do not share style objects between screens.

### General
- No `any` casts in new code unless working around a third-party library type gap.
- No comments that restate what the code does. Only add a comment when the
  *why* is non-obvious (e.g. the quota is pre-decremented to prevent retry abuse
  — that warrants a comment).

---

## Testing

There is no automated test suite yet. Verification is manual:

1. Run `npm run check` — fails on TypeScript errors or Node syntax errors.
2. Start the server locally and run `curl` against each route you changed.
3. Run the app in Expo Go or a simulator and exercise the affected screen.

---

## Notes for AI assistants

- The server is CommonJS JavaScript. The app is TypeScript. Do not mix module
  systems.
- `entitlementService.js` uses an in-memory `Map` — nothing is persisted.
  A server restart resets all trial timers. This is intentional for the
  prototype phase and is documented in KNOWN_ISSUES.md.
- `billingService.ts` is a stub — all methods throw or return empty data.
  Do not implement billing flows in it without the RevenueCat SDK installed.
- When reading Expo docs, use version v54 (the pinned SDK):
  https://docs.expo.dev/versions/v54.0.0/
