/**
 * Stub for Nutritionix food data provider.
 * TODO: implement with Nutritionix API credentials once licensed.
 * Docs: https://developer.nutritionix.com/
 */
import type { FoodItem, FoodProvider } from './types';

export class NutritionixProvider implements FoodProvider {
  async lookup(_query: string): Promise<FoodItem | null> {
    throw new Error('NutritionixProvider not yet implemented');
  }

  async search(_query: string): Promise<FoodItem[]> {
    throw new Error('NutritionixProvider not yet implemented');
  }
}
