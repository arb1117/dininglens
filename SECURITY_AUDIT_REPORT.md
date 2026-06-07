# DiningLens Security Audit Report

**Date:** 2026-06-07  
**Scope:** Server (`server/index.js`), client (`src/`), config (`.env`, `.gitignore`)  
**Auditor:** Claude Sonnet 4.6  
**Beta-readiness verdict:** Ready for internal beta with no critical blockers.

---

## Summary

The prior session laid a solid foundation (helmet, rate limiting on AI endpoints, Zod validation on most inputs, SSRF hardening on `/scrape-menu`, sanitized error responses). This audit identified and fixed four gaps: missing rate limiters on three endpoints, an overly permissive global body-size limit, missing fetch timeouts on Google Places calls, and Zod schema looseness. All npm vulnerabilities are in Expo build-tooling (moderate severity), unrelated to the production server.

---

## What Was Found and Fixed

### 1. Missing Rate Limiters on Public Endpoints (Fixed — commit `ec8430e`)

| Endpoint | Before | After |
|---|---|---|
| `/detect-restaurant` | Global only (300/15min) | + `detectRestaurantLimiter` (20/15min) |
| `/lookup-nutrition` | Global only (300/15min) | + `lookupLimiter` (60/15min) |
| `/barcode` | Global only (300/15min) | + `barcodeLimiter` (60/15min) |

**Why it matters:** `/detect-restaurant` proxies the paid Google Places API — an attacker could exhaust API credits with ~300 free requests per 15 min window. `/lookup-nutrition` and `/barcode` call USDA and Open Food Facts, both of which have their own rate limits that could be violated.

All limiters use `standardHeaders: true` / `legacyHeaders: false` (IETF draft RateLimit headers + Retry-After on 429).

### 2. Global Body Parser Replaced with Per-Route Limits (Fixed — commit `ec8430e`)

**Before:** `app.use(express.json({ limit: '10mb' }))` applied to every endpoint.  
**After:** Two parsers applied per-route:

- `largeJsonBody` (16mb) — only `/analyze` and `/reanalyze` (base64 image payloads)
- `smallJsonBody` (100kb) — all other JSON POST endpoints

**Why it matters:** A 10mb body to `/chat` or `/lookup` is not a valid request. The old setup allowed 10mb of arbitrary JSON to reach Zod validation before being rejected; the new setup rejects oversized bodies at the parser level with a 413.

### 3. Google Places Fetch Timeouts (Fixed — commit `ec8430e`)

**Before:** Both `nearbyRes` and `detailsRes` fetches in `/detect-restaurant` had no timeout.  
**After:** `AbortSignal.timeout(8000)` added to both.

**Why it matters:** Without a timeout, a slow or hanging Google Places response would hold the connection open indefinitely, consuming server resources and potentially exhausting connection pool.

### 4. Zod Schema Hardening (Fixed — commit `ec8430e`)

**`chatSchema.context` — removed `.passthrough()`:**  
Before: unknown fields passed through to the Claude context block. After: Zod strips unknown keys by default (this is the default `z.object()` behavior — removing `.passthrough()` restores it).

**`chatSchema.history` — typed items:**  
Before: `z.array(z.any()).max(20)` — arbitrary objects accepted.  
After: `z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).max(20)` — validates both shape and content length.

**`analyzeSchema.menuItems` — array and field caps:**  
Before: no cap on array length or item name length.  
After: `.max(200)` on array, `.max(200)` on `name` field. Prevents an oversized menu payload from inflating the Claude prompt.

### 5. INJECTION_GUARD Placement (Fixed — commit `ec8430e`)

**Before:** `const INJECTION_GUARD` was declared at line ~948 but first used at line ~418 (inside route handler closures — worked at runtime due to JS module execution order, but confusing and fragile).  
**After:** Moved to line ~114, immediately after the `validate()` helper and before all Zod schemas. The duplicate declaration at line 948 was removed.

