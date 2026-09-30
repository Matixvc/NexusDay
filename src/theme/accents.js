/**
 * Neon accent themes offered in Ajustes › Tema.
 *
 * `accent` is the single colour the whole UI tints with (active tab, buttons, chips,
 * calendar highlights); `accentSoft` is its translucent version used for fills and
 * `accentInk` the readable colour drawn *on top of* the accent. `alt` is decoration only
 * (theme previews, onboarding artwork).
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
  },
  {
    id: 'emerald',
    label: 'Esmeralda Cyberpunk',
    hint: 'Verde ácido de terminal, contraste máximo sobre negro.',
    accent: '#00f5a0',
    accentSoft: 'rgba(0, 245, 160, 0.14)',
    accentInk: '#00251a',
    alt: '#22d3ee',
  },
  {
    id: 'gold',
    label: 'Sunset Gold',
    hint: 'Ámbar cálido de atardecer para botones y textos.',
    accent: '#ffb020',
    accentSoft: 'rgba(255, 176, 32, 0.14)',
    accentInk: '#2b1a00',
    alt: '#ff6b6b',
  },
  {
    id: 'oled',
    label: 'OLED Monocromo',
    hint: 'Blanco sobre negro puro: sin color, máximo contraste.',
    accent: '#f5f5f7',
    accentSoft: 'rgba(245, 245, 247, 0.12)',
    accentInk: '#0a0a0a',
    alt: '#8a8a94',
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
