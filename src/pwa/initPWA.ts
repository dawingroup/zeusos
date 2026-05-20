/**
 * PWA Initialization
 * Register service worker and initialize PWA features
 */

import { register as registerSW } from '@/subsidiaries/advisory/matflow/services/serviceWorkerRegistration';

export function initPWA(): void {
  // Only register in production or if explicitly enabled
  const enableSW = import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW === 'true';
  
  if (!enableSW) {
    console.log('[PWA] Service worker disabled in development');
    return;
  }

  registerSW({
    onSuccess: (registration) => {
      console.log('[PWA] Service worker registered successfully');
      console.log('[PWA] Scope:', registration.scope);
    },
    onUpdate: (registration) => {
      console.log('[PWA] New content available, please refresh');
      
      // Dispatch event for UI to handle
      window.dispatchEvent(
        new CustomEvent('sw-update-available', { detail: registration })
      );
    },
    onOffline: () => {
      console.log('[PWA] App is running offline');
      window.dispatchEvent(new CustomEvent('app-offline'));
    },
    onOnline: () => {
      console.log('[PWA] App is back online');
      window.dispatchEvent(new CustomEvent('app-online'));
    },
  });
}

/**
 * Check if app is running as installed PWA
 */
export function isInstalledPWA(): boolean {
  // Check display-mode media query
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  // Check iOS standalone
  const isIOSStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  
  return isStandalone || isIOSStandalone;
}

/**
 * Get PWA display mode
 */
export function getDisplayMode(): 'browser' | 'standalone' | 'minimal-ui' | 'fullscreen' {
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return 'fullscreen';
  }
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return 'standalone';
  }
  if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    return 'minimal-ui';
  }
  return 'browser';
}

export default initPWA;
