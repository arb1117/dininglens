import type { MenuItem } from '../services/menuService';
import type { DetectedItem } from '../services/visionService';

export function normalizeMenuName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(name: string): Set<string> {
  const STOP_WORDS = new Set(['with', 'and', 'or', 'in', 'on', 'a', 'the', 'of', 'to', 'fresh', 'house']);
  return new Set(
    normalizeMenuName(name)
      .split(' ')
      .filter(t => t.length > 1 && !STOP_WORDS.has(t))
  );
}

export function tokenSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  const union = ta.size + tb.size - intersection;
  return intersection / union;
}

export function findBestMenuMatch(
  name: string,
  menuItems: MenuItem[],
  threshold = 0.55
): { item: MenuItem; score: number } | null {
  const normalizedName = normalizeMenuName(name);
  const detectedTokenCount = tokenize(name).size;
  let best: { item: MenuItem; score: number } | null = null;
  for (const item of menuItems) {
    const normalizedItem = normalizeMenuName(item.name);
    const menuTokenCount = tokenize(item.name).size;
    const canUseContainment = detectedTokenCount >= 2 && menuTokenCount >= 2;
    const exactOrContained =
      normalizedName === normalizedItem ||
      (canUseContainment && (
        normalizedItem.includes(normalizedName) ||
        normalizedName.includes(normalizedItem)
      ));
    const score = exactOrContained ? 1 : tokenSimilarity(name, item.name);
    if (score >= threshold && (!best || score > best.score)) {
      best = { item, score };
    }
  }
  return best;
}

export function applyMenuMatches(
  detectedItems: DetectedItem[],
  menuItems: MenuItem[],
  threshold = 0.55
): DetectedItem[] {
  if (menuItems.length === 0) return detectedItems;
  return detectedItems.map(detected => {
    const match = findBestMenuMatch(detected.name, menuItems, threshold);
    if (!match) return detected;
    const scale = detected.estimatedQuantityGrams != null
      ? detected.estimatedQuantityGrams / 100
      : detected.portionMultiplier;
    return {
      ...detected,
      name: match.item.name,
      calories: Math.round(match.item.calories * scale),
      protein:  Math.round(match.item.protein  * scale * 10) / 10,
      carbs:    Math.round(match.item.carbs    * scale * 10) / 10,
      fat:      Math.round(match.item.fat      * scale * 10) / 10,
    };
  });
}
