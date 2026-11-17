const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const defaultLoader = require.extensions['.js'];
const projectSource = `${path.resolve(__dirname, '..', 'src')}${path.sep}`;
require.extensions['.js'] = (module, filename) => {
  if (!filename.startsWith(projectSource)) {
    defaultLoader(module, filename);
    return;
  }
  const source = fs.readFileSync(filename, 'utf8');
  const result = babel.transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    presets: [require.resolve('babel-preset-expo')],
  });
  module._compile(result.code, filename);
};

const { birthdayDateKeyForYear, birthdayOccursOn } = require('../src/services/birthdayDates');
const { buildCalendarMarks, buildDayAgenda } = require('../src/services/calendar');

const leapBirthday = { id: 'b1', name: 'Alex', dateKey: '2000-02-29', time: '09:00' };
assert.equal(birthdayDateKeyForYear(leapBirthday, 2024), '2024-02-29');
assert.equal(birthdayDateKeyForYear(leapBirthday, 2025), '2025-03-01');
assert.equal(birthdayOccursOn(leapBirthday, '2025-03-01'), true);

const dateKey = '2026-11-16'; // Monday
const rows = buildDayAgenda({
  dateKey,
  events: [{ id: 'e1', title: 'Entrega', dateKey, time: '11:00' }],
  activities: [
    { id: 'a1', title: 'Diseño', day: 0, start: '09:00', end: '10:00', suspended: {} },
    { id: 'a2', title: 'Suspendida', day: 0, start: '10:00', end: '11:00', suspended: { [dateKey]: true } },
  ],
  birthdays: [{ id: 'b2', name: 'Camila', dateKey: '2000-11-16', time: '08:00' }],
});
assert.deepEqual(rows.map((row) => row.kind), ['birthday', 'class', 'event']);
assert.equal(rows.some((row) => row.sourceId === 'a2'), false);

const eventRows = buildDayAgenda({ dateKey, events: [{ id: 'e1', title: 'Entrega', dateKey, time: '11:00' }], filter: 'events' });
assert.deepEqual(eventRows.map((row) => row.kind), ['event']);

const marks = buildCalendarMarks({
  events: [
    { id: 'e1', dateKey },
    { id: 'e2', dateKey },
  ],
  birthdays: [{ id: 'b2', dateKey: '2000-11-16' }],
  year: 2026,
  selectedKey: dateKey,
  colors: { event: '#00f', birthday: '#f90' },
});
assert.deepEqual(marks[dateKey].dots.map((dot) => dot.key), ['events', 'birthdays']);
assert.equal(marks[dateKey].dots.length, 2);

console.log('calendar-smoke-test: 8 assertions passed');
