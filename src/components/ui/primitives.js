import { memo, useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themedStyles, colors, layout, radius, shadow, spacing, typography } from '../../theme/theme';
import { useSwipeLockActions } from '../../context/SwipeLockContext';
import { navigateToRoute } from '../../navigation/navigateToRoute';
import { tap as tapHaptic } from '../../services/haptics';
import { Icon } from '../Icon';
import { useResponsiveLayout } from '../../theme/responsive';
import { AppHeader } from './AppHeader';
import { HeaderIconButton } from './HeaderIconButton';

/**
 * Page scaffold: dark background, large title, scrollable body.
 *
 * The status bar height and the bottom system inset are read here so every screen
 * inherits the right padding: the title never collides with the notch and the last
 * card is never hidden behind the Android nav bar / iOS home indicator.
 */
export function Screen({ title, subtitle, headerLeft, headerRight, children, contentStyle, backButton = true }) {
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();
  const navigation = useNavigation();
  const routeState = navigation.getState?.();
  const secondaryRoute = routeState?.type === 'stack' && routeState.routes?.[routeState.index]?.name !== 'Principal';
  const defaultBack = backButton && secondaryRoute ? (
    <HeaderIconButton
      icon="chevronLeft"
      label="Volver"
      onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigateToRoute(navigation, 'Inicio'))}
    />
  ) : null;
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, paddingHorizontal: responsive.gutter }]}>
        <AppHeader title={title} subtitle={subtitle} headerLeft={headerLeft ?? defaultBack} headerRight={headerRight} />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: responsive.gutter },
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
function Card({ children, style, accent, onPress, dimmed, disabled = false, variant = 'standard', accessibilityLabel, accessibilityHint, accessibilityState, accessibilityActions, onAccessibilityAction }) {
  const body = (
    <View style={[styles.card, variant === 'tinted' ? styles.cardTinted : null, variant === 'featured' ? styles.cardFeatured : null, accent ? styles.cardWithAccent : null, dimmed ? styles.dimmed : null, style]}>
      {accent ? <View style={[styles.accentBar, { backgroundColor: accent }]} /> : null}
      {children}
    </View>
  );

  if (typeof onPress !== 'function') return body;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ ...accessibilityState, disabled }}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      style={({ pressed }) => [styles.cardPressable, disabled ? styles.disabled : null, pressed && !disabled ? styles.pressed : null]}
    >
      {body}
    </Pressable>
  );
}

