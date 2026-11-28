const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const defaultLoader = require.extensions['.js'];
const projectSource = `${path.resolve(__dirname, '..', 'src')}${path.sep}`;
require.extensions['.js'] = (module, filename) => {
  if (!filename.startsWith(projectSource)) return defaultLoader(module, filename);
  const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false, presets: [require.resolve('babel-preset-expo')],
  });
  module._compile(result.code, filename);
};

const {
  normalizeRoutine,
  isRoutineScheduledForDate,
  toggleRoutineCompletion,
  createRoutineRepository,
} = require('../src/services/routines');
const { buildDashboard } = require('../src/services/dashboard');
const { todayKey, weekdayIndex } = require('../src/utils/dates');
const { buildScheduleWidgetSnapshot } = require('../src/services/scheduleWidgetSnapshot');
const routinesScreenSource = fs.readFileSync(path.join(__dirname, '../src/screens/RoutinesScreen.js'), 'utf8');
assert.match(routinesScreenSource, /cancelAlarm\(selectedRoutine\?\.alarmNotificationId\)/, 'Deleting a routine cancels its alarm.');
assert.match(routinesScreenSource, /toggleRoutineEnabled/, 'Pause and resume use the alarm-aware routine path.');

const base = {
  id: 'fixture-routine', name: 'Estudiar', weekdays: [0, 2, 4], startTime: '18:00', endTime: '19:00',
};
const historical = normalizeRoutine(base);
assert.equal(historical.alarmLeadMinutes, null, 'Historical routines default to alarms disabled.');
assert.equal(historical.alarmNotificationId, null, 'Historical notification IDs are never invented.');
assert.equal(normalizeRoutine({ ...base, alarmLeadMinutes: 45, alarmNotificationId: 'local-id' }).alarmLeadMinutes, 45);
assert.throws(() => normalizeRoutine({ ...base, alarmLeadMinutes: 15, startTime: null, endTime: null }), /alarm-time-required/);
assert.throws(() => normalizeRoutine({ ...base, alarmLeadMinutes: 0 }), /invalid-alarm-lead/);
assert.deepEqual(normalizeRoutine({ ...base, completedDates: ['2026-01-02', '2026-01-02'] }).completedDates, ['2026-01-02']);
assert.equal(isRoutineScheduledForDate(base, '2026-11-23'), true, 'Monday is weekday index zero in local routine recurrence.');
assert.equal(isRoutineScheduledForDate(base, '2026-11-24'), false);
assert.deepEqual(toggleRoutineCompletion(base, '2026-11-23').completedDates, ['2026-11-23']);
assert.deepEqual(toggleRoutineCompletion({ ...base, completedDates: ['2026-11-23'] }, '2026-11-23').completedDates, []);
assert.throws(() => normalizeRoutine({ ...base, completedDates: ['2026-02-30'] }), /invalid-completed-date/);
assert.throws(() => normalizeRoutine({ ...base, weekdays: [0, 0] }), /invalid-weekdays/);
const agenda = buildDashboard({
  routines: [{ ...base, name: 'Estudio personal', weekdays: [0, 1, 2, 3, 4, 5, 6] }],
  activities: [{ id: 'class', day: weekdayIndex(new Date()), title: 'Clase', start: '08:00', end: '09:00' }],
  events: [{ id: 'event', dateKey: todayKey(), time: '10:00', title: 'Evento' }],
  now: new Date(),
});
assert.ok(Array.isArray(agenda.todayAgenda), 'Dashboard exposes the integrated agenda collection.');
assert.deepEqual(agenda.todayAgenda.map((item) => item.kind), ['activity', 'event', 'routine']);
const widgetSnapshot = buildScheduleWidgetSnapshot({ routines: [{ ...base, name: 'Rutina confidencial' }], now: new Date(), showDetails: true });
assert.equal(JSON.stringify(widgetSnapshot).includes('Rutina confidencial'), false, 'Routine records remain outside the schedule widget snapshot.');

async function repositoryCases() {
  let stored = [];
  let failNextWrite = false;
  let id = 0;
  const repository = createRoutineRepository({
    read: async () => stored,
    write: async (next) => {
      if (failNextWrite) { failNextWrite = false; throw new Error('disk-full'); }
      stored = next;
    },
    createId: () => `created-routine-${++id}`,
  });
  await repository.hydrate();
  const created = await repository.create({ name: 'Leer', weekdays: [1], startTime: null });
  assert.equal(created.ok, true);
  assert.equal(stored.length, 1);
  const duplicate = await repository.create({ name: ' Leer ', weekdays: [1], startTime: null });
  assert.equal(duplicate.error, 'duplicate-routine');
  const edited = await repository.update(created.item.id, { description: 'Cada semana' });
  assert.equal(edited.ok, true);
  const completed = await repository.toggleCompletion(created.item.id, '2026-11-24');
  assert.deepEqual(completed.item.completedDates, ['2026-11-24']);
  const concurrent = await Promise.all([
    repository.create({ name: 'Caminar', weekdays: [2], startTime: '07:00' }),
    repository.create({ name: ' Caminar ', weekdays: [2], startTime: '07:00' }),
  ]);
  assert.equal(concurrent.filter((result) => result.ok).length, 1, 'Concurrent duplicate creation is serialized.');
  const beforeFailure = repository.getSnapshot();
  failNextWrite = true;
  const failed = await repository.update(created.item.id, { name: 'Leer más', startTime: '08:00', alarmLeadMinutes: 30 });
  assert.equal(failed.error, 'storage-write-failed');
  assert.deepEqual(repository.getSnapshot(), beforeFailure, 'A failed write does not become visible in memory.');
  assert.equal((await repository.remove('missing-id')).error, 'routine-not-found');
  assert.equal((await repository.remove(created.item.id)).ok, true);
  assert.equal((await repository.remove('missing-id')).error, 'routine-not-found');
  assert.equal(stored.length, 1, 'Removing one routine leaves the other independently persisted routine.');
  const readFailure = createRoutineRepository({ read: async () => { throw new Error('unavailable'); }, write: async () => {}, createId: () => 'unused' });
  assert.equal((await readFailure.hydrate()).error, 'storage-read-failed');
  assert.equal((await readFailure.create({ name: 'No guardar', weekdays: [0] })).error, 'storage-not-ready');
  const duplicateIds = createRoutineRepository({ read: async () => [{ ...base }, { ...base }], write: async () => {}, createId: () => 'unused' });
  assert.equal((await duplicateIds.hydrate()).error, 'storage-read-failed', 'Hydration refuses duplicate stored routine IDs.');
  const journalError = new Error('restore pending');
  journalError.code = 'RESTORE_RECOVERY_REQUIRED';
  const journalFailure = createRoutineRepository({ read: async () => { throw journalError; }, write: async () => {}, createId: () => 'unused' });
  assert.equal((await journalFailure.hydrate()).error, 'storage-read-failed');
  assert.equal(journalFailure.getSnapshot().restoreRecoveryError, true, 'An unresolved ND-02 journal still blocks app startup.');
}

repositoryCases().then(() => console.log('routines-smoke-test: recurrence and persistence cases passed'))
  .catch((error) => { console.error(error); process.exitCode = 1; });
