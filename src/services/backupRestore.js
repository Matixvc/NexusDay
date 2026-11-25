export const BACKUP_COLLECTIONS = ['activities', 'events', 'birthdays', 'notes', 'habits', 'expenses', 'routines'];
const SCHEMA_1_COLLECTIONS = BACKUP_COLLECTIONS.filter((name) => name !== 'routines');
export const RESTORE_JOURNAL_KEY = '@nexusday/v1/restore_journal';
const RESTORE_KEYS = new Set([
  ...BACKUP_COLLECTIONS.map((name) => `@nexusday/v1/${name}`),
  '@nexusday/v1/settings', '@nexusday/v1/user_name', '@nexusday/v1/tab_config',
]);

const RECORD_FIELDS = {
  activities: { day: 'number', title: 'string', start: 'string', end: 'string', location: 'string', color: 'string', leadMinutes: 'number', suspended: 'object', notificationId: 'nullableString' },
  events: { dateKey: 'string', time: 'string', title: 'string', notes: 'string', color: 'string', leadMinutes: 'number', notificationId: 'nullableString' },
  birthdays: { name: 'string', emoji: 'string', dateKey: 'string', time: 'string', color: 'string', daysBefore: 'number', notificationId: 'nullableString' },
  notes: { kind: 'string', title: 'string', body: 'string', items: 'array', tags: 'stringArray', color: 'string', pinned: 'boolean', private: 'boolean', createdAt: 'number', updatedAt: 'number', attachment: 'nullableDescriptor', audio: 'nullableDescriptor' },
  habits: { name: 'string', emoji: 'string', color: 'string', marks: 'stringArray', notificationId: 'nullableString' },
  expenses: { dateKey: 'string', amount: 'number', category: 'string', note: 'string', createdAt: 'number', private: 'boolean' },
  routines: { name: 'string', description: 'string', icon: 'string', color: 'string', weekdays: 'numberArray', startTime: 'nullableString', endTime: 'nullableString', enabled: 'boolean', completedDates: 'stringArray' },
};
const REQUIRED_FIELDS = {
  activities: ['day', 'title', 'start', 'end'],
  events: ['dateKey', 'time', 'title'],
  birthdays: ['name', 'dateKey', 'time'],
  notes: ['title'],
  habits: ['name'],
  expenses: ['dateKey', 'amount', 'category'],
  routines: ['name', 'weekdays'],
};
const SETTINGS_FIELDS = { displayName: 'string', career: 'string', privacyEnabled: 'boolean', reduceMotion: 'boolean', lastBackupAt: 'nullableNumber' };

function isJsonValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== 'object') return false;
  return Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(isJsonValue);
}

function matchesType(value, type) {
  if (type === 'nullableNumber') return value === null || (typeof value === 'number' && Number.isFinite(value));
  if (type === 'nullableString') return value === null || typeof value === 'string';
  if (type === 'stringArray') return Array.isArray(value) && value.every((item) => typeof item === 'string');
  if (type === 'numberArray') return Array.isArray(value) && value.every((item) => Number.isInteger(item));
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'nullableDescriptor') return value === null || (
    value && typeof value === 'object' && !Array.isArray(value) && typeof value.uri === 'string' &&
    (value.name == null || typeof value.name === 'string') &&
    (value.size == null || (typeof value.size === 'number' && Number.isFinite(value.size))) &&
    (value.durationMs == null || (typeof value.durationMs === 'number' && Number.isFinite(value.durationMs)))
  );
  if (type === 'array') return Array.isArray(value);
  return typeof value === type && (type !== 'number' || Number.isFinite(value));
}

function validRecord(record, domain) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || !isJsonValue(record)) return false;
  if (typeof record.id !== 'string' || !record.id.trim()) return false;
  if (!REQUIRED_FIELDS[domain].every((key) => key in record)) return false;
  if (domain === 'activities' && (!Number.isInteger(record.day) || record.day < 0 || record.day > 6)) return false;
  if (domain === 'notes' && Array.isArray(record.items) && !record.items.every((item) => (
    item && typeof item === 'object' && !Array.isArray(item) &&
    typeof item.id === 'string' && typeof item.text === 'string' && typeof item.done === 'boolean'
  ))) return false;
  if (domain === 'routines') {
    try {
      // Normalize legacy-compatible optional fields and completed date history without dropping it.
      require('./routines').normalizeRoutine(record);
    } catch { return false; }
  }
  return Object.entries(RECORD_FIELDS[domain]).every(([key, type]) => !(key in record) || matchesType(record[key], type));
}

