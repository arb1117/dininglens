# Codex Supervisor Notes

Owner: Andrew Burruss
Project: DiningLens
Created: 2026-06-06

## Pre-change snapshot

- Starting git commit: `9555e0f`
- `git status --short`: clean
- Pre-existing diff in targeted files: none
- Codex role: narrow implementation pass for checklist issues found during review, preserving Claude's existing file structure and style.

## Initial findings to address

1. `reason: "no_food"` responses were treated as generic fallback menu items in `EstimateScreen`.
2. Dashboard edit navigation did not pass `itemIndex` or `existingItem`, so Search edit mode could not update dashboard items.
3. Dashboard period add navigation passed `context: period`, but Search ignored it and logged by current clock time.
4. `app.json` lacked standalone iOS usage strings and did not list the `expo-camera` plugin.
5. Visual portion multipliers did not match the project brief.
6. Calorie ring turned red immediately over 100%, while the brief specified amber through 110%.
7. MealContext did not expose water/exercise globally. This was noted, but it is intentionally left as a larger follow-up unless required by another screen; Dashboard persistence already works locally.

## Files intended for narrow edits

- `app.json`
- `src/screens/EstimateScreen.tsx`
- `src/screens/DashboardScreen.tsx`
- `src/screens/SearchScreen.tsx`

## Verification plan

- Run `npx tsc --noEmit`.
- Re-check git diff.

## Codex changes applied

### `app.json`

- Added iOS `NSCameraUsageDescription`.
- Added iOS `NSLocationWhenInUseUsageDescription`.
- Added the `expo-camera` config plugin with a matching camera permission message.

### `src/screens/EstimateScreen.tsx`

- Aligned visual portion multipliers with the brief:
  - Tiny `0.4`
  - Small `0.6`
  - Medium `1.0`
  - Large `1.4`
  - Huge `2.0`
- Treated `reason: "no_food"` as an empty/retake state instead of falling back to default menu items.
- Left existing `image_quality` / `low_confidence` behavior intact.
- Prevented empty estimates from logging zero-item meals.
- Hid the venue match banner for image-quality and no-food empty states.
- Made the no-food section label and empty message more explicit.

### `src/screens/DashboardScreen.tsx`

- Adjusted calorie ring colors so amber covers `90%` through `110%`, and red only starts above `110%`.
- Preserved dashboard edit context by carrying each logged item's `itemIndex` and full `MacroItem`.
- Fixed dashboard edit navigation to pass `itemIndex` and `existingItem` into Search.
- Fixed dashboard period add navigation to pass `period` instead of overloading `context`.

### `src/screens/SearchScreen.tsx`

- Reads optional `period` route param.
- Logs manually searched foods with ISO timestamps and the selected meal period when launched from a dashboard period.
- Preserves existing estimate-mode behavior for "Add to Meal".
- Shows an "Adding to Breakfast/Lunch/Dinner/Snacks" pill when launched from a dashboard meal period.
- Changes the sheet CTA to "Log to [Period]" in that flow.

## Verification result

- `npx tsc --noEmit`: passed.
- Additional UX polish pass `npx tsc --noEmit`: passed.
- Git diff after implementation: `app.json`, `DashboardScreen.tsx`, `EstimateScreen.tsx`, `SearchScreen.tsx`, plus this note.

## Remaining follow-up for Claude

### Feature/product priority feedback

Andrew asked what still needs to be added or changed feature-wise. My recommendation is to focus the next pass on making the existing app dependable and shareable before adding major new feature surfaces.

1. Public backend and distribution readiness
   - Replace local LAN proxy usage with a hosted backend URL strategy.
   - Keep the mobile app talking to the same backend endpoints; do not move provider credentials into the app.
   - Rotate any exposed/local-shared API keys before outside testing.
   - Add EAS preview/internal build setup after the backend URL and secrets are stable.

