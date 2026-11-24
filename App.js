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
import { HOME_TAB, PRIMARY_TAB_NAMES } from './src/navigation/tabs';
import { tabOrderSignature } from './src/services/tabs';
import { configureNotifications } from './src/services/notifications';
import { themedStyles, colors, spacing, typography } from './src/theme/theme';
import { useFonts } from './src/hooks/useFonts';

enableScreens();

// Register the foreground notification handler before anything can be scheduled.
configureNotifications();

/** Nombre configurado en app.json, para que los textos sigan un rename sin tocar código. */
const APP_NAME = Constants.expoConfig?.name || 'NexusDay';

export default function App() {
  const { fontsLoaded } = useFonts();

  // Mientras las fuentes no cargan, se muestra una pantalla de carga mínima
  // para evitar que el texto parpadee entre la fuente del sistema y Manrope.
  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={styles.fontLoading}>
          <Text style={styles.fontLoadingText}>{APP_NAME.slice(0, 1)}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

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
  const { onboardingCompleted, tutorialReplay, finishTutorial, tabConfig } = useAppData();
  // Remembered so any navigator remount lands on the same registered route.
  const [lastRoute, setLastRoute] = useState(HOME_TAB);
  const [lastPrimaryRoute, setLastPrimaryRoute] = useState(HOME_TAB);

  const onRouteChange = useCallback((name) => {
    setLastRoute((previous) => (previous === name ? previous : name));
    if (PRIMARY_TAB_NAMES.includes(name)) setLastPrimaryRoute((previous) => (previous === name ? previous : name));
  }, []);

  if (onboardingCompleted === null) return <BootScreen />;

  if (!onboardingCompleted) {
    return <OnboardingScreen firstRun={!tutorialReplay} onFinish={finishTutorial} />;
  }

  return (
    <RootNavigator
      // The normalized legacy signature is stable for the fixed three-section layout.
      key={tabOrderSignature(tabConfig)}
      initialRouteName={lastRoute}
      initialPrimaryRouteName={lastPrimaryRoute}
      onRouteChange={onRouteChange}
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
  fontLoading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  fontLoadingText: { fontSize: 40, fontWeight: '800', color: colors.accent },
});

