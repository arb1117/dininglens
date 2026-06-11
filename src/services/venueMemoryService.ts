import type { StoredVenueMemoryEntry } from '../storage/schema';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { getEnvelope, setEnvelope } from '../storage/storageClient';
const MAX_VENUE_MEMORY = 1000;

function uid(): string {
  return `vm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function sortDate(entry: Pick<StoredVenueMemoryEntry, 'lastUsedAt' | 'updatedAt'>): string {
  return entry.lastUsedAt || entry.updatedAt || '';
}

async function loadAll(): Promise<StoredVenueMemoryEntry[]> {
  const env = await getEnvelope<StoredVenueMemoryEntry[]>(STORAGE_KEYS.VENUE_MEMORY, []);
  return Array.isArray(env.data) ? env.data : [];
}

async function saveAll(entries: StoredVenueMemoryEntry[]): Promise<void> {
  const capped = entries
    .filter(e => typeof e.venueName === 'string' && typeof e.itemName === 'string')
    .sort((a, b) => {
      const bUses = Number.isFinite(b.useCount) ? b.useCount : 0;
      const aUses = Number.isFinite(a.useCount) ? a.useCount : 0;
      if (bUses !== aUses) return bUses - aUses;
      return sortDate(b).localeCompare(sortDate(a));
    })
    .slice(0, MAX_VENUE_MEMORY);
  await setEnvelope(STORAGE_KEYS.VENUE_MEMORY, capped);
}

export async function listVenueMemory(venueName?: string): Promise<StoredVenueMemoryEntry[]> {
  const entries = await loadAll();
  const filtered = venueName
    ? entries.filter(e => e.normalizedVenueName === normalize(venueName))
    : entries;
  return filtered.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
}

export async function recordVenueMeal(
  venueName: string,
  itemName: string,
  macros: { calories: number; protein: number; carbs: number; fat: number },
  opts?: { venueId?: string; placeId?: string; servingDescription?: string; source?: StoredVenueMemoryEntry['source'] }
): Promise<StoredVenueMemoryEntry> {
  const entries = await loadAll();
  const nVenue = normalize(venueName);
  const nItem = normalize(itemName);
  const existing = entries.find(
    e => e.normalizedVenueName === nVenue && e.normalizedItemName === nItem
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.calories = macros.calories;
    existing.protein = macros.protein;
    existing.carbs = macros.carbs;
    existing.fat = macros.fat;
    existing.useCount = (existing.useCount || 0) + 1;
    existing.lastUsedAt = now;
    existing.updatedAt = now;
    if (opts?.servingDescription) existing.servingDescription = opts.servingDescription;
    await saveAll(entries);
    return existing;
  }
  const entry: StoredVenueMemoryEntry = {
    id: uid(),
    venueId: opts?.venueId,
    placeId: opts?.placeId,
    venueName,
    normalizedVenueName: nVenue,
    itemName,
    normalizedItemName: nItem,
    calories: macros.calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    servingDescription: opts?.servingDescription,
    source: opts?.source ?? 'logged_meal',
    useCount: 1,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
  };
  await saveAll([entry, ...entries]);
  return entry;
}

export async function findVenueItem(
  venueName: string,
  itemName: string
): Promise<StoredVenueMemoryEntry | null> {
  const entries = await loadAll();
  const nVenue = normalize(venueName);
  const nItem = normalize(itemName);
  return entries.find(
    e => e.normalizedVenueName === nVenue && e.normalizedItemName === nItem
  ) ?? null;
}

export async function getVenueItemSuggestions(
  venueName: string,
  query: string
): Promise<StoredVenueMemoryEntry[]> {
  const entries = await loadAll();
  const nVenue = normalize(venueName);
  const nQuery = normalize(query);
  return entries
    .filter(e => e.normalizedVenueName === nVenue && e.normalizedItemName.includes(nQuery))
    .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
    .slice(0, 5);
}

export async function deleteVenueMemory(id: string): Promise<void> {
  const entries = await loadAll();
  await saveAll(entries.filter(e => e.id !== id));
}
