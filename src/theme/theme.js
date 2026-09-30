import { Platform } from 'react-native';
import { DarkTheme } from '@react-navigation/native';
import { getAccentTheme } from './accents';

/**
 * `accent`, `accentSoft` and `accentInk` are the only tokens a theme can change, and they
 * are mutated in place by `applyAccent` so every module holding a reference to `colors`
 * (screens, primitives, the navigation theme) picks the new value up.
 */
export const colors = {
  background: '#0a0a0a',
  elevated: '#101012',
  surface: '#151518',
  surfaceAlt: '#1d1d21',
  surfacePlus: '#27272d',
  border: '#26262b',
  borderStrong: '#35353d',
  text: '#f5f5f7',
  // Contrast is measured against `background` (#0a0a0a):
  //   textSecondary #cccccc -> 12.33:1   textMuted #a0a0a0 -> 7.57:1
  // Both clear WCAG AA (4.5:1) with a wide margin, and they stay above 6:1 even on the
  // raised panels (#1d1d21). The previous muted grey (#6d6d78) was only 3.87:1 — it failed
  // AA outright and dropped to 3.29:1 on `surfaceAlt`, which is what made the secondary
  // copy in the tutorial and the settings captions so hard to read.
  textSecondary: '#cccccc',
  textMuted: '#a0a0a0',
  accent: '#4fd1c5',
  accentInk: '#04211e',
  accentSoft: 'rgba(79, 209, 197, 0.13)',
  danger: '#ff6b6b',
  dangerSoft: 'rgba(255, 107, 107, 0.12)',
  warning: '#fbbf24',
  overlay: 'rgba(0, 0, 0, 0.72)',
};

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
 * Runtime accent.
 *
 * Styles are declared once at import time, so switching the accent cannot rebuild them:
 * every `themedStyles(...)` object is registered here and `applyAccent` repaints the
 * accent-derived values in place.
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

// The navigation and calendar themes are plain objects, not StyleSheets, but they carry
// the same accent tokens, so they are registered too.
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
 * Swaps the accent tokens everywhere: the shared `colors` object (for inline styles read
 * during render) and every registered style object. Returns the resolved theme.
 */
export function applyAccent(accentId) {
  const theme = getAccentTheme(accentId);
  const mapping = {
    [colors.accent]: theme.accent,
    [colors.accentSoft]: theme.accentSoft,
    [colors.accentInk]: theme.accentInk,
  };

  colors.accent = theme.accent;
  colors.accentSoft = theme.accentSoft;
  colors.accentInk = theme.accentInk;

  styleRegistry.forEach((styles) => repaint(styles, mapping));
  return theme;
}
