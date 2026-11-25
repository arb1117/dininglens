import type { StoredCorrectionMemoryEntry } from '../storage/schema';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { getEnvelope, setEnvelope } from '../storage/storageClient';
import { sanitizeArray, sanitizeCorrectionMemoryEntry } from '../storage/storageValidation';
const MAX_CORRECTION_MEMORY = 500;

function uid(): string {
  return `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function sortDate(entry: Pick<StoredCorrectionMemoryEntry, 'lastUsedAt' | 'updatedAt'>): string {
  return entry.lastUsedAt || entry.updatedAt || '';
}

async function loadAll(): Promise<StoredCorrectionMemoryEntry[]> {
  const env = await getEnvelope<StoredCorrectionMemoryEntry[]>(STORAGE_KEYS.CORRECTION_MEMORY, []);
  return sanitizeArray(env.data, sanitizeCorrectionMemoryEntry);
}

async function saveAll(entries: StoredCorrectionMemoryEntry[]): Promise<void> {
  const capped = entries
    .filter(e => typeof e.canonicalName === 'string')
    .sort((a, b) => {
      const bSeen = Number.isFinite(b.timesSeen) ? b.timesSeen : 0;
      const aSeen = Number.isFinite(a.timesSeen) ? a.timesSeen : 0;
      if (bSeen !== aSeen) return bSeen - aSeen;
      return sortDate(b).localeCompare(sortDate(a));
    })
    .slice(0, MAX_CORRECTION_MEMORY);
  await setEnvelope(STORAGE_KEYS.CORRECTION_MEMORY, capped);
}

export async function listCorrectionMemory(): Promise<StoredCorrectionMemoryEntry[]> {
  const entries = await loadAll();
  return entries.sort((a, b) => (b.timesSeen || 0) - (a.timesSeen || 0));
}

export type CorrectionInput = {
  originalName: string;
  canonicalName: string;
  source?: StoredCorrectionMemoryEntry['source'];
};

function normalize(name: string | undefined): string {
  return (name ?? '').toLowerCase().trim();
}

// Correction memory stores name mappings only. Macros are deliberately not
// persisted: logged values are portion-scaled, so re-applying them to the next
// photo compounds the portion every time the food is logged.
export async function recordCorrections(corrections: CorrectionInput[]): Promise<void> {
  const meaningful = corrections.filter(
    c => normalize(c.originalName) && normalize(c.canonicalName) && normalize(c.originalName) !== normalize(c.canonicalName)
  );
  if (meaningful.length === 0) return;
  const entries = await loadAll();
  const now = new Date().toISOString();
  for (const c of meaningful) {
    const existing = entries.find(e => normalize(e.originalName) === normalize(c.originalName));
    if (existing) {
      existing.canonicalName = c.canonicalName;
      existing.calories = undefined;
      existing.protein = undefined;
      existing.carbs = undefined;
      existing.fat = undefined;
      existing.timesSeen = (existing.timesSeen || 0) + 1;
      existing.lastUsedAt = now;
      existing.updatedAt = now;
    } else {
      entries.unshift({
        id: uid(),
        canonicalName: c.canonicalName,
        originalName: c.originalName,
        source: c.source ?? 'photo_correction',
        confidence: 1,
        timesSeen: 1,
        lastUsedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  await saveAll(entries);
}

export async function findCorrection(originalName: string): Promise<StoredCorrectionMemoryEntry | null> {
  const entries = await loadAll();
  const normalized = normalize(originalName);
  return entries.find(e => normalize(e.originalName) === normalized) ?? null;
}

export async function applyCorrections<T extends { name: string }>(items: T[]): Promise<T[]> {
  const entries = await loadAll();
  if (entries.length === 0) return items;
  return items.map(item => {
    const normalized = normalize(item.name);
    const match = entries.find(
      e => normalize(e.originalName) === normalized && normalize(e.canonicalName) !== normalized
    );
    if (!match) return item;
    return { ...item, name: match.canonicalName };
  });
}

export async function deleteCorrectionMemory(id: string): Promise<void> {
  const entries = await loadAll();
  await saveAll(entries.filter(e => e.id !== id));
}
