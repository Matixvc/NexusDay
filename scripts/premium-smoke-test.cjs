const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'src/screens/HomeScreen.js'), 'utf8');
const homeSections = fs.readFileSync(path.join(root, 'src/screens/home/DaySections.js'), 'utf8');
const dashboardService = fs.readFileSync(path.join(root, 'src/services/dashboard.js'), 'utf8');
const notes = fs.readFileSync(path.join(root, 'src/screens/NotesScreen.js'), 'utf8');
const notesPresentation = fs.readFileSync(path.join(root, 'src/screens/notesPresentation.js'), 'utf8');
const notesService = fs.readFileSync(path.join(root, 'src/services/notes.js'), 'utf8');
const media = fs.readFileSync(path.join(root, 'src/components/ui/media.js'), 'utf8');
const calendar = fs.readFileSync(path.join(root, 'src/screens/CalendarScreen.js'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'src/theme/theme.js'), 'utf8');
const onboarding = fs.readFileSync(path.join(root, 'src/screens/OnboardingScreen.js'), 'utf8');
const tutorialGuide = fs.readFileSync(path.join(root, 'src/services/tutorialGuide.js'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'src/screens/SettingsScreen.js'), 'utf8');
const appData = fs.readFileSync(path.join(root, 'src/context/AppDataContext.js'), 'utf8');
const icon = fs.readFileSync(path.join(root, 'src/components/Icon.tsx'), 'utf8');
const tabs = fs.readFileSync(path.join(root, 'src/navigation/tabs.js'), 'utf8');
const tabMetadata = fs.readFileSync(path.join(root, 'src/navigation/tabMetadata.js'), 'utf8');
const accordion = fs.readFileSync(path.join(root, 'src/components/ui/Accordion.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'src/navigation/RootNavigator.js'), 'utf8');
const primitives = fs.readFileSync(path.join(root, 'src/components/ui/primitives.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;

assert.ok(!/route:\s*'Cumplea(?:Ã±|ñ)os'/.test(home), 'Inicio no debe exponer un acceso independiente a Cumpleaños.');
assert.ok(!/route:\s*'Notas'/.test(home), 'Inicio no debe duplicar la navegación principal de Notas.');
assert.ok(!/route:\s*'Agenda'/.test(home), 'Inicio no debe duplicar la navegación principal del Calendario.');
assert.match(home, /useFocusEffect\([\s\S]*?millisecondsToNextMinute\(now\)[\s\S]*?AppState\.addEventListener/, 'Día a Día debe actualizar su reloj solo mientras está enfocado y al volver a primer plano.');
assert.equal(appConfig.version, '1.3.0', 'La configuración actual debe identificar NexusDay como versión 1.3.0.');
assert.equal(appConfig.runtimeVersion, '1.3.0', 'La OTA debe conservar compatibilidad con la APK base 1.3.0.');
assert.equal(appConfig.android.package, 'com.matix03.nexusday', 'La actualización debe conservar el application ID instalado.');
assert.match(home, /buildDashboard\(\{[\s\S]*?now: new Date\(clockTimestamp\)/, 'El resumen de hoy debe recalcularse con el reloj actualizado.');
assert.match(dashboardService, /todayCommitments: activeActivities\.length \+ todayEvents\.length \+ todayRoutines\.length/, 'Inicio debe resumir el compromiso diario sin añadir datos ajenos.');
assert.match(dashboardService, /currentActivity[\s\S]*concurrentActivities[\s\S]*nextTimedItems[\s\S]*anytimeItems/, 'El modelo debe separar Ahora, simultáneas, Después y En cualquier momento.');
assert.match(home, /useWindowDimensions\(\)/, 'Inicio debe observar la escala de texto del dispositivo para distribuir horarios.');
assert.match(home, /timeColumnWidth=\{Math\.ceil\(66 \* Math\.max\(1, Math\.min\(fontScale, 1\.5\)\)\)\}/, 'La columna de horario debe ganar espacio con texto ampliado.');
assert.match(homeSections, /timelineRow:[^\n]*flexDirection: 'row'/, 'La agenda debe conservar una fila compacta y flexible.');
assert.match(homeSections, /accessibilityLabel=\{`\$\{item\.typeLabel\} \$\{item\.title\}/, 'TalkBack debe leer tipo, nombre y horario como una unidad.');
assert.match(notes, /successHaptic\(\);[\s\S]*?setSheet\(null\)/, 'Guardar una nota debe dar feedback de éxito antes de cerrar el editor.');
assert.match(notes, /<Fab onPress=\{openCreate\} label="Crear nota" \/>/, 'El acceso de creación de notas debe tener un nombre accesible específico.');
const fabSource = primitives.slice(primitives.indexOf('function Fab('), primitives.indexOf('function Stat('));
assert.match(fabSource, /<Icon name="plus"/, 'El FAB debe mostrar el icono Plus, no imprimir su etiqueta accesible.');
assert.doesNotMatch(fabSource, /<Text style=\{styles\.fabLabel\}/, 'El rótulo accesible no debe aparecer como texto recortado dentro del FAB.');
assert.match(notes, /checkLine: \{ minHeight: 44/, 'Las filas de checklist deben ofrecer un área táctil mínima al marcarlas desde una tarjeta.');
assert.match(notes, /checkEditToggle: \{ width: 44, height: 44/, 'Las casillas del editor deben conservar el indicador compacto dentro de un área táctil accesible.');
assert.match(notes, /variant=\{exposed && note\.pinned \? 'featured' : 'standard'\}/, 'El tratamiento de nota destacada solo puede revelar fijación cuando el registro es público.');
assert.match(notes, /style=\{\[styles\.pinRow, styles\.privatePinRow\]\}[\s\S]*?styles\.privateCopy[\s\S]*?<Switch[\s\S]*?label="Nota privada"/, 'El control de privacidad debe reservar una columna de texto independiente y conservar su switch accesible.');
assert.match(notes, /privateHint: \{[^}]*flexShrink: 1, minWidth: 0/, 'La explicación de privacidad debe poder saltar de línea en anchos reducidos y con fuente ampliada.');
assert.match(notes, /setConfirmDiscard\(true\)/, 'Cerrar un borrador modificado debe pedir una decisión explícita.');
assert.match(notes, /label="Descartar cambios"/, 'El borrador solo debe descartarse tras una acción clara.');
assert.match(notes, /hasNoteContent\(sheet\.values\)/, 'El botón Guardar debe aceptar cualquier contenido de nota compatible.');
assert.match(notes, /onRecordingStart=\{markDraftDirty\}[\s\S]*?controllerRef=\{recorderRef\}/, 'La grabación debe marcar el borrador y conectar su controlador al editor.');
assert.match(media, /controllerRef\.current = \{ finishTake: recorder\.finishTake, discardTake: recorder\.discardTake \}/, 'El grabador debe exponer las acciones de finalizar y descartar toma al editor.');
assert.match(calendar, /<Fab onPress=\{\(\) => setCreateSheetOpen\(true\)\} label="Crear en Calendario" \/>/, 'El acceso de creación del calendario debe anunciar su propósito.');
assert.match(home, /CurrentActivitySection[\s\S]*TimedAgendaSection[\s\S]*AnytimeSection/, 'Inicio debe mantener la jerarquía editorial Ahora, Después y En cualquier momento.');
assert.match(homeSections, /title="Después"[\s\S]*styles\.timeline/, 'Los próximos eventos y clases deben compartir una agenda agrupada y legible.');
assert.match(primitives, /variant === 'featured' \? styles\.cardFeatured/, 'El sistema compartido debe exponer un tratamiento visual para contenido destacado.');
assert.match(primitives, /sectionLeft: \{[^}]*flexShrink: 1, minWidth: 0/, 'Los encabezados de sección deben poder adaptarse a textos largos.');
assert.ok(!/route:\s*'Hábitos'|route:\s*'Gastos'/.test(home), 'Inicio no debe ofrecer accesos redundantes a Hábitos o Gastos.');
assert.ok(/data\.currentActivity/.test(home) && /navigation\.navigate\('Horario'\)/.test(home), 'Inicio debe presentar la actividad actual y enlazar al horario completo.');
assert.ok(/dayState/.test(home) && /unconfigured/.test(homeSections), 'El horario integrado debe distinguir entre una semana sin configurar y un día libre.');
assert.ok(/suspendedActivities\.length \? 'suspended'/.test(dashboardService) && /suspendid/i.test(homeSections), 'Inicio debe identificar si todas las clases de hoy están suspendidas.');
assert.match(notesPresentation, /filterDiscoverableRecords\(notes\)/, 'Las tarjetas y recuentos de notas deben derivarse del conjunto público.');
assert.match(notes, /canExposeInList\(note\)/, 'La lista de notas debe conservar la barrera para registros privados.');
assert.ok(/nexusday-empty-notes\.png/.test(notes), 'Las notas vacías deben mostrar una ilustración local.');
assert.match(notes, /surfaceId === 'nex' \? NEX_U11_NOTES_IMAGE : EMPTY_NOTES_IMAGE/, 'Solo Nex debe mostrar la nueva ilustración de notas vacías; los otros temas conservan su arte actual.');
assert.match(notes, /exposed && note\.pinned \? styles\.noteCardPinned/, 'El marco Nex destacado solo puede aplicarse a notas fijadas públicas.');
assert.match(notes, /NEX_U11_NOTES_IMAGE = require\('\.\.\/\.\.\/assets\/nex\/u11\/tutorial\/tutorial-notes\.jpg'\)/, 'La pantalla de Notas debe usar el nuevo recurso Nex local para el estado vacío.');
assert.match(calendar, /birthday(?:s|Date|Occurs|Key)?/i, 'El calendario debe conservar la integración de cumpleaños.');
assert.ok(/nexusday-empty-calendar\.png/.test(calendar), 'El calendario debe mostrar una ilustración local cuando el día está vacío.');
assert.match(calendar, /surfaceMode\.id === 'nex'[\s\S]*?NEX_MONTH_ART/, 'La identidad Nex debe usar arte local en la vista mensual.');
assert.match(calendar, /filter === 'birthdays' \? NEX_BIRTHDAY_IMAGE : NEX_U11_CALENDAR_IMAGE/, 'El estado vacío debe usar ilustraciones Nex sin fechas ficticias.');
assert.match(home, /surfaceId === 'nex'[\s\S]*?NEX_HOME_ART[\s\S]*?SCHEDULE_ART/, 'Inicio debe integrar ilustraciones originales solo en Nex.');
assert.match(home, /data\.dayState === 'free' \? FREE_DAY_ART/, 'La ilustración debe distinguir el día libre de una agenda activa.');
assert.ok(/createNativeStackNavigator/.test(navigation), 'Las rutas secundarias deben vivir en una pila independiente.');
assert.ok(/PRIMARY_NAVIGATOR_ROUTE\s*=\s*'Principal'/.test(navigation), 'El contenedor principal debe tener un nombre distinto de la pestaña Inicio.');
assert.ok(/name !== 'Principal'/.test(primitives), 'El encabezado con volver debe distinguir el contenedor de las pantallas secundarias.');
assert.ok(/PRIMARY_TAB_NAMES\.includes/.test(navigation), 'Solo las cuatro secciones principales deben integrar el pager.');
const primaryTabs = fs.readFileSync(path.join(root, 'src/navigation/primaryTabs.js'), 'utf8');
assert.ok(!/Hábitos|Gastos/.test(primaryTabs), 'Hábitos y Gastos no deben aparecer en la navegación primaria visible.');
assert.match(primaryTabs, /name: 'Nex AI'[\s\S]*?name: 'Inicio'[\s\S]*?name: 'Notas'[\s\S]*?name: 'Agenda'/, 'La barra principal debe mostrar Nex AI, Día a Día, Notas y Calendario en ese orden.');
assert.match(fs.readFileSync(path.join(root, 'src/navigation/tabs.js'), 'utf8'), /export const HOME_TAB = 'Inicio'/, 'Día a Día debe seguir siendo la pantalla inicial, aunque Nex AI aparezca primero en la barra.');
assert.ok(/onReady=/.test(navigation), 'Una ruta secundaria restaurada debe abrirse encima del pager principal.');
assert.ok(/lastPrimaryRoute/.test(app), 'Al repetir el tutorial debe conservarse la página principal detrás de la secundaria restaurada.');
assert.ok(/swipeEnabled:\s*!locked/.test(navigation), 'El gesto del pager debe respetar los bloqueos de las filas.');
assert.ok(/nativeEvent\?\.touches\?\.length/.test(primitives), 'La lista horizontal debe mantener el bloqueo hasta que termine el último dedo.');
assert.ok(/nativeEvent\?\.touches\?\.length/.test(calendar), 'El calendario debe mantener el bloqueo hasta que termine el último dedo.');
const dayStyles = theme.match(/'stylesheet\.day\.basic':\s*\{([\s\S]*?)\n  \},/)?.[1] || '';
const headerStyles = theme.match(/'stylesheet\.calendar\.header':\s*\{([\s\S]*?)\n  \},/)?.[1] || '';
assert.ok(!/^\s*text\s*:/m.test(dayStyles), 'El tamaño de día debe heredarse de textDayFontSize y no quedar reemplazado por un estilo incompleto.');
assert.ok(!/^\s*month\s*:/m.test(headerStyles), 'El espaciado del encabezado no debe usar una clave ignorada por react-native-calendars.');
assert.match(onboarding, /nex-orb-curious\.jpg/, 'El onboarding debe cargar una ilustración Nex original local.');
for (const key of ['welcome', 'day', 'notes', 'calendar', 'personalize']) {
  assert.match(tutorialGuide, new RegExp(`key: '${key}'`), `El tutorial debe incluir el paso de ${key}.`);
}
for (const asset of ['tutorial-day.jpg', 'tutorial-notes.jpg', 'tutorial-calendar.jpg', 'tutorial-themes.jpg']) {
  assert.ok(onboarding.includes(asset), `El tutorial debe integrar el recurso local ${asset}.`);
}
assert.doesNotMatch(onboarding, /setUserName|TextInput/, 'El tutorial no debe modificar el nombre ni otras preferencias.');
assert.match(onboarding, /index > 0 \? 'Atrás'/, 'El tutorial debe permitir regresar al paso anterior.');
assert.match(onboarding, /label=\{firstRun \? 'Omitir' : 'Cerrar'\}/, 'El tutorial debe poder omitirse o cerrarse.');
assert.match(onboarding, /animated: !reduceMotion/, 'La navegación programática del tutorial debe respetar reducir animaciones.');
assert.match(onboarding, /accessibilityValue=\{\{ min: 1, max: SLIDES\.length, now: index \+ 1 \}\}/, 'El progreso del tutorial debe exponer el paso actual a tecnologías de asistencia.');
assert.match(onboarding, /progressTarget: \{ minWidth: 48, minHeight: 48/, 'Los indicadores de progreso deben tener objetivos táctiles accesibles.');
assert.match(onboarding, /scrollToOffset\(\{ offset: target, animated: !reduceMotion \}\)/, 'El tutorial debe seguir respetando movimiento reducido.');
assert.match(settings, /Cinco pasos visuales/, 'Ajustes debe describir la duración real del tutorial.');
assert.match(settings, /label="5 pasos"/, 'El contador del tutorial en Ajustes debe reflejar sus cinco pasos.');
assert.match(settings, /label="Ver el tutorial otra vez" onPress=\{replayTutorial\}/, 'El usuario debe poder repetir el tutorial desde Ajustes.');
assert.match(appData, /saveValue\(KEYS\.onboarding, true\)/, 'Finalizar el tutorial debe persistir su estado completado.');
assert.match(icon, /import Svg, \{ Circle, SvgProps \} from 'react-native-svg'/, 'El fallback del icono debe usar los componentes SVG nativos.');
assert.match(icon, /<Circle\s/, 'El fallback no debe renderizar etiquetas SVG web en minúscula.');
assert.doesNotMatch(icon, /<circle\s/, 'React Native no debe recibir un elemento llamado circle.');
assert.match(icon, /'arrow-up-right': ArrowUpRight/, 'arrow-up-right debe resolverse desde el registro de iconos.');
assert.match(tabs, /SettingsScreen/, 'La ruta Ajustes debe seguir incluida en el catálogo de navegación.');
assert.match(tabs, /NexAiPreviewScreen/, 'Nex AI debe abrir una pantalla de Próximamente independiente del asistente histórico.');
assert.match(fs.readFileSync(path.join(root, 'src/screens/NexAiPreviewScreen.js'), 'utf8'), /todavía no está disponible[\s\S]*?no inicia conversaciones[\s\S]*?no se conecta a servicios externos/, 'La vista Nex AI debe aclarar que no ofrece chat simulado ni conexión externa.');
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
assert.match(settings, /SELECTABLE_SURFACE_MODES\.map/, 'Ajustes debe mostrar solo los tres temas seleccionables.');
assert.doesNotMatch(settings, /\{SURFACE_MODES\.map/, 'Ajustes no debe mostrar el tema monocromático heredado como opción nueva.');
assert.match(settings, /identityHero/, 'Ajustes debe abrir con un encabezado visual propio.');
assert.match(settings, /resolvePreviewAccent\(getAccentTheme\(accentId\), mode\.id, surfaceId\)/, 'Las previews deben pintar el acento correspondiente al tema real.');
const settingsOrder = ['title="Perfil personal"', 'title="Apariencia y personalizaci', 'title="Notificaciones y permisos"', 'title="Privacidad y seguridad"', 'title="Widget Android: Mi horario"', 'title="Tutorial y ayuda"', 'title="Datos y respaldos"', 'title="Acerca de NexusDay"'];
const settingsPositions = settingsOrder.map((marker) => settings.indexOf(marker));
assert.ok(settingsPositions.every((position) => position >= 0), 'Ajustes debe mantener visibles sus ocho grupos en el orden solicitado.');
assert.ok(settingsPositions.every((position, index) => index === 0 || position > settingsPositions[index - 1]), 'Ajustes debe ordenar perfil, apariencia, permisos, privacidad, widgets, ayuda, datos y acerca de.');
assert.match(settings, /<Accordion title="Personalizar naveg/, 'La personalización de navegación debe mantenerse dentro del grupo de apariencia sin romper el orden principal.');
assert.doesNotMatch(settings, /<SettingsSection title="Personalizar naveg/, 'La navegación no debe intercalar un apartado principal adicional en Ajustes.');
assert.match(settings, /label="Subir"[\s\S]*?label="Bajar"/, 'Los controles para reordenar la navegación deben tener nombres legibles y accesibles.');
assert.match(settings, /title="Permiso del mic[\s\S]*?title="Privacidad y seguridad"/, 'El permiso de micrófono debe quedar junto a las notificaciones y antes de privacidad.');
assert.match(settings, /permission\.status === 'unknown'[\s\S]*?Sin consultar/, 'Los permisos sin consulta deben mostrarse como pendientes, no como bloqueados.');
assert.match(settings, /permission\.status === 'unsupported'[\s\S]*?No disponible/, 'Los permisos no compatibles deben distinguirse de los permisos denegados.');
assert.match(settings, /nombre y ocupación se guardan solo en este dispositivo/, 'El perfil debe explicar su uso local y no simular una cuenta en la nube.');
assert.match(settings, /title="Datos y respaldos"[\s\S]*?Borrar colecciones y rutinas[\s\S]*?title="Acerca de NexusDay"/, 'La acción destructiva debe quedar al cierre de datos, después de exportar e importar.');
for (const asset of ['nex-decor-halo.png', 'nex-decor-arc.png', 'nex-decor-ring.png']) {
  assert.ok(fs.existsSync(path.join(root, 'assets/nex/decor', asset)), `Ajustes debe integrar el recurso Nex ${asset}.`);
  assert.ok(settings.includes(asset), `Ajustes debe usar el recurso Nex ${asset}.`);
}
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
for (const asset of [
  'assets/nex/schedule/nex-schedule-compact.jpg',
  'assets/nex/schedule/nex-schedule-free-day.jpg',
  'assets/nex/notes/nex-notes-empty.jpg',
  'assets/nex/calendar/nex-calendar-empty.jpg',
  'assets/nex/calendar/nex-birthday.jpg',
]) {
  assert.ok(fs.existsSync(path.join(root, asset)), `Debe existir el recurso U9.2 ${asset}.`);
}

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
const { formatTimeUntil, minutesUntilActivity } = require('../src/services/dashboard');
const { hasNoteContent } = require('../src/services/notes');
const dashboardNow = new Date(2026, 4, 12, 9, 15, 0);
const dashboardDate = `${dashboardNow.getFullYear()}-${String(dashboardNow.getMonth() + 1).padStart(2, '0')}-${String(dashboardNow.getDate()).padStart(2, '0')}`;
assert.equal(minutesUntilActivity(dashboardDate, '10:00', dashboardNow), 45, 'El contador de clases debe devolver minutos locales completos y redondeados hacia arriba.');
assert.equal(minutesUntilActivity(dashboardDate, '09:14', dashboardNow), 0, 'Una clase que ya comenzó no debe mostrar un tiempo negativo.');
assert.equal(minutesUntilActivity(dashboardDate, '25:90', dashboardNow), null, 'Un horario malformado no debe producir un contador engañoso.');
assert.equal(minutesUntilActivity('2026-02-31', '10:00', dashboardNow), null, 'Una fecha imposible no debe generar un contador normalizado a otro día.');
assert.equal(formatTimeUntil(0), 'Ahora');
assert.equal(formatTimeUntil(75), 'En 75 min');
assert.equal(formatTimeUntil(135), 'En 2 h 15m');
assert.equal(formatTimeUntil(Number.NaN), null);
assert.equal(hasNoteContent({ kind: 'text', title: '', body: '  ' }), false);
assert.equal(hasNoteContent({ kind: 'text', audio: { uri: 'file:///fixture-audio' } }), true);
assert.equal(hasNoteContent({ kind: 'text', attachment: { uri: 'file:///fixture-document' } }), true);
assert.equal(hasNoteContent({ kind: 'checklist', body: 'hidden draft body', items: [] }), false);
assert.equal(hasNoteContent({ kind: 'checklist', items: [{ text: 'synthetic task' }] }), true);
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