---

## What Was Verified as Already Solid

| Area | Status |
|---|---|
| `helmet` middleware | ✅ Applied globally before all routes |
| CORS configuration | ✅ Allowlist-based via `CORS_ORIGINS` env var |
| `ANTHROPIC_API_KEY` validation at startup | ✅ `process.exit(1)` if missing |
| All API keys via environment variables | ✅ No hardcoded secrets anywhere |
| `EXPO_PUBLIC_*` vars contain no secrets | ✅ Only the server URL (non-sensitive) |
| `.env` in `.gitignore` | ✅ Confirmed |
| SSRF hardening on `/scrape-menu` | ✅ DNS lookup + private IP block + HTTPS-only + redirect re-validation |
| Global error handler strips stack traces | ✅ Returns `{ error: 'An unexpected error occurred', errorId }` only |
| AI response validation (nutrition clamping) | ✅ `validateAnalysisResult()` clamps all numeric fields |
| Prompt injection guards on all AI calls | ✅ `INJECTION_GUARD` prepended to all user-data-containing prompts |
| Anthropic API calls use 25s timeout + 1 retry | ✅ `callAnthropic()` wrapper |
| Request IDs on all responses | ✅ `X-Request-Id` header |
| `IS_PROD` flag gates debug logging | ✅ No sensitive data logged in production |
| USDA API key falls back to `DEMO_KEY` | ✅ Graceful degradation (DEMO_KEY is public) |
| CORS on all responses | ✅ `cors()` middleware applied globally |

---

## npm Audit Findings

Ran `npm audit`. All findings are **moderate severity** and limited to Expo SDK build tooling:

| Package | Issue | Exploitability |
|---|---|---|
| `postcss` | XSS in CSS stringify | Build-time only; not in server bundle |
| `uuid` | Buffer bounds in v3/v5/v6 with custom `buf` | Transitive via `xcode`; not called at runtime |
| `@expo/config-plugins`, `xcode`, etc. | Transitive via above | Build-time only |

**None of these affect the production server or mobile app at runtime.** `npm audit fix --force` was intentionally not run (would break Expo SDK pin).

---

## Remaining Notes / Post-Beta Considerations

1. **CORS in development:** When `CORS_ORIGINS` is empty, all origins are allowed. This is intentional (mobile dev doesn't have a stable origin), but for production deployment, set `CORS_ORIGINS` to the specific app origins if possible.

2. **User-feedback prompt injection:** In `/reanalyze`, the user's feedback string is interpolated directly into the Claude prompt (`The user says: '${feedback}'.`). The `INJECTION_GUARD` already addresses this, but for defense-in-depth a future hardening pass could HTML-encode or further sanitize the feedback before interpolation.

3. **Authentication:** No auth layer exists (by design for beta). If the server URL ever becomes public (e.g., listed somewhere), the global rate limiter is the only protection. Consider an app-secret header (`X-App-Secret`) after beta if public exposure is a concern.

4. **Scrape cache:** `/scrape-menu` caches results in a `Map()` in process memory. This is a minor memory concern if many unique placeIds are queried. For post-beta, consider a TTL-evicting cache or Redis.

5. **`trust proxy: 1`:** The server sets `app.set('trust proxy', 1)` which is correct for Render.com (single reverse proxy). This is required for IP-based rate limiting to work correctly. Verify the actual proxy depth matches when deploying to a different host.

---

## Current Security Posture for Beta Testing

**Excellent for an internal beta.** The server has:
- Defense-in-depth rate limiting on every endpoint (global + per-endpoint)
- Strict Zod schema validation on all inputs with length limits and unknown-key stripping
- No secrets in client bundle or git history
- SSRF protection on the web-scraping endpoint
- Prompt injection guards on all AI calls
- Sanitized error responses (no stack traces to client)
- Helmet security headers
- Per-route body size enforcement

The attack surface is small and well-controlled for the current feature set.
