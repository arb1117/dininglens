# Known Issues

Bugs, limitations, and TODOs that are tracked but not yet fixed.
Add new entries here rather than leaving TODO comments in code.

---

## Critical (blocks production launch)

### KI-001 — In-memory entitlement store resets on server restart

**File:** `server/services/entitlementService.js`

The entitlement store is a Node.js `Map` in process memory. Every Render deploy,
cold start, or server restart wipes all trial records. A user mid-trial will
have their trial reset to 14 days from the restart, not from their original
install date.

**Impact:** trial enforcement is unreliable. Users whose trials have expired
may get a fresh trial after a restart.

**Fix:** replace the `Map` with a PostgreSQL table (Supabase). Schema:
```sql
CREATE TABLE entitlements (
  install_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'trialing',
  trial_started_at TIMESTAMPTZ NOT NULL,
  trial_ends_at TIMESTAMPTZ NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  coach_usage_date DATE,
  coach_usage_count INT DEFAULT 0,
  scrape_usage_date DATE,
  scrape_usage_count INT DEFAULT 0
);
```

### KI-002 — RevenueCat not integrated; billing is a stub

**File:** `src/services/billingService.ts`

All billing methods throw or return empty data. The "Subscribe" CTA in
`src/components/PaywallPlaceholder.tsx` is intentionally disabled.

**Impact:** no revenue. Cannot convert trial users to paid.

**Fix:** see `BILLING_ARCHITECTURE.md` for the integration checklist.

### KI-003 — Supabase not integrated; no cloud sync or real auth

No Supabase client is installed. All meal data is local-only.

**Impact:** users lose all history on reinstall or device change. No
cross-device sync.

**Fix:** add `@supabase/supabase-js`, wire magic link auth or Apple Sign-In,
migrate meal log writes to Supabase, tie install ID to Supabase user record.

---

## High priority

### KI-004 — Render Starter cold starts (5–30 s)

The Render Starter plan spins down after ~15 minutes of inactivity. The first
request after spin-down takes 5–30 s. The mobile app shows a "Server starting
up, please wait…" banner via `useBackendHealth` when `/health` returns an error,
but the user still waits.

**Impact:** poor first-session experience for users who open the app after
a long gap.

**Workaround:** add a payment card to Render and upgrade to a paid plan to
eliminate spin-down. See `RELEASE_CHECKLIST.md`.

**Alternative:** implement a keep-alive ping from a free cron service (UptimeRobot).

### KI-005 — Scrape fails on JS-rendered menus

`/scrape-menu` fetches HTML with a plain `fetch()` and strips tags. Sites that
render menus via JavaScript (e.g. those using React or Angular) return an empty
page body.

**Impact:** `items: []` for most modern restaurant websites.

**Workaround:** scraping still works for sites with server-side-rendered menus.
The `SCRAPE_MENU_ENABLED` flag can disable scraping entirely if it becomes a
source of noise.

**Fix:** integrate a headless browser service (e.g. Browserless) for JS rendering.
This is cost-prohibitive on Starter tier; defer to paid plan.

### KI-006 — No RevenueCat webhook signature verification

The `/webhooks/revenuecat` route does not exist yet. When it is added, it must
verify the `X-RevenueCat-Signature` HMAC before updating entitlements. Failing
to do this allows anyone to fake a "purchase succeeded" webhook.

**File:** `server/index.js` (route to be added)

### KI-007 — GitHub PAT in git remote (if using HTTPS)

If the remote is configured with a personal access token embedded in the URL,
it should be rotated before making the repository public. See
`RELEASE_CHECKLIST.md`.

---

## Medium priority

### KI-008 — TypeScript strict mode gaps on the client

`tsconfig.json` enables `strict: true`, but several service files use `any`
casts or have incomplete type coverage:

- `menuService.ts` — `data: any` in `parseItems()` and `parseNutrient()`
- `venueService.ts` — dynamic import of `restaurantService` avoids circular deps
  but loses type inference
- Some screen files have untyped event handler parameters

**Impact:** potential runtime type errors that TypeScript would otherwise catch.

**Fix:** incremental — replace `any` with proper types as screens are edited.

### KI-009 — No automated test suite

There are no unit tests, integration tests, or snapshot tests. Verification is
entirely manual.

**Impact:** regressions are caught late. High-risk areas with no test coverage:
- `menuMatcher.ts` (tokenSimilarity threshold changes could silently break matching)
- `nutritionCalculator.ts` (formula edge cases for extreme inputs)
- `entitlementService.js` (quota reset logic)
- `assertPublicHttpsUrl()` (SSRF protection)

**Fix:** start with unit tests for the pure functions above (Jest or Vitest).

### KI-010 — Scrape cache is in-memory (resets with server)

`scrapeCache` in `server/index.js` is a `Map`. On restart, all cached scrape
results are lost. The first request for a given restaurant after a restart
triggers a live scrape and Claude call.

**Impact:** slightly higher Anthropic API costs after deploys.

**Fix:** persist scrape cache to Redis or PostgreSQL alongside the entitlement store.

### KI-011 — Coach messages sent before AI response (pre-decrement)

The `/chat` route charges a coach message before Claude returns. If Claude errors,
the message is still consumed. This is intentional (prevents retry abuse) but
can frustrate users who hit a transient error.

**Impact:** users lose a daily coach message on transient Claude errors.

**Fix:** surface a specific UI message ("Message not sent — try again, this
one won't count") if the server responds with a 5xx. Would require changing the
pre-decrement logic on the server.

### KI-012 — Barcode scan returns per-100g values for products without serving data

When Open Food Facts lacks `serving_quantity` for a product, `/barcode` defaults
to `servingGrams = 100` and reports nutrients per 100g as if it were one serving.
The serving size label reads "100g" which is confusing for packaged foods.

**File:** `server/index.js` near line 649.

### KI-013 — `calculateTDEE` server route deprecated but still present

`GoalsScreen` now calculates TDEE locally via `nutritionCalculator.ts`. The
`/calculate-tdee` server route still exists and still works. The Zod schema
was updated to accept new goal keys so it does not reject valid inputs.
The route can be removed once confirmed unused.

### KI-014 — No CORS_ORIGINS set in production

`render.yaml` does not set a value for `CORS_ORIGINS` (it is marked `sync: false`
meaning it must be set manually in the Render dashboard). Until it is set, the
server allows any origin. This is acceptable while the API is only called from
the mobile app (which does not send an `Origin` header), but should be tightened
once a web client exists.

---

## Low priority / cosmetic

### KI-015 — `FAKE_MENU` fallback shown without explanation

When a dining hall menu fetch fails (network error, DineOnCampus API down),
`fetchMenu()` silently returns `FAKE_MENU` — a five-item hardcoded list. The user
sees a menu but it does not reflect today's actual offerings. There is no
"using fallback data" banner.

### KI-016 — Venue cache does not survive app restart

`venueCache` in `venueService.ts` is a module-level variable. It resets to
`null` every time the app is cold-started. The first camera open after restart
always triggers a GPS fix.

### KI-017 — Chain menu data is static

`src/data/chainMenus.ts` contains hardcoded menu data for major chains
(McDonald's, Chipotle, Subway, etc.). This data does not update when chains
change their menus. There is no process to refresh it.

---

## Won't fix (by design)

- **No meal sync between devices** — by design until Supabase is integrated.
- **Trial timer persists only while server is running** — by design for prototype.
  Accepted tradeoff for zero-DB simplicity in beta.
- **JS-rendered restaurant websites return empty scrape** — acceptable for beta;
  fix deferred to paid tier.
