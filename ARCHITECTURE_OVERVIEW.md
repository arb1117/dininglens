# Architecture Overview

How DiningLens fits together: data flows, component responsibilities,
and planned additions.

---

## System diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      iOS Device (Expo / RN)                     │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │Dashboard │  │Camera    │  │AIChatScrn│  │Profile/Goals  │  │
│  │Screen    │  │Screen    │  │          │  │Screen         │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬────────┘  │
│       │              │              │                │           │
│       └──────────────┴──────────────┴────────────────┘           │
│                              │                                   │
│                     ┌────────▼─────────┐                        │
│                     │  MealContext.tsx  │  (global state)        │
│                     └────────┬─────────┘                        │
│                              │                                   │
│  ┌───────────────────────────▼────────────────────────────────┐ │
│  │                     src/services/                          │ │
│  │  apiClient.ts  ← attaches X-DiningLens-Install-Id header   │ │
│  │  identityService.ts  ← getInstallId() from AsyncStorage    │ │
│  │  visionService.ts    ← POST /analyze                       │ │
│  │  menuService.ts      ← DineOnCampus / CS50 APIs direct     │ │
│  │  venueService.ts     ← GPS → dining hall / restaurant      │ │
│  │  restaurantService.ts← POST /detect-restaurant + scrape    │ │
│  │  entitlementService.ts← GET /entitlements/me               │ │
│  │  billingService.ts   ← STUB (RevenueCat not yet wired)     │ │
│  └───────────┬────────────────────────────────────────────────┘ │
│              │                                                   │
│  ┌───────────▼──────────────────────────────────────────────┐   │
│  │               src/storage/ (AsyncStorage)                │   │
│  │  MEAL_LOG, GOALS, PROFILE, WATER, EXERCISE,              │   │
│  │  CUSTOM_FOODS, SAVED_MEALS, WEIGHT_LOG,                  │   │
│  │  CORRECTION_MEMORY, VENUE_MEMORY                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / JSON
                           │ X-DiningLens-Install-Id: <uuid>
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                Express Backend (Render Starter)                  │
│               https://dininglens-api.onrender.com               │
│                                                                  │
│  server/index.js  (all routes, ~820 lines)                      │
│                                                                  │
│  Middleware stack (applied in order):                           │
│    req.requestId ← random ID attached to every request          │
│    identity.js   ← sets req.actor from X-DiningLens-Install-Id  │
│    globalLimiter ← 300 req / 15 min per IP                      │
│    helmet        ← security headers                             │
│    cors          ← CORS_ORIGINS env var                         │
│                                                                  │
│  Protected routes also run:                                     │
│    requireActiveEntitlement ← blocks anon / expired actors      │
│    requireCoachQuota (POST /chat only)                          │
│                                                                  │
│  Routes:                                                        │
│    POST /analyze          → aiProvider.analyzeMealImage()       │
│    POST /reanalyze        → aiProvider.reanalyzeMeal()          │
│    POST /lookup-nutrition → USDA FoodData Central               │
│    POST /lookup           → OFF → USDA → Claude AI fallback     │
│    GET  /search           → Common → OFF → USDA → Claude AI     │
│    POST /detect-restaurant→ Google Places Nearby + Details      │
│    POST /scrape-menu      → fetch + Claude parse (feature-flag) │
│    GET  /barcode          → Open Food Facts v0                  │
│    POST /estimate-exercise→ aiProvider.estimateExercise()       │
│    POST /chat             → aiProvider.chatCoach()              │
│    POST /calculate-tdee   → Mifflin-St Jeor + Claude multiplier │
│    POST /interpret-quantity→ aiProvider.interpretQuantity()     │
│    GET  /entitlements/me  → entitlementService.getOrCreate()    │
│    GET  /health           → {"status":"ok"}                     │
│                                                                  │
│  server/services/entitlementService.js                          │
│    In-memory Map<install_id, EntitlementRecord>                  │
│    Records: status, trialStartedAt, trialEndsAt, paid,          │
│             coachUsageDate/Count, scrapeUsageDate/Count          │
│    ⚠️ RESETS on every server restart (prototype only)           │
│                                                                  │
│  server/services/aiProvider.js                                  │
│    All Anthropic SDK calls. Model: claude-haiku-4-5-20251001    │
│    25 s timeout, 1 retry on transient errors.                   │
│    Validates/clamps all AI output before returning.             │
└──────────┬────────────────────────────────────┬─────────────────┘
           │                                    │
           ▼                                    ▼
┌──────────────────┐              ┌─────────────────────────────┐
│   Anthropic API  │              │  External data sources      │
│  (Claude Haiku)  │              │                             │
│                  │              │  USDA FoodData Central      │
│  /analyze        │              │  (api.nal.usda.gov)         │
│  /reanalyze      │              │                             │
│  /lookup (fb)    │              │  Open Food Facts            │
│  /search (fb)    │              │  (world.openfoodfacts.org)  │
│  /scrape-menu    │              │                             │
│  /chat           │              │  Google Places API          │
│  /calculate-tdee │              │  (maps.googleapis.com)      │
│  /estimate-exer  │              │                             │
│  /interpret-qty  │              │  DineOnCampus API           │
└──────────────────┘              │  (apiv4.dineoncampus.com)   │
                                  │                             │
                                  │  CS50 Dining API            │
                                  │  (api.cs50.io/dining)       │
                                  └─────────────────────────────┘
