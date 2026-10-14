/**
 * Acentos de color secundario ofrecidos en Ajustes › Tema.
 *
 * `accent` es el color con el que se tiñe toda la interfaz (solapa activa, botones, chips,
 * calendario); `accentSoft` es su versión translúcida para rellenos y `accentInk` el color
 * legible que se dibuja *encima* del acento. `alt` es solo decoración (vistas previas).
 *
 * Los seis acentos funcionan sobre las dos bases (oscuro puro y claro puro). Los valores
 * base están afinados para el fondo negro; cada tema declara además una variante `light`,
 * porque un verde neón `#00E676` sobre blanco no alcanza contraste legible — la base clara
 * usa el miembro oscuro de la misma familia y su `accentInk` invierte a tinta pálida.
 *
 * Data pura, sin imports a propósito: `theme.js` la lee y cualquier otro archivo puede
 * importarla sin crear un ciclo.
 */
export const ACCENT_THEMES = [
  {
    id: 'verde',
    label: 'Verde',
    hint: 'Verde brillante y enérgico, ideal para productividad.',
    accent: '#00E676',
    accentSoft: 'rgba(0, 230, 118, 0.14)',
    accentInk: '#00210F',
    alt: '#69F0AE',
    light: {
      accent: '#00875A',
      accentSoft: 'rgba(0, 135, 90, 0.12)',
      accentInk: '#ECFFF5',
    },
  },
  {
    id: 'cian',
    label: 'Cian',
    hint: 'Cian fresco y moderno, el clásico de NexusDay.',
    accent: '#00E5FF',
    accentSoft: 'rgba(0, 229, 255, 0.14)',
    accentInk: '#00252B',
    alt: '#84FFFF',
    light: {
      accent: '#007A99',
      accentSoft: 'rgba(0, 122, 153, 0.12)',
      accentInk: '#EBFAFF',
    },
  },
  {
    id: 'azul',
    label: 'Azul',
    hint: 'Azul intenso y confiable para el día a día.',
    accent: '#2979FF',
    accentSoft: 'rgba(41, 121, 255, 0.16)',
    accentInk: '#06122E',
    alt: '#82B1FF',
    light: {
      accent: '#0033CC',
      accentSoft: 'rgba(0, 51, 204, 0.12)',
      accentInk: '#EEF3FF',
    },
  },
  {
    id: 'rojo',
    label: 'Rojo',
    hint: 'Rojo vivo para urgente y por hacer.',
    accent: '#FF1744',
    accentSoft: 'rgba(255, 23, 68, 0.15)',
    accentInk: '#2A0007',
    alt: '#FF8A80',
    light: {
      accent: '#C40024',
      accentSoft: 'rgba(196, 0, 36, 0.12)',
      accentInk: '#FFEDEF',
    },
  },
  {
    id: 'amarillo',
    label: 'Amarillo',
    hint: 'Amarillo cálido que destaca sin gritar.',
    accent: '#FFC400',
    accentSoft: 'rgba(255, 196, 0, 0.16)',
    accentInk: '#2B1D00',
    alt: '#FFE57F',
    light: {
      accent: '#8A6100',
      accentSoft: 'rgba(138, 97, 0, 0.12)',
      accentInk: '#FFF8E6',
    },
  },
  {
    id: 'purpura',
    label: 'Púrpura',
    hint: 'Púrpura creativo para ideas y proyectos.',
    accent: '#D500F9',
    accentSoft: 'rgba(213, 0, 249, 0.16)',
    accentInk: '#22002B',
    alt: '#EA80FC',
    light: {
      accent: '#8E00A8',
      accentSoft: 'rgba(142, 0, 168, 0.12)',
      accentInk: '#FCE9FF',
    },
  },
];

export const DEFAULT_ACCENT_ID = 'cian';

export function isAccentId(value) {
  return ACCENT_THEMES.some((theme) => theme.id === value);
}

/** Siempre resuelve: un id desconocido o ausente cae en el tema por defecto. */
export function getAccentTheme(id) {
  return (
    ACCENT_THEMES.find((theme) => theme.id === id) ||
    ACCENT_THEMES.find((theme) => theme.id === DEFAULT_ACCENT_ID)
  );
}

/**
 * Elige el trío que corresponde a una base: los valores base son los de fondo oscuro, una
 * base clara usa sus variantes más oscuras. `swatch` es lo que pinta la vista previa de
 * Ajustes — el tono propio del tema sin importar la base, porque la cuadrícula muestra
 * todas las opciones a la vez.
 */
export function resolveAccent(theme, surfaceId) {
  if (surfaceId === 'light') {
    return {
      accent: theme.light.accent,
      accentSoft: theme.light.accentSoft,
      accentInk: theme.light.accentInk,
      alt: theme.alt,
      swatch: theme.accent,
    };
  }
  return {
    accent: theme.accent,
    accentSoft: theme.accentSoft,
    accentInk: theme.accentInk,
    alt: theme.alt,
    swatch: theme.accent,
  };
}

