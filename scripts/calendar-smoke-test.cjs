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
const { buildCalendarMarks, buildDayAgenda, calendarEmptyState, dateKeyInMonth, shiftCalendarMonth } = require('../src/services/calendar');
const { formatTimeInput, timeInputError, timeRangeError } = require('../src/services/timeInput');
const calendarScreen = fs.readFileSync(path.resolve(__dirname, '../src/screens/CalendarScreen.js'), 'utf8');
const timeField = fs.readFileSync(path.resolve(__dirname, '../src/components/ui/TimeField.js'), 'utf8');
const birthdayEditor = fs.readFileSync(path.resolve(__dirname, '../src/components/BirthdayEditor.js'), 'utf8');
const rootNavigator = fs.readFileSync(path.resolve(__dirname, '../src/navigation/RootNavigator.js'), 'utf8');
assert.match(calendarScreen, /LocaleConfig\.defaultLocale = 'nexusEs'/);
assert.match(calendarScreen, /'Domingo', 'Lunes', 'Martes', 'Miércoles'/);
assert.match(calendarScreen, /accessibilityLabel="Mes anterior"[\s\S]*?accessibilityLabel="Mes siguiente"/);
assert.match(calendarScreen, /hideExtraDays[\s\S]*?enableSwipeMonths/);
assert.match(calendarScreen, /enableSwipeMonths=\{false\}/, 'El calendario debe dejar el cambio de mes exclusivamente en las flechas para que sus gestos no compitan con el pager principal.');
assert.match(calendarScreen, /onTouchStart=\{beginCalendarTouch\}[\s\S]*?onTouchEnd=\{endCalendarTouch\}/);
assert.match(calendarScreen, /const beginCalendarTouch = useCallback\(\(\) => \{[\s\S]*?acquireSwipe\(\)/, 'Al tocar la cuadrícula el pager principal debe quedar bloqueado hasta finalizar el gesto.');
assert.match(rootNavigator, /swipeEnabled:\s*!locked/, 'El swipe entre secciones principales debe seguir disponible fuera de la región del calendario.');
assert.match(calendarScreen, /width <= 374 \? styles\.calendarCardCompact/);
assert.match(timeField, /TextInput[\s\S]*inputMode="numeric"[\s\S]*maxLength=\{5\}/, 'La hora debe poder escribirse con teclado numérico.');
assert.match(calendarScreen, /Acciones del evento[\s\S]*Eliminar evento/, 'La ficha del evento debe mostrar una acción de borrado visible.');
assert.match(birthdayEditor, /Acciones del cumpleaños[\s\S]*Eliminar cumpleaños/, 'La ficha del cumpleaños debe mostrar una acción de borrado visible.');

assert.equal(formatTimeInput('9'), '9');
assert.equal(formatTimeInput('0930'), '09:30');
assert.equal(formatTimeInput('09:30'), '09:30');
assert.equal(formatTimeInput('24:00'), '24:00');
assert.equal(timeInputError(''), 'Escribe una hora en formato HH:mm.');
assert.equal(timeInputError('09:'), 'Completa la hora en formato HH:mm.');
assert.equal(timeInputError('23:59'), null);
assert.equal(timeInputError('24:00'), 'Usa una hora entre 00:00 y 23:59.');
assert.equal(timeInputError('12:60'), 'Usa una hora entre 00:00 y 23:59.');
assert.equal(timeRangeError('09:00', '09:00'), 'La hora de fin debe ser posterior al inicio.');
assert.equal(timeRangeError('09:00', '10:00'), null);

assert.equal(shiftCalendarMonth('2026-01-01', -1), '2025-12-01');
assert.equal(shiftCalendarMonth('2026-12-01', 1), '2027-01-01');
assert.equal(dateKeyInMonth('2024-01-31', '2024-02-01'), '2024-02-29');
assert.equal(dateKeyInMonth('2025-01-31', '2025-02-01'), '2025-02-28');
assert.deepEqual(calendarEmptyState('birthdays'), { title: 'Sin cumpleaños', hint: 'No hay cumpleaños para esta fecha.' });
assert.deepEqual(calendarEmptyState('classes'), { title: 'Sin clases', hint: 'No hay clases programadas para esta fecha.' });
assert.deepEqual(calendarEmptyState('events'), { title: 'Sin eventos', hint: 'No hay eventos personales para esta fecha.' });
assert.deepEqual(calendarEmptyState('all'), { title: 'Día libre', hint: 'No hay eventos, clases ni cumpleaños para esta fecha.' });

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
assert.equal(marks[dateKey].selected, true);
assert.equal(marks[dateKey].disableTouchEvent, false);

console.log('calendar-smoke-test: 39 assertions passed');
