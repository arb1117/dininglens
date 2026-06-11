import type { StoredWeightEntry } from '../storage/schema';
import { STORAGE_KEYS, toDateKey } from '../storage/storageKeys';
import { getEnvelope, setEnvelope } from '../storage/storageClient';
import { sanitizeArray, sanitizeWeightEntry } from '../storage/storageValidation';

function uid(): string {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

async function loadAll(): Promise<StoredWeightEntry[]> {
  const env = await getEnvelope<StoredWeightEntry[]>(STORAGE_KEYS.WEIGHT_LOG, []);
  return sanitizeArray(env.data, sanitizeWeightEntry);
}

async function saveAll(entries: StoredWeightEntry[]): Promise<void> {
  await setEnvelope(STORAGE_KEYS.WEIGHT_LOG, entries);
}

export async function listWeightEntries(): Promise<StoredWeightEntry[]> {
  const entries = await loadAll();
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export async function addWeightEntry(
  weightLbs: number,
  date?: string,
  note?: string,
  source: StoredWeightEntry['source'] = 'manual'
): Promise<StoredWeightEntry> {
  const entries = await loadAll();
  const now = new Date().toISOString();
  const entryDate = date ?? toDateKey(new Date());
  const existing = entries.findIndex(e => e.date === entryDate);
  if (existing !== -1) {
    entries[existing] = { ...entries[existing], weightLbs, note, updatedAt: now };
    await saveAll(entries);
    return entries[existing];
  }
  const entry: StoredWeightEntry = {
    id: uid(),
    date: entryDate,
    weightLbs: Math.round(weightLbs * 10) / 10,
    note,
    source,
    createdAt: now,
    updatedAt: now,
  };
  await saveAll([entry, ...entries]);
  return entry;
}

export async function updateWeightEntry(
  id: string,
  patch: Partial<Omit<StoredWeightEntry, 'id' | 'createdAt'>>
): Promise<void> {
  const entries = await loadAll();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return;
  entries[idx] = { ...entries[idx], ...patch, updatedAt: new Date().toISOString() };
  await saveAll(entries);
}

export async function deleteWeightEntry(id: string): Promise<void> {
  const entries = await loadAll();
  await saveAll(entries.filter(e => e.id !== id));
}

export async function getLatestWeight(): Promise<StoredWeightEntry | null> {
  const entries = await listWeightEntries();
  return entries[0] ?? null;
}

export async function getSevenDayAverage(): Promise<number | null> {
  const entries = await listWeightEntries();
  const cutoff = toDateKey(new Date(Date.now() - 7 * 86400000));
  const recent = entries.filter(e => e.date >= cutoff);
  if (recent.length === 0) return null;
  return Math.round((recent.reduce((s, e) => s + e.weightLbs, 0) / recent.length) * 10) / 10;
}

export type WeightTrend = 'up' | 'down' | 'flat';

export async function getTrend(): Promise<WeightTrend | null> {
  const entries = await listWeightEntries();
  if (entries.length < 2) return null;
  const cutoff = toDateKey(new Date(Date.now() - 7 * 86400000));
  const recent = entries.filter(e => e.date >= cutoff);
  if (recent.length < 2) return null;
  const newest = recent[0].weightLbs;
  const oldest = recent[recent.length - 1].weightLbs;
  const delta = newest - oldest;
  if (Math.abs(delta) < 0.5) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

export async function seedWeightFromProfile(weightLbs: number): Promise<void> {
  if (!weightLbs || weightLbs <= 0) return;
  const entries = await loadAll();
  if (entries.length > 0) return;
  await addWeightEntry(weightLbs, undefined, undefined, 'profile');
}
