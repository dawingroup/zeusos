/**
 * Adobe Token Manager
 *
 * Handles token caching, refresh, and expiration for Adobe APIs.
 *
 * @see docs/ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md for full implementation
 */

interface CachedToken {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

const tokenCache = new Map<string, CachedToken>();

export class AdobeTokenManager {
  private static instance: AdobeTokenManager;

  private constructor() {}

  static getInstance(): AdobeTokenManager {
    if (!AdobeTokenManager.instance) {
      AdobeTokenManager.instance = new AdobeTokenManager();
    }
    return AdobeTokenManager.instance;
  }

  /**
   * Get cached token if valid, otherwise return null
   */
  getCachedToken(service: string): string | null {
    const cached = tokenCache.get(service);
    if (!cached) return null;

    // Check if expired (with 5 minute buffer)
    const bufferMs = 5 * 60 * 1000;
    if (Date.now() >= cached.expiresAt - bufferMs) {
      tokenCache.delete(service);
      return null;
    }

    return cached.accessToken;
  }

  /**
   * Cache a new token
   */
  cacheToken(
    service: string,
    accessToken: string,
    expiresIn: number,
    refreshToken?: string
  ): void {
    tokenCache.set(service, {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
      refreshToken,
    });
  }

  /**
   * Get refresh token for a service
   */
  getRefreshToken(service: string): string | null {
    return tokenCache.get(service)?.refreshToken ?? null;
  }

  /**
   * Clear token for a service
   */
  clearToken(service: string): void {
    tokenCache.delete(service);
  }

  /**
   * Clear all cached tokens
   */
  clearAll(): void {
    tokenCache.clear();
  }
}
