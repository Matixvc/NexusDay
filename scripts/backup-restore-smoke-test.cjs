const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const defaultLoader = require.extensions['.js'];
const projectSource = `${path.resolve(__dirname, '..', 'src')}${path.sep}`;
require.extensions['.js'] = (module, filename) => {
  if (!filename.startsWith(projectSource)) return defaultLoader(module, filename);
  const source = fs.readFileSync(filename, 'utf8');
  const result = babel.transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    presets: [require.resolve('babel-preset-expo')],
  });
  module._compile(result.code, filename);
};

const { validateBackup, prepareBackupImport, backupContainsPrivateRecords, backupRequiresPrivateAuthorization, isPartialHistoricalBackup, completeBackupCollections, runRestoreTransaction, recoverRestoreTransaction, RESTORE_JOURNAL_KEY } = require('../src/services/backupRestore');
const { PRIVATE_ACTIONS, createPrivacyAuthorizer } = require('../src/services/privacyPolicy');

const collections = {
  activities: [{ id: 'a1', day: 1, title: 'Clase', start: '08:00', end: '09:00' }],
  events: [],
  birthdays: [],
  notes: [{ id: 'n1', title: 'Privada', private: true, tags: ['secreto'] }],
  habits: [],
  expenses: [],
};
const routine = { id: 'r1', name: 'Leer', description: '', icon: 'checkCircle', color: '#8b7cff', weekdays: [0, 2], startTime: null, endTime: null, enabled: true, completedDates: ['2026-01-02'] };
const backup = { app: 'NexusDay', schema: 1, exportedAt: 123, collections, settings: { privacyEnabled: true, reduceMotion: false, lastBackupAt: null }, userName: '', tabConfig: {} };

assert.equal(validateBackup(backup), null, 'Acepta el formato actual de exportación.');
let readAttempts = 0;
assert.deepEqual(prepareBackupImport({ status: 'cancel' }, () => { readAttempts += 1; throw new Error('must not read'); }), { status: 'cancel' });
assert.equal(readAttempts, 0, 'Cancellation never reads a file or prepares data for restore.');
assert.deepEqual(prepareBackupImport({ status: 'ok' }, () => { throw new Error('read failed'); }), { status: 'invalid-json' });
assert.deepEqual(prepareBackupImport({ status: 'ok' }, () => '{'), { status: 'invalid-json' });
assert.deepEqual(prepareBackupImport({ status: 'ok' }, () => JSON.stringify(backup)), { status: 'ready', backup });
assert.equal(validateBackup({ ...backup, schema: 99 }), 'unsupported-schema', 'Rechaza esquemas desconocidos.');
assert.equal(validateBackup({ ...backup, schema: null }), 'unsupported-schema', 'Rechaza un marcador de esquema explícitamente inválido.');
const missingNotes = { ...collections };
delete missingNotes.notes;
assert.equal(validateBackup({ ...backup, collections: missingNotes }), 'missing-collection');
assert.equal(validateBackup({ ...backup, collections: { ...collections, notes: [{ id: 'x', title: 'uno' }, { id: 'x', title: 'dos' }] } }), 'duplicate-id');
assert.equal(validateBackup({ ...backup, collections: { ...collections, notes: [{ id: 'x', tags: 'privado' }] } }), 'invalid-record');
assert.equal(validateBackup({ ...backup, collections: { ...collections, events: 'no-array' } }), 'invalid-collection');
assert.equal(validateBackup({ ...backup, collections: { ...collections, expenses: [{ id: 'x', amount: Infinity }] } }), 'invalid-record');
assert.equal(validateBackup({ ...backup, collections: { ...collections, notes: [{ id: 'x', title: 'nota', attachment: 'file://invalid' }] } }), 'invalid-record');
assert.equal(validateBackup({ ...backup, settings: { privacyEnabled: 'false' } }), 'invalid-document');
const missingBirthdays = { ...collections };
delete missingBirthdays.birthdays;
assert.equal(validateBackup({ ...backup, collections: missingBirthdays }), 'missing-collection');

