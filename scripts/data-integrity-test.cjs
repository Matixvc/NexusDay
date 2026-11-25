const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src') + path.sep;
const disk = new Map();
const backend = {
  getItem: async (key) => disk.get(key) ?? null,
  setItem: async (key, value) => { disk.set(key, value); },
  removeItem: async (key) => { disk.delete(key); },
};
const originalLoad = Module._load;
Module._load = function (id, ...args) {
  return id === '@react-native-async-storage/async-storage' ? backend : originalLoad.call(this, id, ...args);
};
const loader = require.extensions['.js'];
require.extensions['.js'] = (mod, file) => {
  if (!file.startsWith(src)) return loader(mod, file);
  mod._compile(babel.transformFileSync(file, {
    babelrc: false, configFile: false, presets: ['babel-preset-expo'],
  }).code, file);
};
const storage = require('../src/services/storage');
const { KEYS } = storage;

// Exercise screen/provider callbacks without mounting native controls in Node.
function callback(file, binding, scope) {
  const source = fs.readFileSync(path.join(src, file), 'utf8');
  const ast = babel.parseSync(source, { configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] } });
  let fn;
  babel.traverse(ast, { VariableDeclarator(p) {
    if (p.node.id.name !== binding) return;
    const init = p.node.init;
    fn = init.type === 'CallExpression' ? init.arguments[0] : init;
  } });
  return Function(...Object.keys(scope), 'return (' + source.slice(fn.start, fn.end) + ')')(...Object.values(scope));
}

test('interrupted replay and historical incomplete flag preserve all seven collections', async () => {
  const file = 'context/AppDataContext.js';
  const keys = ['activities','events','birthdays','notes','habits','expenses','routines'].map(k => KEYS[k]);
  const original = '[{"id":"fixture"}]';
  keys.forEach(k => disk.set(k, original));
  disk.set(KEYS.onboarding, 'true');
  const context = Object.fromEntries(keys.map(key => [key.split('/').pop(), { replaceAll() {} }]));
  context.routines = { runExclusive: op => op({ setSnapshot() {} }) };
  const scope = { ...storage, setTutorial() {}, tutorial: { replay: false },
    clearAllData: callback(file, 'clearAllData', { ...storage, ...context }) };
  callback(file, 'replayTutorial', scope)();
  await new Promise(resolve => setImmediate(resolve));
  // Restart loses the in-memory replay flag. An older installation may also have stored false.
  if (!(await storage.loadValue(KEYS.onboarding, false))) await callback(file, 'finishTutorial', scope)();
  for (const k of keys) assert.equal(disk.get(k), original);
  disk.delete(KEYS.onboarding);
  await callback(file, 'finishTutorial', scope)();
  for (const k of keys) assert.equal(disk.get(k), original);
  assert.equal(disk.get(KEYS.onboarding), 'true');
});

for (const [raw, code] of [['{', 'INVALID_JSON'], ['null', 'INCOMPATIBLE_COLLECTION'], ['[null]', 'INCOMPATIBLE_COLLECTION'],
  ['[{}]', 'INCOMPATIBLE_COLLECTION'], ['[{"id":"x"},{"id":"x"}]', 'INCOMPATIBLE_COLLECTION']]) {
  test('preserves unreadable collection: ' + raw, async () => {
    disk.set(KEYS.notes, raw);
    await assert.rejects(storage.loadJSON(KEYS.notes), { code });
    assert.equal(disk.get(KEYS.notes), raw);
  });
}

test('read failures stay distinct from missing and successful reads', async () => {
  disk.delete(KEYS.notes);
  assert.equal(await storage.loadJSON(KEYS.notes, null), null);
  const legacy = '@appmobile/v1/notes';
  disk.set(legacy, '[{"id":"legacy","extra":5}]');
  assert.deepEqual(await storage.loadJSON(KEYS.notes), [{ id: 'legacy', extra: 5 }]);
  const read = backend.getItem;
  backend.getItem = async () => { throw Error('fixture'); };
  try { await assert.rejects(storage.loadJSON(KEYS.notes), { code: 'COLLECTION_READ_FAILED' }); }
  finally { backend.getItem = read; disk.delete(legacy); }
});

test('failed note save keeps the editor, its take and the previous media', async () => {
  const old = { uri: 'fixture:old' };
  const take = { uri: 'fixture:new' };
  let draft = { mode: 'edit', id: 'n', original: { audio: old, attachment: old },
    values: { title: 'Fixture', body: '', audio: old, attachment: null } };
  const effects = [];
  const scope = { sheet: draft, hasContent: true, importing: false, saving: false, savingRef: { current: false },
    NOTE_KINDS: { checklist: 'checklist' }, recorderRef: { current: { finishTake: async () => take } },
    updateNote: async () => false, setSaving() {}, setConfirmDiscard() {}, setPickError() {},
    setValue: patch => Object.assign(draft.values, patch), setSheet: next => { draft = next; },
    removeFile: () => effects.push('remove'), deleteRecording: () => effects.push('delete'),
    successHaptic: () => effects.push('success') };
  await callback('screens/NotesScreen.js', 'save', scope)();
  assert.deepEqual(effects, []);
  assert.equal(draft.values.audio, take);
  assert.equal(draft.values.title, 'Fixture');
  let release;
  const written = new Promise(resolve => { release = resolve; });
  scope.recorderRef.current.finishTake = async () => null;
  scope.updateNote = async (_id, record) => {
    assert.equal(record.audio.uri, take.uri);
    return written;
  };
  const retry = callback('screens/NotesScreen.js', 'save', scope)();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(effects, []);
  assert.ok(draft);
  release(true);
  await retry;
  assert.deepEqual(effects, ['delete', 'remove', 'success']);
  assert.equal(draft, null);
});


