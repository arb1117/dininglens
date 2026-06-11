import type {
  StoredCustomFood,
  StoredSavedMeal,
  StoredWeightEntry,
  StoredCorrectionMemoryEntry,
  StoredVenueMemoryEntry,
} from './schema';
import type { MacroItem, MealPeriod, NutritionTotals } from '../types/nutrition';
import type { LoggedMeal, UserGoals, ExerciseEntry } from '../context/MealContext';

// AsyncStorage contents are untrusted: a partial write, an old app version, or
// a manual edit can leave records with missing fields, wrong types, NaN, or
// negative numbers. Every sanitizer returns null for unsalvageable records so
// callers can filter them out instead of crashing.

const MAX_ITEM_CAL = 10000;
const MAX_ITEM_MACRO = 1000;
const MAX_TOTAL_CAL = 50000;
const MAX_TOTAL_MACRO = 5000;
const MAX_WEIGHT_LBS = 1500;
const MAX_COUNT = 1_000_000;

function clampNum(v: unknown, max: number, fallback = 0): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return fallback;
  return Math.min(v, max);
}

function reqStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

function optStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function optNum(v: unknown, max: number): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return undefined;
  return Math.min(v, max);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function sanitizeArray<T>(
  raw: unknown,
  sanitize: (entry: unknown) => T | null
): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const entry of raw) {
    const clean = sanitize(entry);
    if (clean !== null) out.push(clean);
  }
  return out;
}

