import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { AppDataProvider } from './src/context/AppDataContext';
import RootNavigator from './src/navigation/RootNavigator';
import { configureNotifications } from './src/services/notifications';

enableScreens();

// Register the foreground notification handler before anything can be scheduled.
configureNotifications();

export default function App() {
  return (
    <SafeAreaProvider>
      <AppDataProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AppDataProvider>
    </SafeAreaProvider>
  );
}