2. AI reliability and ownership boundary
   - The app should own stable endpoints like `/analyze`, `/reanalyze`, `/chat`, `/estimate-exercise`, and `/calculate-tdee`.
   - The backend should decide whether those endpoints use Anthropic, OpenAI, a self-hosted Llama server, or another provider.
   - Add a backend AI abstraction when making provider changes so the mobile app does not care which model is behind the endpoint.
   - Validate AI output before returning it to the app. Handle malformed JSON, missing fields, no-food responses, timeouts, and low confidence as first-class states.
   - Preserve the product stance: AI suggests, user confirms, app logs.

3. UX polish on current flows
   - Improve loading, empty, and error states across camera analysis, barcode lookup, manual search, dining hall loading, AI chat, TDEE, and exercise estimation.
   - Show clearer confidence/status language for estimates, especially when dining hall menu context was used.
   - Make portion adjustment after photo analysis faster and easier.
   - Improve meal history ergonomics: edit, delete, duplicate/log again.
   - Keep Dashboard period add/edit behavior consistent with the current fixes.

4. Dining hall mode validation
   - Field-test GPS detection on real devices.
   - Show detected campus/dining hall and whether current menu context is available.
   - Continue adding locations through `src/data/campuses.ts`.
   - Keep provider-specific fetch/parsing logic in `src/services/menuService.ts`.
   - Avoid one-off hardcoding inside screens.

5. Defer for now
   - User accounts/cloud sync can wait until local flows are stable.
   - Admin tools for campus management can wait until the registry/provider pattern has been field-tested.
   - Restaurant scraping should not expand aggressively until dining hall and manual search are reliable.
   - Fully automatic AI logging should be avoided; confirmation matters for food tracking trust.

Suggested next sprint scope: hosted backend URL, secret cleanup, AI response validation, real-device smoke tests, and polish of failure/empty states.

- If Claude wants to commit this, review the diff and decide whether to include this note file permanently or use it only as a handoff artifact.

## Continued Codex development pass

### `src/context/MealContext.tsx`

- Promoted existing Dashboard water state into `MealContext`.
- Promoted existing Dashboard exercise state into `MealContext`.
- Exported `ExerciseEntry`.
- Added context values:
  - `waterCups`
  - `toggleWater`
  - `exerciseLog`
  - `addExercise`
  - `totalBurned`
- Kept the same AsyncStorage keys already used by Dashboard:
  - `@dininglens_water_{date}`
  - `@dininglens_exercise_{date}`

### `src/screens/DashboardScreen.tsx`

- Removed local AsyncStorage water/exercise ownership.
- Reads and updates water/exercise through `MealContext`.
- Preserved existing Dashboard UI and behavior.

### `src/screens/AIChatScreen.tsx`

- Added water and exercise totals to the local AI coach context.

### `server/index.js`

- Added water and exercise lines to the `/chat` context block so Claude can respond with more complete daily context.

### Verification

- Context promotion pass `npx tsc --noEmit`: passed.

## Campus registry expansion pass

### `src/data/campuses.ts`

- Added a central `CAMPUS_REGISTRY` for supported campuses.
- Moved the existing Texas A&M dining hall definitions into that registry.
- Added typed venue/provider structures:
  - `Coords`
  - `DiningProvider`
  - `DiningVenueDefinition`
  - `CampusDefinition`
- Added `SUPPORTED_DINING_VENUES`, derived from all campus registry entries.
- Added `getCampusById` for future UI or settings use.

### `src/services/venueService.ts`

- Replaced the flat hardcoded venue list with registry-derived venues.
- Preserved the existing `KNOWN_VENUES` export for compatibility with `CameraScreen`.
- Added nearest-campus detection before dining hall matching.
- Dining hall matching now checks venues for the nearest supported campus first, falling back to all supported venues if no campus is inside its campus detection radius.
- Kept the existing 0.25 km dining hall threshold and 0.1 km restaurant threshold.

### `src/services/menuService.ts`

- Replaced the duplicated dineoncampus ID map with a `KNOWN_LOCATIONS` map derived from `SUPPORTED_DINING_VENUES`.
- Future campus additions should be made in `src/data/campuses.ts`, not duplicated between menu and venue services.

### How to add a supported campus

1. Add a new campus object to `CAMPUS_REGISTRY`.
2. Give it campus-level coordinates and a `detectionRadiusKm`.
3. Add each dining hall under `venues` with:
   - stable `id`
   - display `name`
   - `campusId`
   - `institution`
   - `provider`
   - provider `locationId`
   - hall coordinates
