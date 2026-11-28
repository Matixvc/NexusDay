const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').resolve(__dirname, '../src/screens/RoutinesScreen.js'), 'utf8');
assert.match(source, /descriptionRef\.current\?\.focus/);
assert.match(source, /startTimeRef\.current\?\.focus/);
assert.match(source, /endTimeRef\.current\?\.focus/);
assert.match(source, /returnKeyType="next"/);
assert.match(source, /Keyboard\.dismiss/);
console.log('keyboard-flow-smoke-test: foco y teclado verificados');
