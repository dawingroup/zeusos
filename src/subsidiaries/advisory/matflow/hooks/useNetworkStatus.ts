/**
 * Network Status Hook
 * Detect and monitor network connectivity
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { NetworkState } from '../types/offline';
import { goOffline, goOnline } from '../services/offlineConfig';

const PING_URL = 'https://www.google.com/favicon.ico';
const PING_TIMEOUT = 5000;
const SLOW_THRESHOLD = 2000; // Consider "slow" if ping > 2s

interface UseNetworkStatusOptions {
  pingInterval?: number;
  enablePing?: boolean;
}

export function useNetworkStatus(options: UseNetworkStatusOptions = {}) {
  const { pingInterval = 30000, enablePing = true } = options;
  
  const [state, setState] = useState<NetworkState>({
    status: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
    lastOnlineAt: typeof navigator !== 'undefined' && navigator.onLine ? new Date() : null,
    lastOfflineAt: typeof navigator !== 'undefined' && navigator.onLine ? null : new Date(),
    connectionQuality: 'unknown',
    isMetered: false,
  });

  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check connection quality with ping
  const checkConnectionQuality = useCallback(async (): Promise<{
    quality: 'good' | 'poor' | 'unknown';
    latency: number;
  }> => {
    if (typeof navigator === 'undefined' || !navigator.onLine) {
      return { quality: 'unknown', latency: -1 };
    }

    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT);
      
      await fetch(PING_URL, {
        mode: 'no-cors',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      
      return {
        quality: latency > SLOW_THRESHOLD ? 'poor' : 'good',
        latency,
      };
    } catch {
      return { quality: 'poor', latency: -1 };
    }
  }, []);

  // Check if connection is metered
  const checkMeteredConnection = useCallback((): boolean => {
    if (typeof navigator === 'undefined') return false;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection) {
      return connection.saveData || connection.effectiveType === '2g';
    }
    return false;
  }, []);

  // Handle online event
  const handleOnline = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      status: 'reconnecting',
      lastOnlineAt: new Date(),
    }));

    // Check actual connectivity
    const { quality } = await checkConnectionQuality();
    
    setState((prev) => ({
      ...prev,
      status: quality === 'poor' ? 'slow' : 'online',
      connectionQuality: quality,
      isMetered: checkMeteredConnection(),
    }));
  }, [checkConnectionQuality, checkMeteredConnection]);

  // Handle offline event
  const handleOffline = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: 'offline',
      lastOfflineAt: new Date(),
      connectionQuality: 'unknown',
    }));
  }, []);

  // Periodic connection check
  useEffect(() => {
    if (!enablePing || typeof window === 'undefined') return;

    const runPing = async () => {
      if (navigator.onLine) {
        const { quality } = await checkConnectionQuality();
        setState((prev) => {
          if (prev.status === 'offline') return prev;
          return {
            ...prev,
            status: quality === 'poor' ? 'slow' : 'online',
            connectionQuality: quality,
          };
        });
      }
    };

    pingTimerRef.current = setInterval(runPing, pingInterval);
    
    return () => {
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
      }
    };
  }, [pingInterval, enablePing, checkConnectionQuality]);

  // Listen for network events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also listen for connection changes
    const nav = navigator as Navigator & { connection?: EventTarget };
    const connection = nav.connection;
    if (connection) {
      const handleConnectionChange = () => {
        setState((prev) => ({
          ...prev,
          isMetered: checkMeteredConnection(),
        }));
      };
      connection.addEventListener('change', handleConnectionChange);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', handleConnectionChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline, checkMeteredConnection]);

  // Force offline mode
  const forceOffline = useCallback(async () => {
    await goOffline();
    setState((prev) => ({
      ...prev,
      status: 'offline',
      lastOfflineAt: new Date(),
    }));
  }, []);

  // Force online mode
  const forceOnline = useCallback(async () => {
    await goOnline();
    handleOnline();
  }, [handleOnline]);

  return {
    ...state,
    isOnline: state.status === 'online' || state.status === 'slow',
    isOffline: state.status === 'offline',
    isSlow: state.status === 'slow',
    isReconnecting: state.status === 'reconnecting',
    forceOffline,
    forceOnline,
    checkConnection: checkConnectionQuality,
  };
}

export default useNetworkStatus;
