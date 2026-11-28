const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
const Module = require('node:module');

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

const notificationsPath = require.resolve('../src/services/notifications');
const cancelled = [];
let alarmResult = { status: 'denied', canAskAgain: false, precision: 'approximate' };
require.cache[notificationsPath] = new Module(notificationsPath);
require.cache[notificationsPath].filename = notificationsPath;
require.cache[notificationsPath].loaded = true;
require.cache[notificationsPath].exports = {
  cancel: async (id) => { if (id) cancelled.push(id); return true; },
  scheduleAt: async () => ({ status: 'denied', canAskAgain: false }),
  scheduleAlarm: async () => alarmResult,
  getScheduledAlarms: async () => [],
  scheduleYearly: async () => ({ status: 'denied', canAskAgain: false }),
};

const { nextClassAlarmOccurrence, nextRoutineAlarmOccurrence, syncRoutineAlarm, resyncReminders } = require('../src/services/reminders');

(async () => {
  const monday = new Date(2099, 0, 5, 8, 50, 0, 0);
  const nextAlarmClass = nextClassAlarmOccurrence({ day: 0, start: '09:00', suspended: {} }, 15, monday);
  assert.equal(nextAlarmClass.getDate(), 12, 'A passed lead point targets the following weekly class.');
  const suspendedKey = `${nextAlarmClass.getFullYear()}-${String(nextAlarmClass.getMonth() + 1).padStart(2, '0')}-${String(nextAlarmClass.getDate()).padStart(2, '0')}`;
  const afterSuspension = nextClassAlarmOccurrence({ day: 0, start: '09:00', suspended: { [suspendedKey]: true } }, 15, monday);
  assert.equal(afterSuspension.getDate(), 19, 'A suspended occurrence is skipped without duplicating alarms.');
  const routineOccurrence = nextRoutineAlarmOccurrence({ weekdays: [0, 2], startTime: '09:00', enabled: true }, 30, monday);
  assert.equal(routineOccurrence.getDate(), 7, 'Routine alarms choose the next configured weekday.');
  const afterCompleted = nextRoutineAlarmOccurrence({ weekdays: [0, 2], startTime: '09:00', enabled: true, completedDates: ['2099-01-07'] }, 30, monday);
  assert.equal(afterCompleted.getDate(), 12, 'Completed routine dates are skipped when finding the next alarm.');
  const paused = await syncRoutineAlarm({ id: 'paused', enabled: false, alarmLeadMinutes: 30 }, 'paused-alarm-id');
  assert.equal(paused.status, 'disabled');
  assert.ok(cancelled.includes('paused-alarm-id'), 'Pausing a routine cancels its scheduled alarm.');

  const result = await resyncReminders({
    events: [{ id: 'fixture-event', title: 'Evento de prueba', dateKey: '2099-06-15', time: '09:00', leadMinutes: 15 }],
    birthdays: [{ id: 'fixture-birthday', name: 'Cumple de prueba', dateKey: '2000-06-15', time: '09:00', daysBefore: 1 }],
    activities: [{ id: 'fixture-class', title: 'Clase de prueba', day: (new Date().getDay() + 6) % 7, start: '23:59', leadMinutes: 15 }],
    routines: [{ id: 'fixture-routine', name: 'Rutina de prueba', weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '23:59', enabled: true, alarmLeadMinutes: 15, alarmNotificationId: 'foreign-id' }],
  });
  assert.deepEqual(result.eventPatches, [], 'A denied schedule does not invent a notification ID.');
  assert.deepEqual(result.failures, [
    { domain: 'events', id: 'fixture-event', status: 'denied' },
    { domain: 'birthdays', id: 'fixture-birthday', status: 'denied' },
    { domain: 'activities', id: 'fixture-class', status: 'denied' },
    { domain: 'routines', id: 'fixture-routine', status: 'denied' },
  ]);

  alarmResult = { status: 'scheduled', id: 'new-local-routine-alarm', precision: 'exact' };
  const reconciled = await resyncReminders({
    routines: [{ id: 'restored-routine', name: 'Restaurada', weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '23:59', enabled: true, alarmLeadMinutes: 30, alarmNotificationId: null }],
  });
  assert.deepEqual(reconciled.routinePatches, [{ id: 'restored-routine', alarmNotificationId: 'new-local-routine-alarm' }], 'Restore reconciliation produces a fresh local alarm ID.');

  const noReminders = await resyncReminders({
    events: [{ id: 'fixture-no-reminder', title: 'Sin aviso', dateKey: '2099-06-15', time: '09:00', leadMinutes: -1 }],
    routines: [{ id: 'paused-routine', enabled: false, alarmLeadMinutes: 30, alarmNotificationId: 'paused-stale-id' }],
  });
  assert.deepEqual(noReminders.failures, [], 'Intentionally disabled reminders are not reported as restore failures.');
  assert.deepEqual(noReminders.routinePatches, [{ id: 'paused-routine', alarmNotificationId: null }], 'Paused routine alarm IDs are cleared during reconciliation.');
  console.log('reminder-restore-smoke-test: notification outcome cases passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
