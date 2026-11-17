import { Keyboard, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { select as selectHaptic } from '../services/haptics';
import { themedStyles, colors, manropeFontFamily, radius, spacing } from '../theme/theme';
import { PRIMARY_TABS } from './primaryTabs';

/** Content height before the device navigation inset is added. */
export const TAB_BAR_BASE_HEIGHT = 68;

/** Kept for secondary route metadata that still exposes a count. */
export function TabBadge({ count }) {
  const label = typeof count === 'number' && count > 9 ? '9+' : count;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Fixed three-destination bar.
 *
 * Buttons come from `PRIMARY_TABS`, not from persisted configuration or the pager's current
 * route subset. The navigator state is only used to identify the active route and emit the
 * standard React Navigation tab events.
 */
export function BottomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const currentName = state.routes[state.index]?.name;
  const activeName = currentName === 'Horario' ? 'Inicio' : currentName;

  return (
    <View
      style={[styles.bar, { height: TAB_BAR_BASE_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}
      accessibilityRole="tablist"
    >
      {PRIMARY_TABS.map((tab) => (
        <TabButton
          key={tab.name}
          tab={tab}
          routeKey={state.routes.find((route) => route.name === tab.name)?.key}
          navigation={navigation}
          active={tab.name === activeName}
        />
      ))}
    </View>
  );
}

function TabButton({ tab, routeKey, navigation, active }) {
  const color = active ? colors.accent : colors.textSecondary;

  const open = () => {
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (event.defaultPrevented) return;
    selectHaptic();
    Keyboard.dismiss();
    navigation.navigate(tab.name);
  };

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
      accessibilityHint={`Abrir ${tab.label}`}
      hitSlop={4}
      android_ripple={{ color: colors.accentSoft }}
      onPress={open}
      onLongPress={() => navigation.emit({ type: 'tabLongPress', target: routeKey })}
      style={({ pressed }) => [styles.item, active ? styles.itemActive : null, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconWrap}>
        <Icon name={tab.glyph} size={22} color={color} strokeWidth={active ? 2.4 : 2} />
      </View>
      <Text style={[styles.label, active ? styles.labelActive : null]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {tab.label}
      </Text>
      {active ? <View style={styles.indicator} /> : null}
    </Pressable>
  );
}

const styles = themedStyles({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.elevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  item: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  itemActive: { backgroundColor: colors.accentSoft, borderColor: colors.borderStrong },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  iconWrap: { height: 25, alignItems: 'center', justifyContent: 'center' },
  label: {
    fontFamily: manropeFontFamily,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  labelActive: { color: colors.accent },
  indicator: {
    position: 'absolute',
    bottom: 2,
    height: 3,
    width: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    fontFamily: manropeFontFamily,
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentInk,
  },
});
