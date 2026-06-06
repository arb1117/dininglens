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
  menuItems?: Array<{ id: string; name: string; calories: number; protein: number; carbs: number; fat: number }>;
};

export type VenueDetectionResult = {
  venue: Venue | null;
  distanceKm: number;
  permissionDenied: boolean;
};

const DINING_HALL_RADIUS_KM = 0.25;
const CACHE_TTL_MS = 5 * 60 * 1000;

export const KNOWN_VENUES: Venue[] = SUPPORTED_DINING_VENUES;

let venueCache: { venue: Venue | null; distanceKm: number; detectedAt: number } | null = null;

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

async function detectFromCoords(coords: Coords): Promise<{ venue: Venue | null; distanceKm: number }> {
  const nearestHall = findNearestDiningHall(coords);

  try {
    const { detectNearbyRestaurant } = await import('./restaurantService');
    const restaurant = await detectNearbyRestaurant(coords);
    if (restaurant && restaurant.distance_km <= 0.1 && restaurant.distance_km < nearestHall.distanceKm) {
      return {
        venue: {
          id: restaurant.id,
          name: restaurant.name,
          institution: restaurant.chain,
          type: 'restaurant',
          locationId: restaurant.id,
          provider: 'generic',
          coords,
          menuItems: restaurant.menuItems,
        },
        distanceKm: restaurant.distance_km,
      };
    }
  } catch {
    // continue with dining hall result
  }

  return { venue: nearestHall.venue, distanceKm: nearestHall.distanceKm };
}

export async function detectVenueFull(): Promise<VenueDetectionResult> {
  // Return cached result if still fresh
  if (venueCache && Date.now() - venueCache.detectedAt < CACHE_TTL_MS) {
    return { venue: venueCache.venue, distanceKm: venueCache.distanceKm, permissionDenied: false };
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return { venue: null, distanceKm: Infinity, permissionDenied: true };
  }

  // Fast path: use last known position (instant, no UI prompt)
  const lastKnown = await Location.getLastKnownPositionAsync({}).catch(() => null);
  if (lastKnown) {
    const coords = { lat: lastKnown.coords.latitude, lon: lastKnown.coords.longitude };
    const result = await detectFromCoords(coords);
    venueCache = { ...result, detectedAt: Date.now() };

    // Refine in background with accurate position; updates cache for next call
    Location.getCurrentPositionAsync({}).then(async (loc) => {
      const accurateCoords = { lat: loc.coords.latitude, lon: loc.coords.longitude };
      const updated = await detectFromCoords(accurateCoords);
      venueCache = { ...updated, detectedAt: Date.now() };
    }).catch(() => {});

    return { ...result, permissionDenied: false };
  }

  // No last known position — wait for accurate fix
  const location = await Location.getCurrentPositionAsync({});
  const coords = { lat: location.coords.latitude, lon: location.coords.longitude };
  const result = await detectFromCoords(coords);
  venueCache = { ...result, detectedAt: Date.now() };
  return { ...result, permissionDenied: false };
}

export async function detectVenue(): Promise<Venue | null> {
  const { venue } = await detectVenueFull();
  return venue;
}

export function clearVenueCache(): void {
  venueCache = null;
}
