# DiningLens Handoff for Claude

Prepared by Codex on 2026-06-06.

## Starting point

- Repo: `C:\Users\arb11\Projects\dininglens`
- Starting commit before Codex work: `9555e0f`
- Initial targeted files were clean before Codex edits.
- Codex did not commit changes.
- Detailed running notes live in `CODEX_SUPERVISOR_NOTES.md`.

## Current verification

- `npx tsc --noEmit`: passing.
- `npm run check`: passing as of 2026-06-07.
- `node --check server/index.js`: passing as of 2026-06-07.
- Backend local smoke check: `GET /health` returned `{"status":"ok"}` as of 2026-06-07.
- No Expo/device smoke test was run in this pass.
- No server integration test was run beyond earlier server startup sanity and direct CS50 API probes.

## Files changed or added

- `app.json`
- `server/index.js`
- `src/context/MealContext.tsx`
- `src/data/campuses.ts` new
- `src/screens/AIChatScreen.tsx`
- `src/screens/CameraScreen.tsx`
- `src/screens/DashboardScreen.tsx`
- `src/screens/EstimateScreen.tsx`
- `src/screens/SearchScreen.tsx`
- `src/services/menuService.ts`
- `src/services/venueService.ts`
- `CODEX_SUPERVISOR_NOTES.md` new
- `CLAUDE_HANDOFF.md` new
- `CODEX_REENTRY_PROMPT.md` new
- `SECURITY_AND_SCALE_PLAN_FOR_CLAUDE.md` new
- `CLAUDE_WORK_AUDIT_2026-06-06.md` new
- `CODEX_SECURITY_TAKEOVER_2026-06-07.md` new
- `DEPLOYMENT_PREVIEW.md` new
- `.env.example` new
- `.dockerignore` new
- `Dockerfile` new
- `eas.json` new
- `render.yaml` new
- `src/config/api.ts` new
- `COWORK_CONTEXT_PACKET.md` new

## Main changes

### Checklist fixes

- `reason: "no_food"` no longer falls through to fake default menu items.
- Empty/no-food estimates cannot log zero-item meals.
- Dashboard item edit now passes `itemIndex` and `existingItem` into Search.
- Dashboard period add now passes `period`; Search logs to that period.
- Search shows a period pill and period-specific CTA when launched from Dashboard.
- Portion multipliers now match the brief: `0.4`, `0.6`, `1.0`, `1.4`, `2.0`.
- Calorie ring is amber from `90%` through `110%`, red only above `110%`.
- Standalone iOS config now includes camera/location usage strings and `expo-camera` plugin config.

### Context/state improvements

- Existing Dashboard water state moved into `MealContext`.
- Existing Dashboard exercise state moved into `MealContext`.
- Dashboard UI remains visually the same, but water/exercise are now app-level state.
- AI Coach context now includes water ounces/cups and exercise calories/entry count.
- `/chat` server context block now includes water and exercise.

### Campus/menu expansion

- Added `src/data/campuses.ts` as the single registry for supported campuses.
- Existing Texas A&M dining halls moved into that registry.
- `venueService` now detects nearest supported campus first, then that campus's dining halls.
- `menuService` derives `KNOWN_LOCATIONS` from the registry instead of duplicating IDs.
- Added `fetchVenueMenu(venue, date)` as a provider-aware menu entrypoint.
- `CameraScreen` now calls `fetchVenueMenu`.

### Harvard hard-data provider

- Added `cs50` provider type.
- Added Harvard University to `CAMPUS_REGISTRY`.
- Added CS50/HUDS locations:
  - `30` Annenberg Hall
  - `9` Adams House
  - `5` Cabot and Pforzheimer House
  - `38` Currier House
  - `7` Dunster and Mather House
  - `14` Eliot and Kirkland House
  - `16` Leverett House
  - `15` Lowell and Winthrop House
  - `8` Quincy House
- `menuService` fetches CS50 menus and resolves recipe nutrition via `/dining/recipes/{id}`.
- Data sources used:
  - CS50 Dining API docs: `https://cs50.readthedocs.io/api/dining/`
  - Live location endpoint: `https://api.cs50.io/dining/locations`
  - OpenStreetMap/Nominatim geocoding for coordinates.

