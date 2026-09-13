import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AuthGate from '@/components/auth-gate';
import WebPasswordGate from '@/components/web-password-gate';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
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