4. Run `npx tsc --noEmit`.

### Verification

- Campus registry pass `npx tsc --noEmit`: passed.

## Hard-data location expansion pass

### Added Harvard / HUDS via CS50 Dining API

- Added Harvard University to `src/data/campuses.ts`.
- Added supported Harvard dining venues with CS50 location IDs:
  - `30` Annenberg Hall
  - `9` Adams House
  - `5` Cabot and Pforzheimer House
  - `38` Currier House
  - `7` Dunster and Mather House
  - `14` Eliot and Kirkland House
  - `16` Leverett House
  - `15` Lowell and Winthrop House
  - `8` Quincy House
- Coordinates were geocoded from public map data for the named Harvard houses/halls.
- Source for IDs/API shape: CS50 Dining API docs and live `https://api.cs50.io/dining/locations`.

### `src/services/menuService.ts`

- Added `cs50` provider support through `fetchVenueMenu`.
- CS50 menu flow:
  1. Fetch current meal menu IDs from `/dining/menus?date={date}&location={id}&meal={mealId}`.
  2. Resolve recipe details through `/dining/recipes/{recipeId}`.
  3. Convert recipe calories/protein/carbs/fat into DiningLens `MenuItem`s.
- Existing DineOnCampus flow remains unchanged for Texas A&M.

### `src/screens/CameraScreen.tsx`

- Switched dining hall menu loading from `fetchMenu(locationId, date)` to `fetchVenueMenu(venue, date)`, so future providers can plug in through the registry.

### `server/index.js`

- Menu prompts now omit fake `0 cal, 0g...` nutrition strings when a provider lacks nutrition.
- Harvard CS50 recipes do provide nutrition, so those items should usually include macro context.

### Verification

- Hard-data expansion pass `npx tsc --noEmit`: passed.

## Claude latest work audit - 2026-06-06

Claude added a substantial set of committed improvements after the earlier handoff:

- photo upload from library
- ambient venue detection and nearby menu search
- expanded campus registry and chain restaurant hard data
- serving-size picker and natural-language quantity interpretation
- AI response validation, timeout handling, and retry on transient errors
- loading/error/empty states
- confidence/source labels on estimates
- history delete/log-again/remove-item
- keyboard dismissal polish

Verification from Codex:

- `npx tsc --noEmit`: passed
- tracked-file secret scan: no plaintext keys found in tracked app/server files
- local `.env` still contains real config values and must remain private; rotate exposed keys before outside testing
- `npm audit --omit=dev --json`: 11 moderate advisories in Expo dependency tree, suggested fix points to Expo `56.0.9` major upgrade
- `npm outdated --json`: expected SDK/package drift; plan upgrades deliberately

Full audit lives in `CLAUDE_WORK_AUDIT_2026-06-06.md`.

Highest-priority findings for Claude:

1. Backend `reason: "parse_error"` / `reason: "timeout"` can fall through to fallback menu items in `EstimateScreen`. Extend client reason types and treat those as error/empty states.
2. `/scrape-menu` is SSRF-prone if exposed publicly. Disable before beta or harden URL/protocol/private-IP/redirect/body-size handling.
3. Backend still returns raw error messages from several handlers. Add centralized production-safe error handling.
4. Expensive AI endpoints still need rate limiting.
5. Repeated hardcoded `http://192.168.1.71:3001` client fallback should be centralized and replaced with dev/preview/prod API config.
6. Dependency advisories should be tracked before beta, but avoid blind Expo major upgrade during active feature work.

Assessment:

- Feature direction is good and aligned with Andrew's request to polish/expand existing Claude-designed features.
- Prototype polish improved meaningfully.
- Security posture is still pre-beta, not production-ready.
- Next Claude sprint should prioritize backend hardening and the AI fallback bug over adding more locations or UI surface.

---

## Claude follow-up pass — 2026-06-06 (post-Codex review)

### What was done after Codex's initial review

