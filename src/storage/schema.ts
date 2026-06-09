export type StorageEnvelope<T> = {
  version: number;
  updatedAt: string;
  data: T;
};

export type StoredMealItem = {
  name: string;
  portion: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity?: number;
  unit?: string;
  count?: number;
  sizeDescription?: string;
  servingDescription?: string;
};

export type StoredMeal = {
  id: string;
  timestamp: string;
  period?: string;
  items: StoredMealItem[];
  totals: { cal: number; protein: number; carbs: number; fat: number };
  venueId?: string;
  placeId?: string;
  venueName?: string;
  source?: 'photo' | 'barcode' | 'manual' | 'menu' | 'saved_meal';
};

export type StoredCustomFood = {
  id: string;
  name: string;
  brand?: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: 'manual' | 'barcode' | 'search' | 'ai';
  barcode?: string;
  createdAt: string;
  updatedAt: string;
  useCount: number;
  lastUsedAt?: string;
};

export type StoredSavedMeal = {
  id: string;
  name: string;
  items: StoredMealItem[];
  totals: { cal: number; protein: number; carbs: number; fat: number };
  defaultPeriod?: string;
  sourceMealId?: string;
  venueId?: string;
  venueName?: string;
  createdAt: string;
  updatedAt: string;
  useCount: number;
  lastUsedAt?: string;
};

export type StoredWeightEntry = {
  id: string;
  date: string;
  weightLbs: number;
  note?: string;
  source: 'manual' | 'profile';
  createdAt: string;
  updatedAt: string;
};

export type StoredCorrectionMemoryEntry = {
  id: string;
  canonicalName: string;
  originalName?: string;
  correctedName?: string;
  averageQuantity?: number;
  unit?: string;
  servingDescription?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  venueId?: string;
  venueName?: string;
  source: 'photo_correction' | 'manual_edit' | 'history_edit';
  confidence: number;
  timesSeen: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
};

export type StoredVenueMemoryEntry = {
  id: string;
  venueId?: string;
  placeId?: string;
  venueName: string;
  normalizedVenueName: string;
  itemName: string;
  normalizedItemName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingDescription?: string;
  source: 'logged_meal' | 'menu_match' | 'manual_correction';
  useCount: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
};
