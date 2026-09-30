import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme/theme';

/**
 * Bottom bar for the swipeable navigator.
 *
 * `react-native-tab-view` renders the pager and this bar side by side, so the screens
 * never sit under it; the bar is the only place that has to know about the system bars:
 * it grows by `insets.bottom` so the Android 3-button bar / iOS home indicator never
 * covers the labels.
 */

export const TAB_BAR_BASE_HEIGHT = 58;

/** Tabs rendered in the bar. The remaining pages (Hábitos, Gastos, Nexus AI) are reachable
 *  by swiping from the neighbouring page or with one tap from the Inicio dashboard. */
export const PRIMARY_TABS = ['Inicio', 'Horario', 'Agenda', 'Cumpleaños', 'Notas', 'Ajustes'];

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

export function BottomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  const routes = state.routes
    .map((route, index) => ({ route, index, options: descriptors[route.key]?.options || {} }))
    .filter((item) => PRIMARY_TABS.includes(item.route.name));

  // On a secondary page (Hábitos, Gastos, Nexus AI) the closest primary tab stays
  // highlighted, so the bar always shows where the user is inside the main flow.
  const activeIndex = routes.reduce((best, item) => (item.index <= state.index ? item.index : best), -1);

  return (
    <View
      style={[styles.bar, { height: TAB_BAR_BASE_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}
    >
      {routes.map(({ route, index, options }) => {
        const focused = index === activeIndex;
        const color = focused ? colors.accent : colors.textMuted;
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
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel || String(label)}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!event.defaultPrevented) navigation.navigate(route.name);
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={({ pressed }) => [styles.item, pressed ? styles.pressed : null]}
          >
            <View style={styles.iconWrap}>
              {typeof options.tabBarIcon === 'function' ? options.tabBarIcon({ focused, color }) : null}
              {badge}
            </View>
            <Text
              style={[styles.label, focused ? styles.labelActive : null]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.elevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  item: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 2 },
  pressed: { opacity: 0.6 },
  iconWrap: { height: 24, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.2, color: colors.textMuted },
  labelActive: { color: colors.accent },

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
