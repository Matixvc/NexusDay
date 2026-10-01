/**
 * Screen surfaces (Ajustes › Modo de pantalla).
 *
 * An accent tints the interface; the *surface* decides what it is painted on top of. Three
 * modes ship: the original graphite dark, pure black for AMOLED panels (the background is
 * literally #000000, so those pixels switch off) and a real light mode built on #ffffff.
 *
 * Every mode declares the same token names, so the rest of the app never branches: it keeps
 * reading `colors.surface`, `colors.textMuted`, `colors.scrim`… and `applyTheme` repaints
 * them. Text tones are chosen *per mode* — the greys that read at 7:1 over black fall under
 * 2:1 over white — which is why contrast lives here and not in `typography`.
 *
 * Value uniqueness inside a mode matters: `applyTheme` repaints the registered style sheets
 * by swapping old colour strings for new ones, so two tokens that shared a value in the same
 * mode would be indistinguishable at swap time. `findTokenCollisions` keeps that invariant
 * honest if a palette is ever edited.
 *
 * Pure data with no imports on purpose: `theme.js` reads it, so any file can import it too.
 */
export const SURFACE_MODES = [
  {
    id: 'dark',
    label: 'Oscuro grafito',
    hint: 'El original de NexusDay: gris grafito suave, sin fatiga nocturna.',
    dark: true,
    statusBar: 'light',
    swatch: ['#151518', '#f4f4f6'],
    tokens: {
      background: '#090909',
      elevated: '#101012',
      surface: '#151518',
      surfaceAlt: '#1d1d21',
      surfacePlus: '#27272d',
      border: '#26262b',
      borderStrong: '#35353d',
      text: '#f4f4f6',
      // Measured against `background` (#090909): textSecondary 12.6:1, textMuted 7.7:1 —
      // both clear WCAG AA on every panel of the mode.
      textSecondary: '#cccccc',
      textMuted: '#a0a0a0',
      scrim: 'rgba(9, 9, 9, 0.69)',
      scrimStrong: 'rgba(9, 9, 9, 0.85)',
      scrimMax: 'rgba(9, 9, 9, 0.93)',
      panel: 'rgba(21, 21, 24, 0.8)',
      panelStrong: 'rgba(21, 21, 24, 0.95)',
      warning: '#fbbf24',
      warningSoft: 'rgba(251, 191, 36, 0.14)',
      danger: '#ff6b6b',
      dangerSoft: 'rgba(255, 107, 107, 0.12)',
    },
  },
  {
    id: 'amoled',
    label: 'Negro puro (AMOLED)',
    hint: 'Fondo #000000: los píxeles se apagan y la batería rinde más.',
    dark: true,
    statusBar: 'light',
    swatch: ['#000000', '#ffffff'],
    tokens: {
      background: '#000000',
      elevated: '#050506',
      surface: '#0b0b0d',
      surfaceAlt: '#121215',
      surfacePlus: '#1b1b1f',
      border: '#1a1a1e',
      borderStrong: '#2a2a30',
      text: '#ffffff',
      // Over pure black the greys step up a notch so secondary copy stays above 6:1.
      textSecondary: '#d6d6da',
      textMuted: '#a8a8b0',
      scrim: 'rgba(0, 0, 0, 0.69)',
      scrimStrong: 'rgba(0, 0, 0, 0.85)',
      scrimMax: 'rgba(0, 0, 0, 0.93)',
      panel: 'rgba(11, 11, 13, 0.8)',
      panelStrong: 'rgba(11, 11, 13, 0.95)',
      // Over pure black the feedback hues lift a touch so a warning still reads at 8:1.
      warning: '#ffca4d',
      warningSoft: 'rgba(255, 202, 77, 0.16)',
      danger: '#ff7b86',
      dangerSoft: 'rgba(255, 123, 134, 0.16)',
    },
  },
  {
    id: 'light',
    label: 'Claro',
    hint: 'Blanco #ffffff real: textos oscuros y bordes suaves, no un negro invertido.',
    dark: false,
    statusBar: 'dark',
    swatch: ['#ffffff', '#141419'],
    tokens: {
      background: '#ffffff',
      // A light mode cannot stack panels the way a dark one does (there is nowhere brighter
      // to go), so the layering inverts: the page is white and cards step down in grey.
      elevated: '#f7f7f9',
      surface: '#fdfdfe',
      surfaceAlt: '#f1f1f4',
      surfacePlus: '#e5e5ea',
      border: '#e3e3e8',
      borderStrong: '#c9c9d2',
      text: '#141419',
      textSecondary: '#3f3f46',
      textMuted: '#5f5f68',
      scrim: 'rgba(255, 255, 255, 0.69)',
      scrimStrong: 'rgba(255, 255, 255, 0.85)',
      scrimMax: 'rgba(255, 255, 255, 0.93)',
      panel: 'rgba(253, 253, 254, 0.8)',
      panelStrong: 'rgba(253, 253, 254, 0.95)',
      // Amber and coral tuned for daylight: `#fbbf24` text over white is 1.9:1, so the light
      // mode uses their burnt counterparts (5.9:1 and 5.4:1).
      warning: '#a15c00',
      warningSoft: 'rgba(161, 92, 0, 0.12)',
      danger: '#c02334',
      dangerSoft: 'rgba(192, 35, 52, 0.12)',
    },
  },
];

export const DEFAULT_SURFACE_ID = 'dark';

const SURFACE_INDEX = new Map(SURFACE_MODES.map((mode) => [mode.id, mode]));

export function getSurfaceMode(id) {
  return SURFACE_INDEX.get(id) || SURFACE_INDEX.get(DEFAULT_SURFACE_ID);
}

export function isSurfaceId(id) {
  return SURFACE_INDEX.has(id);
}

/**
 * Cross-checks a resolved palette for two tokens sharing one colour string. `applyTheme`
 * repaints the frozen style sheets by swapping value strings, so a duplicate would silently
 * repaint the wrong property. Only a development guard — never throws in the app.
 */
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