## Important caveats

- DineOnCampus API/site access from this machine often returns Cloudflare `403`; current code still fetches DineOnCampus client-side as before.
- Harvard CS50 provider resolves up to 40 recipe IDs per current meal. This may be a little chatty, but keeps the implementation simple and nutrition-aware.
- Some Harvard dining API locations share menus/kitchens, matching CS50 docs. The registry uses combined names for shared IDs.
- Coordinates are good enough for campus venue detection but should be field-tested on device.
- `KNOWN_VENUES` remains exported from `venueService` for compatibility, but future additions should go into `src/data/campuses.ts`.

## Suggested next steps for Claude

1. Review `git diff` and this handoff.
2. Run `npx tsc --noEmit`.
3. Run the app on Expo Go and test:
   - normal photo analysis
   - no-food photo
   - Dashboard period add
   - Dashboard item edit
   - water/exercise dashboard state
   - AI Coach daily context
4. Test TAMU menu loading on device/LAN.
5. Test Harvard menu loading by manually selecting or simulating a Harvard venue if GPS is not available.
6. Decide whether to keep `CODEX_SUPERVISOR_NOTES.md`, `CLAUDE_HANDOFF.md`, and `CODEX_REENTRY_PROMPT.md` in repo or treat them as temporary handoff artifacts.

## Product direction feedback from Codex

Andrew asked what still needs to change feature-wise. My supervisor read is that DiningLens is no longer missing a core concept; it is missing prototype polish and deployability. The strongest next work is to make the existing flows feel dependable rather than adding a large new feature surface.

For detailed security/backend/UI action steps, read `SECURITY_AND_SCALE_PLAN_FOR_CLAUDE.md`. It maps Andrew's 50-item security audit list into concrete phases for DiningLens.

For Codex's audit of Claude's latest committed work, read `CLAUDE_WORK_AUDIT_2026-06-06.md`. Highest-priority findings from that audit:

- AI `parse_error` / `timeout` responses can still fall through to fallback menu items on `EstimateScreen`.
- `/scrape-menu` is still SSRF-prone if exposed publicly.
- Backend handlers still return raw `err.message` / `String(err)` in several places.
- Expensive AI/API endpoints still need production rate limiting.
- Client files still repeat the local LAN backend fallback instead of using centralized deployable API config.
- `npm audit --omit=dev` reports moderate advisories in the Expo dependency tree; the suggested fix is a major Expo upgrade and should be planned deliberately.

Codex started addressing those items in `CODEX_SECURITY_TAKEOVER_2026-06-07.md`. That pass added centralized API config, backend security middleware/rate limits, safer public errors, `/scrape-menu` SSRF hardening, AI parse/timeout fallback handling, `.env.example`, `DEPLOYMENT_PREVIEW.md`, Docker/Render deploy scaffolding, and EAS preview build scaffolding.

## Latest handoff for Claude - 2026-06-07

Claude should review `CODEX_SECURITY_TAKEOVER_2026-06-07.md` first. The project is now prepared for a hosted backend and EAS preview builds, but no external hosting account has been configured by Codex.

If opening a fresh Claude Cowork window, paste or attach `COWORK_CONTEXT_PACKET.md`. It summarizes the project from start to current state.

After the first Cowork packet was created, Claude Code committed backend security work through:

- `678988c fix: prompt injection guardrails on user-content-aware AI prompts`

Codex reviewed those commits and kept the work, then fixed a few follow-up issues:

- `src/config/api.ts` now accepts both `EXPO_PUBLIC_PROXY_URL` and `EXPO_PUBLIC_API_URL`, with `EXPO_PUBLIC_PROXY_URL` preferred to match EAS/docs.
- AI coach Zod validation no longer strips `water` and `exercise` context.
- Remaining public endpoints now use schemas instead of ad hoc checks.
- Remaining user-text AI prompts now include the prompt-injection guard.
- `npm run check` passed after these fixes.

Completed:

