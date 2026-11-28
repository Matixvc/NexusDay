const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const calendar = fs.readFileSync(path.join(root, 'src/screens/CalendarScreen.js'), 'utf8');
const schedule = fs.readFileSync(path.join(root, 'src/screens/ScheduleScreen.js'), 'utf8');

for (const source of [calendar, schedule]) {
  assert.match(source, /initialValues/);
  assert.match(source, /JSON\.stringify\([^\n]*values[^\n]*initialValues/);
  assert.match(source, /title="¿Descartar cambios\?"/);
  assert.match(source, /confirmLabel="Descartar"/);
}
assert.match(calendar, /alarmNotificationId/);
assert.match(schedule, /alarmEnabled/);
console.log('form-dismiss-smoke-test: protección de borradores verificada');
