import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createContext, useContext, useMemo } from 'react';
import { View } from 'react-native';
import { useSwipeLock } from '../context/SwipeLockContext';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { themedStyles, colors, navigationTheme } from '../theme/theme';
import { BottomTabBar } from './BottomTabBar';
import RoutinesScreen from '../screens/RoutinesScreen';
import { HOME_TAB, PRIMARY_TAB_NAMES, TABS } from './tabs';

const Stack = createNativeStackNavigator();
const Tab = createMaterialTopTabNavigator();
const RouteChangeContext = createContext(() => {});
const PRIMARY_NAVIGATOR_ROUTE = 'Principal';

/**
 * Four swipeable primary pages live inside a native stack. Secondary destinations are
 * pushed above them, so a horizontal page gesture can never land on Settings or a module.
 */
export default function RootNavigator({ initialRouteName = HOME_TAB, initialPrimaryRouteName = HOME_TAB, onRouteChange }) {
  const navigationRef = useNavigationContainerRef();
  const { revision } = useTheme();
  const { settings } = useAppData();
  const reduceMotion = settings?.reduceMotion === true;
  const theme = useMemo(
    () => ({ ...navigationTheme, colors: { ...navigationTheme.colors }, revision }),
    [revision],
  );
  const isPrimaryRoute = PRIMARY_TAB_NAMES.includes(initialRouteName);
  const isSecondaryRoute = !isPrimaryRoute && TABS.some((tab) => tab.name === initialRouteName);
  const primaryRoute = PRIMARY_TAB_NAMES.includes(initialPrimaryRouteName) ? initialPrimaryRouteName : HOME_TAB;
  const openRestoredSecondaryRoute = () => {
    if (isSecondaryRoute) navigationRef.navigate(initialRouteName);
  };

  return (
    <NavigationContainer ref={navigationRef} theme={theme} onReady={openRestoredSecondaryRoute}>
      <RouteChangeContext.Provider value={onRouteChange}>
        <Stack.Navigator
          initialRouteName={PRIMARY_NAVIGATOR_ROUTE}
          screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'default', contentStyle: styles.scene }}
        >
          <Stack.Screen
            name={PRIMARY_NAVIGATOR_ROUTE}
            component={PrimaryTabNavigator}
            initialParams={{ initialRouteName: isPrimaryRoute ? initialRouteName : primaryRoute }}
            options={{ headerShown: false }}
          />
          {TABS.filter((tab) => !PRIMARY_TAB_NAMES.includes(tab.name)).map((tab) => (
            <Stack.Screen
              key={tab.name}
              name={tab.name}
              component={tab.component}
              listeners={{ focus: () => onRouteChange?.(tab.name) }}
              options={{ headerShown: false }}
            />
          ))}
          <Stack.Screen
            name="Mi rutina"
            component={RoutinesScreen}
            listeners={{ focus: () => onRouteChange?.('Mi rutina') }}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </RouteChangeContext.Provider>
    </NavigationContainer>
  );
}

function PrimaryTabNavigator({ route }) {
  const { locked } = useSwipeLock();
  const onRouteChange = useContext(RouteChangeContext);
  const requestedRoute = route.params?.initialRouteName;
  const initialRouteName = PRIMARY_TAB_NAMES.includes(requestedRoute) ? requestedRoute : HOME_TAB;

  return (
    <Tab.Navigator
      initialRouteName={initialRouteName}
      backBehavior="history"
      tabBarPosition="bottom"
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        swipeEnabled: !locked,
        animationEnabled: false,
        lazy: true,
        lazyPreloadDistance: 1,
        lazyPlaceholder: Placeholder,
        sceneStyle: styles.scene,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      {TABS.filter((tab) => PRIMARY_TAB_NAMES.includes(tab.name)).map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          listeners={{ focus: () => onRouteChange?.(tab.name) }}
          options={{ title: tab.label }}
        />
      ))}
    </Tab.Navigator>
  );
}

/** Shown for the brief moment before a lazily mounted page is ready. */
function Placeholder() {
  return <View style={styles.placeholder} />;
}

const styles = themedStyles({
  scene: { backgroundColor: colors.background },
  placeholder: { flex: 1, backgroundColor: colors.background },
});
