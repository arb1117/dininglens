import { StoredCustomFood } from '../storage/schema';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { getEnvelope, setEnvelope } from '../storage/storageClient';

type CustomFoodInput = Omit<StoredCustomFood, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>;

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function uid(): string {
  return `cf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

async function loadAll(): Promise<StoredCustomFood[]> {
  const env = await getEnvelope<StoredCustomFood[]>(STORAGE_KEYS.CUSTOM_FOODS, []);
  return Array.isArray(env.data) ? env.data : [];
}

async function saveAll(foods: StoredCustomFood[]): Promise<void> {
  await setEnvelope(STORAGE_KEYS.CUSTOM_FOODS, foods);
}

export async function listCustomFoods(): Promise<StoredCustomFood[]> {
  const foods = await loadAll();
  return foods.sort((a, b) => {
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    return (b.lastUsedAt ?? b.updatedAt).localeCompare(a.lastUsedAt ?? a.updatedAt);
  });
}

export async function saveCustomFood(input: CustomFoodInput): Promise<StoredCustomFood> {
  const foods = await loadAll();
  const now = new Date().toISOString();
  const food: StoredCustomFood = {
    ...input,
    id: uid(),
    createdAt: now,
    updatedAt: now,
    useCount: 1,
    lastUsedAt: now,
  };
  await saveAll([food, ...foods]);
  return food;
}

export async function updateCustomFood(
  id: string,
  patch: Partial<Omit<StoredCustomFood, 'id' | 'createdAt'>>
): Promise<void> {
  const foods = await loadAll();
  const idx = foods.findIndex(f => f.id === id);
  if (idx === -1) return;
  foods[idx] = { ...foods[idx], ...patch, updatedAt: new Date().toISOString() };
  await saveAll(foods);
}

export async function deleteCustomFood(id: string): Promise<void> {
  const foods = await loadAll();
  await saveAll(foods.filter(f => f.id !== id));
}

export async function findCustomFoods(query: string): Promise<StoredCustomFood[]> {
  const foods = await loadAll();
  if (!query.trim()) {
    return foods.sort((a, b) => b.useCount - a.useCount);
  }
  const q = normalize(query);
  return foods
    .filter(f => normalize(f.name).includes(q) || (f.brand && normalize(f.brand).includes(q)))
    .sort((a, b) => b.useCount - a.useCount);
}

export async function recordCustomFoodUse(id: string): Promise<void> {
  const foods = await loadAll();
  const idx = foods.findIndex(f => f.id === id);
  if (idx === -1) return;
  const now = new Date().toISOString();
  foods[idx] = {
    ...foods[idx],
    useCount: foods[idx].useCount + 1,
    lastUsedAt: now,
    updatedAt: now,
  };
  await saveAll(foods);
}
