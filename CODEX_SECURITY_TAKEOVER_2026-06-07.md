# Codex Security/Deployability Takeover - 2026-06-07

Andrew asked Codex to take over from Claude and focus on the security items plus moving the app off Andrew's local network so others can test it.

## Changes Applied

### Centralized API URL Config

- Added `src/config/api.ts`.
- Replaced repeated per-screen/per-service `SERVER_URL` constants with `API_BASE_URL`.
- Current behavior still falls back to Andrew's local LAN URL for development, but preview/production builds now only need `EXPO_PUBLIC_PROXY_URL` configured.
- Files updated:
  - `src/services/visionService.ts`
  - `src/services/restaurantService.ts`
  - `src/screens/AIChatScreen.tsx`
  - `src/screens/CameraScreen.tsx`
  - `src/screens/DashboardScreen.tsx`
  - `src/screens/EstimateScreen.tsx`
  - `src/screens/GoalsScreen.tsx`
  - `src/screens/SearchScreen.tsx`

### Backend Hardening for Public Preview

- Installed `helmet`, `cors`, and `express-rate-limit`.
- Added security headers through `helmet()`.
- Added configurable CORS allowlist through `CORS_ORIGINS`.
- Added request IDs via `X-Request-Id`.
- Added global rate limiting with `RATE_LIMIT_GLOBAL`.
- Added AI endpoint rate limiting with `RATE_LIMIT_AI`.
- Added scrape endpoint rate limiting with `RATE_LIMIT_SCRAPE`.
- Replaced several raw `err.message` responses with stable public errors.
- Moved raw AI output logs behind non-production `logDebug()`.
- Stopped logging the raw USDA API key value on server startup.

### `/scrape-menu` Hardening

- Requires HTTPS restaurant URLs.
- Blocks localhost, `.local`, private IP ranges, link-local IPs, and internal/private DNS resolutions.
- Revalidates the final URL after redirects.
- Rejects menu pages over `MAX_SCRAPE_BYTES` before/after body read where possible.
- Keeps the endpoint available, but it is now safer for preview use than before.

### AI Parse/Timeout Fallback Bug

- Extended `AnalysisResult.reason` to include `parse_error` and `timeout`.
- `EstimateScreen` now treats `parse_error` and `timeout` as error/empty states.
- AI parse failure or timeout no longer falls through to default/fallback menu items.

### Deployment Docs/Env Examples

- Added `.env.example` with placeholders only.
- Added `DEPLOYMENT_PREVIEW.md` with the recommended first outside-testing path:
  - deploy Express backend to Render/Railway/Fly.io/VPS
  - set backend secrets on the host
  - set `EXPO_PUBLIC_PROXY_URL` for Expo/EAS preview builds
  - run Android preview first, iOS via TestFlight or registered devices

## Verification

- `npx tsc --noEmit`: passed.
- `node --check server/index.js`: passed.
- `npm audit --omit=dev --json`: still reports 11 moderate advisories in Expo's dependency tree. The suggested fix points to Expo `56.0.9`, a major upgrade. Do not apply blindly during this pass; plan an Expo SDK upgrade separately.

## Remaining Before Outside Beta

1. Rotate any keys that appeared in `.env`, chat, screenshots, logs, or patches.
2. Deploy the Express backend and set hosted environment variables.
3. Set `EXPO_PUBLIC_PROXY_URL` for preview builds.
4. Run real-device smoke tests against the hosted backend.
5. Decide whether `/scrape-menu` should remain enabled for beta or be feature-flagged.
6. Add fuller request schema validation if the API will be exposed broadly.
7. Plan the Expo SDK/dependency advisory upgrade separately.

## Continued Deployability Pass

Additional work completed after the first takeover pass:

- Added `Dockerfile` for Docker-friendly backend hosting.
- Added `.dockerignore` so local env files and artifacts are not copied into Docker images.
- Added `render.yaml` for Render Blueprint/manual service setup.
- Added `eas.json` with `development`, `preview`, and `production` profiles.
- Added `npm run check` and `npm run audit:prod`.
- Updated `DEPLOYMENT_PREVIEW.md` with Render, Docker, and EAS preview instructions.
- Added a placeholder guard in `src/config/api.ts` so preview/production builds fail visibly if `EXPO_PUBLIC_PROXY_URL` is not replaced with the real hosted API URL.
- Removed Andrew's local LAN URL from shared EAS build profiles; local development still gets it through `.env` or the app's local fallback.

Verification:

- `npm run check`: passed.

## Claude Code Refresh Audit

After the Cowork context packet was first created, Claude Code committed additional backend security work through:

- `8ddd0b9 fix: parse_error/timeout treated as error states, not menu fallback`
- `1731836 refactor: centralize API URL config in src/config/api.ts`
- `42e1971 feat: backend hardening — helmet, rate limiting, safe error handler, request size limits, raw error leak fixes`
- `0211a1a fix: harden /scrape-menu against SSRF — URL allowlist, max response size`
- `8978b8c feat: zod schema validation on all public backend endpoints`
- `678988c fix: prompt injection guardrails on user-content-aware AI prompts`

Codex reviewed the work. It was directionally good, but Codex applied these follow-up fixes:

- Reconciled API URL env names: `src/config/api.ts` now accepts `EXPO_PUBLIC_PROXY_URL` and `EXPO_PUBLIC_API_URL`, preferring `EXPO_PUBLIC_PROXY_URL` to match EAS/docs.
- Fixed `chatSchema` so water/exercise AI coach context is preserved.
- Added schema validation to remaining public routes that still had ad hoc checks.
- Added prompt-injection guard text to remaining user/menu/site-text AI prompts.

Verification after the follow-up:

- `npm run check`: passed.
