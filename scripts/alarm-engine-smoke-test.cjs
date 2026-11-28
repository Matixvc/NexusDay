const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
const Module = require('node:module');

const defaultLoader = require.extensions['.js'];
const projectSource = `${path.resolve(__dirname, '..', 'src')}${path.sep}`;
require.extensions['.js'] = (module, filename) => {
  if (!filename.startsWith(projectSource)) return defaultLoader(module, filename);
  const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false, presets: [require.resolve('babel-preset-expo')],
  });
  module._compile(result.code, filename);
};

function stub(id, exports) {
  const filename = require.resolve(id);
  const module = new Module(filename);
  module.filename = filename;
  module.loaded = true;
  module.exports = exports;
  require.cache[filename] = module;
}

let exactGranted = true;
let failScheduling = false;
let sequence = 0;
let scheduled = [];
const expoNotifications = {
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
  AndroidAudioUsage: { ALARM: 4 },
  AndroidAudioContentType: { SONIFICATION: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', YEARLY: 'yearly' },
  setNotificationHandler() {},
  addNotificationResponseReceivedListener() {},
  getLastNotificationResponseAsync: async () => null,
  setNotificationCategoryAsync: async () => undefined,
  setNotificationChannelAsync: async () => undefined,
  getPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  requestPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  getExactAlarmPermissionsAsync: async () => ({ granted: exactGranted, canAskAgain: !exactGranted }),
  requestExactAlarmPermissionsAsync: async () => ({ granted: exactGranted, canAskAgain: !exactGranted }),
  scheduleNotificationAsync: async (request) => {
    if (failScheduling) throw new Error('synthetic scheduling failure');
    const identifier = `alarm-${++sequence}`;
    scheduled.push({ identifier, content: request.content, trigger: request.trigger });
    return identifier;
  },
  getAllScheduledNotificationsAsync: async () => scheduled,
  cancelScheduledNotificationAsync: async (identifier) => {
    scheduled = scheduled.filter((request) => request.identifier !== identifier);
  },
};

stub('react-native', { Platform: { OS: 'android' } });
stub('expo-notifications', expoNotifications);
stub('../src/services/storage', { KEYS: {}, mutateCollection: async () => true });
stub('../src/utils/dates', { todayKey: () => '2099-01-01' });
stub('../src/theme/theme', { colors: { accent: '#8265F5' } });

const alarms = require('../src/services/notifications');

// Regression NEX-FIX1: these render paths execute normalizeAlarmLead as soon as the
// alarm section becomes visible. Importing it from reminders leaves it undefined in
// the production bundle and crashes React during render.
for (const relativePath of [
  '../src/screens/NotesScreen.js',
  '../src/screens/CalendarScreen.js',
  '../src/components/BirthdayEditor.js',
]) {
  const source = fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
  assert.doesNotMatch(
    source,
    /import\s*\{[^}]*\b(?:ALARM_LEAD_PRESETS|normalizeAlarmLead)\b[^}]*\}\s*from\s*['"]\.\.\/services\/reminders['"]/s,
    `${relativePath} must not import alarm engine helpers from reminders`,
  );
  assert.match(
    source,
    /import\s*\{[^}]*\bnormalizeAlarmLead\b[^}]*\}\s*from\s*['"]\.\.\/services\/notifications['"]/s,
    `${relativePath} must import normalizeAlarmLead from notifications`,
  );
}

(async () => {
  assert.deepEqual(alarms.ALARM_LEAD_PRESETS, [15, 30, 60, 120]);
  assert.equal(alarms.normalizeAlarmLead('45'), 45);
  assert.equal(alarms.normalizeAlarmLead(0), null);
  assert.equal(alarms.normalizeAlarmLead(10081), null);

  const targetDate = new Date('2099-06-15T12:00:00.000Z');
  const calculated = alarms.calculateAlarmDate({ targetDate, leadMinutes: 30, now: new Date('2099-06-15T10:00:00.000Z') });
  assert.equal(calculated.date.toISOString(), '2099-06-15T11:30:00.000Z');
  assert.equal(alarms.calculateAlarmDate({ targetDate, leadMinutes: -1 }).status, 'invalid');

  const exact = await alarms.scheduleAlarm({
    targetDate, leadMinutes: 15, title: 'Clase sintética', body: 'Sala de prueba',
    data: { kind: 'class', itemId: 'fixture-class', secret: 'no-persistir' },
  });
  assert.equal(exact.status, 'scheduled');
  assert.equal(exact.precision, 'exact');
  assert.equal(scheduled[0].trigger.delivery, 'alarmClock');
  assert.equal(scheduled[0].trigger.channelId, alarms.ALARM_CHANNEL_ID);
  assert.equal(scheduled[0].content.data.secret, undefined);

  exactGranted = false;
  const privateAlarm = await alarms.scheduleAlarm({
    targetDate, leadMinutes: 60, title: 'Nota privada secreta', body: 'Contenido privado',
    privateContent: true, data: { kind: 'note', itemId: 'fixture-note', privateText: 'secreto' },
  });
  assert.equal(privateAlarm.precision, 'approximate');
  assert.equal(privateAlarm.exactPermission, 'denied');
  assert.equal((await alarms.getExactAlarmPermission({ request: true })).status, 'denied');
  assert.equal(scheduled[1].trigger.delivery, 'bestEffort');
  assert.equal(scheduled[1].content.title, 'Alarma de NexusDay');
  assert.equal(scheduled[1].content.body, 'Tienes una alarma programada.');
  assert.equal(scheduled[1].content.data.privateText, undefined);

  const reconciliation = await alarms.reconcileAlarms([
    { id: 'event', domain: 'events', notificationId: 'historical-id', alarmNotificationId: exact.id },
    { id: 'birthday', domain: 'birthdays', notificationId: 'historical-birthday-id', alarmNotificationId: 'missing-id' },
    { id: 'class', domain: 'activities', notificationId: 'historical-class-id', alarmNotificationId: null },
    { id: 'routine', domain: 'routines', alarmNotificationId: privateAlarm.id },
    { id: 'legacy', domain: 'events', notificationId: 'legacy-only' },
  ]);
  assert.deepEqual(reconciliation.missing.map((item) => item.id), ['birthday']);
  assert.deepEqual(reconciliation.unlinked.map((item) => item.identifier), []);

  assert.equal(await alarms.cancelAlarm(exact.id), true);
  assert.equal((await alarms.getScheduledAlarms()).some((item) => item.identifier === exact.id), false);

  failScheduling = true;
  const originalWarn = console.warn;
  console.warn = () => {};
  const failed = await alarms.scheduleAlarm({ targetDate, leadMinutes: 120, title: 'Fallo sintético' });
  console.warn = originalWarn;
  assert.equal(failed.status, 'error');
  assert.equal(failed.precision, 'approximate');

  console.log('alarm-engine-smoke-test: cálculo, permisos, privacidad, cancelación y reconciliación verificados');
})().catch((error) => { console.error(error); process.exitCode = 1; });
