# Claude Work Audit - 2026-06-06

Prepared by Codex after reviewing Claude's latest committed work.

## Scope Reviewed

Commits from `9555e0f` through current `HEAD`:

- checklist fixes and Codex handoff work
- campus registry and Harvard/HUDS CS50 support
- additional DineOnCampus campuses
- chain restaurant database expansion
- photo upload and ambient venue detection
- nearby menu search
- AI validation, timeout, and retry handling
- loading, empty, and error states
- estimate confidence/source labels
- meal history delete/log-again/remove-item
- serving size/natural-language quantity UI

Verification run:

- `npx tsc --noEmit`: passed
- tracked-file secret scan: no plaintext keys found in tracked app/server files
- local `.env` still contains key names/values and must remain private; rotate exposed keys before outside testing
- `npm audit --omit=dev --json`: 11 moderate advisories in Expo dependency tree, fix points to Expo `56.0.9` major upgrade
- `npm outdated --json`: several Expo/React Native packages are behind latest, expected for an SDK-pinned Expo app

## Overall Assessment

Claude's work is directionally strong and mostly aligned with Andrew's criteria: it expands and polishes existing DiningLens features rather than replacing the architecture. The app is now closer to a polished prototype because core flows have better loading states, history actions, photo upload, venue detection, confidence/source labels, and serving-size controls.

However, this is not production-security-ready. The latest work improves reliability, but the backend still needs explicit security hardening before outside testers or any cloud user data.

## Positive Changes

1. AI reliability moved in the right direction.
   - `server/index.js` now has response validation and transient retry/timeout handling.
   - This helps prevent malformed model output from crashing the client.

2. UI polish improved in existing flows.
   - Loading and error states were added across major async flows.
   - Estimate screen now labels confidence/source.
   - History now supports delete, log again, edit, and individual item removal.
   - Search has a richer serving-size flow and natural-language quantity interpretation.

3. Dining/location model is more adaptable.
   - More campuses were added to `src/data/campuses.ts`.
   - `venueService` has cache/fast-path GPS behavior and distance-oriented detection.

4. TypeScript still passes.
   - This is important given the number of screens touched.

## Findings for Claude

### P1 - AI parse/timeout responses can still create fallback food items

Files:

- `server/index.js:47`
- `server/index.js:315`
- `src/services/visionService.ts:21`
- `src/screens/EstimateScreen.tsx:89`
- `src/screens/EstimateScreen.tsx:97`

Problem:

The backend can now return `reason: "parse_error"` or `reason: "timeout"` with an empty `detectedItems` array. But the client `AnalysisResult.reason` type only includes `image_quality`, `low_confidence`, and `no_food`, and `EstimateScreen` only treats those three reasons as no-item states. When `detectedItems.length === 0`, `buildInitialItems` falls back to the first three `menuItems`, which can reintroduce misleading/fake meal estimates after AI parse failure or timeout.

Action:

- Extend `AnalysisResult.reason` to include `parse_error` and `timeout`.
- Treat `parse_error`, `timeout`, and any validated empty AI result as an error/empty state, not as fallback menu items.
- Only use menu fallback when the app is intentionally showing nearby menu suggestions, and label it clearly as suggestions, not detected food.

### P1 - `/scrape-menu` is still SSRF-prone if exposed publicly

File:

- `server/index.js:602`

Problem:

`/scrape-menu` accepts a user-controlled `website` URL and fetches it directly. It has a timeout and token cap, but it does not restrict protocols, private IP ranges, localhost, redirects, or max response size before reading the body. This should not be public in beta without hardening.

Action:

- Either disable `/scrape-menu` for preview builds or harden it before public deployment.
- Require `https`.
- Reject localhost, private IPs, link-local IPs, metadata IPs, and internal hostnames.
- Re-check the final URL after redirects.
- Enforce max response bytes before `text()`.
- Add endpoint-specific rate limiting.

### P1 - Backend still returns raw internal error messages

Files:

- `server/index.js:326`
- `server/index.js:439`
- `server/index.js:667`
- `server/index.js:782`
- `server/index.js:869`

Problem:

Several handlers return `err.message` or `String(err)` to the client. That can leak provider errors, stack-ish messages, URLs, operational details, or sensitive context in production.

Action:

- Add centralized error handling.
- Return stable public error codes/messages.
- Log internal details server-side with redaction.
- Do not log raw model output in production.

