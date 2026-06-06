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
 * Phase 3 stub — returns null until real GPS detection is wired up.
 * Phase 4 will use coords to match against KNOWN_VENUES.
 */
export async function detectVenue(
  _coords?: { lat: number; lon: number }
): Promise<Venue | null> {
  return null;
}