```

---

## Mobile app structure

### Navigation

```
App.tsx  (RootStackNavigator)
├── PermissionsScreen    (first run only — camera, location, photo library)
├── OnboardingScreen     (goal selection)
├── GoalsScreen          (height, weight, age, activity → calculates targets)
├── MainTabs             (bottom tab bar)
│   ├── Dashboard        (calorie ring, macro bars, meal log, water, exercise)
│   ├── Add (+ button)   (action sheet → Camera / Upload / Search / AI Coach)
│   ├── AICoach          (chat interface with nutrition context)
│   └── Profile          (goals, profile edit, entitlement status)
├── CameraScreen         (photo capture + barcode scan + venue detection)
├── EstimateScreen       (review AI results, adjust portions, log meal)
├── HistoryScreen        (past meals by date)
├── SearchScreen         (text search + manual add)
└── DebugScreen          (dev-only: reset install ID, clear storage)
```

### Global state (MealContext)

`MealContext.tsx` holds the state shared between screens:

- `mealLog` — today's logged meals (array of `LoggedMeal`)
- `goals` — calorie and macro targets (`UserGoals`)
- `profile` — user profile (`UserProfile`)
- `menuItems` — currently loaded venue menu items
- `periodLabel` — current meal period label ("Breakfast", etc.)
- `venue` — currently detected venue (`Venue | null`)
- `waterLog` — today's water intake
- `exerciseLog` — today's exercise entries

All mutations call the `storageClient` helpers so state is persisted immediately.

### Storage layer

```
src/storage/
├── storageKeys.ts   STORAGE_KEYS constants (all prefixed @dininglens/)
├── schema.ts        TypeScript types for every stored shape
├── storageClient.ts getJSON/setJSON/getEnvelope/setEnvelope
└── migrations.ts    Renames legacy keys on schema version bump
```

All AsyncStorage access is funneled through `storageClient.ts`. Do not call
`AsyncStorage` directly outside this module.

---

## Entitlement flow

```
App cold start
    │
    ▼
identityService.getInstallId()
    │  reads/creates UUID in AsyncStorage
    ▼
apiFetch() attaches X-DiningLens-Install-Id on every request
    │
    ▼
server: identity.js middleware
    │  sets req.actor = { type: 'install', id: <uuid> }
    ▼
server: requireActiveEntitlement middleware
    │  calls entitlementService.canUseApp(req.actor.id)
    │  → if actor is anonymous: 401
    │  → if trial expired: 403
    │  → if trial active or paid: next()
    ▼
route handler executes
```

**Trial lifecycle:**
1. First request with a new install ID → `freshRecord()` creates a 14-day trial.
2. Each day, coach and scrape usage counters reset at midnight (server local time).
3. After 14 days, `getComputedStatus()` returns `'expired'`; all routes
   except `/health` and `/entitlements/me` return 403.
4. Setting `rec.paid = true` (manual DB update for now; RevenueCat webhook when
   billing is live) moves status to `'active'` indefinitely.

**Daily coach limits:**
- Trial: 3 messages/day (`TRIAL_COACH_DAILY_LIMIT`)
- Paid: 20 messages/day (`PAID_COACH_DAILY_LIMIT`)

`requireCoachQuota` pre-decrements before the AI call. A transient AI error
still consumes the quota slot (prevents retry abuse).

**Daily scrape limits:**
- Trial: 5 scrapes/day (`TRIAL_SCRAPE_DAILY_LIMIT`)
- Paid: 30 scrapes/day (`PAID_SCRAPE_DAILY_LIMIT`)

The scrape quota is checked before the HTTP fetch so cached results don't cost
quota (cache hit short-circuits before quota check).

---

## Meal analysis flow (camera)

```
CameraScreen
    │  user takes photo or picks from library
    │  image compressed to JPEG base64
    │
    ├── [if dining hall detected]
    │   menuService.fetchVenueMenu() → DineOnCampus or CS50 API
    │   menuItems passed to visionService.analyzeImage()
    │
    └── [if restaurant detected]
        restaurantService.detectNearbyRestaurant()
            ├── /detect-restaurant → Google Places (name, placeId, website)
            ├── findChainMatch() → CHAIN_MENUS static lookup
            └── /scrape-menu → fetch HTML + Claude parse (mom-and-pop)
        menuItems passed to visionService.analyzeImage()

visionService.analyzeImage() → POST /analyze
    │  server: aiProvider.analyzeMealImage(imageBase64, menuItems)
    │  Claude Haiku (vision): identifies food + estimates portion + macros
    │  validateAnalysisResult(): clamps/sanitizes output
    ▼
