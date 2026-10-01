import { Platform } from 'react-native';
import { DarkTheme } from '@react-navigation/native';
import { DEFAULT_ACCENT_ID, getAccentTheme, isAccentId, resolveAccent } from './accents';
import { DEFAULT_SURFACE_ID, findTokenCollisions, getSurfaceMode, isSurfaceId } from './surfaces';

/**
 * Which theme is painted right now, and how to repaint it.
 *
 * Styles are built once when their module is imported, so switching a theme cannot rebuild
 * them. Instead every token is a *value* inside the frozen sheets, and `applyTheme` swaps the
 * old value for the new one in place (`repaint`) while mutating `colors` for the components
 * that read it during render. That is why the token values of a mode must never repeat: the
 * swap identifies a property by its colour string, so `warningSoft` sharing `accentSoft`'s
 * value would repaint the wrong property. `findTokenCollisions` watches that invariant.
 */
const applied = { accentId: DEFAULT_ACCENT_ID, surfaceId: DEFAULT_SURFACE_ID };

/** The keys `applyTheme` can swap; `overlay`, `palette` and the scales never change per mode. */
const TOKEN_KEYS = [
  ...Object.keys(getSurfaceMode(DEFAULT_SURFACE_ID).tokens),
  'accent',
  'accentSoft',
  'accentInk',
];

function resolveTokens(ids) {
  const surface = getSurfaceMode(ids.surfaceId);
  // Only the trio, never the whole accent entry: `alt` and `swatch` are preview decoration and
  // must not land in `colors`, where a duplicate value would confuse the repaint.
  const { accent, accentSoft, accentInk } = resolveAccent(getAccentTheme(ids.accentId), surface.id);
  return { ...surface.tokens, accent, accentSoft, accentInk };
}

/**
 * `overlay` is deliberately outside the palettes: a scrim that dims the page behind a sheet
 * has to stay dark even in light mode, or the sheet loses all separation from the content.
 */
export const colors = Object.assign({ overlay: 'rgba(0, 0, 0, 0.72)' }, resolveTokens(applied));

if (__DEV__) {
  const clashes = findTokenCollisions(colors);
  if (clashes.length) console.warn(`[theme] tokens duplicados: ${clashes.join(' | ')}`);
}


export const palette = [
  '#4fd1c5',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#38bdf8',
  '#a3e635',
  '#fb7185',
  '#94a3b8',
];

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

export const radius = { sm: 10, md: 14, lg: 18, xl: 22, sheet: 28, pill: 999 };

export const layout = { gutter: 20, listGap: 10, fabInset: 24 };

const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: undefined });

export const typography = {
  display: { fontFamily, fontSize: 28, lineHeight: 33, fontWeight: '700', letterSpacing: -0.7, color: colors.text },
  title: { fontFamily, fontSize: 19, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3, color: colors.text },
  subtitle: { fontFamily, fontSize: 13.5, lineHeight: 19, fontWeight: '400', color: colors.textSecondary },
  body: { fontFamily, fontSize: 15, lineHeight: 21, fontWeight: '500', color: colors.text },
  bodyStrong: { fontFamily, fontSize: 15, lineHeight: 21, fontWeight: '700', color: colors.text },
  small: { fontFamily, fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.textSecondary },
  caption: { fontFamily, fontSize: 11.5, lineHeight: 15, fontWeight: '600', color: colors.textMuted },
  overline: {
    fontFamily,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  tabular: { fontVariant: ['tabular-nums'] },
};

export const shadow = {
  card: Platform.select({
    default: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 3 },
  }),
  fab: Platform.select({
    default: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 8 },
  }),
};

export const navigationTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.elevated,
    border: colors.border,
    text: colors.text,
    notification: colors.accent,
  },
};

export const calendarTheme = {
  background: colors.surface,
  calendarBackground: colors.surface,
  textSectionTitleColor: colors.textMuted,
  textSectionTitleDisabledColor: colors.textMuted,
  dayTextColor: colors.text,
  textDisabledColor: colors.borderStrong,
  selectedDayBackgroundColor: 'transparent',
  selectedDayTextColor: colors.text,
  todayTextColor: colors.accent,
  arrowColor: colors.accent,
  disabledArrowColor: colors.borderStrong,
  monthTextColor: colors.text,
  indicatorColor: colors.accent,
  dotColor: colors.accent,
  selectedDotColor: colors.accent,
  textDayFontFamily: fontFamily,
  textMonthFontFamily: fontFamily,
  textDayHeaderFontFamily: fontFamily,
  textDayFontWeight: '500',
  textMonthFontWeight: '700',
  textDayHeaderFontWeight: '600',
  textDayFontSize: 15,
  textMonthFontSize: 15.5,
  textDayHeaderFontSize: 10.5,
  'stylesheet.calendar.header': {
    week: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between' },
    month: { paddingTop: spacing.sm, alignItems: 'center' },
  },
  'stylesheet.calendar.main': {
    container: { paddingHorizontal: 0, paddingTop: spacing.sm, paddingBottom: 0 },
    week: { marginVertical: 1, flexDirection: 'row', justifyContent: 'space-between' },
  },
  'stylesheet.day.basic': {
    base: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    selected: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.accent },
    today: { borderColor: 'transparent', borderRadius: radius.pill },
    text: { color: colors.text, fontWeight: '500' },
    selectedText: { color: colors.accent, fontWeight: '700' },
  },
};

