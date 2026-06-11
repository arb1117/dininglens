# DiningLens Preview Deployment

This is the current path to get DiningLens off Andrew's home WiFi and into outside testing.

## Backend

Deploy the existing Express server to a Node-friendly host first:

- Render
- Railway
- Fly.io
- VPS with Node 20+

Use the existing start command:

```powershell
npm run server
```

This repo now includes:

- `render.yaml` for Render Blueprint setup.
- `Dockerfile` for Docker-friendly hosts such as Fly.io, Railway, or a VPS.
- `.dockerignore` so local env files and build artifacts are not copied into the image.

Set backend environment variables on the host:

```text
NODE_ENV=production
PORT=3001
ANTHROPIC_API_KEY=...
USDA_API_KEY=...
GOOGLE_PLACES_API_KEY=...
CORS_ORIGINS=
RATE_LIMIT_GLOBAL=300
RATE_LIMIT_AI=40
RATE_LIMIT_SCRAPE=12
```

Optional entitlement/scrape tuning (server defaults shown; only set these to
override):

```text
TRIAL_DAYS=14
TRIAL_COACH_DAILY_LIMIT=3
PAID_COACH_DAILY_LIMIT=20
TRIAL_SCRAPE_DAILY_LIMIT=5
PAID_SCRAPE_DAILY_LIMIT=30
SCRAPE_MENU_ENABLED=true
SCRAPE_CACHE_TTL_HOURS=12
```

Keep `CORS_ORIGINS` empty while this is mobile-only unless a web client is deployed. If a web client is deployed, set it to a comma-separated allowlist of exact origins.

**CORS and native mobile:** the iOS app does not send an `Origin` header, so
CORS never blocks it — CORS only constrains browsers. An empty `CORS_ORIGINS`
(allow all) is acceptable for the mobile-only beta; real protection for the
API comes from the install-ID + entitlement perimeter, not CORS.

Health check:

```text
GET /health
```

Render path:

1. Create a new Blueprint from the repo or create a Web Service manually.
2. Use `render.yaml` as the baseline.
3. Set the secret env vars in Render's dashboard.
4. Deploy and copy the public service URL.

Docker path:

```powershell
docker build -t dininglens-api .
docker run --env-file .env -p 3001:3001 dininglens-api
```

Do not use Andrew's real `.env` for public sharing; set secrets in the host dashboard.

## Mobile App

Set this for local development, EAS preview builds, or production builds:

```text
EXPO_PUBLIC_PROXY_URL=https://your-hosted-dininglens-api.example.com
```

Only `EXPO_PUBLIC_PROXY_URL` belongs in the app bundle. AI, USDA, and Google keys stay on the backend.

This repo now includes `eas.json` with `development`, `preview`, and `production` profiles. Replace the placeholder `EXPO_PUBLIC_PROXY_URL` in `eas.json` or set it through EAS environment management before building. The app intentionally throws if the placeholder URL is left in place.

Useful commands:

```powershell
npm run check
npm run audit:prod
npx eas build --profile preview --platform android
```

## Before Outside Testers

1. Rotate any keys that appeared in `.env`, screenshots, logs, or chat.
2. Confirm `.env` is ignored and `.env.example` contains placeholders only.
3. Run:

```powershell
npx tsc --noEmit
npm audit --omit=dev
```

4. Verify these flows on a real phone:
   - photo analysis
   - photo upload
   - no-food/error photo
   - manual search
   - barcode lookup
   - dining hall/restaurant detection
   - AI chat
   - natural-language serving size
   - meal history edit/delete/log again

5. Build an Android preview first with EAS internal distribution. Plan iOS through TestFlight or registered devices.