/** Returns a stable error code; it never includes backup values or record content. */
export function validateBackup(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.app !== 'NexusDay') return 'invalid-document';
  // Historical exports without a marker may omit collections; those domains are preserved during restore.
  if (Object.prototype.hasOwnProperty.call(parsed, 'schema') && ![1, 2].includes(parsed.schema)) return 'unsupported-schema';
  if (Object.prototype.hasOwnProperty.call(parsed, 'exportedAt') && (!Number.isFinite(parsed.exportedAt) || typeof parsed.exportedAt !== 'number')) return 'invalid-document';
  if (Object.prototype.hasOwnProperty.call(parsed, 'settings') && (
    !parsed.settings || typeof parsed.settings !== 'object' || Array.isArray(parsed.settings) || !isJsonValue(parsed.settings) ||
    !Object.entries(SETTINGS_FIELDS).every(([key, type]) => !(key in parsed.settings) || matchesType(parsed.settings[key], type))
  )) return 'invalid-document';
  if (Object.prototype.hasOwnProperty.call(parsed, 'userName') && typeof parsed.userName !== 'string') return 'invalid-document';
  if (Object.prototype.hasOwnProperty.call(parsed, 'tabConfig') && (!parsed.tabConfig || typeof parsed.tabConfig !== 'object' || Array.isArray(parsed.tabConfig) || !isJsonValue(parsed.tabConfig))) return 'invalid-document';
  const collections = parsed.collections;
  if (!collections || typeof collections !== 'object' || Array.isArray(collections)) return 'invalid-document';
  if (Object.keys(collections).some((name) => !BACKUP_COLLECTIONS.includes(name))) return 'invalid-document';
  const hasSchema = Object.prototype.hasOwnProperty.call(parsed, 'schema');
  if (parsed.schema === 1 && Object.prototype.hasOwnProperty.call(collections, 'routines')) return 'invalid-document';
  const expected = parsed.schema === 1 ? SCHEMA_1_COLLECTIONS : BACKUP_COLLECTIONS;
  const presentCollections = expected.filter((name) => Object.prototype.hasOwnProperty.call(collections, name));
  if (!presentCollections.length) return 'missing-collection';
  if (hasSchema && presentCollections.length !== expected.length) return 'missing-collection';
  for (const domain of presentCollections) {
    const records = collections[domain];
    if (!Array.isArray(records)) return 'invalid-collection';
    const ids = new Set();
    for (const record of records) {
      if (!validRecord(record, domain)) return 'invalid-record';
      if (ids.has(record.id)) return 'duplicate-id';
      ids.add(record.id);
    }
  }
  return null;
}

/** Converts picker/read/parse outcomes into safe import states without writing anything. */
export function prepareBackupImport(picked, readText) {
  if (picked?.status === 'cancel') return { status: 'cancel' };
  if (picked?.status !== 'ok') return { status: 'unavailable' };
  let parsed;
  try { parsed = JSON.parse(readText(picked.file?.uri)); } catch { return { status: 'invalid-json' }; }
  const error = validateBackup(parsed);
  return error ? { status: 'invalid', error } : { status: 'ready', backup: parsed };
}

export function backupContainsPrivateRecords(collections = {}) {
  return ['notes', 'expenses'].some((domain) => (
    Array.isArray(collections[domain]) && collections[domain].some((record) => record?.private === true)
  ));
}

/**
 * Gates backup creation before the callback that writes and shares the JSON.
 * Private exports require both an explicit readability warning confirmation and
 * device authentication; neither cancellation path can create a file.
 */
export async function runBackupExport({ payload, privateExportConfirmed = false, authorize, writeBackup }) {
  const containsPrivateRecords = backupContainsPrivateRecords(payload?.collections);
  if (containsPrivateRecords && !privateExportConfirmed) return { status: 'confirmation-required' };
  if (!containsPrivateRecords) return writeBackup(payload);

  let writeResult;
  const authorization = await authorize({
    record: { private: true },
    action: 'mutate',
    privacyEnabled: true,
    promptMessage: 'Autoriza exportar datos privados',
    onAuthorized: async () => { writeResult = await writeBackup(payload); },
  });
  if (!authorization.ok) return { status: 'authorization-denied', reason: authorization.reason };
  return writeResult;
}

