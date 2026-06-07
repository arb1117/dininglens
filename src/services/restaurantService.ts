import { findChainMatch, getChainMenuItems } from '../data/chainMenus';
import { API_BASE_URL } from '../config/api';

export interface Restaurant {
  id: string;
  name: string;
  chain: string;
  distance_km: number;
  menuItems?: Array<{ id: string; name: string; calories: number; protein: number; carbs: number; fat: number }>;
}

export interface RestaurantMenuItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string;
}

// Detect the nearest restaurant via server-proxied Google Places call.
// Returns null if:
//   - GOOGLE_PLACES_API_KEY is not configured on the server
//   - No restaurant within 100m
//   - Neither a known chain nor a scrapeable mom-and-pop
export async function detectNearbyRestaurant(
  coords: { lat: number; lon: number }
): Promise<Restaurant | null> {
  try {
    // Step 1: Ask server to find nearest restaurant via Google Places
    const placeRes = await fetch(`${API_BASE_URL}/detect-restaurant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: coords.lat, lon: coords.lon }),
    });

    if (!placeRes.ok) return null;
    const place = await placeRes.json();
    if (!place?.name) return null;

    const { placeId, name, website } = place;

    // Step 2: Chain match — check CHAIN_MENUS
    const matchedChain = findChainMatch(name);
    if (matchedChain) {
      return {
        id: placeId,
        name,
        chain: matchedChain,
        distance_km: 0.05,
        menuItems: getChainMenuItems(matchedChain),
      };
    }

    // Step 3: Mom-and-pop — scrape website via server
    if (website) {
      const scrapeRes = await fetch(`${API_BASE_URL}/scrape-menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website, restaurantName: name, placeId }),
      });

      if (!scrapeRes.ok) return null;
      const scraped = await scrapeRes.json();

      if (!scraped.items?.length) return null;

      const menuItems = (scraped.items as RestaurantMenuItem[]).map((item, i) => ({
        id: `${placeId}-${i}`,
        name: item.name,
        calories: item.calories ?? 0,
        protein: item.protein ?? 0,
        carbs: item.carbs ?? 0,
        fat: item.fat ?? 0,
      }));

      return { id: placeId, name, chain: name, distance_km: 0.05, menuItems };
    }

    return null;
  } catch {
    return null;
  }
}

// Stub — returns empty until a restaurant menu API is wired in.
export async function getRestaurantMenu(_restaurant: Restaurant): Promise<RestaurantMenuItem[]> {
  return [];
}
