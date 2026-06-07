import { MenuItem } from './menuService';
import { API_BASE_URL } from '../config/api';

export type DetectedItem = {
  name: string;
  portionMultiplier: number;
  confidence: number;
  estimatedQuantityGrams?: number;
  estimatedQuantity?: string;
  // Generic mode only
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export type AnalysisResult = {
  detectedItems: DetectedItem[];
  mode: 'dining_hall' | 'generic';
  reason?: 'image_quality' | 'low_confidence' | 'no_food' | 'parse_error' | 'timeout';
};

export async function analyzeImage(
  imageBase64: string,
  menuItems?: MenuItem[]
): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, menuItems }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // Pass through structured error bodies (e.g. timeout with reason field)
    if (Array.isArray(data?.detectedItems)) {
      return data as AnalysisResult;
    }
    throw new Error(`Server error: ${response.status}`);
  }

  if (!Array.isArray(data?.detectedItems)) {
    throw new Error('Unexpected response shape from server');
  }

  return data as AnalysisResult;
}
