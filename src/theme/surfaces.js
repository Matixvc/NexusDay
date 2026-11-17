/**
 * Bases de pantalla (Ajustes › Modo de pantalla).
 *
 * El acento tiñe la interfaz; la *base* decide sobre qué se pinta. Modern Dark es la opción
 * inicial, AMOLED conserva negro puro y Claro usa una base fría de alta legibilidad. Las tres
 * declaran los mismos nombres de token, así
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
    id: 'dark',
    label: 'Modern Dark',
    hint: 'Azul noche profundo con superficies vibrantes y contraste c\u00f3modo.',
    dark: true,
    statusBar: 'light',
    swatch: ['#101422', '#F7F8FC'],
    tokens: {
      background: '#101422',
      elevated: '#151A2A',
      surface: '#1A2032',
      surfaceAlt: '#222A40',
      surfacePlus: '#2A334B',
      border: '#303A54',
      borderStrong: '#66718B',
      text: '#F7F8FC',
      textSecondary: '#C9CEDD',
      textMuted: '#9EA7BC',
      scrim: 'rgba(5, 7, 14, 0.70)',
      scrimStrong: 'rgba(5, 7, 14, 0.86)',
      scrimMax: 'rgba(5, 7, 14, 0.94)',
      panel: 'rgba(26, 32, 50, 0.84)',
      panelStrong: 'rgba(26, 32, 50, 0.97)',
      mint: '#5EDDD4',
      mintSoft: 'rgba(94, 221, 212, 0.14)',
      mintInk: '#082A2A',
      amber: '#FFC478',
      amberSoft: 'rgba(255, 196, 120, 0.15)',
      amberInk: '#321A00',
      coral: '#FF8BAD',
      coralSoft: 'rgba(255, 139, 173, 0.15)',
      coralInk: '#3A071A',
      warning: '#FFD166',
      warningSoft: 'rgba(255, 209, 102, 0.13)',
      danger: '#FF7188',
      dangerSoft: 'rgba(255, 113, 136, 0.14)',
    },
  },
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
      mint: '#61E2D8',
      mintSoft: 'rgba(97, 226, 216, 0.14)',
      mintInk: '#062521',
      amber: '#FFCA85',
      amberSoft: 'rgba(255, 202, 133, 0.15)',
      amberInk: '#2F1900',
      coral: '#FF91B1',
      coralSoft: 'rgba(255, 145, 177, 0.15)',
      coralInk: '#350616',
      // Sobre el negro puro los tonos de aviso suben un punto para seguir legibles.
      warning: '#FFC400',
      warningSoft: 'rgba(255, 196, 0, 0.16)',
      danger: '#FF4D5E',
      dangerSoft: 'rgba(255, 77, 94, 0.16)',
    },
  },
  {
    id: 'light',
    label: 'Claro',
    hint: 'Base luminosa suave con textos oscuros y bordes discretos.',
    dark: false,
    statusBar: 'dark',
    swatch: ['#F7F8FC', '#171A26'],
    tokens: {
      background: '#F7F8FC',
      // Un modo claro no apila paneles como uno oscuro (no hay nada más brillante a dónde ir),
      // así que el eje se invierte: la página es blanca y las tarjetas bajan a gris.
      elevated: '#FFFFFF',
      surface: '#F1F3F8',
      surfaceAlt: '#E8ECF4',
      surfacePlus: '#DDE3EE',
      border: '#D9DFEA',
      borderStrong: '#8792A8',
      text: '#171A26',
      // Afinados sobre `surface` para conservar AA a plena luz.
      textSecondary: '#4D5568',
      textMuted: '#626B7F',
      scrim: 'rgba(255, 255, 255, 0.69)',
      scrimStrong: 'rgba(255, 255, 255, 0.85)',
      scrimMax: 'rgba(255, 255, 255, 0.93)',
      panel: 'rgba(241, 243, 248, 0.86)',
      panelStrong: 'rgba(241, 243, 248, 0.98)',
      mint: '#06766F',
      mintSoft: 'rgba(6, 118, 111, 0.11)',
      mintInk: '#F3FFFE',
      amber: '#8A4B00',
      amberSoft: 'rgba(138, 75, 0, 0.11)',
      amberInk: '#FFF9F0',
      coral: '#B42355',
      coralSoft: 'rgba(180, 35, 85, 0.11)',
      coralInk: '#FFF4F7',
      // Ámbar y coral afinados para la luz del día: `#FFC400` sobre blanco es 1.4:1, así que la
      // base clara usa sus contrapartes tostadas (4.6:1 y 5.0:1).
      warning: '#A15C00',
      warningSoft: 'rgba(161, 92, 0, 0.12)',
      danger: '#C40024',
      dangerSoft: 'rgba(196, 0, 36, 0.12)',
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
