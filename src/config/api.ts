const LOCAL_DEV_PROXY_URL = 'http://192.168.1.71:3001';
const PLACEHOLDER_PROXY_URL = 'https://replace-with-your-dininglens-api.example.com';

const configuredUrl = (
  process.env.EXPO_PUBLIC_PROXY_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  LOCAL_DEV_PROXY_URL
).replace(/\/+$/, '');

if (configuredUrl === PLACEHOLDER_PROXY_URL) {
  throw new Error('EXPO_PUBLIC_PROXY_URL must be set to the hosted DiningLens API URL before building.');
}

export const API_BASE_URL = configuredUrl;
