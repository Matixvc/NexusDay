import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { AppDataProvider, useAppData } from './src/context/AppDataContext';
import { ThemeProvider, useAccentTheme } from './src/context/ThemeContext';
import OnboardingScreen from './src/screens/OnboardingScreen';
import RootNavigator from './src/navigation/RootNavigator';
import { HOME_TAB } from './src/navigation/tabs';
import { setTabHidden, tabSignature } from './src/services/tabs';
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
          <StatusBar style="light" />
          <AppShell />
        </AppDataProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
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
      key={`${revision}|${tabSignature(tabConfig)}`}
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

