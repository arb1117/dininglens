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
  {
    id: 'pitt',
    name: 'University of Pittsburgh',
    shortName: 'Pitt',
    coords: { lat: 40.4444, lon: -79.9531 },
    detectionRadiusKm: 2,
    venues: [
      {
        id: 'pom-honey-pitt',
        name: 'Pom & Honey',
        campusId: 'pitt',
        institution: 'University of Pittsburgh',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '5eea80e0c4b7ff086297be0c',
        coords: { lat: 40.4444, lon: -79.9531 },
      },
      {
        id: 'true-burger-pitt',
        name: 'True Burger',
        campusId: 'pitt',
        institution: 'University of Pittsburgh',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '5eeb7bb6c4b7ff086298cac4',
        coords: { lat: 40.4449, lon: -79.9534 },
      },
      {
        id: 'market-sutherland-pitt',
        name: 'The Market at Sutherland',
        campusId: 'pitt',
        institution: 'University of Pittsburgh',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '5ecd7997c4b7ff09613be911',
        coords: { lat: 40.4413, lon: -79.9604 },
      },
      {
        id: 'eatery-towers-pitt',
        name: 'The Eatery at Litchfield Towers',
        campusId: 'pitt',
        institution: 'University of Pittsburgh',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '6779562d351d53052c3b5728',
        coords: { lat: 40.4409, lon: -79.9595 },
      },
    ],
  },
  {
    id: 'usf-stpete',
    name: 'University of South Florida St. Pete',
    shortName: 'USF St. Pete',
    coords: { lat: 27.7669, lon: -82.6387 },
    detectionRadiusKm: 1,
    venues: [
      {
        id: 'nest-usfsp',
        name: 'The Nest',
        campusId: 'usf-stpete',
        institution: 'University of South Florida St. Pete',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '685632a50cb6e662c157d3da',
        coords: { lat: 27.7669, lon: -82.6387 },
      },
      {
        id: 'bay-features-usfsp',
        name: 'Bay Features',
        campusId: 'usf-stpete',
        institution: 'University of South Florida St. Pete',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '6807d7c662dbcd7f848c6425',
        coords: { lat: 27.7672, lon: -82.6385 },
      },
      {
        id: 'kahwa-usfsp',
        name: 'Kahwa Coffee',
        campusId: 'usf-stpete',
        institution: 'University of South Florida St. Pete',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '67d9acd309d6f0ac5863fc38',
        coords: { lat: 27.7672, lon: -82.6385 },
      },
      {
        id: 'market-reef-usfsp',
        name: 'Market at The Reef',
        campusId: 'usf-stpete',
        institution: 'University of South Florida St. Pete',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '67d9aca309d6f0ac5863fc35',
        coords: { lat: 27.7672, lon: -82.6385 },
      },
    ],
  },
  {
    id: 'fitchburg',
    name: 'Fitchburg State University',
    shortName: 'Fitchburg State',
    coords: { lat: 42.5843, lon: -71.7955 },
    detectionRadiusKm: 1,
    venues: [
      {
        id: 'holmes-fitchburg',
        name: 'Holmes Dining Commons',
        campusId: 'fitchburg',
        institution: 'Fitchburg State University',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '5878d5923191a2e3419c2d4c',
        coords: { lat: 42.5843, lon: -71.7955 },
      },
      {
        id: 'north-street-fitchburg',
        name: 'North Street Bistro',
        campusId: 'fitchburg',
        institution: 'Fitchburg State University',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '587cddd33191a2ba2a5ebc5f',
        coords: { lat: 42.5839, lon: -71.7951 },
      },
    ],
  },
  {
    id: 'northeastern',
    name: 'Northeastern University',
    shortName: 'Northeastern',
    coords: { lat: 42.3398, lon: -71.0892 },
    detectionRadiusKm: 2,
    venues: [
      {
        id: 'stetson-east-neu',
        name: 'The Eatery at Stetson East',
        campusId: 'northeastern',
        institution: 'Northeastern University',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '586d05e4ee596f6e6c04b527',
        coords: { lat: 42.3398, lon: -71.0892 },
      },
      {
        id: 'intl-village-neu',
        name: 'United Table at International Village',
        campusId: 'northeastern',
        institution: 'Northeastern University',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '5f4f8a425e42ad17329be131',
        coords: { lat: 42.3391, lon: -71.0874 },
      },
      {
        id: 'subway-ryder-neu',
        name: 'Subway at Ryder Hall',
        campusId: 'northeastern',
        institution: 'Northeastern University',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '5e6799901ca48e10a3c876a5',
        coords: { lat: 42.3404, lon: -71.0897 },
      },
    ],
  },
  {
    id: 'uf',
    name: 'University of Florida',
    shortName: 'UF',
    coords: { lat: 29.6436, lon: -82.3549 },
    detectionRadiusKm: 3,
    venues: [
      {
        id: 'gator-corner-uf',
        name: 'The Food Hall @ Gator Corner',
        campusId: 'uf',
        institution: 'University of Florida',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '62a8c2b8a9f13a0de3af64c4',
        coords: { lat: 29.6436, lon: -82.3549 },
      },
      {
        id: 'beaty-uf',
        name: 'The Market @ Beaty Towers',
        campusId: 'uf',
        institution: 'University of Florida',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '62a8d52cb63f1e0af7a967df',
        coords: { lat: 29.6444, lon: -82.3461 },
      },
      {
        id: 'hough-uf',
        name: 'The Market @ Hough Hall',
        campusId: 'uf',
        institution: 'University of Florida',
        type: 'dining_hall',
        provider: 'dineoncampus',
        locationId: '62a8d52cb63f1e0af7a967e6',
        coords: { lat: 29.6487, lon: -82.3435 },
      },
    ],
  },
];

export const SUPPORTED_DINING_VENUES: DiningVenueDefinition[] =
  CAMPUS_REGISTRY.flatMap(campus => campus.venues);

export function getCampusById(campusId: string): CampusDefinition | undefined {
  return CAMPUS_REGISTRY.find(campus => campus.id === campusId);
}
