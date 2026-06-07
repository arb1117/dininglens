const RENDER_URL = 'https://dininglens-api.onrender.com';

const configuredUrl = (
  process.env.EXPO_PUBLIC_PROXY_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  RENDER_URL
).replace(/\/+$/, '');

export const API_BASE_URL = configuredUrl;
