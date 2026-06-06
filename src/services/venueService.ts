import * as Location from 'expo-location';
import { CAMPUS_REGISTRY, SUPPORTED_DINING_VENUES } from '../data/campuses';
import type { Coords, DiningProvider } from '../data/campuses';

export type Venue = {
  id: string;
  name: string;
  campusId?: string;
  institution: string;
  type: 'dining_hall' | 'restaurant';
  locationId: string;
  provider: DiningProvider | 'generic';
  coords: Coords;
  // Pre-fetched menu items for restaurant venues (chain lookup or scrape result)
  menuItems?: Array<{ id: string; name: string; calories: number; protein: number; carbs: number; fat: number }>;
};

const DINING_HALL_RADIUS_KM = 0.25;

export const KNOWN_VENUES: Venue[] = SUPPORTED_DINING_VENUES;

function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function findNearestCampus(coords: Coords) {
  let nearest = null as { id: string; distanceKm: number } | null;
  for (const campus of CAMPUS_REGISTRY) {
    const distanceKm = haversineKm(coords, campus.coords);
    if (distanceKm <= campus.detectionRadiusKm && (!nearest || distanceKm < nearest.distanceKm)) {
      nearest = { id: campus.id, distanceKm };
    }
  }
  return nearest;
}

function findNearestDiningHall(coords: Coords): { venue: Venue | null; distanceKm: number } {
  const nearestCampus = findNearestCampus(coords);
  const candidates = nearestCampus
    ? SUPPORTED_DINING_VENUES.filter(venue => venue.campusId === nearestCampus.id)
    : SUPPORTED_DINING_VENUES;

  let nearestHall: Venue | null = null;
  let nearestHallDist = Infinity;
  for (const venue of candidates) {
    const dist = haversineKm(coords, venue.coords);
    if (dist <= DINING_HALL_RADIUS_KM && dist < nearestHallDist) {
      nearestHall = venue;
      nearestHallDist = dist;
    }
  }

  return { venue: nearestHall, distanceKm: nearestHallDist };
}

export async function detectVenue(): Promise<Venue | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const location = await Location.getCurrentPositionAsync({});
  const { latitude: lat, longitude: lon } = location.coords;
  const userCoords = { lat, lon };

  const nearestHall = findNearestDiningHall(userCoords);

  // Check for a nearby restaurant via Google Places (requires GOOGLE_PLACES_API_KEY on server)
  try {
    const { detectNearbyRestaurant } = await import('./restaurantService');
    const restaurant = await detectNearbyRestaurant(userCoords);
    if (restaurant && restaurant.distance_km <= 0.1 && restaurant.distance_km < nearestHall.distanceKm) {
      return {
        id: restaurant.id,
        name: restaurant.name,
        institution: restaurant.chain,
        type: 'restaurant',
        locationId: restaurant.id,
        provider: 'generic',
        coords: userCoords,
        menuItems: restaurant.menuItems,
      };
    }
  } catch {
    // continue with dining hall result
  }

  return nearestHall.venue;
}
