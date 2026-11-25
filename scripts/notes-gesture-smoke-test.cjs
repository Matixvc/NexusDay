const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const swipeSource = fs.readFileSync(path.join(root, 'src/components/ui/swipeDirection.js'), 'utf8').replace(/\bexport\s+/g, '');
const swipe = vm.runInNewContext(`${swipeSource}\n;({ SWIPE_ACTION_THRESHOLD, getSwipeActionSide })`, Object.create(null));
const notes = fs.readFileSync(path.join(root, 'src/screens/NotesScreen.js'), 'utf8');
const row = notes.slice(notes.indexOf('const NoteRow ='), notes.indexOf('/** Una casilla de checklist'));
const swipeRow = fs.readFileSync(path.join(root, 'src/components/ui/SwipeRow.js'), 'utf8');

assert.equal(swipe.getSwipeActionSide(swipe.SWIPE_ACTION_THRESHOLD + 1), 'left', 'Deslizar a la derecha debe elegir la acción izquierda (fijar).');
assert.equal(swipe.getSwipeActionSide(-swipe.SWIPE_ACTION_THRESHOLD - 1), 'right', 'Deslizar a la izquierda debe elegir la acción derecha (eliminar).');
assert.equal(swipe.getSwipeActionSide(swipe.SWIPE_ACTION_THRESHOLD), null, 'El umbral exacto no debe ejecutar una acción accidentalmente.');
assert.equal(swipe.getSwipeActionSide(-swipe.SWIPE_ACTION_THRESHOLD), null, 'El umbral negativo exacto no debe ejecutar una acción accidentalmente.');

assert.match(swipeRow, /getSwipeActionSide\(dx\)/, 'SwipeRow debe usar el mapeo de dirección cubierto por esta prueba.');
assert.match(row, /leftAction[\s\S]*?onPress:\s*togglePin/, 'La acción revelada al deslizar a la derecha debe fijar o desfijar.');
assert.match(row, /rightAction[\s\S]*?onPress:\s*askDelete/, 'La acción revelada al deslizar a la izquierda debe pedir eliminar.');
assert.doesNotMatch(row, /label:\s*exposed\s*\?\s*'Hacer privada'/, 'El gesto de eliminación no debe cambiar la privacidad.');
assert.match(row, /accessibilityActions=/, 'Las acciones de gesto deben estar disponibles para tecnologías de asistencia.');
assert.match(row, /onAccessibilityAction=/, 'Las acciones accesibles deben ejecutar los mismos handlers protegidos.');
assert.match(swipeRow, /FAIL_OFFSET_Y[\s\S]*?Math\.abs\(move\.dy\)[\s\S]*?acquireSwipe\(\)/, 'El gesto debe ceder al scroll vertical y bloquear el pager solo tras reconocer el arrastre.');

assert.match(notes, /PRIVATE_ACTIONS\.mutate[\s\S]*?updateNote\(note\.id, current => \(\{ pinned: !current\.pinned \}\)\)/, 'Fijar una nota privada debe seguir protegido por la autorización existente.');
assert.match(notes, /PRIVATE_ACTIONS\.delete[\s\S]*?setConfirmId\(note\.id\)/, 'Pedir borrar debe pasar por autorización privada antes de mostrar la confirmación.');
assert.match(notes, /onConfirm=\{confirmDelete\}/, 'El registro debe eliminarse solo al confirmar.');

console.log('notes-gesture-smoke-test: direction, accessibility and privacy checks passed');