test('ordered edits survive an intervening write failure and publish only confirmed snapshots', async () => {
  disk.set(KEYS.notes, '[]');
  const published = [];
  const unsubscribe = storage.subscribeCollection(KEYS.notes, rows => published.push(rows.map(row => row.id)));
  const write = backend.setItem;
  backend.setItem = async (key, value) => {
    if (value.includes('"rejected"')) throw Error('synthetic failure');
    await new Promise(resolve => setImmediate(resolve));
    await write(key, value);
  };
  try {
    const append = id => storage.mutateCollection(KEYS.notes, rows => [...rows, { id }]);
    const writes = await Promise.allSettled(['first', 'rejected', 'last'].map(append));
    assert.deepEqual(writes.map(task => task.status), ['fulfilled', 'rejected', 'fulfilled']);
    assert.deepEqual(JSON.parse(disk.get(KEYS.notes)), [{ id: 'first' }, { id: 'last' }]);
    assert.deepEqual(published, [['first'], ['first', 'last']]);
  } finally { unsubscribe(); backend.setItem = write; }
});

test('journal rollback precedes hydration and a subsequent edit uses recovered data', async () => {
  const file = require.resolve('../src/services/storage');
  delete require.cache[file];
  const reboot = require(file);
  const journal = '@nexusday/v1/restore_journal';
  disk.set(KEYS.notes, '[{"id":"partial"}]');
  disk.set(journal, JSON.stringify({ version: 1, status: 'prepared',
    originals: [{ key: KEYS.notes, value: '[{"id":"original"}]' }] }));
  assert.deepEqual(await reboot.loadJSON(KEYS.notes), [{ id: 'original' }]);
  assert.equal(disk.has(journal), false);
  await reboot.mutateCollection(KEYS.notes, rows => [...rows, { id: 'new' }]);
  assert.deepEqual(JSON.parse(disk.get(KEYS.notes)), [{ id: 'original' }, { id: 'new' }]);
  delete require.cache[file];
  const blocked = require(file);
  disk.set(journal, '{');
  const before = disk.get(KEYS.notes);
  await assert.rejects(blocked.mutateCollection(KEYS.notes, () => []), { code: 'RESTORE_RECOVERY_REQUIRED' });
  assert.equal(disk.get(KEYS.notes), before);
  assert.equal(disk.get(journal), '{');
  disk.delete(journal);
});

test('an active recording that cannot be finalized is a save failure', async () => {
  const finish = callback('hooks/useRecorder.js', 'finishTake', {
    starting: { current: false }, saving: { current: false }, recorderRef: { current: {} },
    recorderSnapshot: () => ({ isRecording: true }), stopAndSave: async () => null,
  });
  await assert.rejects(finish());
});

test('a recording still being imported cannot be mistaken for an empty take', async () => {
  const finish = callback('hooks/useRecorder.js', 'finishTake', {
    starting: { current: false }, saving: { current: true }, recorderRef: { current: {} },
    recorderSnapshot: () => ({ isRecording: false }),
  });
  await assert.rejects(finish());
});

test('fresh install completes empty and hydration does not rewrite a legacy collection', async () => {
  const file = 'context/AppDataContext.js';
  const keys = ['activities','events','birthdays','notes','habits','expenses','routines'].map(k => KEYS[k]);
  disk.clear();
  const scope = { ...storage, setTutorial() {}, tutorial: { replay: false } };
  await callback(file, 'finishTutorial', scope)();
  for (const key of keys) {
    assert.equal(await storage.loadJSON(key, null), null);
    assert.equal(disk.has(key), false);
  }
  const raw = '[ { "id": "older", "futureField": 17 } ]';
  disk.set('@appmobile/v1/notes', raw);
  assert.deepEqual(await storage.loadJSON(KEYS.notes), [{ id: 'older', futureField: 17 }]);
  assert.equal(disk.get('@appmobile/v1/notes'), raw);
  assert.equal(disk.has(KEYS.notes), false);
});

test('a partial ND-02 restore preserves an edit queued before it and accepts the next edit', async () => {
  disk.clear();
  disk.set(KEYS.notes, '[{"id":"one","title":"synthetic"}]');
  const scope = { ...storage, ...require('../src/services/backupRestore'),
    routines: { runExclusive: op => op({ items: [], setSnapshot() {} }) },
    settings: {}, resyncReminders: async () => ({
      eventPatches: [], birthdayPatches: [], habitPatches: [], activityPatches: [], failures: [],
    }),
  };
  for (const name of ['activities','events','birthdays','notes','habits','expenses']) {
    scope[name] = { items: [], replaceAll() {} };
  }
  const append = id => storage.mutateCollection(KEYS.notes, rows => [...rows, { id, title: 'synthetic' }]);
  const first = append('two');
  const restore = callback('context/AppDataContext.js', 'restoreBackup', scope)({ events: [] });
  const last = append('three');
  await Promise.all([first, restore, last]);
  assert.deepEqual(JSON.parse(disk.get(KEYS.notes)).map(row => row.id), ['one', 'two', 'three']);
});
