import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { View } from 'react-native';
import { themedStyles, colors, navigationTheme } from '../theme/theme';
import AssistantScreen from '../screens/AssistantScreen';
import BirthdaysScreen from '../screens/BirthdaysScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import HabitsScreen from '../screens/HabitsScreen';
import HomeScreen from '../screens/HomeScreen';
import NotesScreen from '../screens/NotesScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { BottomTabBar } from './BottomTabBar';
import { Glyph } from './TabGlyphs';

const Tab = createMaterialTopTabNavigator();

/**
 * Main navigation.
 *
 * `createMaterialTopTabNavigator` gives real horizontal swiping (it is backed by
 * `react-native-pager-view`, already a dependency) between every section, while the
 * custom `BottomTabBar` keeps the bottom-bar look of the app and applies the safe-area
 * insets. Pages render lazily, one neighbour preloaded on each side so swiping feels
 * instant without mounting all nine screens on launch.
 */
export default function RootNavigator({ initialRouteName = 'Inicio', onRouteChange }) {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        initialRouteName={initialRouteName}
        tabBarPosition="bottom"
        tabBar={(props) => <BottomTabBar {...props} />}
        screenOptions={{
          swipeEnabled: true,
          animationEnabled: true,
          lazy: true,
          lazyPreloadDistance: 1,
          lazyPlaceholder: Placeholder,
          sceneStyle: styles.scene,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
        }}
        listeners={{
          // Lets the app shell remember the last tab, so remounting (an accent change)
          // puts the user back where they were instead of on Inicio.
          tabPress: ({ target }) => onRouteChange?.(target),
        }}
      >
        <Tab.Screen
          name="Inicio"
          component={HomeScreen}
          options={{ tabBarLabel: 'Inicio', tabBarIcon: ({ color }) => <Glyph name="home" color={color} /> }}
        />
        <Tab.Screen
          name="Horario"
          component={ScheduleScreen}
          options={{ tabBarLabel: 'Horario', tabBarIcon: ({ color }) => <Glyph name="schedule" color={color} /> }}
        />
        <Tab.Screen
          name="Agenda"
          component={CalendarScreen}
          options={{ tabBarLabel: 'Agenda', tabBarIcon: ({ color }) => <Glyph name="calendar" color={color} /> }}
        />
        <Tab.Screen
          name="Cumpleaños"
          component={BirthdaysScreen}
          options={{ tabBarLabel: 'Cumple', tabBarIcon: ({ color }) => <Glyph name="birthdays" color={color} /> }}
        />
        <Tab.Screen
          name="Notas"
          component={NotesScreen}
          options={{ tabBarLabel: 'Notas', tabBarIcon: ({ color }) => <Glyph name="notes" color={color} /> }}
        />
        {/* Secondary pages, now with their own slot in the bar (one tap or one swipe away). */}
        <Tab.Screen
          name="Hábitos"
          component={HabitsScreen}
          options={{ tabBarLabel: 'Hábitos', tabBarIcon: ({ color }) => <Glyph name="habit" color={color} /> }}
        />
        <Tab.Screen
          name="Gastos"
          component={ExpensesScreen}
          options={{ tabBarLabel: 'Gastos', tabBarIcon: ({ color }) => <Glyph name="money" color={color} /> }}
        />
        <Tab.Screen
          name="Nexus AI"
          component={AssistantScreen}
          options={{ tabBarLabel: 'Nexus AI', tabBarIcon: ({ color }) => <Glyph name="ai" color={color} /> }}
        />
        <Tab.Screen
          name="Ajustes"
          component={SettingsScreen}
          options={{ tabBarLabel: 'Ajustes', tabBarIcon: ({ color }) => <Glyph name="settings" color={color} /> }}
        />
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
