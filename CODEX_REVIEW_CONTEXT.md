# DiningLens — Review Context for Codex

Written 2026-11-27 by Claude (Opus 5.5) for an independent review of the work
done in November 2026. It is self-contained: project background, rules, every
change with its reasoning, what was verified, and where the risks are. Please
review critically. The author's own doubts are listed in §7.

---

## 1. How to review

### PR map (all open, none merged)

| PR | Branch | Base | Content |
|---|---|---|---|
| [#1](https://github.com/arb1117/dininglens/pull/1) | `fix/beta-critical-bugs` | `main` | Critical/high bug fixes + search calorie fix |
| [#2](https://github.com/arb1117/dininglens/pull/2) | `fix/beta-medium-bugs` | #1 | Medium bug fixes |
| [#3](https://github.com/arb1117/dininglens/pull/3) | `chore/dev-tooling` | #1 | Jest, ESLint, CI |
| [#4](https://github.com/arb1117/dininglens/pull/4) | `chore/mvp-readiness` | #2 | App Store prep, beta access switch, privacy page |
| [#5](https://github.com/arb1117/dininglens/pull/5) | `feat/nutrition-label-scan` | #2 | Nutrition-label scan mode |
| #6 | `chore/post-merge-hardening` | `main` | Merges #3–#5, then tests, lint cleanup, gallery label scan, keep-alive, docs (this file) |

Merge order: #1 → #2, #3 → #4, #5 → #6. PR #6 contains merge commits of #3–#5;
after those land, its diff shrinks to its own commits.

**Fastest full review:** check out `chore/post-merge-hardening`; it contains
everything. `git log --no-merges origin/main..HEAD` lists the 10 commits
(§4). Ignore `package-lock.json` churn (dev dependencies from #3).

### Commands

```powershell
npm install
npm run check      # tsc --noEmit + node --check server/index.js
npm run lint       # expected: 0 problems
npm test           # expected: 6 suites, 58 tests
npm run server     # needs .env with ANTHROPIC_API_KEY (any value works for non-AI routes)
```

Branch note: GitHub's default branch is `main`. It used to be 9 commits behind
`master`; `main` was fast-forwarded to `master` on 2026-11-27 and PR #1 was
retargeted to `main`. `master` is now stale and can be deleted after #1 merges.
A separate local branch `chore/upgrade-expo-sdk-57` (uncommitted SDK 57 work in
the main checkout) is **not** part of this review and was not touched.

---

## 2. Project overview

DiningLens is an iOS-first (Expo / React Native) macro tracker for college
students. The user photographs a meal; the app sends it to an Express proxy;
the proxy asks Claude Haiku for items and macros; results are reviewed on an
Estimate screen and logged locally.

- **No accounts.** Each install creates a random UUID (`identityService.ts`),
  sent as `X-DiningLens-Install-Id` on every request via `apiFetch()`.
- **All user data is on-device** (AsyncStorage through `storageClient.ts`).
  The server keeps only in-memory entitlement/usage records.
- **Stack:** Expo SDK 54 (pinned), React Native 0.81, React Navigation v7,
  TypeScript strict. Server: Node, Express 5, CommonJS, Zod, express-rate-limit,
  `@anthropic-ai/sdk`. Model: `claude-haiku-4-5-20251001` (`aiProvider.js`).
- **Hosting:** Render (`render.yaml`). EAS builds point at
  `https://dininglens-api.onrender.com`, which **does not exist yet** (KI-020).

### Main flows

1. **Photo → Estimate → Log.** `CameraScreen` → `prepareImageForUpload`
   (resize to 1568 px JPEG) → `POST /analyze` → `EstimateScreen`
   (`buildInitialItems`) → `MealContext.addMeal`.
2. **Dining-hall mode.** GPS → `venueService.detectVenueFull` → campus registry
   or Google Places restaurant → `menuService.fetchVenueMenu` (DineOnCampus or
   CS50 API) → menu sent with the photo; AI returns servings of menu items,
   matched with `menuMatcher.findBestMenuMatch` (Jaccard).
3. **Barcode.** `GET /barcode` → Open Food Facts v0 product API.
4. **Search.** `GET /search` merges USDA FoodData Central + Open Food Facts +
   AI fallback; serving math in `src/utils/servingUnits.ts`.
5. **Label scan (new).** Camera 🏷 mode → `POST /read-label` → single exact item.
6. **Coach.** `POST /chat` with a day summary; daily quota enforced by
   `requireCoachQuota` (pre-decremented, KI-011).

### Server routes (`server/index.js`; every route validates with Zod)

`/analyze`, `/reanalyze`, `/read-label` (new), `/lookup-nutrition`, `/lookup`,
`/search`, `/detect-restaurant`, `/scrape-menu`, `/barcode`,
`/estimate-exercise`, `/chat`, `/calculate-tdee` (deprecated, KI-013),
`/interpret-quantity`, `/entitlements/me`, `/health`.
Middleware: `identity.js` (sets `req.actor`), `requireActiveEntitlement.js`,
`requireCoachQuota.js`. External calls use `AbortSignal.timeout`.

### On-device storage keys (`src/storage/storageKeys.ts`)

`MEAL_LOG`, `GOALS`, `PROFILE` (includes `useKg`, `useMetric`), `LAST_LOGGED`,
`WATER/<date>`, `EXERCISE/<date>`, `CUSTOM_FOODS`, `SAVED_MEALS`, `WEIGHT_LOG`
(always stored in lbs), `CORRECTION_MEMORY`, `VENUE_MEMORY`,
`SCHEMA_VERSION`. Reads are sanitized by `storageValidation.ts`.

Longer background: `ARCHITECTURE_OVERVIEW.md`, `KNOWN_ISSUES.md`,
`DEPLOYMENT_PREVIEW.md`, `BETA_TEST_PLAN.md`, `RELEASE_CHECKLIST.md`.

---

## 3. Rules the work had to follow

From the owner and `CLAUDE.md`. Flag any violation you find.

- Never `npm audit fix --force`; never change the Expo SDK version.
- Never commit `.env`. No secrets in `EXPO_PUBLIC_*`.
- Never set `SCRAPE_MENU_ENABLED=false` without checking fallbacks.
- No business logic in `CLAUDE.md`.
- No billing flows in `billingService.ts` (RevenueCat not installed).
- No direct `AsyncStorage` outside `storageClient.ts`; all API calls via `apiFetch()`.
- Server: CommonJS, all routes in `server/index.js`, Zod `validate()` on every
  body, `AbortSignal.timeout` on external HTTP, `logDebug()` for verbose logs.
- App: strict TS, no new `any`, screen-local `StyleSheet.create`, dark theme
  colors (`#0F0F0F`, `#1A1A1A`, `#2A2A2A`, accent `#00E5A0`, red `#FF4444`).
- Comments only where the *why* is non-obvious.
- `entitlementService.js` in-memory `Map` is intentional for the prototype.

---

## 4. Changes, commit by commit

### 4.1 `46e0fac` fix(beta): critical/high tester-blocking bugs — PR #1

| ID | Problem | Fix | Where |
|---|---|---|---|
| C1 | Menu items scaled by grams/100, but menu nutrition is per serving (215 g Big Mac → 2.15×) | Scale by AI-reported `servings` | `EstimateScreen` (`menuServingScale`), `menuMatcher.ts` |
| C2/H8 | Log/back used `navigate`, stacking navigators; camera kept scanning when unfocused | `popTo`/`reset`; camera and barcode pause when unfocused; Add-to-Meal returns to the same Estimate | `CameraScreen`, `EstimateScreen`, `GoalsScreen`, `SearchScreen`, `App.tsx` |
| C3 | Analysis failure showed placeholder foods | Empty list plus the real reason; "Enter nutrition manually" opens custom entry | `EstimateScreen`, `visionService` |
| C4 | Correction memory stored portion-scaled macros and applied to menu/barcode items | Store name mappings only; skip menu/barcode; batch write; stop recording every logged item | `correctionMemoryService.ts` |
| H1 | IP-only rate limits | Per-install keys; separate search bucket; global IP backstop; `/health` exempt | `server/index.js` |
| H2 | USDA per-100 g values shown as per serving | Scale to labeled serving | `searchUSDA` |
| H4 | Full-resolution photos uploaded | Resize to 1568 px JPEG (`expo-image-manipulator` SDK 54); server 413 above 5 MB | `src/utils/imagePrep.ts`, server |
| H5/H9 | Menu failures returned fake data; brunch/late-night periods missed | `fetchVenueMenu` returns `null` → "menu unavailable"; period matching; dedupe; cap 200 | `menuService.ts` |
| H6 | UTC date for menus | Local `toDateKey` | `menuService.ts` |
| H7 | Venue/menu leaked between camera sessions | Cleared per session; menu badge only when an item matched | `CameraScreen`, `MealContext` |
| H12 | Restaurant distance wrong; async detection overrode manual pick | Distance from Places geometry; manual choice wins | `restaurantService.ts`, `venueService.ts` |

Plus: Log Meal double-tap guard; specific 403/429/413/timeout messages; 45 s
client timeout; AI calls actually aborted on timeout and not retried (avoids
double billing); stale search responses ignored; midnight rollover via
`todayKey`; meals logged before hydration merged, not overwritten; scrape cache
key includes the website; rate limiting before body parsing; protein target
capped (240 lb reference, 40% of calories); Settings deep-link after permanent
camera denial; `/lookup-nutrition` 404 on no results; prompt-injection guard;
`/calculate-tdee` no longer calls the AI.

### 4.2 `cb00816` fix(search): kJ-as-calorie values and irrelevant OFF results — PR #1

- USDA lists Energy in kJ and kcal; the first match was often kJ (dried banana
  1450 "cal" instead of 346). `energyKcal()` prefers the KCAL entry, converts
  kJ, and treats a value more than 2× the Atwater estimate (4P + 4C + 9F) that
  is within 35% of Atwater after ÷4.184 as mislabeled kJ.
- Open Food Facts v2 `/search` ignores `search_terms` ("banana" returned
  Coca-Cola). Switched to `cgi/search.pl` full-text search, US-filtered, and
  dropped products whose name or brand shares no query word (trailing "s"
  stripped).

### 4.3 `be70872` chore(dev): Jest, ESLint, CI — PR #3

Jest projects (app: `jest-expo`; server: node + supertest). `server/index.js`
exports `app` and only calls `listen()` when `require.main === module`. ESLint
via `eslint-config-expo`, with `react/no-unescaped-entities` off (it targets
HTML). CI runs `npm ci`, check, lint and test on PRs and pushes to main/master.

### 4.4 `6bb0627` fix(beta): medium-priority bugs — PR #2

- **History undo:** removing an item snapshots the meal and shows a 5 s UNDO
  bar. `MealContext.restoreMeal(meal)` replaces or reinserts by id and re-sorts
  the log by timestamp, descending.
- **Zero goals:** blank → default, explicit `0` kept; calorie goal ≤ 0 refused
  (`parseGoalInput`, now in `nutritionCalculator.ts`).
- **Custom food duplicates:** `saveCustomFood` matches normalized name and brand.
  On a match it updates macros, increments `useCount` and moves the entry to
  the front.
- **kg weight:** Profile weight modal has a lbs/kg switch, persisted as
  `PROFILE.useKg`. Entries are still stored in lbs (×2.20462).
- **Volume units:** cup/tbsp/tsp only when the serving lists a volume
  (`ml`, `fl oz`, or household "1 cup (30g)"); conversions use that volume,
  not 240 g/cup.
- **Barcode errors:** server returns 422 `no_nutrition` (with name), 502
  upstream down, 504 timeout, and converts kJ-only `energy_100g`. The client
  shows distinct messages and treats `TypeError` as no connection.
- **Micronutrients card:** copy now says it isn't in this beta.

### 4.5 `c26b130` chore(release): MVP readiness — PR #4

- `app.json`: name `DiningLens`, `supportsTablet: false`,
  `userInterfaceStyle: dark`, `ITSAppUsesNonExemptEncryption: false`.
- `BETA_OPEN_ACCESS` env (set `"true"` in `render.yaml`): `getComputedStatus`
  returns `beta`, so `canUseApp` is true regardless of trial age. Daily coach and
  scrape limits still apply. Client `EntitlementStatus` gains `'beta'`; Profile
  shows "Beta — free while testing". Rationale: the in-memory trial store
  resets on every Render restart (KI-001), so enforcing trials in a free beta
  does more harm than good.
- `DEPLOYMENT_PREVIEW.md` "Status" section: backend not deployed, Render steps.
  Production-mode `npm ci --omit=dev` + boot was verified locally.
- `docs/privacy.html`: privacy policy draft (date/contact placeholders), built
  from what the code sends where.

### 4.6 `19781a2` feat(camera): nutrition-label scan — PR #5

- **Why:** Texas A&M's menus come from DineOnCampus, which now blocks
  non-browser clients with Cloudflare. The owner asked about bypassing it; the
  author declined (bot-detection evasion) and the owner emailed Aggie Dining
  for permission. Dining halls post nutrition cards at stations, so reading
  those gives exact numbers without scraping.
- **Server:** `aiProvider.readNutritionLabel(imageBase64)`, a prompt that forbids
  estimating. It returns `{found:false, reason:'no_label'}` unless calories are
  legible, and clamps values. `POST /read-label` (aiLimiter, entitlement,
  16 MB body, Zod, 413 guard) returns the `/analyze` shape with one item,
  `confidence: 1`.
- **App:** `ScanMode` gains `'label'`; 🏷 toggle at `top: 172`; hint overlay;
  the shutter calls `readNutritionLabel`; navigates with `source: 'label'` and no
  `imageBase64` (so no reanalyze or AI disclaimer). `EstimateScreen` adds the
  `'label'` item source, a badge and status line, a `no_label` banner with Retake,
  and skips menu matching for label results.

### 4.7 `4f26c36` test: serving units, goals, custom foods, routes — PR #6

Extracted `src/utils/servingUnits.ts` (from SearchScreen, now accepts any case
of "ml") and `parseGoalInput`. Added `servingUnits.test.ts` (25),
`nutritionCalculator.test.ts`, `customFoodService.test.ts` (AsyncStorage jest
mock), and `server/routes.test.js` (`/read-label` with mocked `aiProvider`;
`/barcode` with mocked `fetch`; `BETA_OPEN_ACCESS` via `jest.isolateModules`).

### 4.8 `003b004` chore(lint): clear all warnings — PR #6

Unused imports and variables removed (`periodLabel`, `periodLocked`,
`profileComplete`, `FlatList`, `ActivityIndicator`, `API_BASE_URL`,
`BottomTabBarButtonProps`), duplicate imports merged, `T[]` array types, Jest
globals for test files, `catch {}` for an unused error. Two
`eslint-disable-next-line` comments: the intentional `todayKey` memo dependency
and the `require()` "lazy" screen imports in `MainTabNavigator`.

### 4.9 `dfa880c` gallery label scan + keep-alive — PR #6

In label mode the 🖼 gallery button stays visible and picked photos go to
`/read-label`. `.github/workflows/keep-alive.yml` pings `vars.HEALTH_URL`
every 10 minutes when set (only useful on Render's free plan); a no-op otherwise.

### 4.10 `75e009c` docs — PR #6 (plus this file, `AGENTS.md`, `CLAUDE.md` testing section)

`KNOWN_ISSUES.md` (KI-001 mitigation, KI-009 status, KI-012 note, new
KI-019 to KI-022), `BETA_TEST_PLAN.md` §14 scripts, `APP_STORE_LISTING.md`.
`AGENTS.md` previously told agents to read Expo **v56** docs; corrected to v54.

---

## 5. Verification performed

| Area | How | Result |
|---|---|---|
| Types / lint / tests | `npm run check`, `npm run lint`, `npm test` | pass / 0 problems / 58 pass |
| CI | GitHub Actions on PR #3 | pass |
| PR #1 flows | Android emulator (Pixel 7, API 36) via adb + uiautomator | onboarding targets (BMR 1744 / TDEE 2092), back-after-onboarding exits, error states, ~50 KB uploads, Add-to-Meal return, double-tap guard, menu-unavailable banner |
| Search calories | emulator + curl | banana/oatmeal values corrected; OFF results relevant |
| Barcode | curl against local server (live OFF) | real product 200, fake code 404; 422/502/504 via mocked tests |
| kg weight | emulator | 80 kg saved and shown as "80 kg" |
| Beta switch | local server with `TRIAL_DAYS=0` | `expired` → `beta` |
| `/read-label` | generated card image via local server (real Haiku call) | exact 230/43/0/5 + serving; blank image → `no_label` |
| Label UI | emulator | toggle, hint, shutter → `no_label` banner + Retake |
| Production boot | `npm ci --omit=dev`, `NODE_ENV=production` | `/health` ok |

**Not verified:** anything on iOS; real food photos; real nutrition cards or
labels; barcode camera scanning on hardware; History undo, zero goals, volume
units and custom-food dedupe in the running app (unit tests only);
Google Places detection; Harvard live menu matching after #1; the Render deploy
itself.

---

## 6. Decisions and non-goals

- **No DineOnCampus circumvention.** The API returns 403 to non-browser TLS
  fingerprints even with browser headers. Impersonating a browser or bulk-copying
  the data was rejected as bot-detection evasion. Path: permission (email sent
  to Aggie Dining contract management), label scan meanwhile.
- **Free beta over trials** (`BETA_OPEN_ACCESS`) until entitlements are persisted.
- **Model not changed.** Haiku 4.5 stays. Evaluating Haiku 5.5 is a follow-up
  that needs real photos and spend approval.
- **No crash reporting added** (Sentry needs a native config plugin and an EAS
  build; deferred).
- **No Supabase or RevenueCat work** (out of scope; rules forbid billing stubs).

---

## 7. Where the author is least sure — please scrutinize

1. **`energyKcal` heuristic** (`server/index.js`): foods whose calories
   legitimately exceed 2× Atwater (alcohol, sugar alcohols, mislabeled macros)
   could be wrongly divided by 4.184. The 35% band limits this, but it is a
   heuristic.
2. **OFF relevance filter** drops results that share no word with the query,
   which also drops synonyms ("soda" vs "cola") and non-English names.
3. **`restoreMeal` re-sorts the whole log by timestamp.** If any code relies on
   insertion order differing from timestamp order, undo could reorder meals.
4. **Custom-food dedupe** silently overwrites the stored macros with the latest
   entry for the same name and brand. Is "latest wins" the right policy?
5. **Profile `useKg` writes** do read-modify-write on `PROFILE` from
   ProfileScreen, while GoalsScreen writes the whole profile. A save in Goals
   after toggling in Profile keeps Goals' in-memory `useKg`. Probably fine, but
   unsynchronized.
6. **`/read-label` trust.** Values come from the model reading the image, and
   only the prompt prevents invented numbers. `confidence: 1` is asserted, not
   measured. The UI says "check the numbers", but a misread is logged as exact.
   It shares the `aiLimiter` bucket with `/analyze`.
7. **Label images go through the 1568 px resize** (JPEG 0.7). Fine for a close
   photo; small print from far away may fail (it should return `no_label`).
8. **`BETA_OPEN_ACCESS` and older clients:** a build before PR #4 sees
   `status: 'beta'` and shows "Subscription active". Harmless, but inaccurate.
9. **Barcode `TypeError` → "no connection":** any `TypeError` thrown in the try
   block (e.g. a malformed response) is reported as a connection problem.
10. **`MainTabNavigator` "lazy" `require()`s** run at module load, so they aren't
    lazy. Left as is (lint-disabled) to avoid import-cycle risk; worth a look.
11. **Privacy policy and App Privacy answers** (`docs/privacy.html`,
    `APP_STORE_LISTING.md`) were written from reading the code, not from a
    legal review. Check them against the actual data flows.
12. **`DebugScreen` imports AsyncStorage directly** (KI-021), a rule violation
    that predates this work and was left alone.

---

## 8. Open items for the owner (not code)

- Create the Render service and set keys (KI-020); set an Anthropic spend limit.
- Enable GitHub Pages for `/docs`; fill in the privacy policy's date and contact.
- Apple Developer account, `eas login`, first TestFlight build.
- Fill in the feedback email in `BETA_TEST_PLAN.md` and `APP_STORE_LISTING.md`.
- Phone checks listed in PRs #2 and #5 before merging.
- Await Aggie Dining's reply about menu data.
