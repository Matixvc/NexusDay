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
  try {
    return await runRestoreTransaction({ store: restoreStore, entries });
  } catch (error) {
    if (error.code === 'RESTORE_RECOVERY_REQUIRED') recoveryPromise = null;
    throw error;
  }
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
  await ensureRestoreRecovered();
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

/** Only an absent key may use the initial value. Preserve historical fields. */
export async function loadJSON(key, missing = []) {
  await ensureRestoreRecovered();
  let raw;
  try { raw = await readItem(key); }
  catch { throw collectionError('COLLECTION_READ_FAILED'); }
  if (raw == null) return missing;
  let items;
  try { items = JSON.parse(raw); }
  catch { throw collectionError('INVALID_JSON'); }
  validateCollectionItems(items);
  return items;
}

function validateCollectionItems(items) {
  if (!Array.isArray(items)) throw collectionError('INCOMPATIBLE_COLLECTION');
  const ids = new Set();
  for (const item of items) {
    const id = item?.id;
    if (!(typeof id === 'string' && id.trim() || Number.isFinite(id)) || ids.has(id)) {
      throw collectionError('INCOMPATIBLE_COLLECTION');
    }
    ids.add(id);
  }
}

function collectionError(code) {
  return Object.assign(new Error(code), { code });
}

// ND-02 replaces several keys together, so notification and UI writers share one queue.
let collectionQueue = Promise.resolve();
export function withCollectionLock(operation) {
  const result = collectionQueue.then(operation);
  collectionQueue = result.catch(() => undefined);
  return result;
}

const collectionListeners = new Map();
export function subscribeCollection(key, listener) {
  if (!collectionListeners.has(key)) collectionListeners.set(key, new Set());
  const listeners = collectionListeners.get(key);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function mutateCollection(key, transform) {
  return withCollectionLock(() => mutateLockedCollection(key, transform));
}

// For reminder IDs generated while restore already owns the collection lock.
export async function mutateLockedCollection(key, transform) {
  const current = await loadJSON(key);
  const next = transform(current);
  if (!next) return false;
  validateCollectionItems(next);
  await saveJSONStrict(key, next);
  collectionListeners.get(key)?.forEach(listener => listener(next));
  return true;
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
