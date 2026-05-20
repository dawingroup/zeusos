import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, startTransition } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Returns the current authenticated Firebase uid, or 'unknown-user' as a
 * traceable fallback. Use this anywhere a service expects a userId string —
 * prefer this over hard-coded placeholders like 'current-user', so audit
 * trails stay correct and pre-auth writes are identifiable.
 */
export const useCurrentUserId = () => {
  const { user } = useAuth();
  return user?.uid ?? 'unknown-user';
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug('[auth] AuthProvider: setting up auth state listener');
    }

    // Check for redirect result first
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          if (import.meta.env.DEV) {
            console.debug('[auth] Redirect sign-in successful:', result.user.email);
          }
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            localStorage.setItem('googleAccessToken', credential.accessToken);
          }
        }
      })
      .catch((error) => {
        console.error('Redirect result error:', error);
        // Ensure loading is set to false even on error
        setTimeout(() => {
          startTransition(() => {
            setLoading(false);
          });
        }, 0);
      });
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (import.meta.env.DEV) {
        console.debug('[auth] Auth state changed:', currentUser ? currentUser.email : 'No user');
      }

      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          // Use setTimeout to defer state updates and prevent Suspense errors during navigation
          setTimeout(() => {
            startTransition(() => {
              setUser(currentUser);
              setAccessToken(token);
              setLoading(false);
            });
          }, 0);
          if (import.meta.env.DEV) {
            console.debug('[auth] User signed in:', currentUser.email);
          }
        } catch (error) {
          console.error('Error getting access token:', error);
          setTimeout(() => {
            startTransition(() => {
              setLoading(false);
            });
          }, 0);
        }
      } else {
        localStorage.removeItem('googleAccessToken');
        setTimeout(() => {
          startTransition(() => {
            setUser(null);
            setAccessToken(null);
            setLoading(false);
          });
        }, 0);
        if (import.meta.env.DEV) {
          console.debug('[auth] User signed out');
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      setLoading(true);
      if (import.meta.env.DEV) {
        console.debug('[auth] Attempting Google sign-in with popup…');
      }

      // Use popup for authentication
      const result = await signInWithPopup(auth, googleProvider);
      if (import.meta.env.DEV) {
        console.debug('[auth] Sign-in successful:', result.user.email);
      }

      // Get the Google OAuth access token for Drive API calls
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('googleAccessToken', credential.accessToken);
        if (import.meta.env.DEV) {
          console.debug('[auth] Google access token stored for Drive API');
        }
      }
      
      return result.user;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Handle specific error cases
      if (error.code === 'auth/popup-closed-by-user') {
        if (import.meta.env.DEV) console.debug('[auth] Popup was closed by user');
      } else if (error.code === 'auth/popup-blocked') {
        if (import.meta.env.DEV) console.debug('[auth] Popup blocked; trying redirect instead');
        await signInWithRedirect(auth, googleProvider);
      } else if (error.code === 'auth/unauthorized-domain') {
        alert(`Domain not authorized: ${window.location.origin}. Please contact support.`);
      } else if (error.code === 'auth/cancelled-popup-request') {
        if (import.meta.env.DEV) console.debug('[auth] Popup request cancelled');
      }

      setTimeout(() => {
        startTransition(() => {
          setLoading(false);
        });
      }, 0);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('googleAccessToken');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }, []);

  const getGoogleAccessToken = useCallback(() => {
    return localStorage.getItem('googleAccessToken');
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    accessToken,
    signInWithGoogle,
    logout,
    signOut: logout, // Alias for compatibility
    getGoogleAccessToken,
    isAuthenticated: !!user
  }), [user, loading, accessToken, signInWithGoogle, logout, getGoogleAccessToken]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
