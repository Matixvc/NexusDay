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
  'welcome', 'day', 'notes', 'calendar', 'personalize',
]);
assert.ok(guide.TUTORIAL_STEPS.every((step) => step.title && step.body && step.demoId && step.imageKey && step.imageAlt), 'Each stage has concise copy, art and a guided interaction.');
assert.ok(guide.TUTORIAL_STEPS.every((step) => step.body.length <= 90), 'Tutorial copy must stay brief.');
assert.equal(guide.tutorialStepIndex(0, -1), 0);
assert.equal(guide.tutorialStepIndex(0, 1), 1);
assert.equal(guide.tutorialStepIndex(4, 1), 4);
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

const demoComponent = fs.readFileSync(path.join(root, 'src/components/onboarding/TutorialDemos.js'), 'utf8');
const iconRegistry = fs.readFileSync(path.join(root, 'src/components/Icon.tsx'), 'utf8');
assert.doesNotMatch(demoComponent, /AsyncStorage|saveValue|setUserName|setTheme|updateSettings|createRoutine|addNote|requestPermissions|scheduleNotification/);
assert.match(demoComponent, /no se guarda/i);
for (const name of ['info', 'clock', 'check', 'calendar', 'unlock', 'lock', 'birthdays', 'plus', 'chevronUp', 'chevronDown', 'minus']) {
  assert.match(iconRegistry, new RegExp(`\\b${name}:`), `El icono ${name} debe estar registrado.`);
}
const onboarding = fs.readFileSync(path.join(root, 'src/screens/OnboardingScreen.js'), 'utf8');
assert.match(onboarding, /<TutorialDemos demoId=\{item\.demoId\}/);
assert.match(onboarding, /animated: !reduceMotion/);
assert.match(onboarding, /BackHandler\.addEventListener\('hardwareBackPress'/, 'Android Back must navigate within or close a replay.');
assert.match(onboarding, /accessibilityLabel=\{item\.imageAlt\}/, 'Every protagonist illustration needs a TalkBack alternative.');
assert.match(onboarding, /minHeight: 48/, 'Tutorial actions must keep 48 dp touch targets.');
assert.doesNotMatch(onboarding, /setUserName|TextInput|objective|openTip|wipeNote/, 'The visual tutorial must not write preferences or restore long-form copy.');
assert.match(onboarding, /label=\{firstRun \? 'Omitir' : 'Cerrar'\}/);

console.log('tutorial-interactions-smoke-test: five visual stages, isolated demos and accessibility passed');
