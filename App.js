import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { AppDataProvider, useAppData } from './src/context/AppDataContext';
import { ThemeProvider, useAccentTheme } from './src/context/ThemeContext';
import { SwipeLockProvider } from './src/context/SwipeLockContext';
import OnboardingScreen from './src/screens/OnboardingScreen';
import RootNavigator from './src/navigation/RootNavigator';
import { HOME_TAB } from './src/navigation/tabs';
import { setTabHidden, tabOrderSignature } from './src/services/tabs';
import { configureNotifications } from './src/services/notifications';
import { themedStyles, colors, spacing, typography } from './src/theme/theme';

enableScreens();

// Register the foreground notification handler before anything can be scheduled.
configureNotifications();

/** Nombre configurado en app.json, para que los textos sigan un rename sin tocar código. */
const APP_NAME = Constants.expoConfig?.name || 'NexusDay';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppDataProvider>
          <SwipeLockProvider>
            <AppStatusBar />
            <AppShell />
          </SwipeLockProvider>
        </AppDataProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * The status bar icons follow the surface: light over graphite and pure black, dark over the
 * white mode. `animated={false}` because a theme swap is meant to land in the same frame as
 * the rest of the interface rather than fade into it.
 */
function AppStatusBar() {
  const { statusBar } = useAccentTheme();
  return <StatusBar style={statusBar} animated={false} />;
}

/**
 * Chooses between the first-run tutorial and the app itself.
 *
 * It lives inside both providers on purpose: it reads the onboarding flag from the data
 * context and the accent revision from the theme context, so switching the accent remounts
 * the navigator (fresh styles) while `lastRoute` puts the user back on the tab they left.
 */
function AppShell() {
  const { revision } = useAccentTheme();
  const { onboardingCompleted, tutorialReplay, finishTutorial, tabConfig, setTabConfig } = useAppData();
  // Remembered so a remount (accent change, tab layout change) lands on the same section.
  const [lastRoute, setLastRoute] = useState(HOME_TAB);

  const onRouteChange = useCallback((name) => {
    setLastRoute((previous) => (previous === name ? previous : name));
  }, []);

  const onRevealTab = useCallback(
    (name) => setTabConfig(setTabHidden(tabConfig, name, false)),
    [setTabConfig, tabConfig],
  );

  if (onboardingCompleted === null) return <BootScreen />;

  if (!onboardingCompleted) {
    return <OnboardingScreen firstRun={!tutorialReplay} onFinish={finishTutorial} />;
  }

  return (
    <RootNavigator
      // Only the *order* remounts the navigator. Toggling a visibility switch changes
      // `tabConfig.hidden`, which `BottomTabBar` applies on its own render — so flipping a
      // switch never rebuilds the navigator and never throws the user off Ajustes.
      key={`${revision}|${tabOrderSignature(tabConfig)}`}
      initialRouteName={lastRoute}
      onRouteChange={onRouteChange}
      tabConfig={tabConfig}
      onRevealTab={onRevealTab}
    />
  );
}

/** Shown for the few milliseconds it takes to read the tutorial flag from AsyncStorage. */
function BootScreen() {
  return (
    <View style={styles.boot}>
      <Text style={styles.bootMark}>{APP_NAME.slice(0, 1)}</Text>
      <Text style={styles.bootName}>{APP_NAME}</Text>
      <Text style={typography.caption}>Preparando tu día…</Text>
    </View>
  );
}

const styles = themedStyles({
  boot: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  bootMark: { fontSize: 40, fontWeight: '800', color: colors.accent },
  bootName: { ...typography.title, color: colors.text },
});

