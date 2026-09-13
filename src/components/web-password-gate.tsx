import { useState, ReactNode } from 'react';
import { Platform, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme';

// Simple soft gate for the WEB build only, so friends/family testers need a
// shared passcode before seeing the app. This is NOT real security - it's a
// basic filter to keep the test link from being casually stumbled into by
// strangers, since everything behind it is general, non-sensitive info.
// Native (iOS/Android via Expo Go) is completely unaffected by this file.

const TEST_PASSCODE = 'nudge2026'; // change this to whatever you want testers to type
const SESSION_KEY = 'nudge_web_unlocked';

export default function WebPasswordGate({ children }: { children: ReactNode }) {
  const theme = useTheme();

  // Only ever gate the web build. Native apps skip this entirely.
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  const alreadyUnlocked =
    typeof window !== 'undefined' && window.sessionStorage?.getItem(SESSION_KEY) === 'true';

  const [unlocked, setUnlocked] = useState(alreadyUnlocked);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  function handleSubmit() {
    if (input.trim() === TEST_PASSCODE) {
      window.sessionStorage?.setItem(SESSION_KEY, 'true');
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  }

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Nudge</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        This is a private test version. Enter the passcode your friend shared with you to continue.
      </Text>
      <TextInput
        style={[
          styles.input,
          { borderColor: theme.accentBorder, color: theme.textPrimary, backgroundColor: theme.cardInnerBackground },
        ]}
        value={input}
        onChangeText={(text) => {
          setInput(text);
          setError(false);
        }}
        placeholder="Passcode"
        placeholderTextColor={theme.textFaint}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={handleSubmit}
      />
      {error && <Text style={styles.errorText}>That passcode didn&apos;t work. Try again.</Text>}
      <Pressable style={[styles.button, { backgroundColor: theme.accent }]} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24, maxWidth: 320 },
  input: {
    width: '100%',
    maxWidth: 280,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 8,
  },
  errorText: { color: '#e24b4a', fontSize: 13, marginBottom: 12 },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});