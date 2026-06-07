# DiningLens Cowork Context Packet

Use this as the first message/context packet in a new Claude Cowork window.

## Project

Repo path:

`C:\Users\arb11\Projects\dininglens`

App:

DiningLens is an Expo React Native / TypeScript mobile app for macro tracking. It supports AI food photo analysis, barcode lookup, manual food search, dining hall context, restaurant/chain matching, dashboard tracking, AI coach chat, water/exercise logging, and goal/TDEE setup.

Backend:

The app uses a local Express proxy in `server/index.js` to keep Anthropic, USDA, and Google Places keys server-side. The long-term goal is to host this backend publicly so testers can use the app outside Andrew's home WiFi.

Important user preference:

- Preserve Claude's existing architecture/style.
- Expand, refine, and secure existing features rather than replacing the product direction.
- Keep notes clear enough for Codex and Claude to hand work back and forth.
- Do not introduce major platform/account changes without Andrew's involvement.

## Current Git State

Latest committed app-work HEAD seen by Codex after Claude's refresh:

`678988c fix: prompt injection guardrails on user-content-aware AI prompts`

Claude committed additional backend security work after the original Cowork packet was created. There are still uncommitted changes from Codex's handoff/deployment docs plus a small follow-up fix pass. Do not assume the working tree is clean.

Before doing anything, run:

```powershell
git -c safe.directory=C:/Users/arb11/Projects/dininglens -C C:\Users\arb11\Projects\dininglens status --short
npm run check
```

Current check status when Codex last ran it:

```powershell
npm run check
```

passed. It runs:

```powershell
npx tsc --noEmit && node --check server/index.js
```

`npm audit --omit=dev` still reports 11 moderate advisories in Expo's dependency tree. The automated fix points to a major Expo upgrade to `56.0.9`. Do not blindly force that during the security/deployment pass; plan it separately.

## Files To Read First

1. `CLAUDE_HANDOFF.md`
2. `CODEX_SECURITY_TAKEOVER_2026-06-07.md`
3. `DEPLOYMENT_PREVIEW.md`
4. `CLAUDE_WORK_AUDIT_2026-06-06.md`
5. `SECURITY_AND_SCALE_PLAN_FOR_CLAUDE.md`
6. `CODEX_REENTRY_PROMPT.md`
7. `src/config/api.ts`
8. `server/index.js`
9. `eas.json`
10. `render.yaml`
11. `Dockerfile`

## What Claude Originally Built

Claude built the core DiningLens app:

- Expo React Native app
- bottom tab navigation
- camera meal scan
- estimate review screen
- manual food search
- dashboard with calorie ring and macro bars
- meal period grouping
- water/exercise tracking
- AI coach chat
- profile/goals/TDEE flow
- local AsyncStorage persistence
- Express backend for AI/nutrition/provider calls

## Codex Initial Review and Fixes

Codex first acted as supervisor and fixed concrete bugs while preserving Claude's structure:

- `reason: "no_food"` no longer falls through to fake/default menu items.
- Empty/no-food estimates cannot log zero-item meals.
- Dashboard item edit now passes `itemIndex` and `existingItem` into Search.
- Dashboard period add now passes `period`; Search logs to that period.
- Search shows period-specific UI when launched from Dashboard.
- Portion multipliers were corrected to match the brief:
  - tiny `0.4`
  - small `0.6`
  - medium `1.0`
  - large `1.4`
  - huge `2.0`
- Calorie ring remains amber through 110%, red only above 110%.
- iOS camera/location/photo permissions and Expo plugins were added.
- Water/exercise moved into `MealContext`.
- AI coach/server chat context now includes water/exercise.

## Campus/Dining Hall Adaptability Work

Codex added a central campus/provider registry:

- `src/data/campuses.ts`
- `src/services/venueService.ts`
- `src/services/menuService.ts`

Pattern:

- Campus/location definitions belong in `src/data/campuses.ts`.
- Provider-specific menu fetch/parsing belongs in `src/services/menuService.ts`.
- Screens should not hardcode one-off dining hall IDs.

Supported provider types currently include:

- `dineoncampus`
- `cs50`

Codex added Harvard/HUDS via the CS50 Dining API, including Annenberg and multiple houses.

Claude later expanded the campus registry with:

- University of Pittsburgh
- USF St. Petersburg
- Fitchburg State University
- Northeastern University
- University of Florida

Known campus gaps:

- USF Tampa was found but not added yet; needs careful geocoding because of campus size.
- Harvard GPS coordinates should be field-tested on device.
- DineOnCampus often 403s from server-side IPs; current menu behavior remains client-side where needed.

## Claude Follow-Up Feature Work

Claude committed a large UX/product polish pass:

- post-log navigation now returns to Dashboard
- upload photo from library with `expo-image-picker`
- ambient venue detection
- "Eating out?" flow for GPS/manual venue search
- removed manual Dining Hall action from Add sheet
- removed Branded filter chip; brand shown inline instead
- meal period picker on log flows
- natural-language serving size interpretation via `/interpret-quantity`
- chain database expanded from 32 to 36 chains, all 20+ items
- AI response validation
- 25s Anthropic timeout
- retry once on transient AI/network errors
- GPS venue detection cache, distance display, fast path, graceful location denial
- loading states across async flows
- error/empty states
- confidence/source labels
- meal history delete/log-again/remove individual item
- keyboard dismissal fix

Codex audited this work in:

`CLAUDE_WORK_AUDIT_2026-06-06.md`

Codex's main findings from that audit:

- AI `parse_error` / `timeout` could still fall through to fallback menu items.
- `/scrape-menu` was SSRF-prone if exposed publicly.
- backend returned raw internal error messages in multiple places.
- expensive AI/API endpoints needed rate limiting.
- client repeated the local LAN backend fallback across files.
- dependency advisories need a planned Expo SDK upgrade decision.

## Security/Deployability Work Codex Completed

Codex then took over security/deployment prep. Details are in:

`CODEX_SECURITY_TAKEOVER_2026-06-07.md`

Implemented:

### Central API URL Config

Added:

`src/config/api.ts`

Replaced repeated `SERVER_URL` constants with `API_BASE_URL` in:

- `src/services/visionService.ts`
- `src/services/restaurantService.ts`
- `src/screens/AIChatScreen.tsx`
- `src/screens/CameraScreen.tsx`
- `src/screens/DashboardScreen.tsx`
- `src/screens/EstimateScreen.tsx`
- `src/screens/GoalsScreen.tsx`
- `src/screens/SearchScreen.tsx`

Important:

- Local dev can still fall back to Andrew's LAN backend.
- EAS/shared preview configs use a placeholder.
- `src/config/api.ts` intentionally throws if the placeholder `EXPO_PUBLIC_PROXY_URL` is not replaced before a shared build.

### Backend Hardening

Installed dependencies:

- `helmet`
- `cors`
- `express-rate-limit`

Added to `server/index.js`:

- security headers
- configurable CORS allowlist through `CORS_ORIGINS`
- request IDs via `X-Request-Id`
- global rate limiting through `RATE_LIMIT_GLOBAL`
- AI endpoint rate limiting through `RATE_LIMIT_AI`
- scrape endpoint rate limiting through `RATE_LIMIT_SCRAPE`
- safer public error responses
- raw AI output logs behind non-production `logDebug()`
- stopped logging raw USDA key value on startup

### `/scrape-menu` SSRF Hardening

`/scrape-menu` now:

- requires HTTPS
- blocks localhost
- blocks `.local`
- blocks private IPs and link-local IPs
- blocks internal/private DNS resolutions
- checks the final URL after redirects
- rejects oversized pages with `MAX_SCRAPE_BYTES`
- keeps the endpoint available, but it is safer for preview than before

Still consider feature-flagging or disabling `/scrape-menu` for public beta if risk tolerance is low.

