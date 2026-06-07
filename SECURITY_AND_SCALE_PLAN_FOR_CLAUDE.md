# DiningLens Security, Backend, and UI Plan for Claude

Prepared by Codex on 2026-06-06.

This is a practical action plan for Claude to use before DiningLens is shared with outside testers. Andrew supplied a 50-item security audit list covering common vulnerabilities in vibe-coded / AI-generated apps. Codex also discussed backend offloading, AI provider ownership, and UI polish. This file combines those into an execution plan.

## Guiding principles

- Treat the mobile app as untrusted. Anything shipped to the phone can be inspected or modified.
- Keep provider secrets on the backend only.
- Keep authorization server-side or database-side, not only in React Native screens.
- Add security before public beta, not after real user data exists.
- Prefer simple infrastructure first: hosted Express backend, managed secrets, EAS preview builds, then database/auth when needed.
- AI should suggest; users should confirm; the app should store reviewed results.
- Build provider flexibility into the backend so Anthropic, OpenAI, or self-hosted Llama can be swapped without rewriting the app.

## Immediate red flags in current project state

1. `.env` has contained real-looking API keys. Rotate them before sharing the repo, pushing to a remote, or giving the app to testers.
2. Several client files fall back to a hardcoded LAN URL: `http://192.168.1.71:3001`. Replace this with a clean environment/config strategy before beta.
3. The app currently has no real account/auth model, so multi-user data security is not ready. Local-only data is acceptable for a private prototype, but not for cloud sync or social/beta use.
4. The Express backend needs production middleware and hardening before it is deployed publicly.

## Phase 0: Secret cleanup before anything public

Claude should do this first.

1. Confirm `.env` is ignored by git.
2. Search the entire repo and commit history for secrets:
   - `rg -n "sk-|ANTHROPIC|OPENAI|GOOGLE|USDA|SUPABASE|FIREBASE|SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY" .`
   - `git log -p --all -S "ANTHROPIC_API_KEY"`
   - `git log -p --all -S "GOOGLE_PLACES_API_KEY"`
   - `git log -p --all -S "USDA_API_KEY"`
3. Rotate any API key that appeared in `.env`, logs, screenshots, patches, chat, or git history.
4. Create `.env.example` with placeholder names only:
   - `ANTHROPIC_API_KEY=`
   - `USDA_API_KEY=`
   - `GOOGLE_PLACES_API_KEY=`
   - `EXPO_PUBLIC_PROXY_URL=`
5. Keep only public, non-secret values in `EXPO_PUBLIC_*`. In Expo, `EXPO_PUBLIC_` values are embedded for client use and must not contain secrets.
6. If using EAS, define separate development, preview, and production environments.

Security items covered: 1, 2, 3, 11, 13, 14, 37, 38, 50.

## Phase 1: Backend deployability and production hardening

Target: make DiningLens usable outside Andrew's home WiFi without exposing secrets.

1. Host the Express backend first on a simple Node-friendly platform:
   - Render, Railway, Fly.io, or a VPS.
   - Keep Vercel/Cloudflare Workers for later unless the server is adapted to their runtime model.
2. Add `server/.env.example` if backend config becomes separate from app config.
3. Make the app consume one configured public backend URL:
   - Development: local LAN or tunnel URL.
   - Preview: hosted staging backend.
   - Production: hosted production backend.
4. Add basic production middleware to `server/index.js`:
   - `helmet` for security headers.
   - strict JSON body size limits per endpoint.
   - request ID middleware.
   - safe centralized error handler.
   - disable stack traces and raw provider errors in client responses.
5. Add strict CORS:
   - Do not use open wildcard CORS for authenticated production APIs.
   - Allow only known preview/production app origins or avoid browser-dependent auth until a web client exists.
6. Add rate limits:
   - Global API limit.
   - Stricter limits on `/analyze`, `/reanalyze`, `/chat`, `/estimate-exercise`, `/calculate-tdee`.
   - Future strict limits on login/signup/password reset.
7. Add deployment health endpoints:
   - `/healthz`: no secrets, no provider calls.
   - `/readyz`: optional dependency checks, still no secrets.
8. Add logging that redacts:
   - API keys
   - auth tokens
   - emails
   - passwords
   - raw images
   - private user nutrition/chat data unless explicitly needed and consented.

Security items covered: 4, 9, 10, 11, 12, 16, 21, 23, 27, 28, 29, 30, 35, 43, 45, 46, 47.

## Phase 2: API validation and abuse controls

Target: every endpoint validates input and returns safe, predictable errors.

1. Add schema validation with `zod` or a similar library.
2. Validate request bodies for:
   - `/analyze`
   - `/reanalyze`
   - `/chat`
   - `/search`
   - `/lookup`
   - `/barcode`
   - `/detect-restaurant`
   - `/scrape-menu`
   - `/calculate-tdee`
   - `/estimate-exercise`
3. Reject oversized, malformed, or unexpected fields.
4. Validate URL inputs for menu scraping:
   - Allow only `https`.
   - Block private IP ranges and localhost.
   - Block redirects to private IPs.
   - Add timeout and maximum response size.
   - Consider removing `/scrape-menu` from public beta if it is not essential.
5. For image upload/base64 analysis:
   - Restrict max size.
   - Restrict supported mime types.
   - Do not store raw images by default.
6. Make error responses generic:
   - Client sees stable messages and error codes.
   - Server logs internal details with redaction.

Security items covered: 12, 16, 19, 21, 22, 23, 28, 35.

## Phase 3: AI safety and provider abstraction

Target: AI features are reliable, swappable, and harder to abuse.

1. Create a backend service layer:
   - `server/services/aiService.js`
   - provider modules such as `anthropicProvider.js`, later `openaiProvider.js`, later `llamaProvider.js`.
