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
require.cache[notificationsPath] = new Module(notificationsPath);
require.cache[notificationsPath].filename = notificationsPath;
require.cache[notificationsPath].loaded = true;
require.cache[notificationsPath].exports = {
  cancel: async () => true,
  scheduleAt: async () => ({ status: 'denied', canAskAgain: false }),
  scheduleYearly: async () => ({ status: 'denied', canAskAgain: false }),
};

const { resyncReminders } = require('../src/services/reminders');

(async () => {
  const result = await resyncReminders({
    events: [{ id: 'fixture-event', title: 'Evento de prueba', dateKey: '2099-06-15', time: '09:00', leadMinutes: 15 }],
    birthdays: [{ id: 'fixture-birthday', name: 'Cumple de prueba', dateKey: '2000-06-15', time: '09:00', daysBefore: 1 }],
    activities: [{ id: 'fixture-class', title: 'Clase de prueba', day: (new Date().getDay() + 6) % 7, start: '23:59', leadMinutes: 0 }],
  });
  assert.deepEqual(result.eventPatches, [], 'A denied schedule does not invent a notification ID.');
  assert.deepEqual(result.failures, [
    { domain: 'events', id: 'fixture-event', status: 'denied' },
    { domain: 'birthdays', id: 'fixture-birthday', status: 'denied' },
    { domain: 'activities', id: 'fixture-class', status: 'denied' },
  ]);

  const noReminders = await resyncReminders({
    events: [{ id: 'fixture-no-reminder', title: 'Sin aviso', dateKey: '2099-06-15', time: '09:00', leadMinutes: -1 }],
  });
  assert.deepEqual(noReminders.failures, [], 'Intentionally disabled reminders are not reported as restore failures.');
  console.log('reminder-restore-smoke-test: notification outcome cases passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
