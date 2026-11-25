const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const sourceRoot = `${path.join(root, 'src')}${path.sep}`;
const defaultLoader = require.extensions['.js'];
require.extensions['.js'] = (module, filename) => {
  if (!filename.startsWith(sourceRoot)) return defaultLoader(module, filename);
  const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false, presets: [require.resolve('babel-preset-expo')],
  });
  module._compile(result.code, filename);
};

const guide = require('../src/services/tutorialGuide');

assert.deepEqual(guide.TUTORIAL_STEPS.map(({ key }) => key), [
  'welcome', 'day', 'notes', 'calendar', 'themes', 'privacy',
]);
assert.ok(guide.TUTORIAL_STEPS.every((step) => step.objective && step.demoId), 'Each stage has a goal and guided interaction.');
assert.deepEqual(guide.TUTORIAL_THEME_PREVIEWS.map(({ id }) => id), ['light', 'dark', 'nex']);
assert.ok(guide.TUTORIAL_THEME_PREVIEWS.every(({ colors }) => colors.background && colors.surface && colors.text && colors.accent));

const originalItems = guide.TUTORIAL_NOTE_ITEMS;
const changedItems = guide.toggleTutorialChecklistItem(originalItems, 'water');
assert.equal(originalItems.find((item) => item.id === 'water').done, false, 'A demo action must not mutate its fixture.');
assert.equal(changedItems.find((item) => item.id === 'water').done, true);
assert.notEqual(changedItems, originalItems, 'Demo checklist state must be local and immutable.');
assert.equal(guide.toggleTutorialChecklistItem(changedItems, 'unknown'), changedItems);

assert.deepEqual(guide.getTutorialAgenda('tuesday').map(({ kind }) => kind), ['event', 'birthday']);
assert.deepEqual(guide.getTutorialAgenda('wednesday'), []);
assert.ok(guide.TUTORIAL_HELP_ITEMS.some((item) => /rutina/i.test(item.title) && /Crear rutina/.test(item.detail)));
assert.ok(guide.TUTORIAL_HELP_ITEMS.some((item) => /nota/i.test(item.title) && /Crear nota/.test(item.detail)));
assert.ok(guide.TUTORIAL_HELP_ITEMS.some((item) => /respaldo/i.test(item.title) && /Exportar copia/.test(item.detail)));

const demoComponent = fs.readFileSync(path.join(root, 'src/components/onboarding/TutorialDemos.js'), 'utf8');
const iconRegistry = fs.readFileSync(path.join(root, 'src/components/Icon.tsx'), 'utf8');
assert.doesNotMatch(demoComponent, /AsyncStorage|saveValue|setUserName|setTheme|createRoutine|addNote|requestPermissions|scheduleNotification/);
assert.match(demoComponent, /no se guarda/i);
for (const name of ['info', 'clock', 'check', 'calendar', 'unlock', 'lock', 'birthdays', 'plus', 'chevronUp', 'chevronDown', 'minus']) {
  assert.match(iconRegistry, new RegExp(`\\b${name}:`), `El icono ${name} debe estar registrado.`);
}
const onboarding = fs.readFileSync(path.join(root, 'src/screens/OnboardingScreen.js'), 'utf8');
assert.match(onboarding, /<TutorialDemos demoId=\{slide\.demoId\}/);
assert.match(onboarding, /firstRun && item\.field/);
assert.match(onboarding, /animated: !reduceMotion/);

console.log('tutorial-interactions-smoke-test: six stages, isolated demos, themes and safe routes passed');
