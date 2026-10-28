import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { View, useState, useEffect, useMemo } from 'react-native';
import { themedStyles, colors, navigationTheme } from '../theme/theme';
import { BottomTabBar } from './BottomTabBar';
import { Glyph } from './TabGlyphs';
import { TABS, HOME_TAB } from './tabs';
import { normalizeTabConfig } from '../services/tabs';
import { useSwipeLock } from '../context/SwipeLockContext';
import { useTheme } from '../context/ThemeContext';

const Tab = createMaterialTopTabNavigator();

/**
 * Main navigation.
 *
 * `createMaterialTopTabNavigator` gives real horizontal swiping (it is backed by
 * `react-native-pager-view`, already a dependency) between every section, while the
 * custom `BottomTabBar` keeps the bottom-bar look of the app and applies the safe-area
 * insets. Pages render lazily, one neighbour preloaded on each side so swiping feels
 * instant without mounting all nine screens on launch.
 *
 * Every section stays registered in the navigator (in the order the user chose, hidden
 * ones included) because the global search navigates by name: a route the navigator does
 * not know would make `navigate` fail. Hiding a tab only removes it from the bar.
 *
 * The navigator subscribes to the theme revision so that `NavigationContainer` receives a
 * fresh `theme` reference whenever the accent or surface changes. The navigator itself is
 * never unmounted by a theme change — only a tab reorder remounts it — so the user stays on
 * the same screen and keeps their scroll position.
 */
export default function RootNavigator({ initialRouteName = HOME_TAB, onRouteChange, tabConfig, onRevealTab }) {
  const config = normalizeTabConfig(tabConfig);
  const order = config.order;
  // A `SwipeRow` being dragged takes this lock, and the pager stops translating the finger.
  // Without it, swiping a card sideways also flips to the next section.
  const { locked: swipeLocked } = useSwipeLock();
  // Theme changes repaint styles in place, but NavigationContainer needs a new theme
  // reference to refresh its internal context. We force a re-render on revision change
  // without unmounting the navigator.
  const { revision } = useTheme();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTick((t) => t + 1);
  }, [revision]);

  const theme = useMemo(
    () => ({
      ...navigationTheme,
      colors: { ...navigationTheme.colors },
    }),
    [revision],
  );

  return (
    <NavigationContainer theme={theme}>
      <Tab.Navigator
        initialRouteName={order.includes(initialRouteName) ? initialRouteName : HOME_TAB}
        tabBarPosition="bottom"
        tabBar={(props) => <BottomTabBar {...props} hidden={config.hidden} onRevealTab={onRevealTab} />}
        screenOptions={{
          swipeEnabled: !swipeLocked,
          animationEnabled: true,
          lazy: true,
          lazyPreloadDistance: 1,
          lazyPlaceholder: Placeholder,
          sceneStyle: styles.scene,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
        }}
        listeners={{
          tabPress: ({ target }) => onRouteChange?.(target),
        }}
      >
        {order.map((name) => {
          const tab = TABS.find((item) => item.name === name) || TABS[0];
          return (
            <Tab.Screen
              key={tab.name}
              name={tab.name}
              component={tab.component}
              options={{
                tabBarLabel: tab.label,
                tabBarIcon: ({ color }) => <Glyph name={tab.glyph} color={color} />,
              }}
            />
          );
        })}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

/** Shown for the split second a lazily-mounted section needs to render. */
function Placeholder() {
  return <View style={styles.placeholder} />;
}

const styles = themedStyles({
  scene: { backgroundColor: colors.background },
  placeholder: { flex: 1, backgroundColor: colors.background },
});
