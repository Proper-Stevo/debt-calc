import { createContext, useContext } from 'react';

interface AuthContextValue {
  lock: () => void; // returns to the lock screen (data stays intact)
  resetApp: () => Promise<void>; // wipes PIN + all cards, starts fresh as a new user
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthGate');
  }
  return ctx;
}