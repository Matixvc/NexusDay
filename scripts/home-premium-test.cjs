const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const defaultLoader = require.extensions['.js'];
const projectSource = `${path.resolve(__dirname, '..', 'src')}${path.sep}`;
require.extensions['.js'] = (module, filename) => {
  if (!filename.startsWith(projectSource)) return defaultLoader(module, filename);
  const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    babelrc: false,
    configFile: false,
    presets: [require.resolve('babel-preset-expo')],
  });
  module._compile(result.code, filename);
};

const { buildDashboard, dailyCommitmentSummary } = require('../src/services/dashboard');
const { createRoutineToggleGuard, eventDestination } = require('../src/services/homeActions');
const homeSource = fs.readFileSync(path.resolve(__dirname, '../src/screens/HomeScreen.js'), 'utf8');
const daySectionsSource = fs.readFileSync(path.resolve(__dirname, '../src/screens/home/DaySections.js'), 'utf8');
const calendarSource = fs.readFileSync(path.resolve(__dirname, '../src/screens/CalendarScreen.js'), 'utf8');
const navigatorSource = fs.readFileSync(path.resolve(__dirname, '../src/navigation/RootNavigator.js'), 'utf8');

const now = new Date(2026, 10, 25, 10, 30, 0);
const activities = [
  { id: 'early', day: 2, title: 'Laboratorio', start: '09:00', end: '11:00', location: 'Sala A', color: '#22aacc' },
  { id: 'middle', day: 2, title: 'Taller', start: '10:00', end: '12:00', location: 'Sala B', color: '#7766dd' },
  { id: 'latest', day: 2, title: 'Ayudantía', start: '10:15', end: '10:45', location: 'Sala C', color: '#dd6677' },
  { id: 'ended', day: 2, title: 'Finalizada', start: '08:00', end: '10:30', location: 'Sala D' },
  { id: 'next', day: 2, title: 'Próxima clase', start: '11:00', end: '12:00', location: 'Sala E' },
  { id: 'anytime', day: 2, title: 'Lectura libre', start: '', end: '', location: 'Biblioteca' },
];
const events = [
  { id: 'event-next', dateKey: '2026-11-25', time: '11:30', title: 'Reunión', color: '#ffaa22' },
];
const routines = [
  { id: 'routine', name: 'Repasar apuntes', description: '20 minutos', weekdays: [2], enabled: true, completedDates: [] },
];

const dashboard = buildDashboard({ activities, events, routines, now });

assert.equal(dashboard.currentActivity.sourceId, 'latest', 'La actividad iniciada más recientemente domina Ahora.');
assert.equal(dashboard.currentActivity.minutesRemaining, 15, 'Ahora conserva el contador hasta el final de la actividad.');
assert.deepEqual(
  dashboard.concurrentActivities.map((item) => item.sourceId),
  ['middle', 'early'],
  'Las simultáneas restantes permanecen separadas y ordenadas por inicio descendente.',
);
assert.equal(dashboard.nextTimedItems[0].minutesUntil, 30, 'La siguiente actividad conserva el contador hasta su inicio.');
assert.equal(dashboard.concurrentActivities.every((item) => item.status === 'in-progress'), true);
assert.deepEqual(
  dashboard.nextTimedItems.map((item) => item.sourceId),
  ['next', 'event-next'],
  'Después contiene solo elementos futuros en orden cronológico.',
);
assert.equal(dashboard.nextTimedItems.some((item) => item.sourceId === 'ended'), false, 'El fin exacto es exclusivo.');
assert.deepEqual(
  dashboard.anytimeItems.map((item) => item.sourceId),
  ['anytime', 'routine'],
  'Las actividades sin hora y las rutinas viven en En cualquier momento.',
);
assert.equal(dashboard.dayState, 'active');

const freeDay = buildDashboard({
  activities: [{ id: 'other-day', day: 4, title: 'Mañana', start: '09:00', end: '10:00' }],
  now,
});
assert.equal(freeDay.dayState, 'free');

const suspendedDay = buildDashboard({
  activities: [{ id: 'paused', day: 2, title: 'Suspendida', start: '09:00', end: '10:00', suspended: { '2026-11-25': true } }],
  now,
});
assert.equal(suspendedDay.dayState, 'suspended');

const unconfigured = buildDashboard({ now });
assert.equal(unconfigured.dayState, 'unconfigured');

const finished = buildDashboard({
  activities: [{ id: 'past', day: 2, title: 'Pasada', start: '08:00', end: '09:00' }],
  now,
});
assert.equal(finished.dayState, 'finished');
const finishedWithTomorrow = buildDashboard({
  activities: [{ id: 'past', day: 2, title: 'Pasada', start: '08:00', end: '09:00' }],
  events: [{ id: 'tomorrow', dateKey: '2026-11-26', time: '09:00', title: 'Mañana' }],
  now,
});
assert.equal(finishedWithTomorrow.dayState, 'finished', 'Los eventos futuros no mantienen activo el estado de hoy.');

const whitespaceTime = buildDashboard({
  activities: [{ id: 'blank-time', day: 2, title: 'Flexible', start: '   ', end: ' ' }],
  now,
});
assert.equal(whitespaceTime.anytimeItems[0].startTime, null, 'Una hora en blanco se normaliza como sin hora.');
assert.equal(dailyCommitmentSummary('Miércoles', 0), 'Miércoles · Sin compromisos para hoy');
assert.equal(dailyCommitmentSummary('Miércoles', 1), 'Miércoles · 1 compromiso para hoy');
assert.equal(dailyCommitmentSummary('Miércoles', 3), 'Miércoles · 3 compromisos para hoy');

