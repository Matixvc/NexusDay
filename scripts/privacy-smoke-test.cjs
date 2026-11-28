const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const defaultLoader = require.extensions['.js'];
const projectSource = `${path.resolve(__dirname, '..', 'src')}${path.sep}`;
require.extensions['.js'] = (module, filename) => {
  if (!filename.startsWith(projectSource)) {
    defaultLoader(module, filename);
    return;
  }
  const source = fs.readFileSync(filename, 'utf8');
  const result = babel.transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    presets: [require.resolve('babel-preset-expo')],
  });
  module._compile(result.code, filename);
};

const {
  PRIVATE_ACTIONS,
  canExposeInList,
  createAuthorizationGate,
  createPrivacyAuthorizer,
  filterDiscoverableRecords,
  applyPrivacyFlag,
  redactPrivateRecord,
  requiresGlobalPrivacyAuthentication,
  requiresPrivateAuthentication,
  runAuthorizedAction,
} = require('../src/services/privacyPolicy');
const { answerQuestion } = require('../src/services/assistant');
const { buildDashboard, millisecondsToNextMinute } = require('../src/services/dashboard');
const { focusIdForParams } = require('../src/services/focusRequest');
const { todayKey } = require('../src/utils/dates');
const notesScreen = fs.readFileSync(path.resolve(__dirname, '../src/screens/NotesScreen.js'), 'utf8');
const notesPresentation = fs.readFileSync(path.resolve(__dirname, '../src/screens/notesPresentation.js'), 'utf8');

const publicRecord = { id: 'public', title: 'Visible' };
const privateRecord = { id: 'private', title: 'Secreto', private: true };

assert.equal(canExposeInList(publicRecord), true, 'Los registros heredados sin private siguen siendo públicos.');
assert.equal(canExposeInList(privateRecord), false, 'Un privado nunca expone contenido en listas o resúmenes.');
assert.equal(requiresPrivateAuthentication(privateRecord, PRIVATE_ACTIONS.open, true), true);
assert.equal(requiresPrivateAuthentication(privateRecord, PRIVATE_ACTIONS.open, false), false);
assert.equal(requiresPrivateAuthentication(privateRecord, PRIVATE_ACTIONS.mutate, false), true);
assert.equal(requiresPrivateAuthentication(privateRecord, PRIVATE_ACTIONS.delete, false), true);
assert.equal(requiresPrivateAuthentication(privateRecord, PRIVATE_ACTIONS.removePrivacy, false), true);
assert.equal(requiresPrivateAuthentication(privateRecord, 'acción-desconocida', false), true);
assert.equal(requiresPrivateAuthentication(publicRecord, PRIVATE_ACTIONS.mutate, true), false);
assert.equal(requiresGlobalPrivacyAuthentication(true, false), true);
assert.equal(requiresGlobalPrivacyAuthentication(false, true), false);

assert.match(notesScreen, /useDeferredValue\(query\)/, 'El filtrado de notas debe ceder prioridad mientras la persona escribe.');
assert.match(notesScreen, /activeFilter/, 'La lista debe ofrecer filtros visibles para notas y fijadas/privadas.');
assert.match(notesPresentation, /filterDiscoverableRecords\(notes\)/, 'Los contadores y etiquetas de la pantalla deben derivarse solo de notas públicas.');
assert.match(notesScreen, /redactPrivateRecord\(note, PRIVATE_NOTE_PLACEHOLDER\)/, 'Las notas privadas deben seguir usando el mismo registro redactado en las tarjetas.');
assert.doesNotMatch(notesScreen, /Stat value=\{visible\.length\}/, 'El resumen no debe contar entradas privadas sin desbloquear.');

const { selectNoteGroups } = require('../src/screens/notesPresentation');
const presentationFixture = [
  { id: 'normal', title: 'Lectura', body: 'Capítulo', tags: ['Trabajo'], updatedAt: 3 },
  { id: 'pinned', title: 'Entrega', tags: ['Trabajo'], pinned: true, updatedAt: 2 },
  { id: 'private', title: 'Secreto-UNICO', body: 'Contenido-PRIVADO', tags: ['Clave-PRIVADA'], private: true, pinned: true },
];
const allGroups = selectNoteGroups(presentationFixture, { filter: 'all' });
assert.deepEqual(allGroups.filteredPublic.map((note) => note.id), ['pinned', 'normal']);
assert.deepEqual(allGroups.visiblePrivate.map((note) => note.id), ['private']);
assert.deepEqual(selectNoteGroups(presentationFixture, { filter: 'pinned' }).filteredPublic.map((note) => note.id), ['pinned']);
assert.deepEqual(selectNoteGroups(presentationFixture, { filter: 'all', tag: 'Trabajo' }).filteredPublic.map((note) => note.id), ['pinned', 'normal']);
const privateQuery = selectNoteGroups(presentationFixture, { filter: 'all', query: 'Secreto-UNICO' });
assert.deepEqual(privateQuery.filteredPublic, [], 'La búsqueda pública no puede encontrar el título privado.');
assert.deepEqual(privateQuery.visiblePrivate, [], 'La búsqueda no debe revelar ni señalar notas privadas.');
assert.deepEqual(selectNoteGroups(presentationFixture, { filter: 'private' }).visiblePrivate.map((note) => note.id), ['private']);

