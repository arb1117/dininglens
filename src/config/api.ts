// Dev: Andrew's local machine. Preview/prod: set EXPO_PUBLIC_API_URL in .env
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') ?? 'http://192.168.1.71:3001';
