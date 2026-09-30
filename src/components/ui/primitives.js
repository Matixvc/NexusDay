import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themedStyles, colors, layout, radius, shadow, spacing, typography } from '../../theme/theme';

/**
 * Page scaffold: dark background, large title, scrollable body.
 *
 * The status bar height and the bottom system inset are read here so every screen
 * inherits the right padding: the title never collides with the notch and the last
 * card is never hidden behind the Android nav bar / iOS home indicator.
 */
export function Screen({ title, subtitle, headerRight, children, contentStyle }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerText}>
          <Text style={typography.display} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[typography.subtitle, styles.subtitle]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing.xxxl * 2 + insets.bottom },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Elevated container used for every list item and group of controls. */
export function Card({ children, style, accent, onPress, dimmed }) {
  const body = (
    <View style={[styles.card, accent ? styles.cardWithAccent : null, dimmed ? styles.dimmed : null, style]}>
      {accent ? <View style={[styles.accentBar, { backgroundColor: accent }]} /> : null}
      {children}
    </View>
  );

  if (typeof onPress !== 'function') return body;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.cardPressable, pressed ? styles.pressed : null]}>
      {body}
    </Pressable>
  );
}

export function SectionTitle({ title, count, right }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionLeft}>
        <Text style={typography.overline}>{title}</Text>
        {count != null ? <Text style={[styles.sectionCount, typography.tabular]}>{count}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Selectable pill. Used for day tabs, lead times, colours and filters. */
export function Chip({ label, selected, onPress, color, compact }) {
  const tint = color || colors.accent;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        compact ? styles.chipCompact : null,
        selected ? { backgroundColor: `${tint}22`, borderColor: tint } : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          compact ? styles.chipLabelCompact : null,
          selected ? { color: tint, fontWeight: '700' } : null,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Pill({ label, tone = 'neutral', style }) {
  const tones = {
    neutral: { backgroundColor: colors.surfacePlus, color: colors.textSecondary },
    accent: { backgroundColor: colors.accentSoft, color: colors.accent },
    danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
    warning: { backgroundColor: 'rgba(251, 191, 36, 0.14)', color: colors.warning },
  };
  const active = tones[tone] || tones.neutral;
  return (
    <View style={[styles.pill, { backgroundColor: active.backgroundColor }, style]}>
      <Text style={[styles.pillLabel, { color: active.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Text button — avoids any icon-font dependency. */
export function TextButton({ label, onPress, tone = 'primary', disabled, style }) {
  const tones = { primary: colors.accent, ghost: colors.textSecondary, danger: colors.danger };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.textButton,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      <Text style={[typography.bodyStrong, { color: tones[tone] || tones.primary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, disabled, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled ? styles.disabled : null,
        pressed ? styles.primaryPressed : null,
        style,
      ]}
    >
      <Text style={[typography.bodyStrong, { color: colors.accentInk }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Fab({ onPress, label = '+' }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.fab, shadow.fab, pressed ? styles.pressed : null]}>
      <Text style={styles.fabLabel}>{label}</Text>
    </Pressable>
  );
}

export function Stat({ value, label, accent }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, typography.tabular, accent ? { color: accent } : null]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Inline feedback line inside forms (permissions, validation, etc). */
export function Notice({ text, tone = 'info' }) {
  if (!text) return null;
  const tones = {
    info: { backgroundColor: colors.accentSoft, color: colors.accent },
    danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
  };
  const active = tones[tone] || tones.info;
  return (
    <View style={[styles.notice, { backgroundColor: active.backgroundColor }]}>
      <Text style={[styles.noticeText, { color: active.color }]}>{text}</Text>
    </View>
  );
}

export function EmptyState({ emoji, title, hint }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={[typography.title, styles.emptyTitle]}>{title}</Text>
      {hint ? <Text style={[typography.small, styles.emptyHint]}>{hint}</Text> : null}
    </View>
  );
}

/** Horizontally scrolling row of Chips (day tabs, filters). */
export function ChipScroller({ children, style, contentContainerStyle, horizontal = true }) {
  if (!horizontal) return <View style={[styles.chipWrap, style]}>{children}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.chipScroll, style]}
      contentContainerStyle={[styles.chipScrollContent, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  );
}

const styles = themedStyles({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  headerRight: { paddingBottom: spacing.xs },
  subtitle: { marginTop: spacing.xs },
  scroll: { flex: 1 },
  content: { paddingHorizontal: layout.gutter, paddingBottom: spacing.xxxl * 3, gap: spacing.lg },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  cardWithAccent: { paddingLeft: spacing.lg + 4 },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  cardPressable: { borderRadius: radius.lg },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.4 },
  dimmed: { opacity: 0.52 },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    overflow: 'hidden',
  },

  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
  },
  chipCompact: { paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2 },
  chipLabel: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  chipLabelCompact: { fontSize: 12 },
  chipScroll: { flexGrow: 0 },
  chipScrollContent: { gap: spacing.sm, paddingRight: layout.gutter },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 3, alignSelf: 'flex-start' },
  pillLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  textButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },

  fab: {
    position: 'absolute',
    right: layout.gutter,
    bottom: layout.fabInset,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabel: { fontSize: 28, lineHeight: 32, fontWeight: '500', color: colors.accentInk, marginTop: -2 },

  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.3 },

  notice: { borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 1 },
  noticeText: { fontSize: 12.5, lineHeight: 17, fontWeight: '500' },

  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyEmoji: { fontSize: 38, marginBottom: spacing.xs },
  emptyTitle: { textAlign: 'center' },
  emptyHint: { textAlign: 'center', paddingHorizontal: spacing.xxl, lineHeight: 19 },
});