### P1 - No production API rate limiting yet

File:

- `server/index.js`

Problem:

The backend has several expensive AI endpoints and public lookup/scrape endpoints but no rate limiting. This is a cost and abuse risk.

Action:

- Add global rate limiting.
- Add stricter limits for `/analyze`, `/reanalyze`, `/chat`, `/interpret-quantity`, `/estimate-exercise`, `/calculate-tdee`, and `/scrape-menu`.
- Consider per-device/per-user limits once auth exists.

### P1 - Hardcoded local backend fallback remains across client files

Files:

- `src/services/visionService.ts:3`
- `src/services/restaurantService.ts:3`
- `src/screens/AIChatScreen.tsx:12`
- `src/screens/CameraScreen.tsx:24`
- `src/screens/DashboardScreen.tsx:13`
- `src/screens/EstimateScreen.tsx:14`
- `src/screens/GoalsScreen.tsx:16`
- `src/screens/SearchScreen.tsx:13`

Problem:

The client still falls back to `http://192.168.1.71:3001`. This is fine for Andrew's LAN, but not for outside testers or production builds.

Action:

- Centralize API URL config in one file, such as `src/config/api.ts`.
- In development, allow a local fallback.
- In preview/production, fail fast or use the configured hosted backend URL.
- Document EAS `development`, `preview`, and `production` environment values.

### P2 - AI validation has a dead sanity check

File:

- `server/index.js:61`
- `server/index.js:62`

Problem:

`calories` is clamped to `5000`, then checked with `if (calories > 5000)`, which can never be true. This is harmless, but it means extreme values are silently clamped instead of rejected.

Action:

- Check raw numeric values before clamping if the goal is rejection.
- Otherwise remove the unreachable check and intentionally clamp.

### P2 - Prompt-injection risk remains in scraped/menu/user text

Files:

- `server/index.js:635`
- `server/index.js:758`
- `server/index.js:844`

Problem:

Dining hall menu text, scraped website text, and user-entered natural-language portions are passed to the model. That is expected, but these are untrusted inputs. The current prompts do not consistently tell the model to ignore instructions inside retrieved/menu/user text.

Action:

- Add explicit untrusted-context instructions to AI prompts.
- Keep structured output validation.
- Never allow model output to choose access permissions or user records.

### P2 - Dependency advisories need a beta-readiness decision

Files:

- `package.json`
- `package-lock.json`

Problem:

`npm audit --omit=dev` reported 11 moderate advisories in the Expo dependency tree. The suggested fix is a major Expo upgrade to `56.0.9`, which may not be a safe quick change.

Action:

- Do not blindly major-upgrade Expo in the middle of feature polish.
- Add this to beta-readiness.
- Run `npx expo-doctor` and confirm whether the current SDK/package set is correct.
- Plan an Expo SDK upgrade separately if needed.

### P2 - Restaurant/chain hard data should be source-labeled

File:

- `src/data/chainMenus.ts`

Problem:

The chain restaurant database is useful for speed and offline-ish UX, but the data appears manually curated. For user trust, it should indicate source/estimated status and should not present itself as precise official nutrition unless verified.

Action:

- Add source metadata or UI copy that labels chain items as "database estimate" or "chain nutrition".
- Prefer verified official data where available.

## Security Checklist Coverage Status

Good progress:

- no plaintext secrets found in tracked files during this pass
- `.gitignore` excludes `.env`
- AI output validation started
- timeout/retry handling started
- some empty/error states improved

Still open before outside testers:

- rotate exposed/local keys
- central API URL config
- hosted backend URL strategy
- production error handler
- rate limiting
- request schema validation
- SSRF hardening or disabling `/scrape-menu`
- production log redaction
- CORS/security headers
- auth/authorization plan before cloud user data
- dependency advisory decision

## Recommended Next Claude Sprint

1. Fix the AI `parse_error` / `timeout` fallback bug.
2. Centralize API URL config and remove repeated LAN fallbacks.
3. Add Express hardening:
   - `helmet`
   - rate limits
   - centralized error handler
   - request size limits
   - safe production logging
4. Disable or harden `/scrape-menu`.
5. Add schema validation for all public backend endpoints.
6. Keep UI polish incremental; do not introduce a large UI framework until the backend is safer.
7. Re-run:
   - `npx tsc --noEmit`
   - `npm audit --omit=dev`
   - real-device Expo smoke tests

