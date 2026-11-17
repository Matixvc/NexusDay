const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function readConstExport(file, name, nextExport) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const pattern = new RegExp(`export const ${name} = ([\\s\\S]*?);\\r?\\n\\r?\\nexport const ${nextExport}`);
  const match = source.match(pattern);
  if (!match) throw new Error(`No se pudo leer ${name} desde ${file}`);
  return vm.runInNewContext(`(${match[1]})`, Object.create(null));
}

function loadPureModule(file, exportNames) {
  const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\bexport\s+/g, '');
  return vm.runInNewContext(`${source}\n;({ ${exportNames.join(', ')} })`, Object.create(null));
}

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const bytes = hex.match(/[0-9a-f]{2}/gi).map((part) => Number.parseInt(part, 16));
  return 0.2126 * channel(bytes[0]) + 0.7152 * channel(bytes[1]) + 0.0722 * channel(bytes[2]);
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertContrast(label, foreground, background, minimum = 4.5) {
  const ratio = contrast(foreground, background);
  assert(ratio >= minimum, `${label}: ${foreground} sobre ${background} da ${ratio.toFixed(2)}:1 (< ${minimum}:1)`);
}

const surfaceModule = loadPureModule('src/theme/surfaces.js', [
  'SURFACE_MODES',
  'DEFAULT_SURFACE_ID',
  'getSurfaceMode',
  'isSurfaceId',
  'findTokenCollisions',
]);
const accentModule = loadPureModule('src/theme/accents.js', [
  'ACCENT_THEMES',
  'DEFAULT_ACCENT_ID',
  'getAccentTheme',
  'isAccentId',
  'resolveAccent',
]);
const themeSource = fs.readFileSync(path.join(root, 'src/theme/theme.js'), 'utf8');
const brand = readConstExport('src/theme/theme.js', 'brand', 'spacing');
const overlay = themeSource.match(/Object\.assign\(\{ overlay: '([^']+)'/)?.[1];
const surfaces = surfaceModule.SURFACE_MODES;
const accents = accentModule.ACCENT_THEMES;
const expectedIds = ['dark', 'amoled', 'light'];
const historicalAccentIds = ['verde', 'cian', 'azul', 'rojo', 'amarillo', 'purpura'];
const tokenKeys = Object.keys(surfaces[0].tokens).sort();

assert(JSON.stringify(surfaces.map((mode) => mode.id)) === JSON.stringify(expectedIds), 'Las superficies deben ser dark, amoled y light.');
assert(surfaceModule.DEFAULT_SURFACE_ID === 'dark', 'Modern Dark debe ser la superficie por defecto.');
assert(surfaceModule.getSurfaceMode('desconocido').id === 'dark', 'Una superficie desconocida debe caer en Modern Dark.');
assert(JSON.stringify(accents.map((accent) => accent.id)) === JSON.stringify(historicalAccentIds), 'Deben conservarse exactamente los seis acentos históricos.');
assert(overlay, 'No se pudo leer el overlay real del runtime.');

for (const surface of surfaces) {
  assert(JSON.stringify(Object.keys(surface.tokens).sort()) === JSON.stringify(tokenKeys), `${surface.id}: conjunto de tokens distinto.`);

  const tokens = surface.tokens;
  for (const background of [tokens.background, tokens.elevated, tokens.surface, tokens.surfaceAlt]) {
    assertContrast(`${surface.id}.text`, tokens.text, background);
    assertContrast(`${surface.id}.textSecondary`, tokens.textSecondary, background);
    assertContrast(`${surface.id}.textMuted`, tokens.textMuted, background);
    assertContrast(`${surface.id}.mint`, tokens.mint, background);
    assertContrast(`${surface.id}.amber`, tokens.amber, background);
    assertContrast(`${surface.id}.coral`, tokens.coral, background);
  }
  assertContrast(`${surface.id}.mintInk`, tokens.mintInk, tokens.mint);
  assertContrast(`${surface.id}.amberInk`, tokens.amberInk, tokens.amber);
  assertContrast(`${surface.id}.coralInk`, tokens.coralInk, tokens.coral);

  for (const accent of accents) {
    const resolved = accentModule.resolveAccent(accent, surface.id);
    const combined = { overlay, ...tokens, accent: resolved.accent, accentSoft: resolved.accentSoft, accentInk: resolved.accentInk, ...brand };
    const seen = new Map();
    for (const [key, value] of Object.entries(combined)) {
      const previous = seen.get(value);
      assert(!previous, `${surface.id}/${accent.id}: ${previous} y ${key} comparten ${value}`);
      seen.set(value, key);
    }
    for (const background of [tokens.background, tokens.elevated, tokens.surface, tokens.surfaceAlt]) {
      assertContrast(`${surface.id}/${accent.id}.accent`, resolved.accent, background);
    }
    assertContrast(`${surface.id}/${accent.id}.accentInk`, resolved.accentInk, resolved.accent);
  }
}

assertContrast('primaryAction', brand.onPrimaryAction, brand.primaryAction);
console.log(`OK: ${surfaces.length} superficies, ${accents.length} acentos y ${surfaces.length * accents.length} combinaciones válidas.`);