/**
 * Runtime theming.
 *
 * Styles are declared once at import time, so switching a theme cannot rebuild them: every
 * `themedStyles(...)` object is registered here and `applyTheme` repaints the token values in
 * place — the accent trio *and* the whole surface palette (backgrounds, borders, text, scrims).
 *
 * `themedStyles` deliberately does NOT go through `StyleSheet.create`: in `__DEV__` that
 * call freezes every entry (`Object.freeze(obj[key])`), and a frozen style would make the
 * repaint throw. React Native accepts plain style objects in a `style` prop, so the sheet
 * is used as-is — mutable, and still the same object across renders, which keeps
 * `React.memo` comparisons stable.
 */
const styleRegistry = new Set();

export function themedStyles(styles) {
  styleRegistry.add(styles);
  return styles;
}

// Typography and the navigation/calendar themes are plain objects rather than style sheets,
// but they carry token colours too. Register them all: miss `typography` and the light mode
// would go on painting white text over white cards.
styleRegistry.add(typography);
styleRegistry.add(navigationTheme);
styleRegistry.add(calendarTheme);

/** Replaces every string in `node` that matches a key of `mapping` (recursively). */
function repaint(node, mapping, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 5) return;
  if (Array.isArray(node)) {
    node.forEach((child) => repaint(child, mapping, depth + 1));
    return;
  }
  Object.keys(node).forEach((key) => {
    const value = node[key];
    if (typeof value === 'string') {
      if (mapping[value]) node[key] = mapping[value];
      return;
    }
    repaint(value, mapping, depth + 1);
  });
}

/**
 * Builds the old-value → new-value table for the swap. A token only needs repainting when its
 * string actually differs, which is also what lets an accent change leave 60 sheets untouched.
 */
function buildRepaintMap(resolved) {
  const changes = {};
  const clashes = [];
  TOKEN_KEYS.forEach((key) => {
    const from = colors[key];
    const to = resolved[key];
    if (typeof from !== 'string' || typeof to !== 'string' || from === to) return;
    if (changes[from] && changes[from] !== to) clashes.push(`${key} (${from})`);
    changes[from] = to;
  });
  return { changes, clashes };
}

/**
 * Paints a theme — accent and surface together — synchronously: the shared `colors` object,
 * every registered style sheet and the navigation/calendar themes are all changed before this
 * returns, so the press that picked the option is the press that shows it. Nothing here waits
 * for storage, animates, or defers to the next frame.
 *
 * Unknown ids are ignored instead of trusted, which is what keeps a stale or corrupted storage
 * value from blanking the interface.
 */
export function applyTheme(patch = {}) {
  const next = {
    accentId: isAccentId(patch.accentId) ? patch.accentId : applied.accentId,
    surfaceId: isSurfaceId(patch.surfaceId) ? patch.surfaceId : applied.surfaceId,
  };
  const resolved = resolveTokens(next);
  const { changes, clashes } = buildRepaintMap(resolved);
  if (__DEV__ && clashes.length) {
    console.warn(`[theme] dos tokens comparten color y el repintado es ambiguo: ${clashes.join(' | ')}`);
  }

  Object.assign(colors, resolved);
  styleRegistry.forEach((styles) => repaint(styles, changes));

  applied.accentId = next.accentId;
  applied.surfaceId = next.surfaceId;

  // `dark` is the one thing the colour swap cannot carry: react-navigation reads the flag
  // itself to decide whether its own defaults go light or dark.
  navigationTheme.dark = getSurfaceMode(applied.surfaceId).dark;
  navigationTheme.colors.background = colors.background;

  return { ...applied };
}

/** Kept for call sites that only know about accents; equivalent to `applyTheme({ accentId })`. */
export function applyAccent(accentId) {
  return applyTheme({ accentId });
}

/** The ids painted right now — what hydration writes back when nothing else changed. */
export function currentThemeIds() {
  return { ...applied };
}

/** The surface the app is painted on: `{ id, label, hint, dark, statusBar, swatch, tokens }`. */
export function currentSurface() {
  return getSurfaceMode(applied.surfaceId);
}

