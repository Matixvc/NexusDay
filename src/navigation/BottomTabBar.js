import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themedStyles, colors, radius, spacing } from '../theme/theme';

/**
 * Bottom bar for the swipeable navigator.
 *
 * `react-native-tab-view` renders the pager and this bar side by side, so the screens
 * never sit under it; the bar is the only place that has to know about the system bars:
 * it grows by `insets.bottom` so the Android 3-button bar / iOS home indicator never
 * covers the labels.
 *
 * Every section of the app gets a slot here — nine tabs, none hidden behind a "more"
 * menu — so the bar is built for that count: each item is a flexible column with a small
 * glyph and a label that shrinks to fit instead of truncating.
 */

export const TAB_BAR_BASE_HEIGHT = 60;

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

export function BottomTabBar({ state, descriptors, navigation, hidden = [], onRevealTab }) {
  const insets = useSafeAreaInsets();

  const routes = state.routes.map((route, index) => ({
    route,
    index,
    options: descriptors[route.key]?.options || {},
  }));

  const isHidden = (name) => hidden.includes(name);
  const visible = routes.filter((item) => !isHidden(item.route.name));
  const activeRoute = routes[state.index]?.route.name;
  // Landing on a hidden tab (the global search can do that) shows a dimmed "pin" slot:
  // one tap brings it back to the bar.
  const orphan = isHidden(activeRoute) ? routes.find((item) => item.route.name === activeRoute) : null;

  return (
    <View
      style={[styles.bar, { height: TAB_BAR_BASE_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}
      accessibilityRole="tablist"
    >
      {visible.map(({ route, index, options }) => (
        <TabButton
          key={route.key}
          route={route}
          index={index}
          options={options}
          navigation={navigation}
          active={index === state.index}
        />
      ))}

      {orphan ? (
        <Pressable
          onPress={() => onRevealTab?.(orphan.route.name)}
          accessibilityRole="button"
          accessibilityLabel={`${orphan.options.tabBarLabel || orphan.route.name} está oculta. Tocar para mostrar de nuevo.`}
          style={({ pressed }) => [styles.item, styles.orphanItem, pressed ? styles.pressed : null]}
        >
          <View style={styles.orphanWrap}>
            {typeof orphan.options.tabBarIcon === 'function'
              ? orphan.options.tabBarIcon({ focused: true, color: colors.accent })
              : null}
          </View>
          <Text
            style={[styles.label, styles.labelActive]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {orphan.options.tabBarLabel || orphan.route.name}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** One tab: glyph, label, the active indicator and the press/long-press contract. */
function TabButton({ route, index, options, navigation, active }) {
  const color = active ? colors.accent : colors.textMuted;
  const badgeOption = options.tabBarBadge;
  const badge =
    typeof badgeOption === 'function'
      ? badgeOption()
      : badgeOption
        ? <TabBadge count={badgeOption} />
        : null;
  const label = options.tabBarLabel ?? options.title ?? route.name;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={options.tabBarAccessibilityLabel || String(label)}
      onPress={() => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!event.defaultPrevented) navigation.navigate(route.name);
      }}
      onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
      style={({ pressed }) => [styles.item, pressed ? styles.pressed : null]}
    >
      <View style={[styles.iconWrap, active ? { backgroundColor: colors.accentSoft } : null]}>
        {typeof options.tabBarIcon === 'function' ? options.tabBarIcon({ focused: active, color }) : null}
        {badge}
      </View>
      <Text
        style={[styles.label, active ? styles.labelActive : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {label}
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
  },
  item: { flex: 1, alignItems: 'center', gap: 2, paddingTop: 3, paddingHorizontal: 1 },
  // The "pin" slot shown when the current tab is hidden.
  orphanItem: { opacity: 0.85 },
  orphanWrap: {
    height: 24,
    minWidth: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  pressed: { opacity: 0.6 },
  iconWrap: {
    height: 24,
    minWidth: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 8.5, fontWeight: '700', letterSpacing: 0.1, color: colors.textMuted, textAlign: 'center' },
  labelActive: { color: colors.accent },
  indicator: {
    position: 'absolute',
    top: -spacing.xs,
    height: 2,
    width: 16,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },

  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: { fontSize: 10, fontWeight: '800', color: colors.accentInk },
});
