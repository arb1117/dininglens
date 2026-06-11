# Security Checklist

Current security posture for DiningLens. Update this file when controls are
added, changed, or verified. Mark items complete only when they are live in
production, not just in local dev.

---

## Route entitlement perimeter

Verified against `server/index.js` on 2026-06-10 (commit df3af77) and exercised
by `scripts/smoke-backend.ps1`. The identity middleware runs globally, so every
route sees `req.actor`; `requireActiveEntitlement` returns **401** for anonymous
actors (missing/malformed `X-DiningLens-Install-Id`) and **403** for expired
trials.

| Route | Public? | Middleware | Cost-bearing? | Without install ID |
|---|---|---|---|---|
| `GET /health` | Yes | none | No | 200 |
| `GET /entitlements/me` | Identity-only | inline anonymous check | No | 401 |
| `POST /analyze` | No | largeJsonBody, aiLimiter, requireActiveEntitlement | Yes (Claude vision) | 401 |
| `POST /reanalyze` | No | largeJsonBody, aiLimiter, requireActiveEntitlement | Yes (Claude vision) | 401 |
| `POST /lookup-nutrition` | No | smallJsonBody, lookupLimiter, requireActiveEntitlement | Yes (USDA + Claude fallback) | 401 |
| `POST /lookup` | No | smallJsonBody, aiLimiter, requireActiveEntitlement | Yes (Claude) | 401 |
| `GET /search` | No | aiLimiter, requireActiveEntitlement | Yes (USDA + Claude fallback) | 401 |
| `POST /detect-restaurant` | No | smallJsonBody, detectRestaurantLimiter, requireActiveEntitlement | Yes (Google Places ×2) | 401 |
| `POST /scrape-menu` | No | smallJsonBody, scrapeLimiter, requireActiveEntitlement + `SCRAPE_MENU_ENABLED` flag + per-actor scrape quota + cache | Yes (fetch + Claude) | 401 |
| `GET /barcode` | No | barcodeLimiter, requireActiveEntitlement | Yes (Open Food Facts) | 401 |
| `POST /estimate-exercise` | No | smallJsonBody, aiLimiter, requireActiveEntitlement | Yes (Claude) | 401 |
| `POST /chat` | No | smallJsonBody, aiLimiter, requireActiveEntitlement, requireCoachQuota | Yes (Claude) | 401 |
| `POST /calculate-tdee` | No | smallJsonBody, aiLimiter, requireActiveEntitlement | Yes (Claude; deprecated, see KI-013) | 401 |
| `POST /interpret-quantity` | No | smallJsonBody, aiLimiter, requireActiveEntitlement | Yes (Claude) | 401 |

Invariants to preserve:

- Only `/health` is freely public.
- `/entitlements/me` requires a stable install ID but **not** an active
  entitlement — an expired user must still be able to learn they are expired.
- Every cost-bearing route requires an active entitlement.
- `/chat` additionally consumes the daily coach quota (pre-decremented).
- `/scrape-menu` additionally honors the `SCRAPE_MENU_ENABLED` kill switch,
  the per-actor scrape quota, and the in-memory scrape cache.
- Re-verify this table with `npm run smoke:backend` after any route change.

---

## What is done

### Input validation

- [x] **Zod schemas on all POST/GET routes** (`server/index.js`)
  All request bodies and query parameters are parsed through Zod schemas before
  use. Invalid requests receive a 400 with sanitized error messages; raw Zod
  error details are included only for development debugging.

- [x] **Body size limits per route**
  `/analyze` and `/reanalyze` accept up to 16 MB (base64 image). All other JSON
  routes are capped at 100 KB. Prevents memory exhaustion from oversized payloads.

- [x] **String length caps in schemas**
  User-supplied strings (food names, feedback, chat messages) are capped at
  200–2000 characters. AI history is capped at 20 messages × 4000 chars each.
  Menu item arrays are capped at 200 items.

### Rate limiting

- [x] **Global rate limiter** — 300 requests / 15 min per IP (`express-rate-limit`)
- [x] **Per-route AI limiter** — 40 requests / 15 min (covers `/analyze`, `/reanalyze`,
  `/lookup`, `/search`, `/chat`, `/calculate-tdee`, `/interpret-quantity`,
  `/estimate-exercise`)
- [x] **Scrape limiter** — 12 requests / hour (covers `/scrape-menu`)
- [x] **Restaurant detection limiter** — 20 requests / 15 min (covers `/detect-restaurant`,
  which makes two Google Places API calls)
- [x] **Lookup/barcode limiters** — 60 requests / 15 min each
- [x] **`trust proxy: 1`** set so Render's `X-Forwarded-For` is used as the real IP.
  Without this, all requests appear to come from the same Render internal IP and
  rate limiting is ineffective.

### Authentication and identity

- [x] **Install ID enforcement** — all protected routes require a valid
  `X-DiningLens-Install-Id` header. Requests without it receive 401.
  The header value is validated against `/^[a-zA-Z0-9_\-]{1,80}$/` before use.
  (`server/middleware/identity.js`, `server/middleware/requireActiveEntitlement.js`)

- [x] **Per-actor coach quota** — daily chat messages are capped per install ID.
  Quota is pre-decremented before the AI call to prevent retry abuse.
  (`server/middleware/requireCoachQuota.js`)

- [x] **Per-actor scrape quota** — daily scrape calls are capped per install ID.
  (`server/services/entitlementService.js`)

- [x] **Entitlement enforcement** — expired trials receive 403. Anonymous actors
  (missing or malformed install ID) receive 401.

### Transport and headers

