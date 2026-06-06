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

// Stub — returns null until Nutritionix keys are configured
export async function detectNearbyRestaurant(coords: { lat: number; lon: number }): Promise<Restaurant | null> {
  if (!process.env.NUTRITIONIX_APP_ID) return null;
  // TODO: POST https://trackapi.nutritionix.com/v2/locations with lat/lon
  return null;
}

// Stub — returns empty until Nutritionix keys are configured
export async function getRestaurantMenu(restaurant: Restaurant): Promise<RestaurantMenuItem[]> {
  if (!process.env.NUTRITIONIX_APP_ID) return [];
  // TODO: fetch menu items for this restaurant chain from Nutritionix
  return [];
}
