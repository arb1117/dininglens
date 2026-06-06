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
    coords: { lat: 30.6185, lon: -96.3407 },
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

  for (const venue of KNOWN_VENUES) {
    if (haversineKm({ lat, lon }, venue.coords) <= RADIUS_KM) {
      return venue;
    }
  }
  return null;
}
