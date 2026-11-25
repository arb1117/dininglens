import { MenuItem, capMenu } from './menuService';
import { apiFetch } from './apiClient';

export type DetectedItem = {
  name: string;
  portionMultiplier: number;
  confidence: number;
  estimatedQuantityGrams?: number;
  estimatedQuantity?: string;
  // Dining-hall / restaurant mode: number of menu servings visible
  servings?: number;
  // Generic mode only
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  // Structured quantity — new fields returned by updated AI prompt
  quantity?: number;
  unit?: string;
  count?: number;
  sizeDescription?: string;
  servingDescription?: string;
};

export type AnalysisResult = {
  detectedItems: DetectedItem[];
  mode: 'dining_hall' | 'generic';
  reason?: 'image_quality' | 'low_confidence' | 'no_food' | 'parse_error' | 'timeout';
};

export type AnalysisErrorKind = 'trial_expired' | 'rate_limited' | 'too_large' | 'timeout' | 'server' | 'network';

export class AnalysisError extends Error {
  constructor(public kind: AnalysisErrorKind, message: string) {
    super(message);
    this.name = 'AnalysisError';
  }
}

const CLIENT_TIMEOUT_MS = 45_000;

export function describeAnalysisError(err: unknown): string {
  const kind = err instanceof AnalysisError ? err.kind : 'network';
  switch (kind) {
    case 'trial_expired': return 'Your free trial has ended — photo analysis is unavailable.';
    case 'rate_limited':  return 'Too many requests — wait a few minutes and try again.';
    case 'too_large':     return 'That photo is too large to analyze — try another one.';
    case 'timeout':       return 'Analysis took too long — check your connection and try again.';
    case 'server':        return 'The analysis server had a problem — try again shortly.';
    default:              return "Couldn't reach the analysis server — check your connection and try again.";
  }
}

export async function analyzeImage(
  imageBase64: string,
  menuItems?: MenuItem[]
): Promise<AnalysisResult> {
  // AbortSignal.timeout is not reliably available in React Native's runtime.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await apiFetch('/analyze', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, menuItems: menuItems ? capMenu(menuItems) : undefined }),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) throw new AnalysisError('timeout', 'Client timeout');
    throw new AnalysisError('network', err instanceof Error ? err.message : 'Network error');
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // Pass through structured error bodies (e.g. timeout with reason field)
    if (Array.isArray(data?.detectedItems)) {
      return data as AnalysisResult;
    }
    if (response.status === 403) throw new AnalysisError('trial_expired', 'Trial expired');
    if (response.status === 429) throw new AnalysisError('rate_limited', 'Rate limited');
    if (response.status === 413) throw new AnalysisError('too_large', 'Image too large');
    throw new AnalysisError('server', `Server error: ${response.status}`);
  }

  if (!Array.isArray(data?.detectedItems)) {
    throw new AnalysisError('server', 'Unexpected response shape from server');
  }

  return data as AnalysisResult;
}
