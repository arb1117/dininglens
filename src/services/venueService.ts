import * as Location from 'expo-location';

export type Venue = {
  id: string;
  name: string;
  institution: string;
  type: 'dining_hall' | 'restaurant';
  locationId: string;
  provider: 'dineoncampus' | 'generic';
  coords: { lat: number; lon: number };
};

const RADIUS_KM = 0.25;

export const KNOWN_VENUES: Venue[] = [
  {
    id: 'duncan-tamu',
    name: 'Duncan Dining Hall',
    institution: 'Texas A&M University',
    type: 'dining_hall',
    locationId: '5878eb5cee596f847636f114',
    provider: 'dineoncampus',
    coords: { lat: 30.6120718, lon: -96.3355046 },
  },
  {
    id: 'sbisa-tamu',
    name: 'Sbisa Dining Hall',
    institution: 'Texas A&M University',
    type: 'dining_hall',
    locationId: '587909deee596f31cedc179c',
    provider: 'dineoncampus',
    coords: { lat: 30.6171351, lon: -96.3437766 },
  },
  {
    id: 'commons-tamu',
    name: 'The Commons Dining Hall',
    institution: 'Texas A&M University',
    type: 'dining_hall',
    locationId: '59972586ee596fe55d2eef75',
    provider: 'dineoncampus',
    coords: { lat: 30.6154596, lon: -96.3360751 },
  },
];

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export async function detectVenue(): Promise<Venue | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const location = await Location.getCurrentPositionAsync({});
  const { latitude: lat, longitude: lon } = location.coords;
  const userCoords = { lat, lon };

  // Find nearest campus dining hall within RADIUS_KM
  let nearestHall: Venue | null = null;
  let nearestHallDist = Infinity;
  for (const venue of KNOWN_VENUES) {
    const dist = haversineKm(userCoords, venue.coords);
    if (dist <= RADIUS_KM && dist < nearestHallDist) {
      nearestHall = venue;
      nearestHallDist = dist;
    }
  }

  // Check for a nearby restaurant (stub always returns null — geolocation needs a paid API)
  try {
    const { detectNearbyRestaurant } = await import('./restaurantService');
    const restaurant = await detectNearbyRestaurant(userCoords);
    if (restaurant && restaurant.distance_km <= 0.1 && restaurant.distance_km < nearestHallDist) {
      return {
        id: restaurant.id,
        name: restaurant.name,
        institution: restaurant.chain,
        type: 'restaurant',
        locationId: restaurant.id,
        provider: 'generic',
        coords: userCoords,
      };
    }
  } catch {
    // continue with dining hall result
  }

  return nearestHall;
}
