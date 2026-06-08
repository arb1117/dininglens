const RENDER_URL = 'https://dininglens-api.onrender.com';

// Local dev: set EXPO_PUBLIC_PROXY_URL in .env to point at your local server (e.g. http://192.168.x.x:3001).
// Preview / prod EAS builds: EXPO_PUBLIC_PROXY_URL is unset; the Render URL is the correct fallback.
const configuredUrl = (
  process.env.EXPO_PUBLIC_PROXY_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  RENDER_URL
).replace(/\/+$/, '');

if (__DEV__ && configuredUrl === RENDER_URL) {
  console.warn(
    '[DiningLens] EXPO_PUBLIC_PROXY_URL is not set — falling back to Render URL in dev mode. ' +
    'Add EXPO_PUBLIC_PROXY_URL=http://<your-local-ip>:3001 to .env for local development.'
  );
}

export const API_BASE_URL = configuredUrl;
