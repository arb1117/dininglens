import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './storageKeys';

export const CURRENT_SCHEMA_VERSION = 1;

const LEGACY_KEY_MAP: Array<{ from: string; to: string }> = [
  { from: '@dininglens_meal_log', to: STORAGE_KEYS.MEAL_LOG },
  { from: '@dininglens_goals',    to: STORAGE_KEYS.GOALS },
  { from: '@dininglens_profile',  to: STORAGE_KEYS.PROFILE },
];

export async function migrateStorageIfNeeded(): Promise<void> {
  try {
    const versionRaw = await AsyncStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION);
    const version = versionRaw ? parseInt(versionRaw, 10) : 0;
    if (version >= CURRENT_SCHEMA_VERSION) return;

    for (const { from, to } of LEGACY_KEY_MAP) {
      try {
        const existing = await AsyncStorage.getItem(to);
        if (existing !== null) continue;
        const old = await AsyncStorage.getItem(from);
        if (old !== null) {
          await AsyncStorage.setItem(to, old);
        }
      } catch {}
    }

    await AsyncStorage.setItem(STORAGE_KEYS.SCHEMA_VERSION, String(CURRENT_SCHEMA_VERSION));
  } catch {}
}
