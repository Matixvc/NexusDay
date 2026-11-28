const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../src/components/ui/Sheet.js'), 'utf8');
assert.match(source, /settings\?\.reduceMotion === true/);
assert.match(source, /isReduceMotionEnabled/);
assert.match(source, /animationType=\{reduceMotion \? 'none' : 'slide'\}/);
assert.match(source, /reduceMotionChanged/);
console.log('reduced-motion-smoke-test: preferencias de app y Android verificadas');