const VALID_PERIODS: MealPeriod[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

function sanitizePeriod(v: unknown): MealPeriod | undefined {
  return VALID_PERIODS.includes(v as MealPeriod) ? (v as MealPeriod) : undefined;
}

function sanitizeTotals(v: unknown): NutritionTotals {
  const t = isRecord(v) ? v : {};
  return {
    cal: clampNum(t.cal, MAX_TOTAL_CAL),
    protein: clampNum(t.protein, MAX_TOTAL_MACRO),
    carbs: clampNum(t.carbs, MAX_TOTAL_MACRO),
    fat: clampNum(t.fat, MAX_TOTAL_MACRO),
  };
}

export function sanitizeMacroItem(raw: unknown): MacroItem | null {
  if (!isRecord(raw)) return null;
  const name = reqStr(raw.name);
  if (name === null) return null;
  return {
    name,
    portion: optStr(raw.portion) ?? '',
    cal: clampNum(raw.cal, MAX_ITEM_CAL),
    protein: clampNum(raw.protein, MAX_ITEM_MACRO),
    carbs: clampNum(raw.carbs, MAX_ITEM_MACRO),
    fat: clampNum(raw.fat, MAX_ITEM_MACRO),
    quantity: optNum(raw.quantity, MAX_COUNT),
    unit: optStr(raw.unit),
    count: optNum(raw.count, MAX_COUNT),
    sizeDescription: optStr(raw.sizeDescription),
    servingDescription: optStr(raw.servingDescription),
  };
}

const VALID_MEAL_SOURCES: NonNullable<LoggedMeal['source']>[] = [
  'camera', 'manual', 'barcode', 'saved',
];

export function sanitizeMeal(raw: unknown): LoggedMeal | null {
  if (!isRecord(raw)) return null;
  const id = reqStr(raw.id);
  const timestamp = reqStr(raw.timestamp);
  if (id === null || timestamp === null) return null;
  const items = sanitizeArray(raw.items, sanitizeMacroItem);
  if (items.length === 0) return null;
  return {
    id,
    timestamp,
    period: sanitizePeriod(raw.period),
    items,
    totals: sanitizeTotals(raw.totals),
    venueId: optStr(raw.venueId),
    placeId: optStr(raw.placeId),
    venueName: optStr(raw.venueName),
    source: VALID_MEAL_SOURCES.includes(raw.source as never)
      ? (raw.source as LoggedMeal['source'])
      : undefined,
  };
}

const VALID_PRESETS: UserGoals['preset'][] = ['lose', 'maintain', 'build', 'recomposition'];

export function sanitizeGoals(raw: unknown): UserGoals | null {
  if (!isRecord(raw)) return null;
  const calories = clampNum(raw.calories, MAX_TOTAL_CAL);
  if (calories <= 0) return null;
  return {
    preset: VALID_PRESETS.includes(raw.preset as never)
      ? (raw.preset as UserGoals['preset'])
      : 'maintain',
    calories,
    protein: clampNum(raw.protein, MAX_TOTAL_MACRO),
    carbs: clampNum(raw.carbs, MAX_TOTAL_MACRO),
    fat: clampNum(raw.fat, MAX_TOTAL_MACRO),
  };
}

export function sanitizeExerciseEntry(raw: unknown): ExerciseEntry | null {
  if (!isRecord(raw)) return null;
  const id = reqStr(raw.id);
  const name = reqStr(raw.name);
  if (id === null || name === null) return null;
  return {
    id,
    name,
    duration: clampNum(raw.duration, 24 * 60),
    type: raw.type === 'cardio' || raw.type === 'strength' ? raw.type : 'other',
    caloriesBurned: clampNum(raw.caloriesBurned, MAX_ITEM_CAL),
  };
}

const VALID_FOOD_SOURCES: StoredCustomFood['source'][] = ['manual', 'barcode', 'search', 'ai'];

export function sanitizeCustomFood(raw: unknown): StoredCustomFood | null {
  if (!isRecord(raw)) return null;
  const id = reqStr(raw.id);
  const name = reqStr(raw.name);
  if (id === null || name === null) return null;
  return {
    id,
    name,
    brand: optStr(raw.brand),
    servingSize: optStr(raw.servingSize) ?? '1 serving',
    calories: clampNum(raw.calories, MAX_ITEM_CAL),
    protein: clampNum(raw.protein, MAX_ITEM_MACRO),
    carbs: clampNum(raw.carbs, MAX_ITEM_MACRO),
    fat: clampNum(raw.fat, MAX_ITEM_MACRO),
    source: VALID_FOOD_SOURCES.includes(raw.source as never)
      ? (raw.source as StoredCustomFood['source'])
      : 'manual',
    barcode: optStr(raw.barcode),
    createdAt: optStr(raw.createdAt) ?? '',
    updatedAt: optStr(raw.updatedAt) ?? '',
    useCount: clampNum(raw.useCount, MAX_COUNT),
    lastUsedAt: optStr(raw.lastUsedAt),
  };
}

export function sanitizeSavedMeal(raw: unknown): StoredSavedMeal | null {
  if (!isRecord(raw)) return null;
  const id = reqStr(raw.id);
  const name = reqStr(raw.name);
  if (id === null || name === null) return null;
  const items = sanitizeArray(raw.items, sanitizeMacroItem);
  if (items.length === 0) return null;
  return {
    id,
    name,
    items,
    totals: sanitizeTotals(raw.totals),
    defaultPeriod: optStr(raw.defaultPeriod),
    sourceMealId: optStr(raw.sourceMealId),
    venueId: optStr(raw.venueId),
    venueName: optStr(raw.venueName),
    createdAt: optStr(raw.createdAt) ?? '',
    updatedAt: optStr(raw.updatedAt) ?? '',
    useCount: clampNum(raw.useCount, MAX_COUNT),
    lastUsedAt: optStr(raw.lastUsedAt),
  };
}

export function sanitizeWeightEntry(raw: unknown): StoredWeightEntry | null {
  if (!isRecord(raw)) return null;
  const id = reqStr(raw.id);
  const date = reqStr(raw.date);
  const weightLbs = clampNum(raw.weightLbs, MAX_WEIGHT_LBS);
  if (id === null || date === null || weightLbs <= 0) return null;
  return {
    id,
    date,
    weightLbs,
    note: optStr(raw.note),
    source: raw.source === 'profile' ? 'profile' : 'manual',
    createdAt: optStr(raw.createdAt) ?? '',
    updatedAt: optStr(raw.updatedAt) ?? '',
  };
}

const VALID_CORRECTION_SOURCES: StoredCorrectionMemoryEntry['source'][] = [
  'photo_correction', 'manual_edit', 'history_edit',
];

export function sanitizeCorrectionMemoryEntry(raw: unknown): StoredCorrectionMemoryEntry | null {
  if (!isRecord(raw)) return null;
  const id = reqStr(raw.id);
  const canonicalName = reqStr(raw.canonicalName);
  if (id === null || canonicalName === null) return null;
  return {
    id,
    canonicalName,
    originalName: optStr(raw.originalName),
    correctedName: optStr(raw.correctedName),
    averageQuantity: optNum(raw.averageQuantity, MAX_COUNT),
    unit: optStr(raw.unit),
    servingDescription: optStr(raw.servingDescription),
    calories: optNum(raw.calories, MAX_ITEM_CAL),
    protein: optNum(raw.protein, MAX_ITEM_MACRO),
    carbs: optNum(raw.carbs, MAX_ITEM_MACRO),
    fat: optNum(raw.fat, MAX_ITEM_MACRO),
    venueId: optStr(raw.venueId),
    venueName: optStr(raw.venueName),
    source: VALID_CORRECTION_SOURCES.includes(raw.source as never)
      ? (raw.source as StoredCorrectionMemoryEntry['source'])
      : 'manual_edit',
    confidence: clampNum(raw.confidence, 1),
    timesSeen: clampNum(raw.timesSeen, MAX_COUNT),
    createdAt: optStr(raw.createdAt) ?? '',
    updatedAt: optStr(raw.updatedAt) ?? '',
    lastUsedAt: optStr(raw.lastUsedAt),
  };
}

const VALID_VENUE_SOURCES: StoredVenueMemoryEntry['source'][] = [
  'logged_meal', 'menu_match', 'manual_correction',
];

export function sanitizeVenueMemoryEntry(raw: unknown): StoredVenueMemoryEntry | null {
  if (!isRecord(raw)) return null;
  const id = reqStr(raw.id);
  const venueName = reqStr(raw.venueName);
  const itemName = reqStr(raw.itemName);
  if (id === null || venueName === null || itemName === null) return null;
  return {
    id,
    venueId: optStr(raw.venueId),
    placeId: optStr(raw.placeId),
    venueName,
    normalizedVenueName: optStr(raw.normalizedVenueName) ?? venueName.toLowerCase().trim(),
    itemName,
    normalizedItemName: optStr(raw.normalizedItemName) ?? itemName.toLowerCase().trim(),
    calories: clampNum(raw.calories, MAX_ITEM_CAL),
    protein: clampNum(raw.protein, MAX_ITEM_MACRO),
    carbs: clampNum(raw.carbs, MAX_ITEM_MACRO),
    fat: clampNum(raw.fat, MAX_ITEM_MACRO),
    servingDescription: optStr(raw.servingDescription),
    source: VALID_VENUE_SOURCES.includes(raw.source as never)
      ? (raw.source as StoredVenueMemoryEntry['source'])
      : 'logged_meal',
    useCount: clampNum(raw.useCount, MAX_COUNT),
    createdAt: optStr(raw.createdAt) ?? '',
    updatedAt: optStr(raw.updatedAt) ?? '',
    lastUsedAt: optStr(raw.lastUsedAt) ?? '',
  };
}
