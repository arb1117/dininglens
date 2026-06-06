import { MenuItem } from './menuService';

const SERVER_URL = process.env.EXPO_PUBLIC_PROXY_URL ?? 'http://192.168.1.71:3001';

export type DetectedItem = {
  name: string;
  portionMultiplier: number;
  confidence: number;
  // Generic mode only
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export type AnalysisResult = {
  detectedItems: DetectedItem[];
  mode: 'dining_hall' | 'generic';
  reason?: 'image_quality' | 'low_confidence' | 'no_food';
};

export async function analyzeImage(
  imageBase64: string,
  menuItems?: MenuItem[]
): Promise<AnalysisResult> {
  const response = await fetch(`${SERVER_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, menuItems }),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  const data = await response.json();

  // Basic shape validation
  if (!Array.isArray(data?.detectedItems)) {
    throw new Error('Unexpected response shape from server');
  }

  return data as AnalysisResult;
}