- Centralized mobile API URL in `src/config/api.ts`.
- Added placeholder guard so `EXPO_PUBLIC_PROXY_URL` must be replaced before shared preview/production builds.
- Added Express hardening with `helmet`, `cors`, `express-rate-limit`, request IDs, safer public errors, and rate limits.
- Hardened `/scrape-menu` against basic SSRF risks.
- Fixed AI `parse_error` / `timeout` fallback behavior on `EstimateScreen`.
- Added `.env.example`, `DEPLOYMENT_PREVIEW.md`, `Dockerfile`, `.dockerignore`, `render.yaml`, and `eas.json`.
- Added `npm run check` and `npm run audit:prod`.

Claude's immediate next actions:

1. Review the full diff and decide whether to commit the security/deployability pass separately from handoff docs.
2. Rotate any exposed keys before pushing or sharing anything.
3. Deploy `server/index.js` to Render/Railway/Fly.io/VPS using `render.yaml` or `Dockerfile`.
4. Set backend env vars on the host: `ANTHROPIC_API_KEY`, `USDA_API_KEY`, `GOOGLE_PLACES_API_KEY`, `NODE_ENV=production`, and rate-limit settings.
5. Replace the placeholder `EXPO_PUBLIC_PROXY_URL` in EAS env/profile with the hosted backend URL.
6. Run `npm run check`, then build Android preview with `npx eas build --profile preview --platform android`.
7. Smoke-test real-device flows against the hosted backend before giving the APK/TestFlight build to testers.

### Priority 1: Make the app testable anywhere

- Replace local LAN proxy usage with a deployable backend URL strategy.
- Keep the mobile app calling stable endpoints such as `/analyze`, `/reanalyze`, `/chat`, `/search`, `/lookup`, `/detect-restaurant`, `/calculate-tdee`, and `/estimate-exercise`.
- Do not put AI, USDA, or Google keys in the client bundle.
- Before outside testing, rotate any keys that have appeared in local/shared files and move secrets fully server-side.

### Priority 2: Add an AI reliability layer

- Treat AI as a suggestion engine, not an automatic truth source.
- Validate and normalize all model responses before the app consumes them.
- Make malformed JSON, missing fields, no-food photos, timeouts, and low-confidence responses recover gracefully.
- Keep the review/adjust/log pattern: AI suggests, user confirms, app stores.
- Consider a backend `aiService` abstraction so Anthropic/OpenAI/self-hosted Llama can be swapped later without changing the mobile app.

### Priority 3: Polish existing UX flows

- Improve loading, empty, and error states for camera analysis, barcode lookup, manual search, dining hall menu load, AI chat, TDEE, and exercise estimation.
- Add clearer confidence language for AI estimates: high confidence, estimated, needs review, or menu-context assisted.
- Make portion editing after photo analysis more intuitive and faster.
- Make meal history actions easy: edit, delete, duplicate/log again.
- Keep Dashboard period add/edit behavior consistent with the fixes in this pass.

### Priority 4: Validate dining hall mode on real devices

- Field-test GPS detection around supported venues.
- Show detected campus/hall and whether live menu context was available.
- Keep adding campuses through `src/data/campuses.ts`; provider-specific logic belongs in `menuService.ts`.
- Avoid hardcoding one-off venue behavior inside screens.

### Priority 5: Prepare beta distribution

- Add EAS preview/internal build setup after the backend URL and secrets are clean.
- Android APK/internal distribution should be the first easy outside-tester path.
- iOS testing likely needs TestFlight or registered devices.
- Run a real-device QA checklist before asking non-developers to test.

### What not to overbuild yet

- Do not rush into accounts/cloud sync before local flows are stable.
- Do not add a large admin interface before the campus/provider registry proves itself.
- Do not make the AI fully automatic; food tracking needs user confirmation.
- Do not expand restaurant scraping aggressively until dining hall and manual search flows are reliable.

Best next sprint: hosted backend URL + secret cleanup + AI response validation + real-device smoke tests + error-state polish.

## If handing back to Codex later

Use `CODEX_REENTRY_PROMPT.md` as the prompt/context packet. Attach this file, `CODEX_SUPERVISOR_NOTES.md`, and the current `git diff` if possible.