- [x] **Helmet** — sets standard security headers: `X-Content-Type-Options`,
  `X-Frame-Options`, `Strict-Transport-Security`, `X-DNS-Prefetch-Control`,
  `Referrer-Policy`, etc.

- [x] **CORS** — controlled via `CORS_ORIGINS` environment variable.
  If the variable is empty, all origins are allowed (acceptable for beta while
  the API is only called from a native mobile app, which sends no `Origin` header).
  Tighten before adding a web client.

- [x] **HTTPS-only on the backend** — Render terminates TLS; the Express app is
  only reachable via HTTPS in production.

### SSRF protection

- [x] **`assertPublicHttpsUrl()` in `/scrape-menu`** (`server/index.js`)
  Before fetching a user-supplied URL:
  1. Validates URL parses without error.
  2. Rejects non-HTTPS schemes.
  3. Rejects `localhost` and `.local` hostnames.
  4. Resolves all DNS A/AAAA records; rejects if any address is in a private,
     loopback, link-local, multicast, or reserved range.
  5. Checks the final URL **after redirects** to block redirect chains to internal hosts.

- [x] **Max scrape page size** — 500 KB. Responses larger than this are rejected
  before the HTML is parsed. (`MAX_SCRAPE_BYTES = 512 * 1024`)

- [x] **Scrape AbortSignal timeout** — 8 seconds. Prevents the server from hanging
  on slow external hosts.

### Prompt injection defense

- [x] **`INJECTION_GUARD` prefix on all prompts that include user input**
  All Claude calls that incorporate user-supplied text or scraped content
  prepend a system instruction telling the model to ignore embedded instructions.
  Applied to: `/analyze`, `/reanalyze`, `/scrape-menu`, `/lookup`, `/search`,
  `/interpret-quantity`, `/estimate-exercise`, `/chat`.
  (`server/services/aiProvider.js`)

- [x] **Chat context is typed** — the `chatSchema` Zod schema strips unknown keys
  from the `context` object. Only `todayLog`, `goals`, `water`, `exercise`, and
  `streak` are forwarded to Claude. Arbitrary keys are dropped.

### AI response validation

- [x] **`validateAnalysisResult()` sanitizes Claude output** — numeric fields are
  clamped to sane ranges (calories max 5000 per item, macros max 500g,
  portionMultiplier 0.1–5.0). Items with empty names or suspicious calorie values
  are dropped. String fields are truncated to 200 characters.
  (`server/services/aiProvider.js`)

### Dependency management

- [x] **`npm run audit:prod`** — audits only production dependencies
  (`npm audit --omit=dev`). Dev-only vulnerabilities are excluded.
  Run this before every deploy.

- [x] **`.dockerignore` and `.gitignore`** — exclude `node_modules`, `.env`,
  server logs, and build artifacts from image builds and version control.

### AbortSignal timeouts

- [x] **All external HTTP calls** use `AbortSignal.timeout(N)`:
  - Anthropic SDK: 25 s + 1 retry on transient errors
  - DineOnCampus API: inherits `fetch` default
  - Google Places: 8 s
  - Website scrape: 8 s
  - Open Food Facts: 10 s

---

## What is pending

### Authentication upgrade

- [ ] **Supabase JWT auth** — replace anonymous install IDs with verified JWT tokens
  (magic link or Apple Sign-In). Until this is done, any client that knows a valid
  install ID can use that actor's entitlements. Low risk for beta (install IDs are
  device-local UUIDs not shared publicly), but unacceptable for production at scale.

### Billing security

- [ ] **RevenueCat webhook signature verification** — the `/webhooks/revenuecat`
  route does not exist yet. When it is added, it must verify the
  `X-RevenueCat-Signature` HMAC header before updating any entitlement. Never
  trust webhook payloads without verification.

- [ ] **Server-side entitlement source of truth** — the client-side
  `billingService.ts` must never be the authority on paid status. All billing
  state must flow through the server. (Currently enforced because billing is
  disabled; critical to maintain when RevenueCat is added.)

### Repository hygiene

- [ ] **Make the repository private** — the repo is currently public on GitHub.
  It does not contain secrets (`.env` is gitignored; API keys are in Render
  environment variables), but a private repo reduces attack surface and prevents
  competitors from reading business logic.

- [ ] **Rotate the GitHub PAT** — if the git remote was ever configured with a
  PAT embedded in the URL, rotate it before the first public beta. Check with:
  `git remote get-url origin`

### CORS tightening

- [ ] **Set `CORS_ORIGINS` in Render dashboard** — currently unset (allows all
  origins). Set it to a specific value once a web client is added. For mobile-only,
  leaving it empty is acceptable (native apps don't send `Origin`).

### Monitoring and alerting

- [ ] **Error rate alerting** — no alerts are configured. A spike in 5xx errors
  (e.g. ANTHROPIC_API_KEY revoked, Render out of memory) is only visible in logs.
  Add Render's built-in health check alerting at minimum.

- [ ] **Log scrubbing audit** — verify that install IDs are not logged in
  plaintext in production logs. Current code logs `req.requestId` (a short
  random string), not the install ID itself. Confirm this is still true after
  any future logging changes.

### Missing security tests

- [ ] **SSRF test cases** — no automated tests for `assertPublicHttpsUrl()`.
  A regression could re-open SSRF. Add unit tests covering: private IPv4 ranges,
  IPv6 loopback, `.local` hostnames, redirect-to-internal, non-HTTPS URLs.

- [ ] **Rate limit integration test** — no test verifies the limiter kicks in at
  the configured threshold.

---

## Security contacts

- For suspected vulnerabilities in the live backend, email the developer directly.
- Do not post security issues in public GitHub issues.
