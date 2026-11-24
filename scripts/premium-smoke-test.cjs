const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'src/screens/HomeScreen.js'), 'utf8');
const notes = fs.readFileSync(path.join(root, 'src/screens/NotesScreen.js'), 'utf8');
const notesPresentation = fs.readFileSync(path.join(root, 'src/screens/notesPresentation.js'), 'utf8');
const calendar = fs.readFileSync(path.join(root, 'src/screens/CalendarScreen.js'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'src/theme/theme.js'), 'utf8');
const onboarding = fs.readFileSync(path.join(root, 'src/screens/OnboardingScreen.js'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'src/screens/SettingsScreen.js'), 'utf8');
const appData = fs.readFileSync(path.join(root, 'src/context/AppDataContext.js'), 'utf8');
const icon = fs.readFileSync(path.join(root, 'src/components/Icon.tsx'), 'utf8');
const tabs = fs.readFileSync(path.join(root, 'src/navigation/tabs.js'), 'utf8');
const tabMetadata = fs.readFileSync(path.join(root, 'src/navigation/tabMetadata.js'), 'utf8');
const accordion = fs.readFileSync(path.join(root, 'src/components/ui/Accordion.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'src/navigation/RootNavigator.js'), 'utf8');
const primitives = fs.readFileSync(path.join(root, 'src/components/ui/primitives.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'App.js'), 'utf8');

assert.ok(!/route:\s*'Cumplea(?:Ã±|ñ)os'/.test(home), 'Inicio no debe exponer un acceso independiente a Cumpleaños.');
assert.ok(!/route:\s*'Notas'/.test(home), 'Inicio no debe duplicar la navegación principal de Notas.');
assert.ok(!/route:\s*'Agenda'/.test(home), 'Inicio no debe duplicar la navegación principal del Calendario.');
assert.ok(!/route:\s*'Hábitos'|route:\s*'Gastos'/.test(home), 'Inicio no debe ofrecer accesos redundantes a Hábitos o Gastos.');
assert.ok(/data\.todayActivities/.test(home) && /navigation\.navigate\('Horario'\)/.test(home), 'Inicio debe presentar las clases reales de hoy y enlazar al horario completo.');
assert.ok(/activities\.length/.test(home), 'El horario integrado debe distinguir entre una semana sin clases configuradas y un día vacío.');
assert.ok(/data\.suspendedToday/.test(home) && /suspendid/i.test(home), 'Inicio debe identificar si todas las clases de hoy están suspendidas.');
assert.match(notesPresentation, /filterDiscoverableRecords\(notes\)/, 'Las tarjetas y recuentos de notas deben derivarse del conjunto público.');
assert.match(notes, /canExposeInList\(note\)/, 'La lista de notas debe conservar la barrera para registros privados.');
assert.ok(/nexusday-empty-notes\.png/.test(notes), 'Las notas vacías deben mostrar una ilustración local.');
assert.match(calendar, /birthday(?:s|Date|Occurs|Key)?/i, 'El calendario debe conservar la integración de cumpleaños.');
assert.ok(/nexusday-empty-calendar\.png/.test(calendar), 'El calendario debe mostrar una ilustración local cuando el día está vacío.');
assert.ok(/createNativeStackNavigator/.test(navigation), 'Las rutas secundarias deben vivir en una pila independiente.');
assert.ok(/PRIMARY_NAVIGATOR_ROUTE\s*=\s*'Principal'/.test(navigation), 'El contenedor principal debe tener un nombre distinto de la pestaña Inicio.');
assert.ok(/name !== 'Principal'/.test(primitives), 'El encabezado con volver debe distinguir el contenedor de las pantallas secundarias.');
assert.ok(/PRIMARY_TAB_NAMES\.includes/.test(navigation), 'Solo las tres secciones principales deben integrar el pager.');
const primaryTabs = fs.readFileSync(path.join(root, 'src/navigation/primaryTabs.js'), 'utf8');
assert.ok(!/Hábitos|Gastos/.test(primaryTabs), 'Hábitos y Gastos no deben aparecer en la navegación primaria visible.');
assert.ok(/onReady=/.test(navigation), 'Una ruta secundaria restaurada debe abrirse encima del pager principal.');
assert.ok(/lastPrimaryRoute/.test(app), 'Al repetir el tutorial debe conservarse la página principal detrás de la secundaria restaurada.');
assert.ok(/swipeEnabled:\s*!locked/.test(navigation), 'El gesto del pager debe respetar los bloqueos de las filas.');
assert.ok(/nativeEvent\?\.touches\?\.length/.test(primitives), 'La lista horizontal debe mantener el bloqueo hasta que termine el último dedo.');
assert.ok(/nativeEvent\?\.touches\?\.length/.test(calendar), 'El calendario debe mantener el bloqueo hasta que termine el último dedo.');
const dayStyles = theme.match(/'stylesheet\.day\.basic':\s*\{([\s\S]*?)\n  \},/)?.[1] || '';
const headerStyles = theme.match(/'stylesheet\.calendar\.header':\s*\{([\s\S]*?)\n  \},/)?.[1] || '';
assert.ok(!/^\s*text\s*:/m.test(dayStyles), 'El tamaño de día debe heredarse de textDayFontSize y no quedar reemplazado por un estilo incompleto.');
assert.ok(!/^\s*month\s*:/m.test(headerStyles), 'El espaciado del encabezado no debe usar una clave ignorada por react-native-calendars.');
assert.match(onboarding, /nexusday-onboarding\.(?:png|webp|jpg)/, 'El onboarding debe cargar la ilustración original local.');
for (const key of ['day', 'notes', 'calendar', 'settings']) {
  assert.match(onboarding, new RegExp(`key: '${key}'`), `El tutorial debe incluir el paso de ${key}.`);
}
assert.match(onboarding, /firstRun && item\.field/, 'Repetir el tutorial no debe ofrecer cambiar el nombre guardado como parte de la bienvenida inicial.');
assert.match(onboarding, /label="Atrás"/, 'El tutorial debe permitir regresar al paso anterior.');
assert.match(onboarding, /label=\{firstRun \? 'Omitir' : 'Cerrar'\}/, 'El tutorial debe poder omitirse o cerrarse.');
assert.match(settings, /Cuatro pasos breves/, 'Ajustes debe describir la duración real del tutorial.');
assert.match(settings, /label="4 pasos"/, 'El contador del tutorial en Ajustes debe reflejar sus cuatro pasos.');
assert.match(settings, /label="Ver el tutorial otra vez" onPress=\{replayTutorial\}/, 'El usuario debe poder repetir el tutorial desde Ajustes.');
assert.match(appData, /if \(!tutorial\.replay\) clearAllData\(\)/, 'Finalizar una repetición debe conservar las colecciones guardadas.');
assert.match(appData, /saveValue\(KEYS\.onboarding, true\)/, 'Finalizar el tutorial debe persistir su estado completado.');
assert.match(icon, /import Svg, \{ Circle, SvgProps \} from 'react-native-svg'/, 'El fallback del icono debe usar los componentes SVG nativos.');
assert.match(icon, /<Circle\s/, 'El fallback no debe renderizar etiquetas SVG web en minúscula.');
assert.doesNotMatch(icon, /<circle\s/, 'React Native no debe recibir un elemento llamado circle.');
assert.match(icon, /'arrow-up-right': ArrowUpRight/, 'arrow-up-right debe resolverse desde el registro de iconos.');
assert.match(tabs, /SettingsScreen/, 'La ruta Ajustes debe seguir incluida en el catálogo de navegación.');
assert.match(settings, /navigation\/tabMetadata/, 'Ajustes debe leer metadatos sin crear un ciclo con el catálogo de pantallas.');
assert.doesNotMatch(settings, /navigation\/tabs['"]/, 'Ajustes no debe importar el módulo que a su vez carga Ajustes.');
assert.match(tabMetadata, /export function tabByName/, 'Los metadatos de pestañas deben seguir disponibles para Ajustes.');
for (const category of ['Apariencia y personalización', 'Notificaciones', 'Privacidad y seguridad', 'Datos y respaldos', 'Tutorial y ayuda', 'Acerca de NexusDay']) {
  assert.ok(settings.includes(category), `Ajustes debe agrupar sus controles en ${category}.`);
}
assert.doesNotMatch(settings, /onPress=\{toggleGoogle\}|onPress=\{syncNow\}/, 'Ajustes no debe presentar controles simulados de conexión o sincronización Google.');
assert.doesNotMatch(settings, /SectionTitle title="Cuenta y[^"\n]*Google/, 'Ajustes no debe conservar un apartado de conexión Google ficticio.');
assert.doesNotMatch(settings, /toggleGoogle|syncNow/, 'El estado de demostración Google debe salir del flujo de Ajustes.');
assert.match(accordion, /<Icon name=\{icon\}/, 'Los acordeones de Ajustes deben utilizar el registro de iconos de la app.');
assert.match(settings, /icon="mic"/);
assert.match(settings, /icon="shieldCheck"/);
assert.doesNotMatch(settings, /SectionTitle title="Widgets"/, 'No debe aparecer una categoría de widgets antes de que exista una implementación.');
assert.match(settings, /settings\?\.reduceMotion === true/, 'La preferencia de movimiento reducido debe manejarse como opt-in y compatible con preferencias antiguas.');
assert.match(appData, /reduceMotion: false/, 'Las preferencias previas deben hidratar con movimiento estándar por defecto.');
assert.match(appData, /lastBackupAt: null/, 'Los ajustes antiguos deben hidratar la fecha del último respaldo vacío.');
assert.match(appData, /const next = \{ \.\.\.prev, \.\.\.patch \}[\s\S]*?saveValue\(KEYS\.settings, next\)/, 'La personalización debe guardarse dentro de los ajustes existentes sin migrar colecciones.');
assert.match(settings, /updateSettings\(\{ lastBackupAt: Date\.now\(\) \}\)/, 'La fecha de respaldo debe actualizarse solo cuando se comparte una copia real.');
assert.match(settings, /formatBackupDate\(settings\?\.lastBackupAt\)/, 'Ajustes debe leer la fecha del respaldo real, no la antigua marca de demostración Google.');
assert.match(navigation, /animation:\s*reduceMotion\s*\?\s*'none'\s*:\s*'default'/, 'La pila debe respetar la preferencia de reducción de movimiento.');
assert.match(theme, /base:\s*\{[^}]*minHeight:\s*44[^}]*aspectRatio:\s*1/, 'Los días del calendario deben ocupar celdas legibles y cuadradas.');
assert.ok(fs.existsSync(path.join(root, 'assets/nexusday-onboarding.png')), 'La ilustración del onboarding debe estar empaquetada localmente.');
assert.ok(fs.existsSync(path.join(root, 'assets/nexusday-empty-notes.png')), 'La ilustración de notas debe estar empaquetada localmente.');
assert.ok(fs.existsSync(path.join(root, 'assets/nexusday-empty-calendar.png')), 'La ilustración de calendario debe estar empaquetada localmente.');

const defaultLoader = require.extensions['.js'];
const sourceRoot = `${path.join(root, 'src')}${path.sep}`;
require.extensions['.js'] = (module, filename) => {
  if (!filename.startsWith(sourceRoot)) return defaultLoader(module, filename);
  const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    babelrc: false,
    configFile: false,
    presets: [require.resolve('babel-preset-expo')],
  });
  module._compile(result.code, filename);
};
const { navigateToRoute } = require('../src/navigation/navigateToRoute');
const calls = [];
const stackNavigation = {
  getState: () => ({ type: 'stack' }),
  popTo: (...args) => calls.push(['popTo', ...args]),
  navigate: (...args) => calls.push(['navigate', ...args]),
};
navigateToRoute(stackNavigation, 'Agenda', { focusId: 'event-1' });
assert.deepEqual(calls, [['popTo', 'Principal', { screen: 'Agenda', params: { focusId: 'event-1' } }]], 'Desde un módulo secundario se debe volver al pager existente y abrir la sección principal solicitada.');
calls.length = 0;
navigateToRoute({ ...stackNavigation, getState: () => ({ type: 'tab' }) }, 'Agenda');
assert.deepEqual(calls, [['navigate', 'Agenda', undefined]], 'Desde el pager se debe navegar directamente a su pestaña principal.');

console.log('premium-smoke-test: navegación, privacidad, cumpleaños y recursos verificados');