2. Keep mobile endpoints stable:
   - `/analyze`
   - `/reanalyze`
   - `/chat`
   - `/estimate-exercise`
   - `/calculate-tdee`
3. Validate model output before returning it to the app:
   - no missing macro fields
   - numeric ranges sane
   - no arbitrary text where JSON is expected
   - explicit handling for `no_food`, `low_confidence`, and provider failure
4. Add AI-specific rate limits and cost limits.
5. Add prompt-injection guardrails:
   - Treat dining hall menus, restaurant pages, barcode names, and user text as untrusted context.
   - Tell the model not to follow instructions from menu/content snippets.
   - Never let AI choose which private records a user may access.
6. If tools/actions are added later, enforce permission checks before tool execution.
7. If self-hosting Llama later:
   - Keep it behind the DiningLens API, not exposed directly to clients.
   - Add request queueing, timeouts, health checks, and fallback provider behavior.

Security items covered: 28, 35, 39, 40, 50.

## Phase 4: Authentication, authorization, and user data

Do not add cloud accounts until these rules are planned.

1. Pick one auth/database path when ready:
   - Supabase is a strong prototype choice because it provides auth, Postgres, storage, and admin UI.
   - Firebase can also work, but rules must be reviewed carefully.
2. Every cloud table/document must have an owner model:
   - `user_id`
   - optional `household_id` / `team_id` only if intentionally shared
   - timestamps
3. Never trust user-controlled IDs from the client.
4. Enforce object ownership on every read/update/delete.
5. If Supabase is used:
   - enable RLS on every exposed table
   - create `select`, `insert`, `update`, and `delete` policies
   - use `auth.uid() = user_id` style ownership checks
   - never ship the service role key to the app
6. If Firebase is used:
   - default deny
   - write explicit rules for each collection/path
   - test rules before beta.
7. Add authorization tests:
   - user A cannot read user B meals
   - user A cannot edit/delete user B meals
   - user A cannot access another user's image/storage path
   - admin-only endpoints reject normal users.

Security items covered: 4, 5, 6, 7, 8, 15, 24, 25, 26, 32, 33, 34, 41, 49.

## Phase 5: Storage, uploads, logs, and privacy

Target: avoid leaking sensitive nutrition, health, and image data.

1. Default to not storing raw food photos.
2. If image storage is added:
   - use private buckets by default
   - per-user object paths
   - signed URLs with short expiry
   - file size and mime checks
   - malware/content scanning if public upload/sharing exists later.
3. Encrypt sensitive data at rest through the managed database/storage provider.
4. Add a retention policy:
   - raw images: none or very short retention
   - logs: short and redacted
   - user nutrition history: user-controlled export/delete later.
5. Add backups before real user data:
   - database backup schedule
   - restore rehearsal
   - backup access limited to maintainers.

Security items covered: 8, 21, 35, 42, 44, 48.

## Phase 6: Frontend and UI polish

Target: make the app feel like a polished prototype while security work proceeds.

1. Pick one UI system instead of styling every screen independently:
   - Conservative path: React Native Paper.
   - More ambitious path: Tamagui.
   - Tailwind-like path: NativeWind.
2. Keep current app structure, but start extracting reusable UI:
   - buttons
   - cards/list rows
   - empty/error states
   - loading states
   - macro chips
   - confidence labels
   - review sheet controls.
3. Use better visual feedback:
   - confidence status on AI estimates
   - dining hall context indicator
   - clean failed-network states
   - clearer portion editing.
4. Add animation only after layout is stable:
   - Reanimated for transitions/bottom sheets.
   - Skia later for dashboard charts/rings.
5. Avoid making a marketing landing page. The first screen should remain the actual app experience.

## Phase 7: Beta readiness checklist

Before Andrew gives the app to non-developer testers:

1. Backend hosted with preview URL.
2. API keys rotated and server-side.
3. `.env.example` committed; `.env` ignored.
4. `npx tsc --noEmit` passing.
5. Backend starts in production mode.
6. Rate limits active.
7. Error responses do not leak stack traces.
8. `/scrape-menu` either hardened or disabled.
9. Real-device tests completed:
   - camera photo analyze
   - no-food photo
   - manual search
   - barcode scan
   - dining hall detection
   - dashboard edit/delete/log flows
   - AI chat
   - water/exercise
10. EAS preview/internal build configured.
11. Android preview APK tested first.
12. iOS TestFlight or registered-device path planned.

## Audit mapping for Andrew's 50-item list

- Secrets and config: 1, 2, 3, 11, 13, 14, 30.
- Auth and authorization: 4, 5, 6, 15, 24, 25, 26, 32, 33, 34, 49.
- Database/storage permissions: 7, 8, 41, 44, 48.
- Admin/debug exposure: 9, 10, 29, 45.
- API validation and web attacks: 12, 16, 17, 18, 19, 20, 21, 22, 23, 27, 28, 31, 46, 47.
- Logging/privacy/monitoring: 35, 42, 43.
- Build and dependency hygiene: 36, 37, 38.
- AI-specific risks: 39, 40.
- Review discipline: 50.

## Suggested implementation order for Claude

1. Commit or stash current feature work after review.
2. Secret cleanup and `.env.example`.
3. Backend config cleanup and hosted URL strategy.
4. Add validation/rate-limit/error-handler middleware.
5. Harden or disable SSRF-prone scraping endpoint.
6. Add AI service abstraction and output validation.
7. Add EAS preview setup.
8. Pick UI system and polish existing screens.
9. Add auth/database only when Andrew is ready for cloud user data.
10. Ask Codex to audit the security diff before outside beta.