export function backupRequiresPrivateAuthorization({ collections, currentPrivacyEnabled, settings, currentHasPrivateRecords }) {
  const disablesProtection = currentPrivacyEnabled !== false && settings?.privacyEnabled === false;
  return Boolean(currentHasPrivateRecords || disablesProtection || backupContainsPrivateRecords(collections));
}

export function isPartialHistoricalBackup(parsed) {
  return parsed?.app === 'NexusDay' && !Object.prototype.hasOwnProperty.call(parsed, 'schema') &&
    SCHEMA_1_COLLECTIONS.some((name) => !Object.prototype.hasOwnProperty.call(parsed.collections || {}, name));
}

/** Merges historical partial exports without interpreting omitted domains as empty. */
export function completeBackupCollections(collections, currentCollections) {
  return Object.fromEntries(BACKUP_COLLECTIONS.map((name) => [
    name,
    Array.isArray(collections?.[name])
      ? (name === 'routines' ? collections[name].map((routine) => require('./routines').normalizeRoutine(routine)) : collections[name])
      : (currentCollections[name] || []),
  ]));
}

function createError(code) {
  const error = new Error(code === 'recovery-required'
    ? 'La restauración quedó incompleta y requiere recuperar el respaldo anterior.'
    : 'No se pudo completar la restauración. Los datos anteriores se conservaron cuando fue posible.');
  error.code = code === 'recovery-required' ? 'RESTORE_RECOVERY_REQUIRED' : 'RESTORE_FAILED';
  return error;
}

async function rollback(store, originals) {
  for (const item of [...originals].reverse()) {
    if (item.value == null) await store.remove(item.key);
    else await store.set(item.key, item.value);
    if (await store.get(item.key) !== item.value) throw createError('recovery-required');
  }
}

async function clearJournal(store) {
  await store.remove(RESTORE_JOURNAL_KEY);
}

/** Recovers a prepared journal before any app collection is hydrated. */
export async function recoverRestoreTransaction(store) {
  const raw = await store.get(RESTORE_JOURNAL_KEY);
  if (raw == null) return { recovered: false };
  let journal;
  try { journal = JSON.parse(raw); } catch { throw createError('recovery-required'); }
  if (journal?.version !== 1 || journal.status !== 'prepared' || !Array.isArray(journal.originals)) {
    throw createError('recovery-required');
  }
  if (!journal.originals.every((item) => item && RESTORE_KEYS.has(item.key) && (item.value === null || typeof item.value === 'string')) ||
      new Set(journal.originals.map((item) => item.key)).size !== journal.originals.length) {
    throw createError('recovery-required');
  }
  try { await rollback(store, journal.originals); } catch { throw createError('recovery-required'); }
  try { await clearJournal(store); } catch { throw createError('recovery-required'); }
  return { recovered: true };
}

/**
 * Writes a recoverable before-image journal, commits every key, verifies, then clears it.
 * AsyncStorage has no multi-key transaction: process death between writes is recovered on
 * next startup, while simultaneous storage corruption or a failed rollback may remain partial.
 */
export async function runRestoreTransaction({ store, entries }) {
  if (!Array.isArray(entries) || !entries.length || entries.some((item) => !item || typeof item.key !== 'string' || typeof item.value !== 'string')) {
    throw createError('failed');
  }
  const keys = entries.map((item) => item.key);
  if (new Set(keys).size !== keys.length || keys.some((key) => !RESTORE_KEYS.has(key))) throw createError('failed');
  await recoverRestoreTransaction(store);
  const originals = [];
  try {
    for (const { key } of entries) originals.push({ key, value: await store.get(key) });
    const journal = JSON.stringify({ version: 1, status: 'prepared', originals });
    await store.set(RESTORE_JOURNAL_KEY, journal);
    if (await store.get(RESTORE_JOURNAL_KEY) !== journal) throw new Error('journal verification failed');
    for (const { key, value } of entries) {
      await store.set(key, value);
      if (await store.get(key) !== value) throw new Error('verify failed');
    }
    await clearJournal(store);
    return { persisted: true };
  } catch {
    try {
      if (originals.length === entries.length) await rollback(store, originals);
      await clearJournal(store);
    } catch {
      throw createError('recovery-required');
    }
    throw createError('failed');
  }
}
