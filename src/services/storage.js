import AsyncStorage from '@react-native-async-storage/async-storage';
import { recoverRestoreTransaction, runRestoreTransaction } from './backupRestore';

const NAMESPACE = '@nexusday/v1';

/** Pre-rebrand namespace. Kept read-only so installs that stored data under the old
 *  name keep working after the rename; new writes always go to NAMESPACE. */
const LEGACY_NAMESPACE = '@appmobile/v1';
let recoveryPromise = null;

const restoreStore = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
};

async function ensureRestoreRecovered() {
  if (!recoveryPromise) {
    recoveryPromise = recoverRestoreTransaction(restoreStore).catch((error) => {
      recoveryPromise = null;
      throw error;
    });
  }
  return recoveryPromise;
}

/** Persists a prepared restore before the context exposes it in memory. */
export async function persistRestoreSnapshot(entries) {
  await ensureRestoreRecovered();
  return runRestoreTransaction({ store: restoreStore, entries });
}

/** `'@nexusday/v1/events'` -> `'@appmobile/v1/events'`. */
function legacyKey(key) {
  return key.startsWith(NAMESPACE) ? key.replace(NAMESPACE, LEGACY_NAMESPACE) : key;
}

/** Reads from the current namespace, falling back to the legacy one when empty. */
async function readItem(key) {
  const raw = await AsyncStorage.getItem(key);
  if (raw != null) return raw;
  return AsyncStorage.getItem(legacyKey(key));
}

export const KEYS = {
  activities: `${NAMESPACE}/activities`,
  events: `${NAMESPACE}/events`,
  birthdays: `${NAMESPACE}/birthdays`,
  notes: `${NAMESPACE}/notes`,
  habits: `${NAMESPACE}/habits`,
  expenses: `${NAMESPACE}/expenses`,
  routines: `${NAMESPACE}/routines`,
  settings: `${NAMESPACE}/settings`,
  onboarding: `${NAMESPACE}/onboarding`,
  accent: `${NAMESPACE}/accent`,
  surface: `${NAMESPACE}/surface`,
  userName: `${NAMESPACE}/user_name`,
  tabConfig: `${NAMESPACE}/tab_config`,
};

/** Strict collection reader for domains whose writes must not overwrite malformed data. */
export async function loadJSONStrict(key, fallback = []) {
  await ensureRestoreRecovered();
  const raw = await readItem(key);
  if (raw == null) return fallback;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('STORAGE_READ_FAILED'); }
  if (!Array.isArray(parsed)) throw new Error('STORAGE_READ_FAILED');
  return parsed;
}

/** Resolves only after AsyncStorage confirms the collection write; callers keep old memory on rejection. */
export async function saveJSONStrict(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

/**
 * Reads a JSON array from AsyncStorage.
 * Resolves to `fallback` when the key is missing or the payload is corrupt,
 * so a bad write can never soft-lock the app on next launch.
 */
export async function loadJSON(key, fallback = []) {
  await ensureRestoreRecovered();
  try {
    const raw = await readItem(key);
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
    // "Borrar datos" must not leave the pre-rebrand copy behind.
    await AsyncStorage.removeItem(legacyKey(key));
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
  await ensureRestoreRecovered();
  try {
    const raw = await readItem(key);
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
