import { applyMenuMatches, findBestMenuMatch, menuServingScale } from './menuMatcher';
import type { MenuItem } from '../services/menuService';

const bigMac: MenuItem = { name: 'Big Mac', calories: 590, protein: 25, carbs: 46, fat: 34 } as MenuItem;
const fries: MenuItem = { name: 'Medium French Fries', calories: 320, protein: 5, carbs: 43, fat: 15 } as MenuItem;

describe('menuServingScale', () => {
  it('defaults to one serving when servings is missing or invalid', () => {
    expect(menuServingScale({})).toBe(1);
    expect(menuServingScale({ servings: 0 })).toBe(1);
    expect(menuServingScale({ servings: -2 })).toBe(1);
    expect(menuServingScale({ servings: Number.NaN })).toBe(1);
  });

  it('caps servings at 10', () => {
    expect(menuServingScale({ servings: 50 })).toBe(10);
  });
});

describe('applyMenuMatches', () => {
  it('scales menu nutrition by servings, not grams', () => {
    const [item] = applyMenuMatches(
      [{ name: 'big mac', portionMultiplier: 1, confidence: 0.9, estimatedQuantityGrams: 215, servings: 1 }],
      [bigMac, fries],
    );
    expect(item.name).toBe('Big Mac');
    expect(item.calories).toBe(590);
  });

  it('leaves unmatched items untouched', () => {
    const detected = { name: 'caesar salad', portionMultiplier: 1, confidence: 0.8, calories: 200 };
    expect(applyMenuMatches([detected], [bigMac])).toEqual([detected]);
  });
});

describe('findBestMenuMatch', () => {
  it('matches on contained multi-word names', () => {
    expect(findBestMenuMatch('french fries', [bigMac, fries])?.item.name).toBe('Medium French Fries');
  });
});