All changes below were made by Claude Code after Codex's changes were committed in two commits:
- `fix(codex): portion multipliers, calorie ring thresholds, no-food state, dashboard edit/period nav, water/exercise in MealContext, app.json iOS permissions`
- `feat(codex): campus registry + Harvard/HUDS via CS50 Dining API`

---

### Navigation, photo upload, venue UX (committed)

**Post-log navigation fixed:**
- After logging a meal from EstimateScreen, SearchScreen, or anywhere else, navigation now resets to Dashboard (MainTabs) so the user is never stranded on the camera screen.

**Photo library upload added:**
- `expo-image-picker` installed and added to app.json plugins.
- Gallery button (🖼) added to CameraScreen. Tapping opens the device's photo library.
- Selected photo goes through the same base64 analysis pipeline as a camera capture.
- "Upload Photo" also added to the Add tab action sheet.

**"Eating out?" button redesigned:**
- Replaced the old "🍽 Near a dining hall? Tap to enable" chip with a unified "Eating out?" button covering both dining halls and restaurants.
- Tapping opens a bottom modal with two options: "📍 Use my location" (runs detectVenue()) and "🔍 Search a place" (text search against CAMPUS_REGISTRY + chainMenus).
- Once a venue is active it becomes the venue pill ("📍 Duncan Dining Hall · 0.1 km") with an ✕ to dismiss.
- Ambient GPS detection still runs on mount silently; "Eating out?" is the fallback for when nothing is found or the user wants to override.

**"Dining Hall" removed from Add tab action sheet:**
- Add sheet now shows only: Scan Meal / Upload Photo / Search Foods / Ask AI.
- Dining hall context is only accessible via the "Eating out?" button and the nearby menu section in Search.

**Branded filter chip removed from SearchScreen:**
- Filter chips are now: All / My Foods / Common (no Branded).
- "Common" = USDA results. "All" = USDA + Open Food Facts combined.
- Brand info shown inline on individual result cards when available.

**Meal period picker added to all log flows:**
- 4-pill selector (Breakfast / Lunch / Dinner / Snacks) appears above Log buttons on EstimateScreen and SearchScreen.
- Auto-detected period is pre-selected based on time of day.
- When opened from Dashboard [+] on a specific period, that period is locked (no override).

**Natural language serving size added:**
- Replaced the old stepper ([-] 1.5 [+]) with two modes:
  - Structured: amount field + unit picker (g/oz/cup/tbsp/tsp/serving/scoop/ml, adapts to food type).
  - Natural language: "Describe amount instead" text input → POST /interpret-quantity → Claude estimates grams → fills structured fields with one-sentence explanation shown below.
- `/interpret-quantity` server route added (claude-haiku).

---

### Campus registry expansion (committed)

Added 5 more universities to `src/data/campuses.ts`:

| University | Site ID | Dining halls added |
|---|---|---|
| University of Pittsburgh | 5e6fcc641ca48e0cacd93b04 | 4 (Pom & Honey, True Burger, Market at Sutherland, The Eatery) |
| USF St. Petersburg | 67d43f44c625af0664d547c6 | 4 (The Nest, Bay Features, Kahwa Coffee, Market at The Reef) |
| Fitchburg State University | 5751fd2c90975b60e04892b0 | 2 (Holmes Dining Commons, North Street Bistro) |
| Northeastern University | 5751fd2b90975b60e048929a | 3 (Stetson East, United Table, Subway Ryder) |
| University of Florida | 62312845a9f13a1011b4dd3a | 3 (Food Hall @ Gator Corner, Market @ Beaty, Market @ Hough) |

Note: GPS coordinates hardcoded from geocoding. USF Tampa (30 locations, site_id: 67102500e45d43075d091d90) was found but not added yet — needs careful GPS geocoding given campus size.

---

### Chain restaurant database expansion (committed)

`src/data/chainMenus.ts` expanded from 32 chains to 36 chains, all at 20+ items.

New chains added: KFC, Popeyes, Arby's, Jack in the Box.

