export type MealPeriod = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type NutritionTotals = {
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type MacroItem = {
  name: string;
  portion: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity?: number;
  unit?: string;
  count?: number;
  sizeDescription?: string;
  servingDescription?: string;
};

export type FoodItem = {
  name: string;
  serving_size: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source?: string;
};

export type VenueMetadata = {
  venueId?: string;
  placeId?: string;
  venueName?: string;
};
