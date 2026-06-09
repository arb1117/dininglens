import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StorageEnvelope } from './schema';

export async function getJSON<T>(
  key: string,
  fallback: T,
  validator?: (v: unknown) => boolean
): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (validator && !validator(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export async function setJSON<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

export async function getEnvelope<T>(
  key: string,
  fallback: T
): Promise<StorageEnvelope<T>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) {
      return { version: 0, updatedAt: '', data: fallback };
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      'updatedAt' in parsed &&
      'data' in parsed
    ) {
      return parsed as StorageEnvelope<T>;
    }
    return { version: 0, updatedAt: '', data: parsed as T };
  } catch {
    return { version: 0, updatedAt: '', data: fallback };
  }
}

export async function setEnvelope<T>(
  key: string,
  data: T,
  version = 1
): Promise<void> {
  const envelope: StorageEnvelope<T> = {
    version,
    updatedAt: new Date().toISOString(),
    data,
  };
  await setJSON(key, envelope);
}
