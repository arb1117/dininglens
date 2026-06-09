export function toDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const STORAGE_KEYS = {
  SCHEMA_VERSION:    '@dininglens/schema_version',
  MEAL_LOG:          '@dininglens/meal_log',
  GOALS:             '@dininglens/goals',
  PROFILE:           '@dininglens/profile',
  LAST_LOGGED:       '@dininglens/last_logged',
  WATER:             (date: string) => `@dininglens/water/${date}`,
  EXERCISE:          (date: string) => `@dininglens/exercise/${date}`,
  CUSTOM_FOODS:      '@dininglens/custom_foods',
  SAVED_MEALS:       '@dininglens/saved_meals',
  WEIGHT_LOG:        '@dininglens/weight_log',
  CORRECTION_MEMORY: '@dininglens/correction_memory',
  VENUE_MEMORY:      '@dininglens/venue_memory',
} as const;