const historical = { app: 'NexusDay', collections };
assert.equal(validateBackup(historical), null, 'Acepta respaldos históricos sin schema/exportedAt cuando contienen las seis colecciones válidas.');
const partialHistorical = { app: 'NexusDay', collections: { notes: [{ id: 'legacy-note', title: 'Nota antigua' }] } };
assert.equal(validateBackup(partialHistorical), null, 'Acepta el formato histórico parcial que la versión anterior producía.');
assert.equal(isPartialHistoricalBackup(partialHistorical), true);
const completedLegacy = completeBackupCollections(partialHistorical.collections, { ...collections, notes: [{ id: 'current-note', title: 'Actual' }] });
assert.deepEqual(completedLegacy.notes, partialHistorical.collections.notes);
assert.deepEqual(completedLegacy.activities, collections.activities, 'Keeps current records in omitted historical domains.');
assert.equal(validateBackup({ app: 'NexusDay', collections: {} }), 'missing-collection');
assert.equal(isPartialHistoricalBackup(historical), false);
assert.notEqual(validateBackup({ ...historical, collections: { ...collections, notes: [{ id: 'x', private: 'yes' }] } }), null);
assert.equal(validateBackup({ ...backup, collections: { ...collections, routines: [routine] } }), 'invalid-document', 'Schema 1 rejects an unknown seventh collection.');
const schema2 = { ...backup, schema: 2, collections: { ...collections, routines: [routine] } };
assert.equal(validateBackup(schema2), null, 'Schema 2 requires and accepts seven validated collections.');
assert.equal(validateBackup({ ...schema2, collections: { ...collections, routines: undefined } }), 'invalid-collection');
const missingRoutine = { ...schema2.collections };
delete missingRoutine.routines;
assert.equal(validateBackup({ ...schema2, collections: missingRoutine }), 'missing-collection');
assert.equal(validateBackup({ ...schema2, collections: { ...schema2.collections, routines: [{ ...routine, completedDates: ['2026-02-30'] }] } }), 'invalid-record');
assert.equal(validateBackup({ ...schema2, collections: { ...schema2.collections, routines: [{ ...routine, icon: 'webview' }] } }), 'invalid-record');
assert.equal(validateBackup({ ...schema2, collections: { ...schema2.collections, routines: [routine, routine] } }), 'duplicate-id');
assert.equal(validateBackup({ ...schema2, collections: { ...schema2.collections, routines: undefined } }), 'invalid-collection');
const currentWithRoutine = { ...collections, routines: [routine] };
assert.deepEqual(completeBackupCollections(collections, currentWithRoutine).routines, [routine], 'Schema 1 imports retain 1.2.0 routines.');
assert.deepEqual(completeBackupCollections({ routines: [] }, currentWithRoutine).routines, [], 'An explicit schema 2 empty routine collection can clear routines.');
assert.equal(backupContainsPrivateRecords(collections), true, 'Detecta registros privados sin inspeccionar ni devolver su contenido.');
assert.equal(backupContainsPrivateRecords({ notes: [{ id: 'public' }], expenses: [] }), false);
assert.equal(backupRequiresPrivateAuthorization({ collections, currentPrivacyEnabled: true, settings: { privacyEnabled: true }, currentHasPrivateRecords: false }), true);
assert.equal(backupRequiresPrivateAuthorization({ collections: { notes: [], expenses: [] }, currentPrivacyEnabled: true, settings: { privacyEnabled: false } }), true);
assert.equal(backupRequiresPrivateAuthorization({ collections: { notes: [], expenses: [] }, currentPrivacyEnabled: false, settings: { privacyEnabled: false } }), false);

let restoreMutations = 0;
const deniedRestore = createPrivacyAuthorizer(async () => ({ ok: false, reason: 'cancelled' }));
async function verifyDeniedRestore() {
  const deniedResult = await deniedRestore.authorizePrivateAction({
    record: { private: backupRequiresPrivateAuthorization({ collections, currentPrivacyEnabled: true, settings: { privacyEnabled: true }, currentHasPrivateRecords: false }) },
    action: PRIVATE_ACTIONS.delete,
    privacyEnabled: true,
    onAuthorized: () => { restoreMutations += 1; },
  });
  assert.equal(deniedResult.ok, false);
  assert.equal(restoreMutations, 0, 'Authentication cancellation never reaches storage mutation.');
}

function memoryStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  let failKey = null;
  let failCount = 0;
  let failReadKey = null;
  return {
    values,
    failOnce(key) { failKey = key; failCount = 1; },
    failReadOnce(key) { failReadKey = key; },
    async get(key) {
      if (key === failReadKey) { failReadKey = null; throw new Error('read failed'); }
      return values.has(key) ? values.get(key) : null;
    },
    async set(key, value) {
      if (key === failKey && failCount > 0) { failCount -= 1; throw new Error('write failed'); }
      values.set(key, value);
    },
    async remove(key) { values.delete(key); },
  };
}

