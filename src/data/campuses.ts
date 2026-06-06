export type Coords = { lat: number; lon: number };

export type DiningProvider = 'dineoncampus' | 'cs50';

export type DiningVenueDefinition = {
  id: string;
  name: string;
  campusId: string;
  institution: string;
  type: 'dining_hall';
  provider: DiningProvider;
  locationId: string;
  coords: Coords;
};

export type CampusDefinition = {
  id: string;
  name: string;
  shortName: string;
  coords: Coords;
  detectionRadiusKm: number;
  venues: DiningVenueDefinition[];
};

export const CAMPUS_REGISTRY: CampusDefinition[] = [
  {
    id: 'tamu',
    name: 'Texas A&M University',
    shortName: 'Texas A&M',
    coords: { lat: 30.6150, lon: -96.3400 },
    detectionRadiusKm: 3,
    venues: [
      {
        id: 'duncan-tamu',
        name: 'Duncan Dining Hall',
        campusId: 'tamu',
        institution: 'Texas A&M University',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '5878eb5cee596f847636f114',
        coords: { lat: 30.6120718, lon: -96.3355046 },
      },
      {
        id: 'sbisa-tamu',
        name: 'Sbisa Dining Hall',
        campusId: 'tamu',
        institution: 'Texas A&M University',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '587909deee596f31cedc179c',
        coords: { lat: 30.6171351, lon: -96.3437766 },
      },
      {
        id: 'commons-tamu',
        name: 'The Commons Dining Hall',
        campusId: 'tamu',
        institution: 'Texas A&M University',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '59972586ee596fe55d2eef75',
        coords: { lat: 30.6154596, lon: -96.3360751 },
      },
    ],
  },
  {
    id: 'harvard',
    name: 'Harvard University',
    shortName: 'Harvard',
    coords: { lat: 42.3736, lon: -71.1097 },
    detectionRadiusKm: 4,
    venues: [
      {
        id: 'annenberg-harvard',
        name: 'Annenberg Hall',
        campusId: 'harvard',
        institution: 'Harvard University',
        type: 'dining_hall',
        provider: 'cs50',
        locationId: '30',
        coords: { lat: 42.3759452, lon: -71.1153030 },
      },
      {
        id: 'adams-harvard',
        name: 'Adams House',
        campusId: 'harvard',
        institution: 'Harvard University',
        type: 'dining_hall',
        provider: 'cs50',
        locationId: '9',
        coords: { lat: 42.3717171, lon: -71.1166957 },
      },
      {
        id: 'cabot-pforzheimer-harvard',
        name: 'Cabot and Pforzheimer House',
        campusId: 'harvard',
        institution: 'Harvard University',
        type: 'dining_hall',
        provider: 'cs50',
        locationId: '5',
        coords: { lat: 42.3812378, lon: -71.1247296 },
      },
      {
        id: 'currier-harvard',
        name: 'Currier House',
        campusId: 'harvard',
        institution: 'Harvard University',
        type: 'dining_hall',
        provider: 'cs50',
        locationId: '38',
        coords: { lat: 42.3817601, lon: -71.1255976 },
      },
      {
        id: 'dunster-mather-harvard',
        name: 'Dunster and Mather House',
        campusId: 'harvard',
        institution: 'Harvard University',
        type: 'dining_hall',
        provider: 'cs50',
        locationId: '7',
        coords: { lat: 42.3685068, lon: -71.1157280 },
      },
      {
        id: 'eliot-kirkland-harvard',
        name: 'Eliot and Kirkland House',
        campusId: 'harvard',
        institution: 'Harvard University',
        type: 'dining_hall',
        provider: 'cs50',
        locationId: '14',
        coords: { lat: 42.3705510, lon: -71.1207256 },
      },
      {
        id: 'leverett-harvard',
        name: 'Leverett House',
        campusId: 'harvard',
        institution: 'Harvard University',
        type: 'dining_hall',
        provider: 'cs50',
        locationId: '16',
        coords: { lat: 42.3697182, lon: -71.1171093 },
      },
      {
        id: 'lowell-winthrop-harvard',
        name: 'Lowell and Winthrop House',
        campusId: 'harvard',
        institution: 'Harvard University',
        type: 'dining_hall',
        provider: 'cs50',
        locationId: '15',
        coords: { lat: 42.3705971, lon: -71.1188363 },
      },
      {
        id: 'quincy-harvard',
        name: 'Quincy House',
        campusId: 'harvard',
        institution: 'Harvard University',
        type: 'dining_hall',
        provider: 'cs50',
        locationId: '8',
        coords: { lat: 42.3707762, lon: -71.1168698 },
      },
    ],
  },
];

export const SUPPORTED_DINING_VENUES: DiningVenueDefinition[] =
  CAMPUS_REGISTRY.flatMap(campus => campus.venues);

export function getCampusById(campusId: string): CampusDefinition | undefined {
  return CAMPUS_REGISTRY.find(campus => campus.id === campusId);
}
