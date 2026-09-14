import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AuthGate from '@/components/auth-gate';
import WebPasswordGate from '@/components/web-password-gate';

SplashScreen.preventAutoHideAsync();

// On web, the browser's <html>/<body> background defaults to white and
// stays white regardless of the app's theme. If the app's own root view
// doesn't cover the full viewport (safe-area insets, rounding, etc.), that
// default white peeks through as a thin border. Syncing the real page
// background to the current theme color closes that gap.
function useWebBackgroundSync(backgroundColor: string) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.style.backgroundColor = backgroundColor;
    document.body.style.backgroundColor = backgroundColor;
  }, [backgroundColor]);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useWebBackgroundSync(colorScheme === 'dark' ? '#000000' : '#ffffff');
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <WebPasswordGate>
          <AuthGate>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="add-card" options={{ presentation: 'modal', title: 'Add card' }} />
              <Stack.Screen name="edit-card/[id]" options={{ presentation: 'modal', title: 'Edit card' }} />
              <Stack.Screen name="about" options={{ presentation: 'modal', title: 'About' }} />
            </Stack>
          </AuthGate>
        </WebPasswordGate>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}