All existing chains expanded to 20+ items covering breakfast/lunch/dinner/drinks where applicable. Chains now at 20+ items: McDonald's, Chick-fil-A, Chipotle, Subway, Taco Bell, Wendy's, Burger King, Panera Bread, Panda Express, Five Guys, Raising Cane's, Whataburger, Shake Shack, Wingstop, Starbucks, Dunkin', Jersey Mike's, Jimmy John's, Smoothie King, Jamba Juice, Culver's, Sonic, Dairy Queen, Olive Garden, Applebee's, IHOP, Denny's, Cracker Barrel, Cook Out, Zaxby's, Freddy's, In-N-Out.

---

### AI response validation and reliability (committed)

In `server/index.js`:
- `validateAnalysisResult(raw)`: normalizes every /analyze and /reanalyze response. Defaults missing fields, clamps values (calories cap 5000, macros cap 500, portionMultiplier 0.1–5.0, confidence 0–1). Removes items with empty names or calories > 5000. Adds `validated: true`.
- `callAnthropic()`: wraps all AI calls with 25-second timeout (returns 504 on timeout). One retry after 2s on transient errors (529 overloaded, network errors).

---

### GPS venue detection improvements (committed)

In `src/services/venueService.ts` and `src/screens/CameraScreen.tsx`:
- **5-minute cache**: `{ venue, detectedAt }` cached in module scope. Returns instantly if within TTL.
- **Distance display**: venue pill shows "📍 Duncan Dining Hall · 0.1 km" (meters when < 100m).
- **Fast path**: `getLastKnownPositionAsync()` returns immediately; `getCurrentPositionAsync()` refines in background.
- **Graceful degradation**: first location permission denial shows helpful message (stored in AsyncStorage); subsequent denials are silent.
- **Manual venue search**: "Eating out?" modal searches CAMPUS_REGISTRY dining halls by name + findChainMatch() for restaurants.

---

### UX polish pass (in progress at time of this writing)

Currently building in sequence:
1. **Loading states**: typing indicator in AI chat, barcode lookup overlay, search activity indicator, "Loading menu..." on Eating Out button, "Calculating targets..." on TDEE, "Estimating calories..." on exercise.
2. **Error/empty states**: error card when analysis fails with Retake button, barcode-not-found toast with Search button, search empty state with AI suggestion, dining hall menu failure banner, Dashboard friendly empty state.
3. **Confidence and source labels**: per-item badges (AI estimated / Menu matched / Barcode scanned / Manually added), low-confidence amber indicator, overall estimate status line.
4. **History actions**: delete meal (with confirmation), "Log again" (re-logs immediately), delete individual item from logged meal.

---

### Current git state

Full commit list as of 2026-06-06:

```
0716c1b feat: error states and empty states across all flows
b9973a0 feat: loading states across all async flows
cbd20af feat: GPS venue detection improvements — caching, distance display, fast path, better manual search
b561b7c feat: AI response validation, timeout handling, retry on transient errors
4302fc0 feat: expand chain restaurant database to 36 chains, 20+ items each
598dae1 feat: meal period picker on log, natural language + dropdown serving size UI
096070e fix: remove Branded filter chip, inline brand on result cards
918d123 feat: expand chain restaurant database to 32 chains, 477 items
6f07d5d feat: add Pitt, USF St Pete, Fitchburg State, Northeastern, UF to campus registry
c16218a fix: remove Dining Hall from Add tab action sheet
ff833b0 fix: restore Eating out? button — GPS-first with manual search fallback
9281d17 feat: ambient venue detection, remove manual toggle, nearby menu in search
8d92d2b feat: upload photo from library for meal analysis
9821585 fix: post-log navigation returns to Dashboard
39f65c6 feat(codex): campus registry + Harvard/HUDS via CS50 Dining API
cac17c9 fix(codex): portion multipliers, calorie ring thresholds, no-food state, dashboard edit/period nav, water/exercise in MealContext, app.json iOS permissions
```

### Known remaining gaps
- USF Tampa (30 locations) not yet added — GPS coordinates need careful geocoding.
- Harvard GPS coordinates need field testing on device.
- DineOnCampus API still 403s from server-side IP — menu fetches remain client-side.
- HealthKit stub exists but not integrated (requires bare workflow or special Expo config).
- Backend proxy still on local LAN (Andrew's home network only) — not yet deployed.
