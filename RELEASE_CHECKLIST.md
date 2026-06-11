# Release Checklist

Step-by-step checklist to go from the current codebase state to a live iOS beta.
Work through these in order; items marked with ⚠️ block subsequent steps.

---

## Phase 1 — Backend (Render)

### 1.0 Create the Render service ⚠️

As of 2026-06-10, https://dininglens-api.onrender.com returns
`x-render-routing: no-server` — the service does not exist yet (or was
deleted/suspended). Create it before anything else in this phase:

- [ ] Render dashboard → New → Blueprint → connect the repo (uses `render.yaml`)
- [ ] Confirm the service name is `dininglens-api` so the URL matches
      `https://dininglens-api.onrender.com` (the URL hardcoded in `eas.json`)
- [ ] If the name is taken, pick a new one and update `EXPO_PUBLIC_PROXY_URL`
      in `eas.json` and `.env.example` to match

### 1.1 Add a payment card to Render ⚠️

The Render Starter plan free tier spins down after inactivity (5–30 s cold starts).
Add a credit card at https://dashboard.render.com/billing to unlock the paid
Starter plan and eliminate spin-down.

- [ ] Log in to Render dashboard
- [ ] Add payment method under Billing
- [ ] Upgrade `dininglens-api` service to paid Starter ($7/mo)

### 1.2 Set required environment variables in Render ⚠️

In the Render dashboard → `dininglens-api` → Environment:

- [ ] `ANTHROPIC_API_KEY` — set to a fresh Anthropic API key
- [ ] `USDA_API_KEY` — set to your USDA FoodData Central key (or leave blank
      for `DEMO_KEY`, which has lower rate limits)
- [ ] `GOOGLE_PLACES_API_KEY` — set to your Google Cloud key with the
      Places API enabled
- [ ] `CORS_ORIGINS` — leave blank for mobile-only beta (native apps don't send
      `Origin` header); set to a specific domain if a web client is added later
- [ ] `NODE_ENV=production` — should already be set via `render.yaml`

### 1.3 Trigger a manual deploy

`render.yaml` sets `autoDeploy: false`. Deploy manually after environment
variables are set.

- [ ] Go to Render dashboard → `dininglens-api` → Manual Deploy → Deploy Latest Commit
- [ ] Watch deploy logs for: `DiningLens proxy running on :3001`
- [ ] Verify `ANTHROPIC_API_KEY: present` and no `MISSING` lines in startup log

### 1.4 Verify /health endpoint

- [ ] Open https://dininglens-api.onrender.com/health in a browser
- [ ] Response: `{"status":"ok"}`
- [ ] Response time under 500 ms (no cold start)

### 1.5 Smoke test backend routes

Run the automated entitlement smoke test first (verifies /health is public and
gated routes return 401 without an install ID, without spending AI calls):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-backend.ps1 -BaseUrl https://dininglens-api.onrender.com
```

- [ ] All 6 checks pass

Then spot-check real lookups with `curl` or an HTTP client:

```bash
# Identity check (should return 401 — no install ID)
curl -s https://dininglens-api.onrender.com/entitlements/me

# Search (should return food results)
curl -s "https://dininglens-api.onrender.com/search?q=banana" \
  -H "X-DiningLens-Install-Id: test-beta-001"

# Barcode lookup
curl -s "https://dininglens-api.onrender.com/barcode?code=0085239315507" \
  -H "X-DiningLens-Install-Id: test-beta-001"

# Entitlements (should return trialing status)
curl -s https://dininglens-api.onrender.com/entitlements/me \
  -H "X-DiningLens-Install-Id: test-beta-001"
```

- [ ] `/health` → `{"status":"ok"}`
- [ ] `/search?q=banana` → array of food results
- [ ] `/barcode` → product found or 404 (both are valid)
- [ ] `/entitlements/me` without header → 401
- [ ] `/entitlements/me` with header → trialing status JSON

---

## Phase 2 — Repository hygiene

### 2.1 Rotate the GitHub Personal Access Token (if used) ⚠️

If your git remote URL contains a PAT (`https://<token>@github.com/...`):

- [ ] Generate a new PAT at https://github.com/settings/tokens
      with `repo` scope only, expiry 90 days
- [ ] Update the remote: `git remote set-url origin https://<new-token>@github.com/arb1117/dininglens.git`
- [ ] Revoke the old PAT at https://github.com/settings/tokens

### 2.2 Make the repository private ⚠️

- [ ] Go to https://github.com/arb1117/dininglens/settings
- [ ] Scroll to "Danger Zone" → Change repository visibility → Make private
- [ ] Confirm