const privacy = buildDashboard({
  notes: [{ id: 'public', title: 'Visible' }, { id: 'private', title: 'Secreto', private: true }],
  expenses: [{ id: 'public-expense', dateKey: '2026-11-25', amount: 10 }, { id: 'private-expense', dateKey: '2026-11-25', amount: 999, private: true }],
  now,
});
assert.equal(privacy.notesCount, 1);
assert.equal(privacy.spentToday, 10);
assert.equal(JSON.stringify(privacy).includes('Secreto'), false);
assert.equal(JSON.stringify(privacy).includes('999'), false);

async function verifyRoutineGuard() {
  let releaseWrite;
  let writes = 0;
  const pendingChanges = [];
  const guard = createRoutineToggleGuard({
    toggleRoutineCompletion: async (id, dateKey) => {
      writes += 1;
      return new Promise((resolve) => { releaseWrite = () => resolve({ ok: true, item: { id, completedDates: [dateKey] } }); });
    },
    onPendingChange: (id, pending) => pendingChanges.push([id, pending]),
  });

  const first = guard.toggle('routine', '2026-11-25');
  const duplicate = await guard.toggle('routine', '2026-11-25');
  assert.deepEqual(duplicate, { ok: false, status: 'busy' });
  assert.equal(writes, 1, 'Dos pulsaciones rápidas ejecutan una sola escritura.');
  assert.deepEqual(pendingChanges, [['routine', true]], 'El estado ocupado comienza antes de escribir.');
  releaseWrite();
  assert.deepEqual(await first, { ok: true, status: 'completed' });
  assert.deepEqual(pendingChanges, [['routine', true], ['routine', false]], 'El éxito se publica después de persistir.');

  let attempts = 0;
  const retryable = createRoutineToggleGuard({
    toggleRoutineCompletion: async () => {
      attempts += 1;
      return attempts === 1 ? { ok: false, error: 'write-failed' } : { ok: true, item: { completedDates: [] } };
    },
  });
  assert.deepEqual(await retryable.toggle('routine', '2026-11-25'), { ok: false, status: 'failed' });
  assert.deepEqual(await retryable.toggle('routine', '2026-11-25'), { ok: true, status: 'pending' });
  assert.equal(attempts, 2, 'Un fallo libera la rutina para reintentar o deshacer.');
}

async function main() {
  await verifyRoutineGuard();
  assert.deepEqual(eventDestination({ id: 'event-next', dateKey: '2026-11-25' }), {
    route: 'Agenda',
    params: { focusId: 'event-next', dateKey: '2026-11-25' },
  });
  assert.match(calendarSource, /handledFocusRequest\.current === focusRequest[\s\S]*handledFocusRequest\.current = focusRequest/, 'Una nueva solicitud al mismo evento vuelve a consumirse.');
  assert.match(navigatorSource, /backBehavior="history"/, 'Atrás desde Agenda conserva Inicio como procedencia.');
  assert.match(homeSource, /navigation\.navigate\('Mi rutina'\)/, 'Inicio conserva acceso para crear y gestionar rutinas.');
  assert.match(homeSource, /todayCommitments=\{data\.todayCommitments\}/, 'Mi día muestra el resumen de compromisos.');
  assert.match(homeSource, /CurrentActivitySection[\s\S]*TimedAgendaSection[\s\S]*AnytimeSection/, 'Inicio conserva la jerarquía Ahora, Después y En cualquier momento.');
  assert.match(homeSource, /eventDestination[\s\S]*navigation\.navigate\(destination\.route, destination\.params\)/, 'Cada evento abre su fecha y registro específicos.');
  assert.match(calendarSource, /useFocusRequest[\s\S]*focusRequest\?\.dateKey[\s\S]*setVisibleMonth/, 'Agenda consume la fecha solicitada además del id.');
  assert.match(daySectionsSource, /accessibilityRole="checkbox"[\s\S]*checked:[\s\S]*busy:[\s\S]*disabled:/, 'TalkBack recibe estado de rutina completo, ocupado y deshabilitado.');
  assert.match(daySectionsSource, /minHeight: 48/, 'La acción de rutina conserva un objetivo táctil Android de 48 dp.');
  assert.match(daySectionsSource, /reduceMotion[\s\S]*accentOpacity\.setValue[\s\S]*Animated\.timing/, 'Movimiento reducido evita la transición y el modo normal usa opacidad breve.');
  assert.match(daySectionsSource, /Completada · Deshacer/, 'La fila completada expone visualmente la acción de deshacer.');
  assert.doesNotMatch(daySectionsSource, /numberOfLines=/, 'Nombre, tipo, horario y lugar no se recortan con texto ampliado.');
  assert.doesNotMatch(daySectionsSource, /Animated\.View style=\{\[styles\.anytimeRow, \{ opacity \}\]\}/, 'El texto completado no pierde contraste por opacidad global.');
  assert.doesNotMatch(daySectionsSource, /`En \$\{formatTimeUntil/, 'Los contadores no duplican la preposición En.');
  console.log('home-premium-test: modelo, acciones y privacidad verificados');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
