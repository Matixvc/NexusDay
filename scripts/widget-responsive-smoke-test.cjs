const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const file of ['ScheduleWidget.js', 'DayWidget.js', 'CalendarWidget.js']) {
  const source = fs.readFileSync(path.join(root, 'src/widgets', file), 'utf8');
  assert.doesNotMatch(source, /widgetFamily/);
  assert.match(source, /fillMaxSize\(\)/);
  assert.match(source, /paddingAll\(/);
  assert.match(source, /maxLines=/);
  assert.match(source, /overflow="ellipsis"/);
}
console.log('widget-responsive-smoke-test: renderer adaptable y compatible');
