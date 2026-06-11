import type { LoggedMeal, MealPeriod } from '../context/MealContext';
import type { StoredSavedMeal, StoredMealItem } from '../storage/schema';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { getEnvelope, setEnvelope } from '../storage/storageClient';
const MAX_SAVED_MEALS = 200;

function uid(): string {
  return `sm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function sortDate(meal: Pick<StoredSavedMeal, 'lastUsedAt' | 'updatedAt'>): string {
  return meal.lastUsedAt || meal.updatedAt || '';
}

async function loadAll(): Promise<StoredSavedMeal[]> {
  const env = await getEnvelope<StoredSavedMeal[]>(STORAGE_KEYS.SAVED_MEALS, []);
  return Array.isArray(env.data) ? env.data : [];
}

async function saveAll(meals: StoredSavedMeal[]): Promise<void> {
  await setEnvelope(STORAGE_KEYS.SAVED_MEALS, meals.slice(0, MAX_SAVED_MEALS));
}

export async function listSavedMeals(): Promise<StoredSavedMeal[]> {
  const meals = await loadAll();
  return meals.filter(m => typeof m.name === 'string' && Array.isArray(m.items)).sort((a, b) => {
    const bUses = Number.isFinite(b.useCount) ? b.useCount : 0;
    const aUses = Number.isFinite(a.useCount) ? a.useCount : 0;
    if (bUses !== aUses) return bUses - aUses;
    return sortDate(b).localeCompare(sortDate(a));
  });
}

export async function saveMealFromLoggedMeal(
  meal: LoggedMeal,
  name?: string
): Promise<StoredSavedMeal> {
  const meals = await loadAll();
  const now = new Date().toISOString();
  const items: StoredMealItem[] = meal.items.map(item => ({
    name: item.name,
    portion: item.portion,
    cal: item.cal,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    quantity: item.quantity,
    unit: item.unit,
    count: item.count,
    sizeDescription: item.sizeDescription,
    servingDescription: item.servingDescription,
  }));
  const savedMeal: StoredSavedMeal = {
    id: uid(),
    name: name ?? meal.items.slice(0, 3).map(i => i.name).join(', '),
    items,
    totals: meal.totals,
    defaultPeriod: meal.period,
    sourceMealId: meal.id,
    venueId: meal.venueId,
    venueName: meal.venueName,
    createdAt: now,
    updatedAt: now,
    useCount: 0,
  };
  await saveAll([savedMeal, ...meals]);
  return savedMeal;
}

export async function saveMealFromItems(
  items: StoredMealItem[],
  name: string,
  metadata?: { defaultPeriod?: string; venueId?: string; venueName?: string }
): Promise<StoredSavedMeal> {
  const meals = await loadAll();
  const now = new Date().toISOString();
  const totals = items.reduce(
    (acc, item) => ({
      cal: Math.round(acc.cal + item.cal),
      protein: Math.round((acc.protein + item.protein) * 10) / 10,
      carbs: Math.round((acc.carbs + item.carbs) * 10) / 10,
      fat: Math.round((acc.fat + item.fat) * 10) / 10,
    }),
    { cal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const savedMeal: StoredSavedMeal = {
    id: uid(),
    name,
    items,
    totals,
    ...(metadata ?? {}),
    createdAt: now,
    updatedAt: now,
    useCount: 0,
  };
  await saveAll([savedMeal, ...meals]);
  return savedMeal;
}

export async function updateSavedMeal(
  id: string,
  patch: Partial<Omit<StoredSavedMeal, 'id' | 'createdAt'>>
): Promise<void> {
  const meals = await loadAll();
  const idx = meals.findIndex(m => m.id === id);
  if (idx === -1) return;
  meals[idx] = { ...meals[idx], ...patch, updatedAt: new Date().toISOString() };
  await saveAll(meals);
}

export async function deleteSavedMeal(id: string): Promise<void> {
  const meals = await loadAll();
  await saveAll(meals.filter(m => m.id !== id));
}

export async function recordSavedMealUse(id: string): Promise<void> {
  const meals = await loadAll();
  const idx = meals.findIndex(m => m.id === id);
  if (idx === -1) return;
  const now = new Date().toISOString();
  meals[idx] = {
    ...meals[idx],
    useCount: meals[idx].useCount + 1,
    lastUsedAt: now,
    updatedAt: now,
  };
  await saveAll(meals);
}

export async function logSavedMeal(
  id: string,
  addMeal: (meal: LoggedMeal) => void,
  period?: string
): Promise<void> {
  const meals = await loadAll();
  const saved = meals.find(m => m.id === id);
  if (!saved) return;
  const mealPeriod = (period ?? saved.defaultPeriod) as MealPeriod | undefined;
  addMeal({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    timestamp: new Date().toISOString(),
    period: mealPeriod,
    items: saved.items,
    totals: saved.totals,
    venueId: saved.venueId,
    venueName: saved.venueName,
    source: 'saved',
  });
  await recordSavedMealUse(id);
}
