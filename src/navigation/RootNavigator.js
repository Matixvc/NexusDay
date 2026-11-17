import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { View } from 'react-native';
import { useMemo } from 'react';
import { themedStyles, colors, navigationTheme } from '../theme/theme';
import { BottomTabBar } from './BottomTabBar';
import { TABS, HOME_TAB } from './tabs';
import { useTheme } from '../context/ThemeContext';

const Tab = createMaterialTopTabNavigator();

/**
 * Main navigation.
 *
 * The custom bottom bar exposes three destinations. All historical routes remain registered
 * for focused flows and legacy links, while paging is disabled so secondary routes cannot
 * appear through an accidental horizontal swipe.
 *
 * The navigator subscribes to the theme revision so that `NavigationContainer` receives a
 * fresh `theme` reference whenever the accent or surface changes. The navigator itself is
 * never unmounted by a theme change, so the user stays on the same screen and keeps their
 * scroll position.
 */
export default function RootNavigator({ initialRouteName = HOME_TAB, onRouteChange }) {
  // Theme changes repaint styles in place, but NavigationContainer needs a new theme
  // reference to refresh its internal context. We force a re-render on revision change
  // without unmounting the navigator.
  const { revision } = useTheme();
  const theme = useMemo(
    () => ({
      ...navigationTheme,
      colors: { ...navigationTheme.colors },
      revision,
    }),
    [revision],
  );

  return (
    <NavigationContainer theme={theme}>
      <Tab.Navigator
        initialRouteName={TABS.some((tab) => tab.name === initialRouteName) ? initialRouteName : HOME_TAB}
        tabBarPosition="bottom"
        tabBar={(props) => <BottomTabBar {...props} />}
        screenOptions={{
          swipeEnabled: false,
          animationEnabled: true,
          lazy: true,
          lazyPreloadDistance: 1,
          lazyPlaceholder: Placeholder,
          sceneStyle: styles.scene,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
        }}
      >
        {TABS.map((tab) => (
          <Tab.Screen
            key={tab.name}
            name={tab.name}
            component={tab.component}
            listeners={{ focus: () => onRouteChange?.(tab.name) }}
            options={{ title: tab.label }}
          />
        ))}
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
