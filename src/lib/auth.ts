import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const PIN_KEY = 'user_pin';

// Check if a PIN has been set up before (determines create-PIN vs unlock flow).
export async function hasPin(): Promise<boolean> {
  const pin = await SecureStore.getItemAsync(PIN_KEY);
  return pin !== null;
}

// Save a new PIN (used during first-time setup).
export async function setPin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

// Remove the saved PIN entirely (used when starting over as a new user).
export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
}

// Check if an entered PIN matches the saved one.
export async function verifyPin(pin: string): Promise<boolean> {
  const savedPin = await SecureStore.getItemAsync(PIN_KEY);
  return savedPin === pin;
}

// Check whether this device supports Face ID / Touch ID / fingerprint,
// and whether the user has actually enrolled it in their device settings.
export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

// Prompt the system Face ID / Touch ID dialog. Returns true if it succeeded.
export async function tryBiometricUnlock(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock CreditHelper',
    fallbackLabel: 'Use PIN',
  });
  return result.success;
}