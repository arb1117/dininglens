import AsyncStorage from '@react-native-async-storage/async-storage';

export const INSTALL_ID_KEY = '@dininglens_install_id';

function generateId(): string {
  const seg = (len: number) =>
    Array.from({ length: len }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  return `${seg(8)}-${seg(4)}-4${seg(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${seg(3)}-${seg(12)}`;
}

let cachedId: string | null = null;

export async function getInstallId(): Promise<string> {
  if (cachedId) return cachedId;
  try {
    const stored = await AsyncStorage.getItem(INSTALL_ID_KEY);
    if (stored) {
      cachedId = stored;
      return cachedId;
    }
    const newId = generateId();
    await AsyncStorage.setItem(INSTALL_ID_KEY, newId);
    cachedId = newId;
    return cachedId;
  } catch {
    if (!cachedId) cachedId = generateId();
    return cachedId;
  }
}

export async function resetInstallIdForDebugOnly(): Promise<string> {
  cachedId = null;
  await AsyncStorage.removeItem(INSTALL_ID_KEY);
  return getInstallId();
}