const redacted = redactPrivateRecord(
  { ...privateRecord, body: 'Contenido', amount: 9900, tags: ['Urgente'], attachment: { name: 'secreto.pdf' } },
  { title: 'Nota privada', body: 'Desbloquea para ver el contenido' },
);
assert.deepEqual(redacted, {
  id: 'private',
  private: true,
  title: 'Nota privada',
  body: 'Desbloquea para ver el contenido',
});
assert.deepEqual(
  filterDiscoverableRecords([publicRecord, privateRecord]).map((record) => record.id),
  ['public'],
  'Búsquedas, filtros y agregados solo reciben registros públicos.',
);
assert.deepEqual(
  applyPrivacyFlag({ id: 'new-note', title: 'Nueva' }, true),
  { id: 'new-note', title: 'Nueva', private: true },
  'Crear una nota privada conserva el indicador en el registro persistido.',
);
assert.deepEqual(
  applyPrivacyFlag({ id: 'legacy-shape', title: 'Pública' }, false),
  { id: 'legacy-shape', title: 'Pública' },
  'Una nota pública conserva la forma histórica sin añadir campos.',
);

const firstParams = { focusId: 'private' };
const secondParams = { focusId: 'private' };
assert.equal(focusIdForParams(firstParams, null), 'private');
assert.equal(focusIdForParams(firstParams, firstParams), null);
assert.equal(focusIdForParams(secondParams, firstParams), 'private', 'La misma id en una navegación nueva vuelve a procesarse.');

const today = todayKey();
const privateOnlyValues = {
  expenses: [
    { id: 'visible-expense', amount: 10, dateKey: today },
    { id: 'hidden-expense', amount: 9999, dateKey: today, private: true, note: 'Compra secreta' },
  ],
  notes: [
    { id: 'visible-note', title: 'Visible', pinned: false },
    {
      id: 'hidden-note',
      title: 'Secreto absoluto',
      body: 'CLAVE-PRIVADA',
      tags: ['#Oculta'],
      kind: 'checklist',
      pinned: true,
      private: true,
      items: [{ id: 'hidden-item', text: 'TAREA-PRIVADA', done: false }],
    },
  ],
};
const dashboard = buildDashboard(privateOnlyValues);
assert.equal(millisecondsToNextMinute(0), 60000, 'El reloj debe programar el siguiente minuto cuando ya está en el límite.');
assert.equal(millisecondsToNextMinute(1), 59999, 'El reloj debe sincronizar el refresco con el límite del minuto.');
assert.equal(millisecondsToNextMinute(59999), 1, 'El reloj debe refrescar justo después del próximo cambio de minuto.');
assert.equal(millisecondsToNextMinute(Number.NaN), 60000, 'Un timestamp inválido debe usar un intervalo seguro.');
assert.equal(dashboard.spentToday, 10);
assert.equal(dashboard.spentMonth, 10);
assert.equal(dashboard.notesCount, 1);
assert.equal(dashboard.pinnedNotes, 0);
assert.deepEqual(dashboard.todayExpenses.map((item) => item.id), ['visible-expense']);

for (const question of ['¿Cómo va Secreto absoluto?', '¿Qué notas tengo en #Oculta?', '¿Qué notas tengo?', '¿Cuánto gasté?']) {
  const { question: echoedQuestion, ...generated } = answerQuestion(question, privateOnlyValues);
  assert.equal(echoedQuestion, question);
  const serialized = JSON.stringify(generated);
  for (const secret of ['Secreto absoluto', 'CLAVE-PRIVADA', '#Oculta', 'TAREA-PRIVADA', '9999', 'Compra secreta']) {
    if (question.toLowerCase().includes(secret.toLowerCase())) continue;
    assert.equal(serialized.includes(secret), false, `El asistente filtró ${secret}.`);
  }
}

async function verifyAuthorization(result, expected) {
  assert.equal(result.ok, expected.ok);
  assert.equal(result.authenticated, expected.authenticated);
  assert.equal(result.reason, expected.reason);
}

