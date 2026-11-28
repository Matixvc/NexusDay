/**
 * Las cuatro identidades visuales seleccionables de NexusDay.
 * Todas exponen el mismo contrato de tokens. `amoled` se conserva como alias de lectura:
 * al hidratar una preferencia histórica se normaliza a `mono`.
 */
export const SURFACE_MODES = [
  {
    id: 'light', label: 'Blanco',
    hint: 'Base luminosa, tarjetas limpias y textos oscuros de alta legibilidad.',
    dark: false, statusBar: 'dark', swatch: ['#F7F8FC', '#171A26'],
    tokens: {
      background: '#F7F8FC', elevated: '#FFFFFF', surface: '#F1F3F8', surfaceAlt: '#E8ECF4', surfacePlus: '#DDE3EE',
      border: '#D9DFEA', borderStrong: '#8792A8', text: '#171A26', textSecondary: '#4D5568', textMuted: '#626B7F',
      scrim: 'rgba(255, 255, 255, 0.69)', scrimStrong: 'rgba(255, 255, 255, 0.85)', scrimMax: 'rgba(255, 255, 255, 0.93)',
      panel: 'rgba(241, 243, 248, 0.86)', panelStrong: 'rgba(241, 243, 248, 0.98)',
      mint: '#06766F', mintSoft: 'rgba(6, 118, 111, 0.11)', mintInk: '#F3FFFE',
      amber: '#8A4B00', amberSoft: 'rgba(138, 75, 0, 0.11)', amberInk: '#FFF9F0',
      coral: '#B42355', coralSoft: 'rgba(180, 35, 85, 0.11)', coralInk: '#FFF4F7',
      violet: '#6848D8', violetSoft: 'rgba(104, 72, 216, 0.13)', violetInk: '#FAF6FF',
      editorialSurface: '#EEEAFB', editorialInk: '#30245A', selectedSurface: '#E4DCF9', progressTrack: '#D3C9EF',
      violetContainer: '#DED5F8', onVioletContainer: '#30205F', mintContainer: '#D4EFEB', onMintContainer: '#084F49',
      coralContainer: '#F6D8E1', onCoralContainer: '#741436', amberContainer: '#F6E2C5', onAmberContainer: '#633600',
      warning: '#A15C00', warningSoft: 'rgba(161, 92, 0, 0.12)', danger: '#C40024', dangerSoft: 'rgba(196, 0, 36, 0.12)',
    },
  },
  {
    id: 'dark', label: 'Oscuro',
    hint: 'Azul noche equilibrado, con superficies separadas y contraste cómodo.',
    dark: true, statusBar: 'light', swatch: ['#101422', '#F7F8FC'],
    tokens: {
      background: '#101422', elevated: '#151A2A', surface: '#1A2032', surfaceAlt: '#222A40', surfacePlus: '#2A334B',
      border: '#303A54', borderStrong: '#66718B', text: '#F7F8FC', textSecondary: '#C9CEDD', textMuted: '#9EA7BC',
      scrim: 'rgba(5, 7, 14, 0.70)', scrimStrong: 'rgba(5, 7, 14, 0.86)', scrimMax: 'rgba(5, 7, 14, 0.94)',
      panel: 'rgba(26, 32, 50, 0.84)', panelStrong: 'rgba(26, 32, 50, 0.97)',
      mint: '#5EDDD4', mintSoft: 'rgba(94, 221, 212, 0.14)', mintInk: '#082A2A',
      amber: '#FFC478', amberSoft: 'rgba(255, 196, 120, 0.15)', amberInk: '#321A00',
      coral: '#FF8BAD', coralSoft: 'rgba(255, 139, 173, 0.15)', coralInk: '#3A071A',
      violet: '#B9A7FF', violetSoft: 'rgba(185, 167, 255, 0.17)', violetInk: '#201538',
      editorialSurface: '#282441', editorialInk: '#E8E1FF', selectedSurface: '#302A50', progressTrack: '#3A335D',
      violetContainer: '#403663', onVioletContainer: '#F0ECFF', mintContainer: '#173E3D', onMintContainer: '#C8FFF9',
      coralContainer: '#4A2634', onCoralContainer: '#FFE5ED', amberContainer: '#49351F', onAmberContainer: '#FFE9CA',
      warning: '#FFD166', warningSoft: 'rgba(255, 209, 102, 0.13)', danger: '#FF7188', dangerSoft: 'rgba(255, 113, 136, 0.14)',
    },
  },
  {
    id: 'mono', label: 'Blanco y negro',
    hint: 'Negro puro, blanco y grises neutros; conserva tu acento sin mostrar color.',
    dark: true, statusBar: 'light', swatch: ['#050505', '#F7F7F7'],
    tokens: {
      background: '#050505', elevated: '#0B0B0B', surface: '#121212', surfaceAlt: '#1A1A1A', surfacePlus: '#242424',
      border: '#303030', borderStrong: '#707070', text: '#F7F7F7', textSecondary: '#D0D0D0', textMuted: '#A5A5A5',
      scrim: 'rgba(0, 0, 0, 0.69)', scrimStrong: 'rgba(0, 0, 0, 0.85)', scrimMax: 'rgba(0, 0, 0, 0.93)',
      panel: 'rgba(18, 18, 18, 0.82)', panelStrong: 'rgba(18, 18, 18, 0.96)',
      mint: '#E8E8E8', mintSoft: 'rgba(232, 232, 232, 0.12)', mintInk: '#161616',
      amber: '#DADADA', amberSoft: 'rgba(218, 218, 218, 0.13)', amberInk: '#101010',
      coral: '#CCCCCC', coralSoft: 'rgba(204, 204, 204, 0.14)', coralInk: '#080808',
      violet: '#E2E2E2', violetSoft: 'rgba(226, 226, 226, 0.11)', violetInk: '#141414',
      editorialSurface: '#202020', editorialInk: '#EAEAEA', selectedSurface: '#292929', progressTrack: '#383838',
      violetContainer: '#333333', onVioletContainer: '#F1F1F1', mintContainer: '#3C3C3C', onMintContainer: '#FAFAFA',
      coralContainer: '#454545', onCoralContainer: '#F4F4F4', amberContainer: '#4E4E4E', onAmberContainer: '#FCFCFC',
      warning: '#BEBEBE', warningSoft: 'rgba(190, 190, 190, 0.15)', danger: '#B0B0B0', dangerSoft: 'rgba(176, 176, 176, 0.16)',
    },
  },
  {
    id: 'nex', label: 'Nex',
    hint: 'Grafito y carbón con acentos definidos, tarjetas elegantes y jerarquía firme.',
    dark: true, statusBar: 'light', swatch: ['#15121D', '#B9A7FF'],
    tokens: {
      background: '#15121D', elevated: '#1C1827', surface: '#231E31', surfaceAlt: '#2B253B', surfacePlus: '#352E47',
      border: '#443B59', borderStrong: '#817497', text: '#F8F5FC', textSecondary: '#D7CFE3', textMuted: '#ADA3BC',
      scrim: 'rgba(8, 6, 13, 0.71)', scrimStrong: 'rgba(8, 6, 13, 0.87)', scrimMax: 'rgba(8, 6, 13, 0.95)',
      panel: 'rgba(35, 30, 49, 0.85)', panelStrong: 'rgba(35, 30, 49, 0.98)',
      mint: '#62DED3', mintSoft: 'rgba(98, 222, 211, 0.16)', mintInk: '#062622',
      amber: '#FFC77D', amberSoft: 'rgba(255, 199, 125, 0.17)', amberInk: '#301900',
      coral: '#FF8FAF', coralSoft: 'rgba(255, 143, 175, 0.17)', coralInk: '#370617',
      violet: '#B9A7FF', violetSoft: 'rgba(185, 167, 255, 0.18)', violetInk: '#201538',
      editorialSurface: '#302746', editorialInk: '#F0E9FF', selectedSurface: '#3A3053', progressTrack: '#493D66',
      violetContainer: '#493B70', onVioletContainer: '#F4F0FF', mintContainer: '#194340', onMintContainer: '#C9FFF9',
      coralContainer: '#51283A', onCoralContainer: '#FFE5ED', amberContainer: '#4E3820', onAmberContainer: '#FFE9C9',
      warning: '#FFD166', warningSoft: 'rgba(255, 209, 102, 0.13)', danger: '#FF7188', dangerSoft: 'rgba(255, 113, 136, 0.14)',
    },
  },
];

