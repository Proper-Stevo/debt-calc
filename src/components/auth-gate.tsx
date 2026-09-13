import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  hasPin,
  setPin,
  clearPin,
  verifyPin,
  isBiometricAvailable,
  tryBiometricUnlock,
} from '@/lib/auth';
import { clearCards, clearPlanIntroFlag } from '@/lib/storage';
import { AuthContext } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';

type Mode = 'loading' | 'welcome' | 'create' | 'confirm' | 'onboarding' | 'loggedOut' | 'locked' | 'unlocked';

const ONBOARDING_SLIDES = [
  {
    title: 'Add your cards',
    body: "Enter your balances, interest rates, and due dates. That's the only setup you need to do.",
  },
  {
    title: 'Three ways to pay it off',
    body: "Avalanche saves the most money. Snowball clears cards fastest. Nudge helps your score. Not sure which? Just add your cards - we'll suggest one for you.",
  },
  {
    title: 'Follow your plan',
    body: "Each month we'll tell you exactly what to pay and where. Check back anytime on the Plan tab.",
  },
];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('loading');
  const [input, setInput] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  useEffect(() => {
    (async () => {
      const pinExists = await hasPin();
      if (!pinExists) {
        setMode('welcome');
        return;
      }
      const bioAvailable = await isBiometricAvailable();
      setBiometricAvailable(bioAvailable);
      setMode('loggedOut');
    })();
  }, []);

  // On the web build, the outer WebPasswordGate is already the privacy layer
  // for testers. expo-secure-store and expo-local-authentication (PIN storage
  // and Face ID) don't reliably work inside a browser, so rather than risk a
  // tester getting stuck behind a broken PIN screen, web skips this entirely
  // and goes straight in. Native iOS/Android are completely unaffected -
  // they still get the full PIN + biometric flow exactly as before. This check
  // runs after all hooks are declared, so it doesn't break React's rules of hooks.
  if (Platform.OS === 'web') {
    return <AuthContext.Provider value={{ lock: () => {}, resetApp: async () => {} }}>{children}</AuthContext.Provider>;
  }

  async function attemptBiometric() {
    const success = await tryBiometricUnlock();
    if (success) setMode('unlocked');
  }

  function handleCreateSubmit() {
    if (input.length < 4) {
      Alert.alert('PIN too short', 'Please enter at least 4 digits.');
      return;
    }
    setFirstPin(input);
    setInput('');
    setMode('confirm');
  }

  async function handleConfirmSubmit() {
    if (input !== firstPin) {
      Alert.alert('PINs don\u2019t match', 'Please try again.');
      setInput('');
      setMode('create');
      setFirstPin('');
      return;
    }
    await setPin(input);
    setInput('');
    setOnboardingStep(0);
    setMode('onboarding');
  }

  async function handleUnlockSubmit() {
    const correct = await verifyPin(input);
    if (correct) {
      setInput('');
      setMode('unlocked');
    } else {
      Alert.alert('Incorrect PIN', 'Please try again.');
      setInput('');
    }
  }

  function logOut() {
    setInput('');
    setMode('loggedOut');
  }

  function goToLogin() {
    setMode('locked');
    if (biometricAvailable) attemptBiometric();
  }

  async function resetApp() {
    await clearPin();
    await clearCards();
    await clearPlanIntroFlag();
    setInput('');
    setFirstPin('');
    setBiometricAvailable(false);
    setMode('welcome');
  }

  function confirmNewUser() {
    Alert.alert(
      'Start as a new user?',
      'This will clear your saved cards and let you set a new PIN.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start fresh', onPress: resetApp },
      ]
    );
  }

  if (mode === 'loading') return null;

  if (mode === 'unlocked') {
    return <AuthContext.Provider value={{ lock: logOut, resetApp }}>{children}</AuthContext.Provider>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {mode === 'welcome' && (
        <>
          <Text style={[styles.brand, { color: theme.textMuted }]}>Nudge</Text>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Pay off your credit card debt, faster</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Track your cards, compare payoff strategies, and see exactly when
            you&apos;ll be debt-free. Everything stays on your device.
          </Text>
          <Text style={[styles.disclaimer, { color: theme.disclaimerText }]}>
            This app gives general estimates based on info you enter and public
            research - not financial or credit advice.
          </Text>
          <Pressable style={[styles.button, { backgroundColor: theme.accent }]} onPress={() => setMode('create')}>
            <Text style={styles.buttonText}>Get started</Text>
          </Pressable>
        </>
      )}

      {mode === 'create' && (
        <>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Set up a PIN</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            You&apos;ll be storing sensitive info here, like your card balances
            and interest rates. A PIN keeps it private to you.
          </Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
            value={input}
            onChangeText={setInput}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            autoFocus
            placeholderTextColor={theme.textFaint}
          />
          <Pressable style={[styles.button, { backgroundColor: theme.accent }]} onPress={handleCreateSubmit}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </>
      )}

      {mode === 'confirm' && (
        <>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Confirm your PIN</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
            value={input}
            onChangeText={setInput}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            autoFocus
            placeholderTextColor={theme.textFaint}
          />
          <Pressable style={[styles.button, { backgroundColor: theme.accent }]} onPress={handleConfirmSubmit}>
            <Text style={styles.buttonText}>Confirm</Text>
          </Pressable>
        </>
      )}

      {mode === 'onboarding' && (
        <>
          <View style={styles.dotsRow}>
            {ONBOARDING_SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: theme.border },
                  i === onboardingStep && { backgroundColor: theme.accent, width: 20 },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{ONBOARDING_SLIDES[onboardingStep].title}</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{ONBOARDING_SLIDES[onboardingStep].body}</Text>
          <Pressable
            style={[styles.button, { backgroundColor: theme.accent }]}
            onPress={() => {
              if (onboardingStep < ONBOARDING_SLIDES.length - 1) {
                setOnboardingStep(onboardingStep + 1);
              } else {
                setMode('unlocked');
              }
            }}
          >
            <Text style={styles.buttonText}>
              {onboardingStep < ONBOARDING_SLIDES.length - 1 ? 'Next' : 'Get started'}
            </Text>
          </Pressable>
        </>
      )}

      {mode === 'loggedOut' && (
        <>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Welcome to Nudge</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>Are you a returning user, or starting fresh?</Text>
          <Pressable style={[styles.button, { backgroundColor: theme.accent }]} onPress={goToLogin}>
            <Text style={styles.buttonText}>I&apos;m returning</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, { borderColor: theme.border }]} onPress={confirmNewUser}>
            <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>I&apos;m new / start fresh</Text>
          </Pressable>
        </>
      )}

      {mode === 'locked' && (
        <>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Enter your PIN</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardInnerBackground, color: theme.textPrimary }]}
            value={input}
            onChangeText={setInput}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            autoFocus
            placeholderTextColor={theme.textFaint}
          />
          <Pressable style={[styles.button, { backgroundColor: theme.accent }]} onPress={handleUnlockSubmit}>
            <Text style={styles.buttonText}>Unlock</Text>
          </Pressable>
          {biometricAvailable && (
            <Pressable style={styles.linkButton} onPress={attemptBiometric}>
              <Text style={[styles.linkButtonText, { color: theme.textSecondary }]}>Use Face ID instead</Text>
            </Pressable>
          )}
          <Pressable style={styles.linkButton} onPress={confirmNewUser}>
            <Text style={[styles.linkButtonText, { color: theme.textSecondary }]}>Forgot PIN? Start over</Text>
          </Pressable>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  brand: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  disclaimer: { fontSize: 11, textAlign: 'center', marginBottom: 20, lineHeight: 15 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 16,
  },
  button: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '500' },
  linkButton: { marginTop: 16, alignItems: 'center' },
  linkButtonText: { fontSize: 14 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 20 },
});