### 2.3 Verify .env is not in git history

```bash
git log --all --full-history -- .env
```

- [ ] Command returns no commits. If it does, follow GitHub's guide to remove
      secrets from git history before making the repo public.

---

## Phase 3 — EAS Build

### 3.1 Install EAS CLI

```bash
npm install -g eas-cli
eas login   # log in with your Expo account
```

- [ ] `eas whoami` shows your Expo username

### 3.2 Configure EAS project

```bash
eas build:configure
```

This sets `extra.eas.projectId` in `app.json` if not already present.

- [ ] `app.json` has `extra.eas.projectId` or `owner` field set

### 3.3 Build the iOS production binary

```bash
eas build --platform ios --profile production
```

- [ ] Build completes without errors on EAS servers
- [ ] `.ipa` artifact is available in the Expo dashboard

The production build profile uses `autoIncrement: true` so build numbers are
bumped automatically.

### 3.4 Verify bundle identifier

`app.json` uses `com.dininglens.app`. Confirm this matches what is registered
in App Store Connect.

- [ ] Bundle identifier in `app.json` matches App Store Connect

---

## Phase 4 — App Store Connect / TestFlight

### 4.1 Create app record in App Store Connect

- [ ] Log in to https://appstoreconnect.apple.com
- [ ] My Apps → **+** → New App
      - Platform: iOS
      - Name: DiningLens
      - Bundle ID: `com.dininglens.app`
      - SKU: `dininglens`
- [ ] App record created

### 4.2 Submit build to TestFlight ⚠️

```bash
eas submit --platform ios --profile production
```

Or manually: upload the `.ipa` from the Expo dashboard using Transporter.

- [ ] Build uploaded to App Store Connect
- [ ] Build passes App Store automated checks (no missing export compliance, etc.)
- [ ] Build is available under TestFlight tab in App Store Connect

### 4.3 Complete TestFlight metadata

- [ ] Add test information: "DiningLens is a macro tracking app. It uses AI to
      estimate calories from meal photos."
- [ ] Set "What to test" description (copy from `BETA_TEST_PLAN.md`)
- [ ] Add beta review notes: "No purchases are made. The subscription flow is
      disabled in this build."
- [ ] Submit build for Beta App Review (required for external testers)

### 4.4 Create beta tester group

- [ ] Create an external tester group: "Beta Testers"
- [ ] Add tester email addresses (invite via email)
- [ ] Set group to use the submitted build
- [ ] Testers receive TestFlight invitation email

---

## Phase 5 — Post-launch verification

### 5.1 Smoke test on a real device

Using a device that received the TestFlight invite (not the simulator):

- [ ] Install from TestFlight
- [ ] Complete onboarding
- [ ] Scan a meal photo → EstimateScreen shows results → Log Meal → Dashboard updates
- [ ] Search for a food → add it → Dashboard updates
- [ ] Open AI Coach tab → send a message → response appears
- [ ] Check /health banner does not appear (server is up)

### 5.2 Verify rate limits are working

- [ ] Send 5 /chat messages → limit message appears at 3 (trial) or 20 (paid)
- [ ] Verify reset time shown in limit message is tomorrow at midnight

### 5.3 Monitor backend logs for errors

- [ ] Watch Render logs for 5 minutes of use
- [ ] No `ERROR: ANTHROPIC_API_KEY is not set` messages
- [ ] No unhandled rejections or uncaught exceptions
- [ ] `/analyze` route logs show `items: N reason: none`

---

## Phase 6 — Deferred (before public launch)

These are not required for a closed beta but must be done before charging users.

- [ ] **Integrate RevenueCat** — see `BILLING_ARCHITECTURE.md`
- [ ] **Replace in-memory entitlement store with Supabase PostgreSQL** — see KI-001
- [ ] **Add RevenueCat webhook with HMAC signature verification** — see KI-006
- [ ] **Set CORS_ORIGINS** in Render if a web client is added — see KI-014
- [ ] **Privacy Policy and Terms of Service** — required by App Store for apps
      that collect any user data. Install IDs are collected; a privacy policy
      is required.
- [ ] **Add feedback email address** to `BETA_TEST_PLAN.md`

---

## Quick rollback procedure

If the live backend breaks after a deploy:

1. Go to Render dashboard → `dininglens-api` → Deploys
2. Find the last successful deploy
3. Click **Rollback to this deploy**
4. Verify `/health` returns `{"status":"ok"}` after rollback

The mobile app does not need to be rolled back; it falls back to showing the
"Server starting up…" banner until the backend is healthy.