export const DEFAULT_SURFACE_ID = 'nex';

/** Tres temas que se ofrecen en Ajustes; los IDs mono/amoled siguen resolviéndose al hidratar. */
export const SELECTABLE_SURFACE_MODES = Object.freeze(SURFACE_MODES.filter((mode) => mode.id !== 'mono'));

const SURFACE_ALIASES = Object.freeze({ amoled: 'mono' });
const SURFACE_INDEX = new Map(SURFACE_MODES.map((mode) => [mode.id, mode]));

export function normalizeSurfaceId(id) {
  const normalized = SURFACE_ALIASES[id] || id;
  return SURFACE_INDEX.has(normalized) ? normalized : DEFAULT_SURFACE_ID;
}

export function resolveSurfacePreference(id) {
  const surfaceId = normalizeSurfaceId(id);
  return { surfaceId, shouldPersist: typeof id === 'string' && id !== surfaceId };
}

export async function resolveHydratedSurfacePreference(id, { persist, canApply } = {}) {
  const preference = resolveSurfacePreference(id);
  if (preference.shouldPersist && typeof persist === 'function') {
    await persist(preference.surfaceId);
  }
  return typeof canApply !== 'function' || canApply() ? preference.surfaceId : null;
}

export function getSurfaceMode(id) {
  return SURFACE_INDEX.get(normalizeSurfaceId(id));
}

export function isSurfaceId(id) {
  return SURFACE_INDEX.has(id) || Object.prototype.hasOwnProperty.call(SURFACE_ALIASES, id);
}

export function findTokenCollisions(tokens) {
  const seen = new Map();
  const clashes = [];
  Object.entries(tokens).forEach(([name, value]) => {
    if (typeof value !== 'string') return;
    const previous = seen.get(value);
    if (previous) clashes.push(`${previous} y ${name} comparten ${value}`);
    else seen.set(value, name);
  });
  return clashes;
}
