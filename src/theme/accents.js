/**
 * Neon accent themes offered in Ajustes › Tema.
 *
 * `accent` is the single colour the whole UI tints with (active tab, buttons, chips,
 * calendar highlights); `accentSoft` is its translucent version used for fills and
 * `accentInk` the readable colour drawn *on top of* the accent. `alt` is decoration only
 * (theme previews, onboarding artwork).
 *
 * Every theme also declares a `light` variant. Tints tuned for a graphite page turn muddy
 * over white (a mint `#4fd1c5` on `#ffffff` barely reaches 1.6:1), so the light surface gets
 * darker members of the same family, and their `accentInk` flips to a pale ink: dark text
 * sitting on a dark accent is how labels end up invisible.
 *
 * Pure data with no imports on purpose: `theme.js` reads it, so every other file can
 * import it too without creating a cycle.
 */
export const ACCENT_THEMES = [
  {
    id: 'cyan',
    label: 'Cyan / Violeta',
    hint: 'El original de NexusDay: turquesa frío con detalle violeta.',
    accent: '#4fd1c5',
    accentSoft: 'rgba(79, 209, 197, 0.13)',
    accentInk: '#04211e',
    alt: '#8b5cf6',
    light: {
      accent: '#0a6f62',
      accentSoft: 'rgba(10, 111, 98, 0.12)',
      accentInk: '#f2fffd',
    },
  },
  {
    id: 'emerald',
    label: 'Esmeralda Cyberpunk',
    hint: 'Verde ácido de terminal, contraste máximo sobre negro.',
    accent: '#00f5a0',
    accentSoft: 'rgba(0, 245, 160, 0.14)',
    accentInk: '#00251a',
    alt: '#22d3ee',
    light: {
      accent: '#05704f',
      accentSoft: 'rgba(5, 112, 79, 0.12)',
      accentInk: '#effff9',
    },
  },
  {
    id: 'gold',
    label: 'Sunset Gold',
    hint: 'Ámbar cálido de atardecer para botones y textos.',
    accent: '#ffb020',
    accentSoft: 'rgba(255, 176, 32, 0.14)',
    accentInk: '#2b1a00',
    alt: '#ff6b6b',
    light: {
      accent: '#8a5600',
      accentSoft: 'rgba(138, 86, 0, 0.12)',
      accentInk: '#fff8ec',
    },
  },
  {
    id: 'oled',
    label: 'OLED Monocromo',
    hint: 'Blanco sobre negro puro: sin color, máximo contraste.',
    accent: '#f5f5f7',
    accentSoft: 'rgba(245, 245, 247, 0.12)',
    accentInk: '#0a0a0a',
    alt: '#8a8a94',
    light: {
      accent: '#1b1b20',
      accentSoft: 'rgba(27, 27, 32, 0.1)',
      accentInk: '#f6f6fa',
    },
  },
];

export const DEFAULT_ACCENT_ID = 'cyan';

export function isAccentId(value) {
  return ACCENT_THEMES.some((theme) => theme.id === value);
}

/** Always resolves: an unknown or missing id falls back to the default theme. */
export function getAccentTheme(id) {
  return (
    ACCENT_THEMES.find((theme) => theme.id === id) ||
    ACCENT_THEMES.find((theme) => theme.id === DEFAULT_ACCENT_ID)
  );
}

/**
 * Picks the trio that belongs on a given surface: the base values are the dark ones, a light
 * page swaps in its darker variants. `swatch` is what the Ajustes preview paints — the theme's
 * own hue regardless of mode, because the grid shows every option at once.
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

