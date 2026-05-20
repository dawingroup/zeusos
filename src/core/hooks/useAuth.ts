/**
 * useAuth Hook
 * Authentication hook for Firebase Auth
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  onAuthChange, 
  signInWithGoogle as firebaseSignIn, 
  signOut as firebaseSignOut,
  getGoogleAccessToken,
  type User 
} from '@/shared/services/firebase';

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export interface UseAuthReturn extends AuthState {
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  getAccessToken: () => string | null;
}

/**
 * Hook for Firebase authentication
 * Returns current user, loading state, and auth methods
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    try {
      setLoading(true);
      const user = await firebaseSignIn();
      return user;
    } catch (error) {
      console.error('Sign in error:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await firebaseSignOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, []);

  const getAccessToken = useCallback((): string | null => {
    return getGoogleAccessToken();
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    signInWithGoogle,
    signOut,
    getAccessToken,
  };
}
