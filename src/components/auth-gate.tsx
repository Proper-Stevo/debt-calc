import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
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
  const [mode, setMode] = useState<Mode>('loading');
  const [input, setInput] = useState('');
  const [firstPin, setFirstPin] = useState(''); // holds the PIN during the "confirm" step
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // On mount, figure out which screen to show first.
  useEffect(() => {
    (async () => {
      const pinExists = await hasPin();
      if (!pinExists) {
        setMode('welcome'); // no pin at all - definitely a new user
        return;
      }
      const bioAvailable = await isBiometricAvailable();
      setBiometricAvailable(bioAvailable);
      // A PIN already exists, but we still ask every time rather than assuming -
      // biometric/PIN entry only happens once they choose "Log in".
      setMode('loggedOut');
    })();
  }, []);

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
    setMode('onboarding'); // walk brand-new users through the workflow before dropping them in
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
    setMode('welcome'); // treat this like a genuinely fresh start, intro screen included
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
    <SafeAreaView style={styles.container}>
   {mode === 'welcome' && (
  <>
    <Text style={styles.brand}>Nudge</Text>
    <Text style={styles.title}>Pay off your credit card debt, faster</Text>
    <Text style={styles.subtitle}>
      Track your cards, compare payoff strategies, and see exactly when
      you&apos;ll be debt-free. Everything stays on your device.
    </Text>
    <Text style={styles.disclaimer}>
      This app gives general estimates based on info you enter and public
      research - not financial or credit advice.
    </Text>
    <Pressable style={styles.button} onPress={() => setMode('create')}>
      <Text style={styles.buttonText}>Get started</Text>
    </Pressable>
  </>
)}

      {mode === 'create' && (
        <>
          <Text style={styles.title}>Set up a PIN</Text>
          <Text style={styles.subtitle}>
            You&apos;ll be storing sensitive info here, like your card balances
            and interest rates. A PIN keeps it private to you.
          </Text>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            autoFocus
          />
          <Pressable style={styles.button} onPress={handleCreateSubmit}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </>
      )}

      {mode === 'confirm' && (
        <>
          <Text style={styles.title}>Confirm your PIN</Text>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            autoFocus
          />
          <Pressable style={styles.button} onPress={handleConfirmSubmit}>
            <Text style={styles.buttonText}>Confirm</Text>
          </Pressable>
        </>
      )}

      {mode === 'onboarding' && (
        <>
          <View style={styles.dotsRow}>
            {ONBOARDING_SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === onboardingStep && styles.dotActive]} />
            ))}
          </View>
          <Text style={styles.title}>{ONBOARDING_SLIDES[onboardingStep].title}</Text>
          <Text style={styles.subtitle}>{ONBOARDING_SLIDES[onboardingStep].body}</Text>
          <Pressable
            style={styles.button}
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
          <Text style={styles.brand}>Nudge</Text>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>Are you a returning user, or starting fresh?</Text>
          <Pressable style={styles.button} onPress={goToLogin}>
            <Text style={styles.buttonText}>I&apos;m returning</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={confirmNewUser}>
            <Text style={styles.secondaryButtonText}>I&apos;m new / start fresh</Text>
          </Pressable>
        </>
      )}

      {mode === 'locked' && (
        <>
          <Text style={styles.title}>Enter your PIN</Text>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            autoFocus
          />
          <Pressable style={styles.button} onPress={handleUnlockSubmit}>
            <Text style={styles.buttonText}>Unlock</Text>
          </Pressable>
          {biometricAvailable && (
            <Pressable style={styles.linkButton} onPress={attemptBiometric}>
              <Text style={styles.linkButtonText}>Use Face ID instead</Text>
            </Pressable>
          )}
          <Pressable style={styles.linkButton} onPress={confirmNewUser}>
            <Text style={styles.linkButtonText}>Forgot PIN? Start over</Text>
          </Pressable>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  brand: { fontSize: 15, fontWeight: '600', textAlign: 'center', color: '#888', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  disclaimer: { fontSize: 11, color: '#aaa', textAlign: 'center', marginBottom: 20, lineHeight: 15 },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: { color: '#111', fontSize: 16, fontWeight: '500' },
  linkButton: { marginTop: 16, alignItems: 'center' },
  linkButtonText: { color: '#555', fontSize: 14 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ddd' },
  dotActive: { backgroundColor: '#111', width: 20 },
});