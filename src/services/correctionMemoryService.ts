import type { StoredCorrectionMemoryEntry } from '../storage/schema';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { getEnvelope, setEnvelope } from '../storage/storageClient';

function uid(): string {
  return `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

async function loadAll(): Promise<StoredCorrectionMemoryEntry[]> {
  const env = await getEnvelope<StoredCorrectionMemoryEntry[]>(STORAGE_KEYS.CORRECTION_MEMORY, []);
  return Array.isArray(env.data) ? env.data : [];
}

async function saveAll(entries: StoredCorrectionMemoryEntry[]): Promise<void> {
  await setEnvelope(STORAGE_KEYS.CORRECTION_MEMORY, entries);
}

export async function listCorrectionMemory(): Promise<StoredCorrectionMemoryEntry[]> {
  const entries = await loadAll();
  return entries.sort((a, b) => b.timesSeen - a.timesSeen);
}

export async function recordCorrection(
  originalName: string,
  canonicalName: string,
  macros: { calories?: number; protein?: number; carbs?: number; fat?: number },
  source: StoredCorrectionMemoryEntry['source'] = 'photo_correction'
): Promise<StoredCorrectionMemoryEntry> {
  const entries = await loadAll();
  const normalizedOriginal = originalName.toLowerCase().trim();
  const existing = entries.find(e => (e.originalName ?? '').toLowerCase().trim() === normalizedOriginal);
  const now = new Date().toISOString();
  if (existing) {
    existing.canonicalName = canonicalName;
    existing.calories = macros.calories;
    existing.protein = macros.protein;
    existing.carbs = macros.carbs;
    existing.fat = macros.fat;
    existing.timesSeen += 1;
    existing.lastUsedAt = now;
    existing.updatedAt = now;
    await saveAll(entries);
    return existing;
  }
  const entry: StoredCorrectionMemoryEntry = {
    id: uid(),
    canonicalName,
    originalName,
    calories: macros.calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    source,
    confidence: 1,
    timesSeen: 1,
    lastUsedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await saveAll([entry, ...entries]);
  return entry;
}

export async function findCorrection(originalName: string): Promise<StoredCorrectionMemoryEntry | null> {
  const entries = await loadAll();
  const normalized = originalName.toLowerCase().trim();
  return entries.find(e => (e.originalName ?? '').toLowerCase().trim() === normalized) ?? null;
}

export async function applyCorrections<T extends { name: string; cal: number; protein: number; carbs: number; fat: number }>(
  items: T[]
): Promise<T[]> {
  const entries = await loadAll();
  if (entries.length === 0) return items;
  return items.map(item => {
    const normalized = item.name.toLowerCase().trim();
    const match = entries.find(e => (e.originalName ?? '').toLowerCase().trim() === normalized);
    if (!match) return item;
    return {
      ...item,
      name: match.canonicalName,
      cal: match.calories ?? item.cal,
      protein: match.protein ?? item.protein,
      carbs: match.carbs ?? item.carbs,
      fat: match.fat ?? item.fat,
    };
  });
}

export async function deleteCorrectionMemory(id: string): Promise<void> {
  const entries = await loadAll();
  await saveAll(entries.filter(e => e.id !== id));
}
