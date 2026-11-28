const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadPureModule(file, exportNames) {
  const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\bexport\s+/g, '');
  return vm.runInNewContext(`${source}\n;({ ${exportNames.join(', ')} })`, Object.create(null));
}

const surfaces = loadPureModule('src/theme/surfaces.js', [
  'resolveHydratedSurfacePreference',
]);
const accents = loadPureModule('src/theme/accents.js', [
  'getAccentTheme',
  'resolvePreviewAccent',
]);

async function main() {
  let releasePersistence;
  let current = true;
  let persisted = null;
  const pending = surfaces.resolveHydratedSurfacePreference('amoled', {
    persist: (surfaceId) => new Promise((resolve) => {
      persisted = surfaceId;
      releasePersistence = resolve;
    }),
    canApply: () => current,
  });

  current = false;
  releasePersistence(true);

  assert.equal(await pending, null, 'Una selección nueva invalida la hidratación pendiente.');
  assert.equal(persisted, 'mono', 'La migración persiste el identificador normalizado.');

  const red = accents.getAccentTheme('rojo');
  const preview = accents.resolvePreviewAccent(red, 'light', 'mono');
  assert.deepEqual(
    { accent: preview.accent, alt: preview.alt },
    { accent: '#EFEFEF', alt: '#B8B8B8' },
    'Las miniaturas permanecen neutras mientras Blanco y negro está activo.',
  );

  console.log('theme-hydration-smoke-test: migración y miniaturas verificadas');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
