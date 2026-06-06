export interface Restaurant {
  id: string;
  name: string;
  chain: string;
  distance_km: number;
}

export interface RestaurantMenuItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string;
}

// Stub — restaurant geolocation requires a paid API (e.g. Nutritionix /v2/locations).
// USDA FoodData Central and Open Food Facts do not provide geolocation search.
// This returns null until a geolocation-capable API is wired in.
export async function detectNearbyRestaurant(_coords: { lat: number; lon: number }): Promise<Restaurant | null> {
  return null;
}

// Stub — returns empty until a restaurant menu API is wired in.
export async function getRestaurantMenu(_restaurant: Restaurant): Promise<RestaurantMenuItem[]> {
  return [];
}