async function main() {
  let mutations = 0;
  let authentications = 0;
  const allow = createAuthorizationGate(async () => {
    authentications += 1;
    return { ok: true, reason: null };
  });
  await verifyAuthorization(
    await runAuthorizedAction({ required: true, authorize: allow, onAuthorized: () => { mutations += 1; } }),
    { ok: true, authenticated: true, reason: null },
  );
  assert.equal(authentications, 1);
  assert.equal(mutations, 1);

  for (const reason of ['cancelled', 'error', 'unsupported']) {
    const deny = createAuthorizationGate(async () => ({ ok: false, reason }));
    await verifyAuthorization(
      await runAuthorizedAction({ required: true, authorize: deny, onAuthorized: () => { mutations += 1; } }),
      { ok: false, authenticated: false, reason },
    );
  }
  const nativeFailure = createAuthorizationGate(async () => { throw new Error('native failure'); });
  await verifyAuthorization(
    await runAuthorizedAction({ required: true, authorize: nativeFailure, onAuthorized: () => { mutations += 1; } }),
    { ok: false, authenticated: false, reason: 'error' },
  );
  assert.equal(mutations, 1, 'Cancelar, fallar o no disponer de autenticación nunca muta.');

  let openWithoutProtection = 0;
  await verifyAuthorization(
    await runAuthorizedAction({ required: false, authorize: allow, onAuthorized: () => { openWithoutProtection += 1; } }),
    { ok: true, authenticated: false, reason: null },
  );
  assert.equal(openWithoutProtection, 1, 'Abrir con protección global desactivada está permitido.');
  assert.equal(authentications, 1, 'Una apertura permitida no invoca autenticación.');

  let releaseAuthentication;
  let guardedMutations = 0;
  const pending = createAuthorizationGate(
    () => new Promise((resolve) => { releaseAuthentication = resolve; }),
  );
  const first = runAuthorizedAction({
    required: true,
    authorize: pending,
    onAuthorized: () => { guardedMutations += 1; },
  });
  const second = await runAuthorizedAction({
    required: true,
    authorize: pending,
    onAuthorized: () => { guardedMutations += 1; },
  });
  assert.deepEqual(second, { ok: false, authenticated: false, reason: 'busy' });
  releaseAuthentication({ ok: true, reason: null });
  await first;
  assert.equal(guardedMutations, 1, 'Dos acciones simultáneas solo pueden ejecutar una mutación.');

  let authorizerCalls = 0;
  let protectedActions = 0;
  const authorizer = createPrivacyAuthorizer(async () => {
    authorizerCalls += 1;
    return { ok: true, reason: null };
  });
  await authorizer.authorizePrivateAction({
    record: privateRecord,
    action: PRIVATE_ACTIONS.open,
    privacyEnabled: true,
    promptMessage: 'Abrir desde foco externo',
    onAuthorized: () => { protectedActions += 1; },
  });
  await authorizer.authorizePrivateAction({
    record: privateRecord,
    action: PRIVATE_ACTIONS.removePrivacy,
    privacyEnabled: false,
    onAuthorized: () => { protectedActions += 1; },
  });
  await authorizer.authorizeGlobalPrivacyChange({
    currentValue: true,
    nextValue: false,
    onAuthorized: () => { protectedActions += 1; },
  });
  assert.equal(authorizerCalls, 3, 'Foco externo, acción rápida y desactivación global autentican.');
  assert.equal(protectedActions, 3);

  await authorizer.authorizePrivateAction({
    record: privateRecord,
    action: PRIVATE_ACTIONS.open,
    privacyEnabled: false,
    onAuthorized: () => { protectedActions += 1; },
  });
  assert.equal(authorizerCalls, 3, 'Abrir con protección desactivada no autentica.');
  assert.equal(protectedActions, 4);

  let signalActionStarted;
  let releaseAction;
  const actionStarted = new Promise((resolve) => { signalActionStarted = resolve; });
  const heldAuthorizer = createPrivacyAuthorizer(async () => ({ ok: true, reason: null }));
  const heldAction = heldAuthorizer.authorizePrivateAction({
    record: privateRecord,
    action: PRIVATE_ACTIONS.delete,
    onAuthorized: () => new Promise((resolve) => {
      releaseAction = resolve;
      signalActionStarted();
    }),
  });
  await actionStarted;
  const overlappingAction = await heldAuthorizer.authorizePrivateAction({
    record: privateRecord,
    action: PRIVATE_ACTIONS.delete,
    onAuthorized: () => { throw new Error('Una acción simultánea no debe ejecutarse.'); },
  });
  assert.deepEqual(overlappingAction, { ok: false, authenticated: false, reason: 'busy' });
  releaseAction();
  await heldAction;

  console.log('privacy-smoke-test: política, fallos y concurrencia verificados');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
