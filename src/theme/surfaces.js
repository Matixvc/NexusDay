/**
 * Bases de pantalla (Ajustes › Modo de pantalla).
 *
 * El acento tiñe la interfaz; la *base* decide sobre qué se pinta. Se envían exactamente dos:
 * el **Oscuro puro (AMOLED)**, con fondo `#000000` real para que los píxeles se apaguen, y el
 * **Claro puro**, blanco `#ffffff` de verdad. Ambas declaran los mismos nombres de token, así
 * que el resto de la app nunca bifurca: sigue leyendo `colors.surface`, `colors.textMuted`… y
 * `applyTheme` los repinta.
 *
 * Los tonos de texto se eligen *por base* — los grises que se leen a 7:1 sobre negro caen bajo
 * 2:1 sobre blanco — así que el contraste vive aquí y no en `typography`.
 *
 * La unicidad de valores dentro de una base importa: `applyTheme` repinta las hojas de estilo
 * congeladas intercambiando cadenas de color, así que dos tokens que compartieran valor en la
 * misma base serían indistinguibles al intercambiar. `findTokenCollisions` vigila ese
 * invariante si una paleta se edita.
 *
 * Data pura, sin imports a propósito: `theme.js` la lee, así que cualquier archivo puede
 * importarla también.
 */
export const SURFACE_MODES = [
  {
    id: 'amoled',
    label: 'Oscuro puro (AMOLED)',
    hint: 'Fondo #000000 real: los píxeles se apagan y la batería rinde más.',
    dark: true,
    statusBar: 'light',
    swatch: ['#000000', '#F5F5F7'],
    tokens: {
      background: '#000000',
      elevated: '#08080B',
      surface: '#0D0D11',
      surfaceAlt: '#15151C',
      surfacePlus: '#202028',
      border: '#1E1E26',
      borderStrong: '#2E2E3A',
      text: '#F5F5F7',
      // Medido sobre `surface` (#0D0D11): textSecondary 9.1:1, textMuted 6.6:1 — ambos superan
      // WCAG AA sobre cada panel de la base.
      textSecondary: '#C7C7CF',
      textMuted: '#9A9AA6',
      scrim: 'rgba(0, 0, 0, 0.69)',
      scrimStrong: 'rgba(0, 0, 0, 0.85)',
      scrimMax: 'rgba(0, 0, 0, 0.93)',
      panel: 'rgba(13, 13, 17, 0.82)',
      panelStrong: 'rgba(13, 13, 17, 0.96)',
      // Sobre el negro puro los tonos de aviso suben un punto para seguir legibles.
      warning: '#FFC400',
      warningSoft: 'rgba(255, 196, 0, 0.16)',
      danger: '#FF4D5E',
      dangerSoft: 'rgba(255, 77, 94, 0.16)',
    },
  },
  {
    id: 'light',
    label: 'Claro puro',
    hint: 'Blanco #ffffff real: textos oscuros y bordes suaves, no un negro invertido.',
    dark: false,
    statusBar: 'dark',
    swatch: ['#FFFFFF', '#111115'],
    tokens: {
      background: '#FFFFFF',
      // Un modo claro no apila paneles como uno oscuro (no hay nada más brillante a dónde ir),
      // así que el eje se invierte: la página es blanca y las tarjetas bajan a gris.
      elevated: '#FAFAFC',
      surface: '#F4F5F8',
      surfaceAlt: '#EBEDF2',
      surfacePlus: '#DFE2E9',
      border: '#E2E4EA',
      borderStrong: '#C9CCD6',
      text: '#111115',
      // Calculado sobre `surface` (#F4F5F8): textSecondary 9.6:1, textMuted 5.3:1 — ambos
      // limpian WCAG AA a plena luz.
      textSecondary: '#3F3F48',
      textMuted: '#62626E',
      scrim: 'rgba(255, 255, 255, 0.69)',
      scrimStrong: 'rgba(255, 255, 255, 0.85)',
      scrimMax: 'rgba(255, 255, 255, 0.93)',
      panel: 'rgba(244, 245, 248, 0.85)',
      panelStrong: 'rgba(244, 245, 248, 0.97)',
      // Ámbar y coral afinados para la luz del día: `#FFC400` sobre blanco es 1.4:1, así que la
      // base clara usa sus contrapartes tostadas (4.6:1 y 5.0:1).
      warning: '#A15C00',
      warningSoft: 'rgba(161, 92, 0, 0.12)',
      danger: '#C40024',
      dangerSoft: 'rgba(196, 0, 36, 0.12)',
    },
  },
];

export const DEFAULT_SURFACE_ID = 'amoled';

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