EstimateScreen receives AnalysisResult { detectedItems, mode }
    │
    ├── [if mode='dining_hall'] client runs applyMenuMatches()
    │   menuMatcher.findBestMenuMatch() (Jaccard similarity, threshold 0.55)
    │   Replaces AI macro estimates with official dining hall data
    │
    └── [if mode='generic'] AI-estimated macros used as-is
    │
    user reviews, adjusts portions, taps "Log Meal"
    │
    MealContext.addMeal() → storageClient.setJSON(MEAL_LOG)
    Dashboard re-renders with updated totals
```

---

## Food search/lookup flow

```
SearchScreen: user types query
    │
    ▼
GET /search?q=<query>
    │
    ├── 1. Common foods list (in-memory, ~1 item today)
    ├── 2. Open Food Facts v2 search (branded/packaged)
    ├── 3. USDA FoodData Central (generic/ingredient foods)
    │   (parallel — combined, deduped by name, top 8 returned)
    │
    └── 4. Claude AI fallback (only if 1+2+3 return nothing)
    ▼
SearchScreen: user selects item, adjusts quantity, taps Add
    │
    MealContext.addMeal()
```

---

## Data sources by feature

| Feature                | Primary source          | Fallback              |
|------------------------|-------------------------|-----------------------|
| Meal photo analysis    | Claude Haiku (vision)   | —                     |
| Dining hall menu       | DineOnCampus API        | FAKE_MENU (static)    |
| Harvard dining menu    | CS50 Dining API         | FAKE_MENU (static)    |
| Restaurant detection   | Google Places API       | —                     |
| Chain restaurant menu  | CHAIN_MENUS (static)    | —                     |
| Mom-and-pop menu       | HTML scrape + Claude    | — (returns null)      |
| Food search            | Open Food Facts + USDA  | Claude AI             |
| Barcode lookup         | Open Food Facts v0      | —                     |
| Nutrition lookup       | Open Food Facts → USDA  | Claude AI             |
| Exercise calories      | Claude AI               | MET rough estimate    |
| TDEE calculation       | nutritionCalculator.ts  | (deprecated /calculate-tdee route) |
| Chat coach             | Claude Haiku            | —                     |

---

## Planned additions

### Supabase (auth + persistence)

```
Mobile app
    ├── Supabase Auth (magic link / Apple Sign-In)
    │   → JWT token attached to API requests instead of anonymous install ID
    └── Supabase client for meal log sync
        → meal writes go to both AsyncStorage (offline) and Supabase (cloud)

Backend
    ├── JWT middleware (replaces install ID middleware)
    └── entitlements table in Supabase PostgreSQL (replaces in-memory Map)
```

### RevenueCat (billing)

```
Mobile app
    └── react-native-purchases SDK
        ├── purchasePackage() → StoreKit / Google Play Billing
        ├── restorePurchases() → sync after reinstall
        └── getCustomerInfo() → check active subscription

Backend
    └── POST /webhooks/revenuecat
        ├── verify X-RevenueCat-Signature HMAC
        └── update entitlements table on purchase/renewal/cancellation
```

### Nutrislice / additional campus dining

`src/services/providers/NutritionixProvider.ts` is a stub implementing the
`FoodProvider` interface from `src/services/providers/types.ts`. When the
Nutritionix API key is obtained, the stub can be wired into the `/search` and
`/lookup` routes as an additional high-quality source for restaurant nutrition.

Additional dining halls can be added to `src/data/campuses.ts` by adding entries
to `CAMPUS_REGISTRY` with the correct DineOnCampus `locationId` and GPS coordinates.
No other code changes are required.

### DineOnCampus expansion

To add a new campus:
1. Find the location IDs via the DineOnCampus web interface or API.
2. Add a `CampusDefinition` entry to `CAMPUS_REGISTRY` in `src/data/campuses.ts`
   with accurate GPS coordinates and a `detectionRadiusKm` appropriate to the
   campus size.
3. The venue will be auto-detected when a user is within the radius.

---

## Technology choices

| Component         | Technology                           | Version (pinned)           |
|-------------------|--------------------------------------|----------------------------|
| Mobile framework  | Expo / React Native                  | SDK 54 / RN 0.81.5         |
| Navigation        | React Navigation (native stack + tabs)| ^7.x                      |
| Local storage     | AsyncStorage                         | 2.2.0                      |
| AI model          | Claude Haiku (Anthropic SDK)         | claude-haiku-4-5-20251001  |
| Anthropic SDK     | @anthropic-ai/sdk                    | ^0.101.0                   |
| Backend framework | Express                              | ^5.2.1 (Express 5)         |
| Input validation  | Zod                                  | ^4.4.3                     |
| Security headers  | Helmet                               | ^8.2.0                     |
| Rate limiting     | express-rate-limit                   | ^8.5.2                     |
| Deployment        | Render (Node, Starter plan)          | —                          |
| Build system      | EAS Build (Expo Application Services)| CLI >= 14.0.0              |
| TypeScript        | 5.9 (strict mode)                    | ~5.9.2                     |
