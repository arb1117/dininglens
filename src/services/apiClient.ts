import { API_BASE_URL } from '../config/api';
import { getInstallId } from './identityService';

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const installId = await getInstallId();
  const existingHeaders = (options.headers ?? {}) as Record<string, string>;
  const headers: Record<string, string> = {
    ...existingHeaders,
    'X-DiningLens-Install-Id': installId,
  };
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}
