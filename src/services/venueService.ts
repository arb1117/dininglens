export type Venue = {
  id: string;
  name: string;
  institution: string;
  type: 'dining_hall' | 'restaurant';
  locationId: string;
  provider: 'dineoncampus' | 'generic';
};

export const KNOWN_VENUES: Venue[] = [
  {
    id: 'duncan-tamu',
    name: 'Duncan Dining Hall',
    institution: 'Texas A&M University',
    type: 'dining_hall',
    locationId: '5878eb5cee596f847636f114',
    provider: 'dineoncampus',
  },
];

/**
 * Stub: always returns Duncan Dining Hall.
 * Phase 3 will replace this with real GPS + lookup against KNOWN_VENUES.
 */
export async function detectVenue(
  _coords: { lat: number; lon: number }
): Promise<Venue | null> {
  return KNOWN_VENUES[0];
}