function SectionTitle({ title, count, right, variant = 'compact' }) {
  const editorial = variant === 'editorial';
  return (
    <View style={[styles.sectionRow, editorial ? styles.sectionEditorial : null]}>
      <View style={[styles.sectionLeft, editorial ? styles.sectionEditorialLeft : null]}>
        {editorial ? <View style={styles.sectionAccent} /> : null}
        <Text style={editorial ? styles.sectionEditorialTitle : typography.overline} accessibilityRole="header">
          {title}
        </Text>
        {count != null ? <Text style={[styles.sectionCount, typography.tabular]}>{count}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Selectable pill. Used for day tabs, lead times, colours and filters. */
function Chip({ label, selected, onPress, color, compact, disabled = false, accessibilityLabel }) {
  const tint = color || colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.chip,
        compact ? styles.chipCompact : null,
        selected ? { backgroundColor: colors.surfaceAlt, borderColor: tint } : null,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
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

function Pill({ label, tone = 'neutral', style }) {
  const tones = {
    neutral: { backgroundColor: colors.surfacePlus, color: colors.textSecondary },
    accent: { backgroundColor: colors.accentSoft, color: colors.accent },
    danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
    warning: { backgroundColor: colors.warningSoft, color: colors.warning },
    outline: { backgroundColor: 'transparent', color: colors.accent, borderColor: colors.accent, borderWidth: 1 },
  };
  const active = tones[tone] || tones.neutral;
  return (
    <View style={[styles.pill, { backgroundColor: active.backgroundColor, borderColor: active.borderColor, borderWidth: active.borderWidth }, style]}>
      <Text style={[styles.pillLabel, { color: active.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Text button — avoids any icon-font dependency. */
function TextButton({ label, onPress, tone = 'primary', disabled, style }) {
  const tones = { primary: colors.accent, ghost: colors.textSecondary, danger: colors.danger };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
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

function Button({ label, onPress, variant = 'primary', disabled = false, loading = false, style, icon }) {
  const inactive = disabled || loading;
  const variants = {
    primary: { container: styles.buttonPrimary, text: styles.buttonPrimaryText },
    secondary: { container: styles.buttonSecondary, text: styles.buttonSecondaryText },
    ghost: { container: styles.buttonGhost, text: styles.buttonGhostText },
    destructive: { container: styles.buttonDestructive, text: styles.buttonDestructiveText },
  };
  const active = variants[variant] || variants.primary;
  const indicatorColor = variant === 'primary' ? colors.accentInk : active.text.color;

  const handlePress = useCallback(() => {
    if (inactive) return;
    tapHaptic();
    onPress?.();
  }, [inactive, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [styles.button, active.container, inactive ? styles.disabled : null, pressed && !inactive ? styles.buttonPressed : null, style]}
    >
      {loading ? <ActivityIndicator size="small" color={indicatorColor} /> : icon ? <Icon name={icon} size={19} color={active.text.color} /> : null}
      <Text style={[typography.label, active.text]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress, disabled, style }) {
  return <Button label={label} onPress={onPress} disabled={disabled} style={[styles.primaryButtonLegacy, style]} />;
}

function Fab({ onPress, label = 'Agregar' }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Agregar' : label}
      accessibilityHint="Abre el formulario para crear un elemento."
      style={({ pressed }) => [styles.fab, shadow.fab, pressed ? styles.pressed : null]}
    >
      <Icon name="plus" size={24} color={colors.accentInk} />
    </Pressable>
  );
}

function Stat({ value, label, accent }) {
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
function Notice({ text, tone = 'info' }) {
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

function EmptyState({ emoji, icon, image, title, hint, action }) {
  return (
    <View style={styles.empty}>
      {image ? (
        <Image
          source={image}
          style={styles.emptyIllustration}
          resizeMode="contain"
          accessible={false}
          importantForAccessibility="no"
        />
      ) : icon ? <View style={styles.emptyIcon}><Icon name={icon} size={30} color={colors.accent} /></View> : <Text style={styles.emptyEmoji}>{emoji}</Text>}
      <Text style={[typography.title, styles.emptyTitle]}>{title}</Text>
      {hint ? <Text style={[typography.small, styles.emptyHint]}>{hint}</Text> : null}
      {action}
    </View>
  );
}

/** Horizontally scrolling row of Chips (day tabs, filters). */
function ChipScroller({ children, style, contentContainerStyle, horizontal = true }) {
  const { acquireSwipe } = useSwipeLockActions();
  const releaseRef = useRef(null);
  const beginTouch = () => {
    releaseRef.current?.();
    releaseRef.current = acquireSwipe();
  };
  const endTouch = (event) => {
    if (event?.nativeEvent?.touches?.length > 0) return;
    releaseRef.current?.();
    releaseRef.current = null;
  };
  const cancelTouch = () => {
    releaseRef.current?.();
    releaseRef.current = null;
  };
  useEffect(() => () => {
    releaseRef.current?.();
    releaseRef.current = null;
  }, []);

  if (!horizontal) return <View style={[styles.chipWrap, style]}>{children}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.chipScroll, style]}
      contentContainerStyle={[styles.chipScrollContent, contentContainerStyle]}
      onTouchStart={beginTouch}
      onTouchEnd={endTouch}
      onTouchCancel={cancelTouch}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Memoized exports.
 *
 * These primitives are rendered dozens of times per screen (one `Card` and one `Pill` per
 * list row), so wrapping them in `memo` is the cheapest win available: a list that re-renders
 * because a sibling state changed now only reconciles the rows whose own props moved.
 *
 * `Screen` and `ChipScroller` stay unmemoized on purpose — they take `children`, which is a
 * fresh element on every parent render, so `memo` would never hit and would only add cost.
 */
export {
  Card,
  SectionTitle,
  Chip,
  Pill,
  TextButton,
  Button,
  PrimaryButton,
  Fab,
  Stat,
  Notice,
  EmptyState,
};

export const MemoCard = memo(Card);
export const MemoSectionTitle = memo(SectionTitle);
export const MemoChip = memo(Chip);
export const MemoPill = memo(Pill);
export const MemoStat = memo(Stat);
export const MemoPrimaryButton = memo(PrimaryButton);
export const MemoFab = memo(Fab);
export const MemoEmptyState = memo(EmptyState);

export { ChipScroller };

const styles = themedStyles({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxxl * 3, gap: spacing.lg },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  cardTinted: { backgroundColor: colors.surfaceAlt },
  cardFeatured: { backgroundColor: colors.surfaceAlt, borderColor: colors.accent, borderWidth: 1.5 },
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
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1, minWidth: 0 },
  sectionEditorial: { marginTop: spacing.md, minHeight: 28, alignItems: 'center' },
  sectionEditorialLeft: { gap: spacing.sm },
  sectionAccent: { width: 3, height: 20, borderRadius: radius.pill, backgroundColor: colors.accent },
  sectionEditorialTitle: { ...typography.title, fontSize: 17, lineHeight: 23 },
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
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCompact: { paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2 },
  chipLabel: { ...typography.label, fontWeight: '500', color: colors.textSecondary },
  chipLabelCompact: { ...typography.caption },
  chipScroll: { flexGrow: 0 },
  chipScrollContent: { gap: spacing.sm, paddingRight: layout.gutter },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignSelf: 'flex-start' },
  pillLabel: { ...typography.overline, letterSpacing: 0.2 },

  textButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 48, justifyContent: 'center' },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonPrimaryText: { color: colors.accentInk },
  buttonSecondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderStrong },
  buttonSecondaryText: { color: colors.text },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonGhostText: { color: colors.accent },
  buttonDestructive: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger },
  buttonDestructiveText: { color: colors.danger },
  buttonPressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
  primaryButtonLegacy: { flex: 1 },

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
  statLabel: { ...typography.overline, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.3 },

  notice: { borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 1 },
  noticeText: { ...typography.caption, fontSize: 12.5 },

  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyIllustration: { width: 176, height: 120, marginBottom: spacing.xs },
  emptyEmoji: { fontSize: 38, marginBottom: spacing.xs },
  emptyIcon: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { textAlign: 'center' },
  emptyHint: { textAlign: 'center', paddingHorizontal: spacing.xxl, lineHeight: 19 },
});