### AI Failure Fallback Fix

Fixed:

- `AnalysisResult.reason` now includes `parse_error` and `timeout`.
- `EstimateScreen` treats those as error/empty states.
- AI parse failure/timeout no longer becomes default/fallback menu items.

### Deployment/Preview Files Added

Added:

- `.env.example`
- `DEPLOYMENT_PREVIEW.md`
- `Dockerfile`
- `.dockerignore`
- `render.yaml`
- `eas.json`

Package scripts added:

```json
"check": "npx tsc --noEmit && node --check server/index.js",
"audit:prod": "npm audit --omit=dev"
```

## Claude Code Security Follow-Up After Context Refresh

After Andrew refreshed Claude Code, Claude committed more security work:

- `8ddd0b9 fix: parse_error/timeout treated as error states, not menu fallback`
- `1731836 refactor: centralize API URL config in src/config/api.ts`
- `42e1971 feat: backend hardening — helmet, rate limiting, safe error handler, request size limits, raw error leak fixes`
- `0211a1a fix: harden /scrape-menu against SSRF — URL allowlist, max response size`
- `8978b8c feat: zod schema validation on all public backend endpoints`
- `678988c fix: prompt injection guardrails on user-content-aware AI prompts`

Codex reviewed those commits. The direction is good and `npm run check` passed, but Codex found and fixed these follow-up issues:

- `src/config/api.ts` used `EXPO_PUBLIC_API_URL`, while docs/EAS used `EXPO_PUBLIC_PROXY_URL`. Codex made it accept both, with `EXPO_PUBLIC_PROXY_URL` preferred.
- Claude's Zod `chatSchema` stripped `water` and `exercise` from AI coach context. Codex added those fields and `.passthrough()`.
- Some public endpoints still used ad hoc validation despite the commit title saying all public endpoints were covered. Codex added schemas/use of schemas for:
  - `/lookup-nutrition`
  - `/lookup`
  - `/detect-restaurant`
  - `/scrape-menu`
  - `/estimate-exercise`
  - `/interpret-quantity` optional serving fields
- Prompt-injection guardrails were added to remaining user-text AI prompts:
  - `/analyze` dining hall menu context
  - `/lookup`
  - `/search`
  - `/estimate-exercise`
  - `/calculate-tdee`
  - `/interpret-quantity`

Verification after these follow-up fixes:

```powershell
npm run check
```

passed.

## Current Deployment Plan

Goal:

Get DiningLens off Andrew's home WiFi so others can test it.

Recommended first path:

1. Deploy Express backend to Render, Railway, Fly.io, or a VPS.
2. Set backend env vars on the host:
   - `NODE_ENV=production`
   - `ANTHROPIC_API_KEY`
   - `USDA_API_KEY`
   - `GOOGLE_PLACES_API_KEY`
   - `RATE_LIMIT_GLOBAL=300`
   - `RATE_LIMIT_AI=40`
   - `RATE_LIMIT_SCRAPE=12`
   - `CORS_ORIGINS` if a web origin exists; can be empty for mobile-only.
3. Hit hosted backend health check:
   - `GET /health`
4. Set `EXPO_PUBLIC_PROXY_URL` to the hosted backend URL for EAS preview.
5. Build Android preview first:

```powershell
npx eas build --profile preview --platform android
```

6. iOS should go through TestFlight or registered devices later.

Important:

- Do not ship `ANTHROPIC_API_KEY`, `USDA_API_KEY`, or `GOOGLE_PLACES_API_KEY` in the app bundle.
- Only `EXPO_PUBLIC_PROXY_URL` belongs in Expo/EAS public env.
- Rotate any key that appeared in `.env`, chat, screenshots, logs, or patches before pushing/sharing/deploying.

## Security Checklist Context

Andrew provided a 50-item security audit list including exposed envs, hardcoded keys, weak auth, missing authorization, open DB permissions, verbose errors, XSS, SSRF, rate limits, prompt injection, excessive DB permissions, missing audit logs, missing backups, exposed dashboards, weak cookies, tenant isolation, and over-trusting generated code.