(async () => {
  await verifyDeniedRestore();
  const keyA = '@nexusday/v1/activities';
  const keyB = '@nexusday/v1/events';
  const routineKey = '@nexusday/v1/routines';
  const successfulStore = memoryStore({ [keyA]: '["old-a"]' });
  await runRestoreTransaction({ store: successfulStore, entries: [{ key: keyA, value: '["new-a"]' }] });
  assert.equal(await successfulStore.get(keyA), '["new-a"]', 'Persists and verifies all values before reporting success.');
  assert.equal(await successfulStore.get(RESTORE_JOURNAL_KEY), null, 'Removes the journal after a completed restore.');

  const routineStore = memoryStore({ [routineKey]: '[{"id":"old-routine"}]' });
  await runRestoreTransaction({ store: routineStore, entries: [{ key: routineKey, value: '[]' }] });
  assert.equal(await routineStore.get(routineKey), '[]', 'The journal transaction accepts the routines key.');

  const wipeStore = memoryStore(Object.fromEntries([
    '@nexusday/v1/activities', '@nexusday/v1/events', '@nexusday/v1/birthdays', '@nexusday/v1/notes',
    '@nexusday/v1/habits', '@nexusday/v1/expenses', routineKey,
  ].map((key) => [key, '[{"id":"fixture"}]'])));
  await runRestoreTransaction({ store: wipeStore, entries: [
    '@nexusday/v1/activities', '@nexusday/v1/events', '@nexusday/v1/birthdays', '@nexusday/v1/notes',
    '@nexusday/v1/habits', '@nexusday/v1/expenses', routineKey,
  ].map((key) => ({ key, value: '[]' })) });
  assert.equal(await wipeStore.get(routineKey), '[]', 'A full seven-domain wipe includes routines.');

  const readFailureStore = memoryStore({ [keyA]: '["old-a"]' });
  readFailureStore.failReadOnce(keyA);
  await assert.rejects(runRestoreTransaction({ store: readFailureStore, entries: [{ key: keyA, value: '["new-a"]' }] }));
  assert.equal(await readFailureStore.get(keyA), '["old-a"]', 'Does not change data when before-image reading fails.');

  const failedStore = memoryStore({ [keyA]: '["old-a"]', [keyB]: '["old-b"]' });
  failedStore.failOnce(keyB);
  await assert.rejects(runRestoreTransaction({ store: failedStore, entries: [{ key: keyA, value: '["new-a"]' }, { key: keyB, value: '["new-b"]' }] }));
  assert.equal(await failedStore.get(keyA), '["old-a"]', 'Rolls back writes completed before a later failure.');
  assert.equal(await failedStore.get(keyB), '["old-b"]', 'Preserves the original value of a failed write.');
  assert.equal(await failedStore.get(RESTORE_JOURNAL_KEY), null, 'Clears the journal after a successful rollback.');

  const interruptedStore = memoryStore({
    [keyA]: '["new-a"]',
    [routineKey]: '[]',
    [RESTORE_JOURNAL_KEY]: JSON.stringify({ version: 1, status: 'prepared', originals: [{ key: keyA, value: '["old-a"]' }, { key: keyB, value: null }, { key: routineKey, value: '[{"id":"old-routine"}]' }] }),
  });
  interruptedStore.failOnce(keyA);
  await assert.rejects(recoverRestoreTransaction(interruptedStore), (error) => error.code === 'RESTORE_RECOVERY_REQUIRED');
  assert.notEqual(await interruptedStore.get(RESTORE_JOURNAL_KEY), null, 'Keeps a prepared journal when controlled recovery cannot write.');
  await recoverRestoreTransaction(interruptedStore);
  assert.equal(await interruptedStore.get(keyA), '["old-a"]', 'Recovers the previous snapshot after an interrupted restore.');
  assert.equal(await interruptedStore.get(keyB), null, 'Removes keys that did not exist before an interrupted restore.');
  assert.equal(await interruptedStore.get(routineKey), '[{"id":"old-routine"}]', 'Recovers the routines before-image after an interrupted restore.');
  assert.equal(await interruptedStore.get(RESTORE_JOURNAL_KEY), null);
  console.log('backup-restore-smoke-test: validation and transaction cases passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
