import { useState, useEffect, useCallback } from 'react';

interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  isSigningIn: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing user from storage on mount
  useEffect(() => {
    chrome.storage.local
      .get(['user'])
      .then((result: any) => {
        if (result.user) {
          setUser(result.user);
        }
      })
      .catch((err: any) => {
        console.error('Failed to load user from storage:', err);
        setError('Failed to load auth state');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Listen for storage changes so the popup picks up the user
  // even if the popup was closed and reopened during sign-in
  useEffect(() => {
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.user) {
        const newUser = changes.user.newValue ?? null;
        setUser(newUser);
        if (newUser) {
          setIsSigningIn(false);
          setError(null);
        }
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  const signIn = useCallback(async () => {
    // Clear previous error before retrying
    setError(null);
    setIsSigningIn(true);

    try {
      // Delegate to the service worker so the OAuth flow survives
      // even if this popup closes when the auth window opens
      const result = await chrome.runtime.sendMessage({ type: 'SIGN_IN' });

      if (result?.success && result.user) {
        setUser(result.user as User);
      } else if (result?.error) {
        setError(result.error);
      }
    } catch (err) {
      console.error('Sign in failed:', err);
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'SIGN_OUT' });
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  }, []);

  return { user, isLoading, isSigningIn, error, signIn, signOut };
}
