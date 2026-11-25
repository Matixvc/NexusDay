const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const primary = read('src/navigation/primaryTabs.js');
const tabCatalog = read('src/navigation/tabs.js');
const onboarding = read('src/screens/OnboardingScreen.js');
const tutorialGuide = read('src/services/tutorialGuide.js');
const appData = read('src/context/AppDataContext.js');
const settings = read('src/screens/SettingsScreen.js');
const nexAi = read('src/screens/NexAiPreviewScreen.js');

assert.match(primary, /name: 'Nex AI'[\s\S]*?name: 'Inicio'[\s\S]*?name: 'Notas'[\s\S]*?name: 'Agenda'/);
assert.match(tabCatalog, /export const HOME_TAB = 'Inicio'/);
assert.match(tabCatalog, /name: 'Nexus AI'[\s\S]*?component: AssistantScreen/, 'La ruta histórica del asistente local debe mantenerse registrada.');
assert.match(tabCatalog, /'Nex AI': NexAiPreviewScreen/);

const slideKeys = [...tutorialGuide.matchAll(/key: '([^']+)'/g)].slice(0, 6).map((match) => match[1]);
assert.deepEqual(slideKeys, ['welcome', 'day', 'notes', 'calendar', 'themes', 'privacy']);
assert.match(onboarding, /animated: !reduceMotion/);
assert.match(appData, /if \(!tutorial\.replay\) await clearAllData\(\)/, 'La repetición debe conservar el flujo que no elimina datos.');
assert.match(settings, /Seis pasos breves/);
assert.match(settings, /label="6 pasos"/);

assert.match(nexAi, /PRÓXIMAMENTE/);
assert.match(nexAi, /no inicia conversaciones[\s\S]*?no consulta tus datos[\s\S]*?no se conecta a servicios externos/);
assert.doesNotMatch(nexAi, /TextInput|fetch\s*\(|answerQuestion|applyCommand/);

const assets = [
  'assets/nex/u11/backgrounds/nex-flow.jpg',
  'assets/nex/u11/backgrounds/nex-arch.jpg',
  'assets/nex/u11/backgrounds/nex-eclipse.jpg',
  'assets/nex/u11/tutorial/tutorial-day.jpg',
  'assets/nex/u11/tutorial/tutorial-notes.jpg',
  'assets/nex/u11/tutorial/tutorial-calendar.jpg',
  'assets/nex/u11/tutorial/tutorial-themes.jpg',
  'assets/nex/u11/tutorial/tutorial-privacy.jpg',
  'assets/nex/u11/ai/nex-orb-base.jpg',
  'assets/nex/u11/ai/nex-orb-orbit.jpg',
  'assets/nex/u11/ai/nex-orb-curious.jpg',
  'assets/nex/u11/ai/nex-orb-calm.jpg',
  'assets/nex/u11/routines/routine-steps.jpg',
  'assets/nex/u11/routines/routine-study.jpg',
  'assets/nex/u11/routines/routine-rhythm.jpg',
  'assets/nex/u11/settings/theme-materials.jpg',
  'assets/nex/u11/settings/local-privacy.jpg',
  'assets/nex/u11/decor/violet-arc.png',
  'assets/nex/u11/decor/glass-loop.png',
  'assets/nex/u11/decor/violet-ring.png',
];
let totalBytes = 0;
for (const asset of assets) {
  const stat = fs.statSync(path.join(root, asset));
  assert.ok(stat.size > 0 && stat.size < 250_000, `${asset} debe estar optimizado para el paquete móvil.`);
  totalBytes += stat.size;
}
assert.ok(totalBytes < 1_500_000, 'La segunda biblioteca debe conservar un peso moderado para la APK.');
assert.equal((read('docs/nex-u11-assets-catalog.md').match(/^\| [^|]+\| `assets\/nex\/u11\//gm) || []).length, 20);

console.log(`OK: tutorial de ${slideKeys.length} pasos, navegación de cuatro destinos y ${assets.length} assets (${totalBytes} bytes).`);
