import { useColorScheme } from 'react-native';

// Central color palette. Every screen should pull colors from here
// instead of hardcoding hex values, so dark mode works everywhere at once.

const lightColors = {
  background: '#ffffff',
  cardBackground: '#f5f5f5',
  cardInnerBackground: '#ffffff',
  textPrimary: '#111111',
  textSecondary: '#555555',
  textMuted: '#888888',
  textFaint: '#999999',
  border: '#eeeeee',
  accent: '#1a5fb4',
  accentBackground: '#e6f1fb',
  accentBorder: '#c9e0ff',
  success: '#1a7f37',
  disclaimerText: '#aaaaaa',
  scoreMuted: '#8098bd',
};

const darkColors = {
  background: '#000000',
  cardBackground: '#1c1c1e',
  cardInnerBackground: '#2c2c2e',
  textPrimary: '#f2f2f2',
  textSecondary: '#c7c7c7',
  textMuted: '#9a9a9a',
  textFaint: '#8a8a8a',
  border: '#3a3a3c',
  accent: '#4c93e0',
  accentBackground: '#1c2e42',
  accentBorder: '#2f4f70',
  success: '#3ddc65',
  disclaimerText: '#7a7a7a',
  scoreMuted: '#9db3d4',
};

export type Theme = typeof lightColors;

// Call this inside any component to get the right color set for the
// current system appearance. Colors update automatically if the user
// switches modes while the app is open.
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}