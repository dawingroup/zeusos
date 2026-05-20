/**
 * Platform detection utilities for cross-browser extension support
 */

// Note: @types/chrome not installed; `chrome` is shimmed as `any` in src/vite-env.d.ts

export type Platform = 'chrome' | 'safari-macos' | 'safari-ios' | 'firefox' | 'edge';

declare const browser: typeof chrome | undefined;

/**
 * Detect the current browser platform
 */
export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  
  // Firefox has browser.runtime.getBrowserInfo
  if (typeof browser !== 'undefined' && 'getBrowserInfo' in (browser?.runtime || {})) {
    return 'firefox';
  }
  
  // Edge detection
  if (/Edg\//.test(ua)) {
    return 'edge';
  }
  
  // Safari detection (Safari doesn't have Chrome in UA)
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    // iOS/iPadOS detection
    if (/iPad|iPhone|iPod/.test(ua) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      return 'safari-ios';
    }
    return 'safari-macos';
  }
  
  return 'chrome';
}

/**
 * Check if running in Safari (macOS or iOS)
 */
export function isSafari(): boolean {
  const platform = detectPlatform();
  return platform === 'safari-macos' || platform === 'safari-ios';
}

/**
 * Check if running on iOS/iPadOS
 */
export function isIOS(): boolean {
  return detectPlatform() === 'safari-ios';
}

/**
 * Check if running on a touch device
 */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Get browser API object (handles chrome vs browser namespace)
 */
export function getBrowserAPI(): typeof chrome {
  if (typeof browser !== 'undefined') {
    return browser as typeof chrome;
  }
  return chrome;
}

/**
 * Platform capabilities
 */
export interface PlatformCapabilities {
  hasIdentityAPI: boolean;
  hasCookieChangeEvents: boolean;
  hasNotificationsAPI: boolean;
  hasWebRequestAPI: boolean;
  supportsOffscreen: boolean;
  supportsNativeMessaging: boolean;
}

/**
 * Get capabilities for current platform
 */
export function getPlatformCapabilities(): PlatformCapabilities {
  const platform = detectPlatform();
  
  switch (platform) {
    case 'safari-ios':
      return {
        hasIdentityAPI: false,
        hasCookieChangeEvents: false,
        hasNotificationsAPI: false,
        hasWebRequestAPI: false,
        supportsOffscreen: false,
        supportsNativeMessaging: true, // Via app extension
      };
    
    case 'safari-macos':
      return {
        hasIdentityAPI: false,
        hasCookieChangeEvents: false,
        hasNotificationsAPI: false,
        hasWebRequestAPI: true, // Limited support
        supportsOffscreen: false,
        supportsNativeMessaging: true,
      };
    
    case 'firefox':
      return {
        hasIdentityAPI: true,
        hasCookieChangeEvents: true,
        hasNotificationsAPI: true,
        hasWebRequestAPI: true,
        supportsOffscreen: false,
        supportsNativeMessaging: true,
      };
    
    case 'chrome':
    case 'edge':
    default:
      return {
        hasIdentityAPI: true,
        hasCookieChangeEvents: true,
        hasNotificationsAPI: true,
        hasWebRequestAPI: true,
        supportsOffscreen: true,
        supportsNativeMessaging: true,
      };
  }
}