Codex translated that into:

`SECURITY_AND_SCALE_PLAN_FOR_CLAUDE.md`

Security status now:

Good progress:

- `.env` is ignored.
- `.env.example` exists.
- client API URL is centralized.
- backend has security headers, CORS config, rate limits, safer errors.
- `/scrape-menu` has basic SSRF hardening.
- AI parse/timeout handling is safer.
- Zod validation now covers the major public backend endpoints.
- Prompt-injection guardrails now cover user/menu/site-text AI prompts.

Still open before outside beta:

- rotate exposed keys
- deploy backend and set secrets on host
- set hosted `EXPO_PUBLIC_PROXY_URL`
- real-device smoke tests
- decide whether `/scrape-menu` remains enabled
- decide whether Zod validation should be extracted into separate modules as the backend grows
- dependency advisory / Expo SDK upgrade plan
- auth/authorization only when cloud user data is introduced
- audit logging/monitoring/backups before real user data

## Known Product Gaps

- HealthKit integration is still a stub.
- No cloud sync/user accounts yet.
- No real auth/authorization model yet.
- Dining hall GPS and provider behavior need real-device testing.
- DineOnCampus access can be unreliable from server-side environments.
- CS50/Harvard recipe fetches can be chatty.
- Chain restaurant data should eventually have clearer source/verification labeling.

## Suggested Immediate Next Actions For Claude

1. Review all uncommitted changes:

```powershell
git -c safe.directory=C:/Users/arb11/Projects/dininglens -C C:\Users\arb11\Projects\dininglens status --short
git -c safe.directory=C:/Users/arb11/Projects/dininglens -C C:\Users\arb11\Projects\dininglens diff --stat
```

2. Run:

```powershell
npm run check
npm run audit:prod
```

3. Decide commit structure. Suggested commits:

- security/backend hardening
- deploy/EAS scaffolding
- handoff/docs

4. Rotate exposed keys before pushing/sharing.

5. Deploy backend using `render.yaml` or `Dockerfile`.

6. Replace EAS placeholder URL with the hosted backend URL.

7. Build Android preview and test on a real phone.

8. Report back to Andrew/Codex with:

- hosted backend URL
- whether `/health` works
- whether Android preview build succeeded
- which real-device flows passed/failed
- any new errors/logs

## Important Files Changed/Added By Latest Codex Pass

Code/config:

- `server/index.js`
- `src/config/api.ts`
- `src/services/visionService.ts`
- `src/services/restaurantService.ts`
- `src/screens/AIChatScreen.tsx`
- `src/screens/CameraScreen.tsx`
- `src/screens/DashboardScreen.tsx`
- `src/screens/EstimateScreen.tsx`
- `src/screens/GoalsScreen.tsx`
- `src/screens/SearchScreen.tsx`
- `package.json`
- `package-lock.json`
- `eas.json`
- `render.yaml`
- `Dockerfile`
- `.dockerignore`
- `.env.example`

Docs/handoff:

- `CLAUDE_HANDOFF.md`
- `CODEX_SECURITY_TAKEOVER_2026-06-07.md`
- `DEPLOYMENT_PREVIEW.md`
- `CODEX_REENTRY_PROMPT.md`
- `CLAUDE_WORK_AUDIT_2026-06-06.md`
- `SECURITY_AND_SCALE_PLAN_FOR_CLAUDE.md`
- `CODEX_SUPERVISOR_NOTES.md`
- `CODEX_WORKING_TREE.patch`

## If Handing Back To Codex

Give Codex:

- this context packet
- current `git status --short`
- current `git diff --stat`
- any deployment URL/build errors
- `CLAUDE_HANDOFF.md`
- `CODEX_SECURITY_TAKEOVER_2026-06-07.md`
- `DEPLOYMENT_PREVIEW.md`
