import AsyncStorage from '@react-native-async-storage/async-storage';

const NAMESPACE = '@appmobile/v1';

export const KEYS = {
  activities: `${NAMESPACE}/activities`,
  events: `${NAMESPACE}/events`,
  birthdays: `${NAMESPACE}/birthdays`,
  notes: `${NAMESPACE}/notes`,
  habits: `${NAMESPACE}/habits`,
  expenses: `${NAMESPACE}/expenses`,
  settings: `${NAMESPACE}/settings`,
};

/**
 * Reads a JSON array from AsyncStorage.
 * Resolves to `fallback` when the key is missing or the payload is corrupt,
 * so a bad write can never soft-lock the app on next launch.
 */
export async function loadJSON(key, fallback = []) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed == null) return fallback;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.warn(`[storage] could not read ${key}`, error);
    return fallback;
  }
}

export async function saveJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[storage] could not write ${key}`, error);
    return false;
  }
}

export async function removeKey(key) {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[storage] could not remove ${key}`, error);
    return false;
  }
}

/**
 * Reads any JSON payload (object, string, number). `loadJSON` is array-only, so
 * preferences such as the greeting name or the preferred calendar live here.
 */
export async function loadValue(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (error) {
    console.warn(`[storage] could not read ${key}`, error);
    return fallback;
  }
}

export async function saveValue(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[storage] could not write ${key}`, error);
    return false;
  }
}
