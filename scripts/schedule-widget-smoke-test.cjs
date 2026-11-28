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

const { buildScheduleWidgetSnapshot, getScheduleWidgetSnapshotView } = require('../src/services/scheduleWidgetSnapshot');

const now = new Date(2026, 10, 25, 9, 15);
const schedule = [
  { id: 'legacy-1', day: 2, title: 'Álgebra', start: '08:00', end: '09:00', suspended: {} },
  { id: 'legacy-2', day: 2, title: 'Historia', start: '10:00', end: '11:00', suspended: {} },
];
const privateByDefault = buildScheduleWidgetSnapshot({ activities: schedule, now });
assert.equal(privateByDefault.dateKey, '2026-11-25');
assert.equal(privateByDefault.status, 'scheduled');
assert.equal(privateByDefault.classes.length, 2);
assert.equal(privateByDefault.classes[0].title, null);
assert.deepEqual(Object.keys(privateByDefault.classes[0]), ['start', 'end', 'title']);
assert.equal(privateByDefault.nextClass.start, '10:00');
assert.equal(privateByDefault.updatedAt, now.getTime());
assert.equal(privateByDefault.dateLabel, '25/11/2026');
assert.equal(privateByDefault.currentClass, null);
const inProgress = buildScheduleWidgetSnapshot({ activities: [{ ...schedule[0], start: '09:00', end: '10:00' }], now });
assert.equal(inProgress.currentClass.start, '09:00');

const optedIn = buildScheduleWidgetSnapshot({ activities: schedule, now, showDetails: true });
assert.equal(optedIn.classes[0].title, 'Álgebra');
assert.equal(optedIn.classes[0].location, undefined);
assert.equal(buildScheduleWidgetSnapshot({ activities: [], now }).status, 'empty');
assert.equal(buildScheduleWidgetSnapshot({ activities: [{ ...schedule[0], suspended: { '2026-11-25': true } }], now }).status, 'suspended');
const staleView = getScheduleWidgetSnapshotView(privateByDefault, new Date(2026, 10, 26, 8));
assert.equal(staleView.status, 'stale');
assert.deepEqual(staleView.classes, []);
assert.equal(getScheduleWidgetSnapshotView(privateByDefault, now).status, 'scheduled');

const sunday = new Date(2026, 10, 29, 7, 0);
assert.equal(buildScheduleWidgetSnapshot({ activities: [{ ...schedule[0], day: 6 }], now: sunday }).classes.length, 1);

const routeCatalog = fs.readFileSync(path.resolve(__dirname, '../src/navigation/tabs.js'), 'utf8');
assert.match(routeCatalog, /name: 'Horario', label: 'Horario'/);

console.log('schedule-widget-smoke-test: 15 assertions passed');
