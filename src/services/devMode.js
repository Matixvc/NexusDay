import AsyncStorage from '@react-native-async-storage/async-storage';

export const ENABLE_DEV_MODE = __DEV__ === true;

export const DEV_NAMESPACE = '@nexusday/dev/';

export function isDevModeEnabled() {
  return ENABLE_DEV_MODE;
}

export function devKey(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('devMode: "name" must be a non-empty string');
  }
  if (name.includes('..') || name.includes('\\')) {
    throw new Error('devMode: key name attempts to escape the dev namespace');
  }
  const key = `${DEV_NAMESPACE}${name}`;
  if (!key.startsWith(DEV_NAMESPACE)) {
    throw new Error('devMode: key does not belong to the dev namespace');
  }
  return key;
}

export async function devSaveJSON(name, value) {
  if (!ENABLE_DEV_MODE) {
    throw new Error('devMode: writes are disabled because dev mode is off');
  }
  const key = devKey(name);
  if (!key.startsWith(DEV_NAMESPACE)) {
    throw new Error('devMode: refusing to write outside the dev namespace');
  }
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('[devMode] could not write', key, error);
    throw error;
  }
}

export async function devLoadJSON(name, fallback = null) {
  if (!ENABLE_DEV_MODE) {
    return fallback;
  }
  const key = devKey(name);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (error) {
    console.error('[devMode] could not read', key, error);
    throw error;
  }
}

export async function devRemoveKey(name) {
  if (!ENABLE_DEV_MODE) {
    throw new Error('devMode: writes are disabled because dev mode is off');
  }
  const key = devKey(name);
  if (!key.startsWith(DEV_NAMESPACE)) {
    throw new Error('devMode: refusing to remove a key outside the dev namespace');
  }
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('[devMode] could not remove', key, error);
    throw error;
  }
}

export async function devClearAll() {
  if (!ENABLE_DEV_MODE) {
    throw new Error('devMode: writes are disabled because dev mode is off');
  }
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const candidates = Array.isArray(allKeys)
      ? allKeys.filter((key) => typeof key === 'string' && key.startsWith(DEV_NAMESPACE))
      : [];

    for (const key of candidates) {
      if (!key.startsWith(DEV_NAMESPACE)) {
        throw new Error(`devMode: refusing to remove non-dev key ${key}`);
      }
      await AsyncStorage.removeItem(key);
    }
    return true;
  } catch (error) {
    console.error('[devMode] could not clear dev keys', error);
    throw error;
  }
}

export function devCreateId() {
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
