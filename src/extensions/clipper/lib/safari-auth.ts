/**
 * Safari-specific authentication using native app bridge
 * 
 * Safari doesn't support chrome.identity, so we need to use
 * ASWebAuthenticationSession via native messaging to the containing app.
 */

// Note: @types/chrome not installed; `chrome` is shimmed as `any` in src/vite-env.d.ts

import { getBrowserAPI, isSafari } from './platform';

const NATIVE_APP_ID = 'com.dawingroup.clipper';

interface NativeAuthResponse {
  success: boolean;
  token?: string;
  error?: string;
  user?: {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
  };
}

/**
 * Authenticate using Safari's native app bridge
 * This sends a message to the containing iOS/macOS app which handles
 * ASWebAuthenticationSession for Google OAuth
 */
export async function safariAuthenticate(): Promise<NativeAuthResponse> {
  if (!isSafari()) {
    return { success: false, error: 'Not running in Safari' };
  }

  const browserAPI = getBrowserAPI();

  return new Promise((resolve) => {
    try {
      browserAPI.runtime.sendNativeMessage(
        NATIVE_APP_ID,
        { action: 'authenticate', provider: 'google' },
        (response: NativeAuthResponse | undefined) => {
          if (browserAPI.runtime.lastError) {
            resolve({
              success: false,
              error: browserAPI.runtime.lastError.message || 'Native messaging failed',
            });
            return;
          }

          if (!response) {
            resolve({
              success: false,
              error: 'No response from native app',
            });
            return;
          }

          resolve(response);
        }
      );
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

/**
 * Sign out via native app bridge
 */
export async function safariSignOut(): Promise<boolean> {
  if (!isSafari()) {
    return false;
  }

  const browserAPI = getBrowserAPI();

  return new Promise((resolve) => {
    try {
      browserAPI.runtime.sendNativeMessage(
        NATIVE_APP_ID,
        { action: 'signOut' },
        (response: { success: boolean } | undefined) => {
          resolve(response?.success ?? false);
        }
      );
    } catch {
      resolve(false);
    }
  });
}

/**
 * Check if user is authenticated via native app
 */
export async function safariCheckAuth(): Promise<NativeAuthResponse> {
  if (!isSafari()) {
    return { success: false, error: 'Not running in Safari' };
  }

  const browserAPI = getBrowserAPI();

  return new Promise((resolve) => {
    try {
      browserAPI.runtime.sendNativeMessage(
        NATIVE_APP_ID,
        { action: 'checkAuth' },
        (response: NativeAuthResponse | undefined) => {
          if (browserAPI.runtime.lastError || !response) {
            resolve({ success: false, error: 'Auth check failed' });
            return;
          }
          resolve(response);
        }
      );
    } catch {
      resolve({ success: false, error: 'Native messaging unavailable' });
    }
  });
}

/**
 * Fallback: Open auth in new tab (works without native app)
 * User will need to manually complete auth flow
 */
export function openAuthInTab(): void {
  const browserAPI = getBrowserAPI();
  const authURL = buildAuthURL();
  
  browserAPI.tabs.create({ url: authURL });
}

/**
 * Build Google OAuth URL for manual auth flow
 */
function buildAuthURL(): string {
  const clientId = '820903406446-d0nh72b76ep9qtv3t56pu8uuumo9ebc1.apps.googleusercontent.com';
  const redirectUri = 'https://dawinos.web.app/auth/callback';
  const scope = encodeURIComponent('email profile');
  
  return `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=token&` +
    `scope=${scope}`;
}
